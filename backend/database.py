import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# In Docker the env var points to the persistent volume path.
# Locally it falls back to a file next to app.py.
SQLALCHEMY_DATABASE_URL = os.getenv(
    "SQLALCHEMY_DATABASE_URL",
    "sqlite:///./clinifusion.db"
)

# ensure the directory exists (important for the Docker volume path)
db_path = SQLALCHEMY_DATABASE_URL.replace("sqlite:///", "").replace("sqlite://", "")
if db_path and not db_path.startswith(":"):
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
