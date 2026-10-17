"""SMTP delivery for account verification and password recovery messages."""

from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage
from typing import Any

from services.account_store import AccountError


def send_password_reset_otp(config: Any, recipient: str, code: str) -> None:
    smtp_host = config.get("SMTP_HOST")
    from_email = config.get("SMTP_FROM_EMAIL")
    if not smtp_host or not from_email:
        raise AccountError(
            "Password recovery email is not configured. Set CITYFLOW_SMTP_HOST and CITYFLOW_SMTP_FROM_EMAIL.",
            503,
        )

    message = EmailMessage()
    message["Subject"] = "Your FluxGRID password reset code"
    message["From"] = from_email
    message["To"] = recipient
    message.set_content(
        f"Your FluxGRID password reset code is {code}.\n\n"
        f"It expires in {config.get('PASSWORD_RESET_OTP_TTL_SECONDS', 600) // 60} minutes. "
        "If you did not request this code, you can ignore this message."
    )

    try:
        with smtplib.SMTP(smtp_host, config.get("SMTP_PORT", 587), timeout=10) as client:
            client.ehlo()
            if config.get("SMTP_STARTTLS", True):
                client.starttls(context=ssl.create_default_context())
                client.ehlo()
            smtp_username = config.get("SMTP_USERNAME")
            if smtp_username:
                client.login(smtp_username, config.get("SMTP_PASSWORD", ""))
            client.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise AccountError(
            "The password reset email could not be sent. Check the SMTP settings and try again.",
            503,
        ) from exc
