import os
import io
import base64
import json
import logging
import tempfile
import secrets
import hashlib
import time
from datetime import datetime, timedelta
from typing import Optional, Any, Union, Dict, List
from sqlalchemy.orm import Session
from database import engine as db_engine, Base, get_db
from models import User, AnalysisRecord

# ── Logging setup (replaces bare print() everywhere) ──────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("clinifusionx")

# ── Load .env ─────────────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()
if "GEMINI_API_KEY" in os.environ and "LLM_API_KEY" not in os.environ:
    os.environ["LLM_API_KEY"] = os.environ["GEMINI_API_KEY"]

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn
from PIL import Image

# ML Modules
from inference import InferenceEngine
from explainability import Explainer
from clinical_extractor import ClinicalExtractor
from report_generator import ReportGenerator
from ccm import ClinicalConsistencyModule, DISEASE_KB
from pdf_exporter import generate_report_pdf

# ── Constants ─────────────────────────────────────────────────────────────────
MAX_IMAGE_SIZE_MB = 15
MAX_PDF_SIZE_MB = 20
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
ALLOWED_PDF_TYPES = {"application/pdf"}

# ── Simple in-memory token store (replace with Redis in production) ──────────────
# Maps token -> {user_id, name, role, department, expires_at}
_token_store: dict[str, dict] = {}

def _hash_password(password: str) -> str:
    """Deterministic SHA-256 hash (replace with bcrypt in production)."""
    return hashlib.sha256(password.encode()).hexdigest()

def _create_token(username: str, db: Session) -> str:
    token = secrets.token_urlsafe(32)
    user = db.query(User).filter(User.username == username).first()
    _token_store[token] = {
        "user_id": username,
        "name": user.name,
        "role": user.role,
        "department": user.department,
        "expires_at": (datetime.utcnow() + timedelta(hours=12)).isoformat(),
    }
    return token

def _validate_token(token: str) -> Optional[dict]:
    record = _token_store.get(token)
    if not record:
        return None
    if datetime.utcnow() > datetime.fromisoformat(record["expires_at"]):
        del _token_store[token]
        return None
    return record

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CliniFusionX API",
    version="1.0.0",
    # Disable Swagger/ReDoc in production via env flag
    docs_url="/docs" if os.getenv("ENABLE_DOCS", "true").lower() == "true" else None,
    redoc_url="/redoc" if os.getenv("ENABLE_DOCS", "true").lower() == "true" else None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS — restrict to known origins ─────────────────────────────────────────
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://localhost:8000"
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Model state ───────────────────────────────────────────────────────────────
engine = None
explainer = None
clinical_extractor = None
report_generator = None
ccm = None
_models_ready = False
_startup_error: Optional[str] = None


@app.on_event("startup")
def load_models():
    global engine, explainer, clinical_extractor, report_generator, ccm
    global _models_ready, _startup_error
    try:
        logger.info("Initializing Database...")
        Base.metadata.create_all(bind=db_engine)
        
        # Ensure new columns exist in existing SQLite databases
        from sqlalchemy import text
        with db_engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE analysis_records ADD COLUMN patient_name VARCHAR"))
                conn.commit()
                logger.info("Added patient_name column to analysis_records")
            except Exception:
                # Column already exists
                pass

        # Seed users if empty
        from database import SessionLocal
        db = SessionLocal()
        if db.query(User).count() == 0:
            db.add(User(username="admin", password_hash=_hash_password("admin123"), name="Dr. Admin", role="Lead Radiologist", department="Thoracic Radiology & AI Clinical Intelligence"))
            db.add(User(username="guest", password_hash=_hash_password("guest"), name="Guest", role="Attending Clinician", department="Thoracic Radiology & AI Clinical Intelligence"))
            db.commit()
        db.close()

        logger.info("Loading Swin Transformer...")
        engine = InferenceEngine()
        explainer = Explainer(engine.model, engine.device)
        logger.info("Loading LLM Modules...")
        clinical_extractor = ClinicalExtractor()
        report_generator = ReportGenerator()
        logger.info("Loading CCM...")
        ccm = ClinicalConsistencyModule()
        _models_ready = True
        logger.info("All models loaded successfully.")
    except Exception as e:
        _startup_error = str(e)
        logger.error(f"FATAL — model startup failed: {e}", exc_info=True)


