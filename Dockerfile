# ============================================================
# Stage 1: Build the React/Vite frontend
# ============================================================
FROM node:20-slim AS frontend-builder

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# ============================================================
# Stage 2: Python runtime — use pre-built PyTorch CPU image
# This avoids downloading and installing 3+ GB of PyTorch via pip.
# ============================================================
FROM pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime

WORKDIR /app

# System dependencies for OpenCV and ReportLab
RUN DEBIAN_FRONTEND=noninteractive TZ=UTC apt-get update && apt-get install -y \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install all Python dependencies (torch/torchvision already in base image)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --default-timeout=100 -r requirements.txt

# Copy Python source files
COPY backend/app.py \
     backend/inference.py \
     backend/model.py \
     backend/explainability.py \
     backend/clinical_extractor.py \
     backend/report_generator.py \
     backend/ccm.py \
     backend/gated_fusion.py \
     backend/database.py \
     backend/models.py \
     backend/pdf_exporter.py \
     ./

# Copy JSON config files
COPY backend/config.json backend/labels.json backend/thresholds.json backend/firebase-service-account.json ./

# Copy model weights
COPY best_swin_chestxray14.pth .

# Copy React build
COPY --from=frontend-builder /frontend/dist ./frontend_dist/

# Persistent volume for SQLite database
VOLUME ["/app/data"]

# Set DB path to the persistent volume so data survives container restarts
ENV SQLALCHEMY_DATABASE_URL=sqlite:////app/data/clinifusion.db

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
