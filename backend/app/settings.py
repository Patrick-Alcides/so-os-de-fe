import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


def _normalize_database_url(value: str) -> str:
    url = value.strip()
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://") and "+psycopg" not in url:
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def _split_origins(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


DATABASE_URL = _normalize_database_url(os.getenv("DATABASE_URL", "sqlite:///./so_os_de_fe.db"))
SECRET_KEY = os.getenv("SECRET_KEY", "so-os-de-fe-secret-key-dev")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").strip()

_cors_env = os.getenv("CORS_ORIGINS", "").strip()

# Se CORS_ORIGINS não estiver definida, aceitar todas as origens (*)
# para evitar bloqueios ao trocar de domínio Vercel/Render.
if _cors_env:
    CORS_ORIGINS = _split_origins(_cors_env)
else:
    CORS_ORIGINS = ["*"]