def _require_models():
    """Dependency — raises 503 if models failed to load."""
    if not _models_ready:
        detail = f"Models not ready. Startup error: {_startup_error}" if _startup_error else "Models are still loading."
        raise HTTPException(status_code=503, detail=detail)


def _require_auth(request: Request) -> dict:
    """Dependency — validates Bearer token from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")
    token = auth_header[len("Bearer "):]
    user = _validate_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token. Please log in again.")
    return user


def _validate_image_upload(image: UploadFile) -> None:
    """Validate image MIME type and size."""
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image type '{image.content_type}'. Allowed: JPEG, PNG, WebP, BMP."
        )


def _validate_pdf_upload(pdf: UploadFile) -> None:
    """Validate PDF MIME type."""
    if pdf.content_type not in ALLOWED_PDF_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{pdf.content_type}'. Only PDF is allowed for clinical documents."
        )


# ── Health & System endpoints ───────────────────────────────────────────────

@app.get("/health", tags=["System"])
@app.get("/api/v1/health", tags=["System"])
async def health_check():
    """System and AI model health check endpoint."""
    return {
        "status": "healthy" if _models_ready else "initializing",
        "models_ready": _models_ready,
        "engine": "Swin Transformer V2",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }


# ── Auth endpoints ────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    password: str
    name: Optional[str] = "Clinician"
    role: Optional[str] = "Attending Clinician"
    department: Optional[str] = "Thoracic Radiology & AI Clinical Intelligence"

@app.post("/api/v1/auth/register", tags=["Auth"])
async def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user profile and return a session token."""
    username = body.username.strip().lower()
    if not username or not body.password:
        raise HTTPException(status_code=400, detail="Username and password are required.")
    
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists. Please choose another username or sign in.")
        
    name = body.name.strip() if body.name and body.name.strip() else f"Dr. {username.capitalize()}"
    role = body.role.strip() if body.role and body.role.strip() else "Attending Clinician"
    dept = body.department.strip() if body.department and body.department.strip() else "Thoracic Radiology & AI Clinical Intelligence"
    
    new_user = User(
        username=username,
        password_hash=_hash_password(body.password),
        name=name,
        role=role,
        department=dept
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    token = _create_token(username, db)
    logger.info(f"User '{username}' registered successfully.")
    return {
        "token": token,
        "user": {
            "id": username,
            "name": new_user.name,
            "role": new_user.role,
            "department": new_user.department,
        }
    }

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/v1/auth/login", tags=["Auth"])
async def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate a user and return a session token."""
    username = body.username.strip().lower()
    user = db.query(User).filter(User.username == username).first()
    if not user or user.password_hash != _hash_password(body.password):
        # Constant-time-like delay to slow brute force
        time.sleep(0.3)
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    token = _create_token(username, db)
    logger.info(f"User '{username}' logged in.")
    return {
        "token": token,
        "user": {
            "id": username,
            "name": user.name,
            "role": user.role,
            "department": user.department,
        }
    }

@app.post("/api/v1/auth/logout", tags=["Auth"])
async def logout(user: dict = Depends(_require_auth)):
    """Invalidate the current session token."""
    # The token is already validated in _require_auth; find and remove it
    request_token = None
    for t, data in list(_token_store.items()):
        if data["user_id"] == user["user_id"]:
            request_token = t
            break
    if request_token:
        del _token_store[request_token]
    logger.info(f"User '{user['user_id']}' logged out.")
    return {"message": "Logged out successfully."}

@app.get("/api/v1/auth/me", tags=["Auth"])
async def get_me(user: dict = Depends(_require_auth)):
    """Return the current authenticated user's profile."""
    return {"user": user}


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None


@app.put("/api/v1/auth/profile", tags=["Auth"])
async def update_profile(
    body: ProfileUpdateRequest,
    user: dict = Depends(_require_auth),
    db: Session = Depends(get_db),
):
    """Update profile details for the authenticated user."""
    db_user = db.query(User).filter(User.username == user["user_id"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if body.name is not None and body.name.strip():
        db_user.name = body.name.strip()
    if body.role is not None and body.role.strip():
        db_user.role = body.role.strip()
    if body.department is not None and body.department.strip():
        db_user.department = body.department.strip()

    db.commit()
    db.refresh(db_user)

    # Synchronize in-memory token store if present
    for token_key, data in _token_store.items():
        if data.get("user_id") == user["user_id"]:
            data["name"] = db_user.name
            data["role"] = db_user.role
            data["department"] = db_user.department

    return {
        "message": "Profile updated successfully.",
        "user": {
            "id": db_user.username,
            "name": db_user.name,
            "role": db_user.role,
            "department": db_user.department,
        },
    }


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@app.post("/api/v1/auth/change-password", tags=["Auth"])
async def change_password(
    body: ChangePasswordRequest,
    user: dict = Depends(_require_auth),
    db: Session = Depends(get_db),
):
    """Change password for the authenticated user."""
    if not body.new_password or len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    db_user = db.query(User).filter(User.username == user["user_id"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if db_user.password_hash != _hash_password(body.current_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    db_user.password_hash = _hash_password(body.new_password)
    db.commit()
    return {"message": "Password updated successfully."}


# ── Firebase Google Sign-In ───────────────────────────────────────────────────

# Initialise firebase-admin once using the service account JSON.
# If the file is absent the endpoint returns a clear error instead of crashing.
_firebase_ready = False
_firebase_project_id = "clinifusionx"
_jwks_client = None

try:
    import firebase_admin
    from firebase_admin import credentials as fb_credentials, auth as fb_auth
    import jwt
    import requests
    import email.utils

    _sa_path = os.path.join(os.path.dirname(__file__), "firebase-service-account.json")
    if not firebase_admin._apps and os.path.exists(_sa_path):
        cred = fb_credentials.Certificate(_sa_path)
        firebase_admin.initialize_app(cred)
        _firebase_ready = True
        try:
            with open(_sa_path, "r", encoding="utf-8") as f:
                sa_data = json.load(f)
                _firebase_project_id = sa_data.get("project_id", _firebase_project_id)
        except Exception:
            pass
        _jwks_client = jwt.PyJWKClient(
            "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
            cache_keys=True,
            max_cached_keys=10,
        )
        logger.info(f"Firebase Admin SDK initialised successfully for project {_firebase_project_id}.")
    elif not os.path.exists(_sa_path):
        logger.warning(
            "firebase-service-account.json not found — /api/v1/auth/google will be unavailable. "
            "Download it from Firebase Console → Project settings → Service accounts."
        )
except ImportError:
    logger.warning("firebase-admin or jwt package not installed — Google sign-in unavailable.")


def _verify_firebase_token_robust(id_token: str) -> dict:
    """
    Verify Firebase ID token.
    First tries standard fb_auth.verify_id_token(id_token, clock_skew_seconds=60).
    If it fails due to host clock drift (e.g. system clock drifted from Google time),
    it securely verifies the cryptographic signature with Google's public JWKS certificates
    and checks expiration against Google's authoritative server timestamp.
    """
    try:
        return fb_auth.verify_id_token(id_token, clock_skew_seconds=60)
    except Exception as exc:
        err_msg = str(exc)
        logger.warning(f"Standard Firebase token verification check: {err_msg}")

        # If it's a clock skew / time drift error, verify signature directly using Google's JWKS
        if _jwks_client and any(kw in err_msg.lower() for kw in ("early", "clock", "expired", "time")):
            try:
                signing_key = _jwks_client.get_signing_key_from_jwt(id_token)
                payload = jwt.decode(
                    id_token,
                    signing_key.key,
                    algorithms=["RS256"],
                    audience=_firebase_project_id,
                    issuer=f"https://securetoken.google.com/{_firebase_project_id}",
                    options={"verify_exp": False, "verify_iat": False},
                )

                uid = payload.get("sub") or payload.get("user_id")
                if not uid:
                    raise ValueError("Token missing user ID ('sub').")

                # Fetch Google server time to validate expiration independently of local clock drift
                try:
                    head_res = requests.head(
                        "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
                        timeout=5,
                    )
                    google_now = email.utils.parsedate_to_datetime(head_res.headers["Date"]).timestamp()
                except Exception as net_err:
                    logger.warning(f"Could not reach Google time endpoint: {net_err}")
                    google_now = time.time()

                iat = payload.get("iat", 0)
                exp = payload.get("exp", 0)
                # Allow a generous 5-minute leeway around Google's authoritative clock
                if google_now < iat - 300:
                    raise ValueError(f"Token used before issuance time ({google_now} < {iat}).")
                if google_now > exp + 300:
                    raise ValueError(f"Token expired ({google_now} > {exp}). Please sign in again.")

                if "uid" not in payload:
                    payload["uid"] = uid

                logger.info(f"Firebase token verified via Google JWKS (clock-skew compensated) for user: {uid}")
                return payload
            except Exception as jwks_exc:
                logger.warning(f"JWKS fallback verification failed: {jwks_exc}")
                raise HTTPException(status_code=401, detail=f"Google token verification failed: {jwks_exc}")

        raise HTTPException(status_code=401, detail=f"Invalid or expired Google token: {exc}")


class GoogleTokenRequest(BaseModel):
    id_token: str


@app.post("/api/v1/auth/google", tags=["Auth"])
async def google_sign_in(body: GoogleTokenRequest, db: Session = Depends(get_db)):
    """
    Verify a Firebase ID token and return a CliniFusionX session token.
    Creates a local user account on first sign-in.
    """
    if not _firebase_ready:
        raise HTTPException(
            status_code=503,
            detail=(
                "Google Sign-In is not configured on this server. "
                "Place firebase-service-account.json in the backend directory."
            ),
        )

    # 1. Verify the Firebase ID token (with clock-skew compensation)
    decoded = _verify_firebase_token_robust(body.id_token)

    uid: str  = decoded["uid"]
    email: str = decoded.get("email", f"{uid}@google.com")
    name: str  = decoded.get("name", email.split("@")[0].replace(".", " ").title())
    # Prefix "Dr." if the display name doesn't already look like a doctor title
    if not name.lower().startswith("dr."):
        name = f"Dr. {name}"

    # 2. Upsert user in our database (create on first login, no-op on subsequent)
    username = f"google_{uid}"
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            username=username,
            password_hash="<firebase>",   # never used for password auth
            name=name,
            role="Attending Clinician",
            department="Thoracic Radiology & AI Clinical Intelligence",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"New Google user created: {username} ({email})")
    else:
        logger.info(f"Google user signed in: {username} ({email})")

    # 3. Issue our own session token
    token = _create_token(username, db)
    return {
        "token": token,
        "user": {
            "id":         username,
            "name":       user.name,
            "role":       user.role,
            "department": user.department,
            "email":      email,
        },
    }


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/v1/health", tags=["System"])
async def health_check():
    return {
        "status": "online" if _models_ready else "degraded",
        "models_ready": _models_ready,
        "startup_error": _startup_error,
        "model": "Swin Tiny Patch4 Window7 224",
        "checkpoint": "best_swin_chestxray14.pth",
        "classes": 15,
        "device": str(engine.device) if engine else "cpu",
    }

# Legacy alias so existing frontend settings page keeps working
@app.get("/api/health", tags=["System"], include_in_schema=False)
async def health_check_legacy():
    return await health_check()


# ── Knowledge base ────────────────────────────────────────────────────────────

@app.get("/api/v1/kb-diseases", tags=["Knowledge Base"])
async def kb_diseases(user: dict = Depends(_require_auth)):
    """Return all disease names and their primary symptom lists."""
    return {
        "diseases": {
            disease: {
                "primary": info["primary"],
                "secondary": info["secondary"],
                "asymptomatic_possible": info["asymptomatic_possible"],
            }
            for disease, info in DISEASE_KB.items()
        }
    }

@app.get("/api/v1/risk-context/{disease}", tags=["Knowledge Base"])
async def risk_context(disease: str, user: dict = Depends(_require_auth)):
    """Return risk factors for a given NIH ChestX-ray14 disease label."""
    if disease not in DISEASE_KB:
        raise HTTPException(status_code=404, detail=f"Disease '{disease}' not found in knowledge base.")
    return {
        "disease": disease,
        "risk_context": DISEASE_KB[disease].get("risk_context", []),
        "asymptomatic_possible": DISEASE_KB[disease].get("asymptomatic_possible", True),
    }

# Legacy aliases
@app.get("/api/kb-diseases", include_in_schema=False)
async def kb_diseases_legacy():
    return await kb_diseases(user={"user_id": "legacy"})

@app.get("/api/risk-context/{disease}", include_in_schema=False)
async def risk_context_legacy(disease: str):
    return await risk_context(disease=disease, user={"user_id": "legacy"})


# ── Analyze ───────────────────────────────────────────────────────────────────

@app.post("/api/v1/analyze", tags=["Inference"])
@limiter.limit("10/minute")
async def analyze_xray(
    request: Request,
    image: UploadFile = File(...),
    clinical_text: str = Form(""),
    symptoms: str = Form("[]"),
    clinical_pdf: UploadFile = File(None),
    user: dict = Depends(_require_auth),
    _models: None = Depends(_require_models),
):
    """Run Swin Transformer inference on a chest X-ray image."""
    # ── Validate uploads ──────────────────────────────────────────────────
    _validate_image_upload(image)

    img_bytes = await image.read()
    if len(img_bytes) > MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Image too large. Max {MAX_IMAGE_SIZE_MB} MB.")

    try:
        pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode image. Please upload a valid chest X-ray.")

    # ── Inference ─────────────────────────────────────────────────────────
    logger.info(f"[{user['user_id']}] Running inference on image ({len(img_bytes)//1024} KB)...")
    image_findings = engine.predict(pil_img)

    # ── CCM ───────────────────────────────────────────────────────────────
    try:
        reported_symptoms_list = json.loads(symptoms)
    except Exception:
        reported_symptoms_list = []
    enriched_findings = ccm.evaluate_all(image_findings, reported_symptoms_list)

    # ── PDF extraction (safe temp file) ──────────────────────────────────
    pdf_text = ""
    if clinical_pdf and clinical_pdf.filename:
        _validate_pdf_upload(clinical_pdf)
        pdf_bytes = await clinical_pdf.read()
        if len(pdf_bytes) > MAX_PDF_SIZE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"PDF too large. Max {MAX_PDF_SIZE_MB} MB.")

        # Use a proper temp file so cleanup is guaranteed even on exceptions
        from clinical_extractor import extract_text_from_pdf
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        try:
            tmp.write(pdf_bytes)
            tmp.flush()
            tmp.close()
            pdf_text = extract_text_from_pdf(tmp.name)
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                logger.warning(f"Could not delete temp PDF: {tmp.name}")

    # ── Report generation ─────────────────────────────────────────────────
    combined_clinical = clinical_text + f"\n{pdf_text}"
    logger.info(f"[{user['user_id']}] Generating report...")
    report = report_generator.generate_report(enriched_findings, combined_clinical)

    return {"findings": enriched_findings, "report": report}


# Legacy alias for existing frontend
@app.post("/api/analyze", include_in_schema=False)
@limiter.limit("10/minute")
async def analyze_xray_legacy(
    request: Request,
    image: UploadFile = File(...),
    clinical_text: str = Form(""),
    symptoms: str = Form("[]"),
    clinical_pdf: UploadFile = File(None),
):
    """Legacy endpoint — no auth required for backward compatibility."""
    return await analyze_xray(
        request=request,
        image=image,
        clinical_text=clinical_text,
        symptoms=symptoms,
        clinical_pdf=clinical_pdf,
        user={"user_id": "legacy"},
        _models=None,
    )


# ── In-memory Explainability Heatmap Cache ─────────────────────────────────────
# Maps sha256(img_bytes)_classIdx_camMethod -> base64 heatmap string
_heatmap_cache: dict[str, str] = {}
_MAX_HEATMAP_CACHE = 120

def _get_cached_heatmap(cache_key: str) -> Optional[str]:
    return _heatmap_cache.get(cache_key)

def _store_cached_heatmap(cache_key: str, heatmap_base64: str) -> None:
    if len(_heatmap_cache) >= _MAX_HEATMAP_CACHE:
        # Evict oldest entry
        first_key = next(iter(_heatmap_cache))
        _heatmap_cache.pop(first_key, None)
    _heatmap_cache[cache_key] = heatmap_base64

# ── Explain ───────────────────────────────────────────────────────────────────

import asyncio

@app.post("/api/v1/explain", tags=["Inference"])
@limiter.limit("30/minute")
async def explain_finding(
    request: Request,
    class_idx: int = Form(...),
    image: UploadFile = File(...),
    cam_method: str = Form("gradcam"),
    user: dict = Depends(_require_auth),
    _models: None = Depends(_require_models),
):
    """Generate a GradCAM / ScoreCAM heatmap for a specific class with caching."""
    _validate_image_upload(image)

    img_bytes = await image.read()
    if len(img_bytes) > MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Image too large. Max {MAX_IMAGE_SIZE_MB} MB.")

    cache_key = f"{hashlib.sha256(img_bytes).hexdigest()}_{class_idx}_{cam_method}"
    cached_res = _get_cached_heatmap(cache_key)
    if cached_res:
        logger.info(f"[{user['user_id']}] Heatmap CACHE HIT for class_idx={class_idx} ({cam_method})")
        return {"heatmap_base64": cached_res, "cached": True}

    try:
        pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode image.")

    logger.info(f"[{user['user_id']}] Generating heatmap for class_idx={class_idx} ({cam_method})...")
    input_tensor = engine.preprocess_image(pil_img).to(engine.device)
    
    # Run CPU/GPU compute in threadpool so FastAPI event loop is never blocked
    heatmap_img = await asyncio.to_thread(
        explainer.generate_heatmap, input_tensor, pil_img, class_idx, cam_method
    )

    heatmap_pil = Image.fromarray(heatmap_img)
    buffered = io.BytesIO()
    heatmap_pil.save(buffered, format="JPEG", quality=90)
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")

    _store_cached_heatmap(cache_key, img_str)
    return {"heatmap_base64": img_str, "cached": False}


# Legacy alias
@app.post("/api/explain", include_in_schema=False)
@limiter.limit("20/minute")
async def explain_finding_legacy(
    request: Request,
    class_idx: int = Form(...),
    image: UploadFile = File(...),
    cam_method: str = Form("gradcam"),
):
    return await explain_finding(
        request=request,
        class_idx=class_idx,
        image=image,
        cam_method=cam_method,
        user={"user_id": "legacy"},
        _models=None,
    )

# ── History ───────────────────────────────────────────────────────────────────

class HistoryRecordCreate(BaseModel):
    id: str
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    patientName: Optional[str] = None
    timestamp: Optional[int] = None
    date: Optional[str] = None
    status: Optional[str] = "Completed"
    findings: Optional[list] = []
    top_finding: Optional[dict] = None
    topFinding: Optional[dict] = None
    report: Optional[Any] = None
    age: Optional[str] = ""
    sex: Optional[str] = ""
    clinical_text: Optional[str] = ""
    clinicalText: Optional[str] = ""
    image_preview: Optional[str] = ""
    imagePreview: Optional[str] = ""

@app.get("/api/v1/history", tags=["History"])
async def get_history(user: dict = Depends(_require_auth), db: Session = Depends(get_db)):
    records = db.query(AnalysisRecord).filter(AnalysisRecord.user_id == user["user_id"]).order_by(AnalysisRecord.timestamp.desc()).all()
    results = []
    for r in records:
        top_data = None
        if r.top_finding:
            try:
                top_data = json.loads(r.top_finding)
            except Exception:
                top_data = None
        if not top_data:
            top_data = {"disease": "No Finding", "probability": 0}

        report_data = None
        if r.report:
            try:
                report_data = json.loads(r.report)
            except Exception:
                report_data = r.report

        # Resolve patient name: check record.patient_name, fallback to associated Patient relation if available
        resolved_patient_name = r.patient_name or ""
        if not resolved_patient_name and r.patient:
            resolved_patient_name = f"{r.patient.first_name} {r.patient.last_name}".strip()

        results.append({
            "id": r.id,
            "patient_id": r.patient_id,
            "patient_name": resolved_patient_name,
            "patientName": resolved_patient_name,
            "timestamp": r.timestamp or 0,
            "date": r.date or "",
            "status": r.status or "Completed",
            "findings": json.loads(r.findings) if r.findings else [],
            "top_finding": top_data,
            "topFinding": top_data,
            "report": report_data,
            "clinical_text": r.clinical_text or "",
            "clinicalText": r.clinical_text or "",
            "age": r.age or "",
            "sex": r.sex or "",
            "patientInfo": {
                "age": r.age or "",
                "sex": r.sex or "",
                "clinicalText": r.clinical_text or "",
                "patientName": resolved_patient_name,
            },
            "image_preview": r.image_preview or "",
            "imagePreview": r.image_preview or ""
        })
    return results

@app.post("/api/v1/history", tags=["History"])
async def save_history(record: HistoryRecordCreate, user: dict = Depends(_require_auth), db: Session = Depends(get_db)):
    top = record.top_finding or record.topFinding
    img = record.image_preview or record.imagePreview or ""
    clin_text = record.clinical_text or record.clinicalText or ""
    p_name = record.patient_name or record.patientName or ""
    
    report_data = record.report
    if isinstance(report_data, (dict, list)):
        report_str = json.dumps(report_data)
    elif report_data is not None:
        report_str = str(report_data)
    else:
        report_str = "{}"

    db_record = AnalysisRecord(
        id=record.id,
        user_id=user["user_id"],
        patient_id=record.patient_id,
        patient_name=p_name,
        timestamp=record.timestamp or int(datetime.utcnow().timestamp() * 1000),
        date=record.date or datetime.utcnow().strftime("%d %b %Y, %H:%M"),
        status=record.status or "Completed",
        findings=json.dumps(record.findings or []),
        top_finding=json.dumps(top) if top else None,
        report=report_str,
        age=record.age or "",
        sex=record.sex or "",
        clinical_text=clin_text,
        image_preview=img
    )
    db.add(db_record)
    db.commit()
    return {"message": "Saved", "id": db_record.id}

class PatientCreate(BaseModel):
    mrn: str
    first_name: str
    last_name: Optional[str] = ""
    date_of_birth: Optional[str] = "N/A"
    sex: Optional[str] = "Unknown"

@app.get("/api/v1/patients", tags=["Patients"])
async def get_patients(user: dict = Depends(_require_auth), db: Session = Depends(get_db)):
    from models import Patient
    patients = db.query(Patient).all()
    return [{"mrn": p.mrn, "first_name": p.first_name, "last_name": p.last_name or "", "date_of_birth": p.date_of_birth or "N/A", "sex": p.sex or "Unknown"} for p in patients]

@app.get("/api/v1/patients/{mrn}", tags=["Patients"])
async def get_patient(mrn: str, user: dict = Depends(_require_auth), db: Session = Depends(get_db)):
    from models import Patient
    p = db.query(Patient).filter(Patient.mrn == mrn).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"mrn": p.mrn, "first_name": p.first_name, "last_name": p.last_name or "", "date_of_birth": p.date_of_birth or "N/A", "sex": p.sex or "Unknown"}

@app.post("/api/v1/patients", tags=["Patients"])
async def create_patient(body: PatientCreate, user: dict = Depends(_require_auth), db: Session = Depends(get_db)):
    from models import Patient
    p = db.query(Patient).filter(Patient.mrn == body.mrn).first()
    if p:
        # Update existing patient demographics if updated
        if body.first_name:
            p.first_name = body.first_name
        if body.last_name is not None and body.last_name != "":
            p.last_name = body.last_name
        if body.date_of_birth and body.date_of_birth != "N/A":
            p.date_of_birth = body.date_of_birth
        if body.sex and body.sex != "Unknown":
            p.sex = body.sex
        db.commit()
        return {"message": "Patient updated successfully", "mrn": p.mrn}

    db_patient = Patient(
        mrn=body.mrn,
        first_name=body.first_name,
        last_name=body.last_name or "",
        date_of_birth=body.date_of_birth or "N/A",
        sex=body.sex or "Unknown"
    )
    db.add(db_patient)
    db.commit()
    return {"message": "Patient created successfully", "mrn": db_patient.mrn}

@app.delete("/api/v1/patients/{mrn}", tags=["Patients"])
async def delete_patient(mrn: str, user: dict = Depends(_require_auth), db: Session = Depends(get_db)):
    from models import Patient
    p = db.query(Patient).filter(Patient.mrn == mrn).first()
    if p:
        db.delete(p)
        db.commit()
    return {"message": "Patient deleted successfully"}

@app.delete("/api/v1/history/{record_id}", tags=["History"])
async def delete_history(record_id: str, user: dict = Depends(_require_auth), db: Session = Depends(get_db)):
    db_record = db.query(AnalysisRecord).filter(AnalysisRecord.id == record_id, AnalysisRecord.user_id == user["user_id"]).first()
    if db_record:
        db.delete(db_record)
        db.commit()
    return {"message": "Deleted"}

@app.delete("/api/v1/history", tags=["History"])
async def clear_history(user: dict = Depends(_require_auth), db: Session = Depends(get_db)):
    db.query(AnalysisRecord).filter(AnalysisRecord.user_id == user["user_id"]).delete()
    db.commit()
    return {"message": "Cleared"}


class PdfExportRequest(BaseModel):
    record_id: str
    report_date: str
    report: dict
    image_preview: Optional[str] = None
    patient_name: Optional[str] = None

@app.post("/api/v1/export-pdf", tags=["Export"])
async def export_pdf(
    body: PdfExportRequest,
    user: dict = Depends(_require_auth),
    db: Session = Depends(get_db),
):
    """Generate and stream a branded clinical PDF report."""
    # Fetch clinician info
    db_user = db.query(User).filter(User.username == user["user_id"]).first()
    clinician_name = db_user.name if db_user else user.get("name", "Unknown")
    clinician_role = db_user.role if db_user else "Clinician"
    clinician_dept = db_user.department if db_user else "Radiology"

    # Resolve patient name if not directly supplied in request
    resolved_patient_name = body.patient_name
    if not resolved_patient_name:
        db_rec = db.query(AnalysisRecord).filter(AnalysisRecord.id == body.record_id).first()
        if db_rec and db_rec.patient_name:
            resolved_patient_name = db_rec.patient_name

    logger.info(f"[{user['user_id']}] Generating PDF for record {body.record_id} (Patient: {resolved_patient_name})")
    try:
        pdf_bytes = generate_report_pdf(
            report_data=body.report,
            record_id=body.record_id,
            report_date=body.report_date,
            clinician_name=clinician_name,
            clinician_role=clinician_role,
            clinician_dept=clinician_dept,
            image_base64=body.image_preview,
            patient_name=resolved_patient_name,
        )
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    filename = f"{body.record_id}_CliniFusionX_Report.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )



# ── SPA static file serving ───────────────────────────────────────────────────
frontend_dist = os.path.join(os.path.dirname(__file__), "frontend_dist")
if not os.path.exists(frontend_dist) and os.path.exists("frontend_dist"):
    frontend_dist = "frontend_dist"

if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    samples_dir = os.path.join(frontend_dist, "samples")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    if os.path.exists(samples_dir):
        app.mount("/samples", StaticFiles(directory=samples_dir), name="samples")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
