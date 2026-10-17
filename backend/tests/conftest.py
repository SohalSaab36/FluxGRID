from __future__ import annotations

import pytest

from app import create_app
from config import Config


class TestConfig(Config):
    TESTING = True
    DEBUG = False
    TRAFFIC_REPORTS_DB_PATH = ":memory:"
    ADMIN_EMAIL = "admin@example.test"
    ADMIN_PASSWORD = "test-admin-password-123"
    SMTP_HOST = ""
    SMTP_FROM_EMAIL = ""


@pytest.fixture()
def app():
    application = create_app(TestConfig)
    yield application


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def simulation(app):
    return app.extensions["simulation"]


@pytest.fixture(autouse=True)
def mock_phone_verification(monkeypatch):
    monkeypatch.setattr("routes.auth.send_signup_otp", lambda *_args: None)
    monkeypatch.setattr(
        "routes.auth.verify_signup_otp",
        lambda _config, _phone, code: code == "123456",
    )
