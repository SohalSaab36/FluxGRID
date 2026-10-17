"""Application configuration. All values may be overridden with environment variables."""

from __future__ import annotations

import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", override=False)


def _bool_env(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


def _float_env(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return float(raw)


class Config:
    APP_NAME = os.environ.get("CITYFLOW_APP_NAME", "CityFlow AI")
    SECRET_KEY = os.environ.get("CITYFLOW_SESSION_SECRET") or secrets.token_hex(32)
    HOST = os.environ.get("CITYFLOW_HOST", "127.0.0.1")
    PORT = _int_env("CITYFLOW_PORT", 5000)
    DEBUG = _bool_env("CITYFLOW_DEBUG", False)
    ADMIN_EMAIL = os.environ.get("CITYFLOW_ADMIN_EMAIL", "").strip().lower()
    ADMIN_PASSWORD = os.environ.get("CITYFLOW_ADMIN_PASSWORD", "")
    SMTP_HOST = os.environ.get("CITYFLOW_SMTP_HOST", "").strip()
    SMTP_PORT = _int_env("CITYFLOW_SMTP_PORT", 587)
    SMTP_USERNAME = os.environ.get("CITYFLOW_SMTP_USERNAME", "")
    SMTP_PASSWORD = os.environ.get("CITYFLOW_SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL = os.environ.get("CITYFLOW_SMTP_FROM_EMAIL", "").strip()
    SMTP_STARTTLS = _bool_env("CITYFLOW_SMTP_STARTTLS", True)
    PASSWORD_RESET_OTP_TTL_SECONDS = _int_env("CITYFLOW_PASSWORD_RESET_OTP_TTL_SECONDS", 600)
    TWILIO_ACCOUNT_SID = os.environ.get("CITYFLOW_TWILIO_ACCOUNT_SID", "").strip()
    TWILIO_AUTH_TOKEN = os.environ.get("CITYFLOW_TWILIO_AUTH_TOKEN", "")
    TWILIO_VERIFY_SERVICE_SID = os.environ.get("CITYFLOW_TWILIO_VERIFY_SERVICE_SID", "").strip()

    # Frontend Vite origin. Credentials are not used; origins are listed explicitly.
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.environ.get(
            "CITYFLOW_CORS_ORIGINS",
            "http://127.0.0.1:5173,http://localhost:5173",
        ).split(",")
        if origin.strip()
    ]
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = _bool_env("CITYFLOW_SESSION_COOKIE_SECURE", False)

    # Prototype signal bounds (not recommendations for real roads).
    MIN_GREEN_SECONDS = _int_env("CITYFLOW_MIN_GREEN", 10)
    MAX_GREEN_SECONDS = _int_env("CITYFLOW_MAX_GREEN", 40)
    YELLOW_SECONDS = _int_env("CITYFLOW_YELLOW_SECONDS", 4)
    FIXED_GREEN_SECONDS = _int_env("CITYFLOW_FIXED_GREEN", 30)

    # Service: vehicles departing the stop line per green second (prototype).
    GREEN_SERVICE_RATE = _float_env("CITYFLOW_GREEN_SERVICE_RATE", 0.5)
    YELLOW_SERVICE_RATE = _float_env("CITYFLOW_YELLOW_SERVICE_RATE", 0.2)

    STARVATION_SECONDS = _int_env("CITYFLOW_STARVATION_SECONDS", 60)
    ARRIVAL_SEED = _int_env("CITYFLOW_ARRIVAL_SEED", 42)

    MAX_STEP_SECONDS = _int_env("CITYFLOW_MAX_STEP_SECONDS", 120)
    COMPARE_DURATION_SECONDS = _int_env("CITYFLOW_COMPARE_DURATION", 600)
    HISTORY_INTERVAL_SECONDS = _int_env("CITYFLOW_HISTORY_INTERVAL", 30)

    # Detection — never download weights because health was called.
    YOLO_MODEL_PATH = os.environ.get(
        "CITYFLOW_YOLO_MODEL_PATH",
        str(BASE_DIR / "models" / "weights" / "yolov8n.pt"),
    )
    YOLO_DEVICE = os.environ.get("CITYFLOW_YOLO_DEVICE", "cpu")
    YOLO_CONFIDENCE = _float_env("CITYFLOW_YOLO_CONFIDENCE", 0.35)
    DETECTION_FRAME_STRIDE = _int_env("CITYFLOW_DETECTION_FRAME_STRIDE", 5)
    DETECTION_MAX_FRAMES = _int_env("CITYFLOW_DETECTION_MAX_FRAMES", 240)
    MAX_UPLOAD_BYTES = _int_env("CITYFLOW_MAX_UPLOAD_BYTES", 15 * 1024 * 1024)
    ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}

    MAX_CONTENT_LENGTH = MAX_UPLOAD_BYTES

    TRAFFIC_REPORTS_DB_PATH = os.environ.get(
        "CITYFLOW_REPORTS_DB_PATH",
        str(BASE_DIR / "data" / "traffic_reports.sqlite3"),
    )
    TRAFFIC_REPORT_TTL_SECONDS = _int_env("CITYFLOW_REPORT_TTL_SECONDS", 4 * 60 * 60)
    TRAFFIC_REPORT_MAX_DISTANCE_KM = _float_env(
        "CITYFLOW_REPORT_MAX_DISTANCE_KM",
        5.0,
    )
    ROUTING_BASE_URL = os.environ.get(
        "CITYFLOW_ROUTING_BASE_URL",
        "https://router.project-osrm.org",
    ).rstrip("/")
    ROUTING_TIMEOUT_SECONDS = _float_env("CITYFLOW_ROUTING_TIMEOUT_SECONDS", 8.0)
    ROUTE_INTERSECTION_RADIUS_KM = _float_env(
        "CITYFLOW_ROUTE_INTERSECTION_RADIUS_KM",
        2.5,
    )
