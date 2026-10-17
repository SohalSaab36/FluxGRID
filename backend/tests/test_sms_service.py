import base64
import json
from urllib.parse import parse_qs

import pytest

from services.account_store import AccountError
from services.sms_service import send_signup_otp, verify_signup_otp


class StubResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


def configured_twilio():
    return {
        "TWILIO_ACCOUNT_SID": "AC123",
        "TWILIO_AUTH_TOKEN": "private-token",
        "TWILIO_VERIFY_SERVICE_SID": "VA456",
    }


def test_send_sms_uses_twilio_verify_with_phone_and_auth(monkeypatch):
    from services import sms_service

    calls = []

    def fake_urlopen(request, timeout):
        calls.append((request, timeout))
        return StubResponse({"status": "pending"})

    monkeypatch.setattr(sms_service, "urlopen", fake_urlopen)
    send_signup_otp(configured_twilio(), "+919876543210")

    request, timeout = calls[0]
    assert request.full_url.endswith("/Services/VA456/Verifications")
    assert parse_qs(request.data.decode("ascii")) == {
        "To": ["+919876543210"],
        "Channel": ["sms"],
    }
    expected_auth = base64.b64encode(b"AC123:private-token").decode("ascii")
    assert request.get_header("Authorization") == f"Basic {expected_auth}"
    assert timeout == 10


def test_verify_accepts_only_twilio_approved_status(monkeypatch):
    from services import sms_service

    monkeypatch.setattr(
        sms_service,
        "_request",
        lambda *_args: {"status": "approved"},
    )
    assert verify_signup_otp(configured_twilio(), "+919876543210", "123456")

    monkeypatch.setattr(
        sms_service,
        "_request",
        lambda *_args: {"status": "pending"},
    )
    assert not verify_signup_otp(configured_twilio(), "+919876543210", "123456")


def test_sms_verification_requires_all_twilio_credentials():
    with pytest.raises(AccountError, match="Mobile verification is not configured"):
        send_signup_otp({}, "+919876543210")
