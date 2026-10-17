"""Twilio Verify integration for phone-number verification."""

from __future__ import annotations

import base64
import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from services.account_store import AccountError


def _credentials(config: Any) -> tuple[str, str, str]:
    account_sid = config.get("TWILIO_ACCOUNT_SID", "").strip()
    auth_token = config.get("TWILIO_AUTH_TOKEN", "")
    service_sid = config.get("TWILIO_VERIFY_SERVICE_SID", "").strip()
    if not account_sid or not auth_token or not service_sid:
        raise AccountError(
            "Mobile verification is not configured. Set the Twilio Verify settings in the backend environment.",
            503,
        )
    return account_sid, auth_token, service_sid


def _request(config: Any, action: str, fields: dict[str, str]) -> dict[str, Any]:
    account_sid, auth_token, service_sid = _credentials(config)
    endpoint = "Verifications" if action == "send" else "VerificationCheck"
    url = (
        f"https://verify.twilio.com/v2/Services/{service_sid}/{endpoint}"
    )
    token = base64.b64encode(f"{account_sid}:{auth_token}".encode("utf-8")).decode("ascii")
    request = Request(
        url,
        data=urlencode(fields).encode("ascii"),
        headers={
            "Authorization": f"Basic {token}",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "FluxGRID-CityFlowAI/1.0",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
        raise AccountError(
            "SMS verification could not be completed. Check the Twilio settings and try again.",
            503,
        ) from exc
    if not isinstance(payload, dict):
        raise AccountError("The SMS verification service returned an invalid response.", 503)
    return payload


def send_signup_otp(config: Any, phone: str) -> None:
    result = _request(config, "send", {"To": phone, "Channel": "sms"})
    if result.get("status") != "pending":
        raise AccountError("The SMS verification service did not start a verification.", 503)


def verify_signup_otp(config: Any, phone: str, code: str) -> bool:
    result = _request(config, "check", {"To": phone, "Code": code})
    return result.get("status") == "approved"
