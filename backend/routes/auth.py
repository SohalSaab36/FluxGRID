from functools import wraps
from typing import Any, Callable

from flask import Blueprint, current_app, jsonify, request, session

from models.schemas import require_json_object
from services.account_store import AccountError
from services.email_service import send_password_reset_otp
from services.sms_service import send_signup_otp, verify_signup_otp

auth_bp = Blueprint("auth", __name__)


def current_account() -> dict[str, Any] | None:
    user_id = session.get("user_id")
    if user_id is None:
        return None
    try:
        return current_app.extensions["accounts"].get_by_id(user_id)
    except AccountError:
        session.clear()
        return None


def login_required(view: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(view)
    def wrapped(*args: Any, **kwargs: Any):
        account = current_account()
        if account is None:
            return jsonify({"error": "Sign in to continue."}), 401
        return view(account, *args, **kwargs)

    return wrapped


def admin_required(view: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(view)
    @login_required
    def wrapped(account: dict[str, Any], *args: Any, **kwargs: Any):
        if account["role"] != "admin":
            return jsonify({"error": "Administrator access is required."}), 403
        return view(account, *args, **kwargs)

    return wrapped


def _credentials() -> tuple[str, str]:
    from flask import request

    payload = require_json_object(request.get_json(silent=True))
    email = payload.get("email")
    password = payload.get("password")
    if not isinstance(email, str) or not isinstance(password, str):
        raise AccountError("Email and password are required.")
    return email, password


@auth_bp.get("/auth/me")
def get_current_account():
    return jsonify({"user": current_account()})


@auth_bp.post("/auth/signup/phone-verification")
def request_signup_phone_verification():
    payload = require_json_object(request.get_json(silent=True))
    phone = payload.get("phone")
    if not isinstance(phone, str):
        raise AccountError("Enter a phone number in international format, such as +919876543210.")
    normalized_phone = current_app.extensions["accounts"].normalize_phone(phone)
    if not normalized_phone.startswith("+") or not 8 <= len(normalized_phone) - 1 <= 15:
        raise AccountError("Enter a phone number in international format, such as +919876543210.")
    send_signup_otp(current_app.config, normalized_phone)
    return jsonify({"message": "A verification code has been sent to your mobile number."})


@auth_bp.post("/auth/signup")
def signup():
    payload = require_json_object(request.get_json(silent=True))
    email = payload.get("email")
    password = payload.get("password")
    full_name = payload.get("fullName")
    phone = payload.get("phone")
    city = payload.get("city")
    verification_code = payload.get("phoneVerificationCode")
    if not all(isinstance(value, str) for value in (email, password, full_name, phone, city, verification_code)):
        raise AccountError("Full name, email, phone, city, password, and mobile verification code are required.")
    normalized_phone = current_app.extensions["accounts"].normalize_phone(phone)
    if not normalized_phone.startswith("+"):
        raise AccountError("Enter your mobile number in international format, such as +919876543210.")
    if not verification_code.isdigit() or not 4 <= len(verification_code) <= 10:
        raise AccountError("Enter the verification code sent to your mobile number.")
    if not verify_signup_otp(current_app.config, normalized_phone, verification_code):
        raise AccountError("The mobile verification code is incorrect or expired.")
    account = current_app.extensions["accounts"].register(email, password, full_name, normalized_phone, city)
    session.clear()
    session["user_id"] = account["id"]
    return jsonify({"user": account}), 201


@auth_bp.post("/auth/login")
def login():
    email, password = _credentials()
    account = current_app.extensions["accounts"].authenticate(email, password)
    session.clear()
    session["user_id"] = account["id"]
    return jsonify({"user": account})


@auth_bp.post("/auth/logout")
def logout():
    session.clear()
    return jsonify({"user": None})


@auth_bp.post("/auth/password-reset/request")
def request_password_reset():
    payload = require_json_object(request.get_json(silent=True))
    email = payload.get("email")
    if not isinstance(email, str):
        raise AccountError("Enter the email address for your account.")

    accounts = current_app.extensions["accounts"]
    reset = accounts.prepare_password_reset(email)
    if reset is not None:
        user_id, recipient, code = reset
        try:
            send_password_reset_otp(current_app.config, recipient, code)
        except AccountError:
            accounts.cancel_password_reset(user_id)
            raise
    return jsonify(
        {"message": "If an account exists for that email, a password reset code has been sent."}
    )


@auth_bp.post("/auth/password-reset/confirm")
def confirm_password_reset():
    payload = require_json_object(request.get_json(silent=True))
    email = payload.get("email")
    code = payload.get("code")
    new_password = payload.get("newPassword")
    if not all(isinstance(value, str) for value in (email, code, new_password)):
        raise AccountError("Email, verification code, and new password are required.")
    current_app.extensions["accounts"].reset_password(email, code, new_password)
    return jsonify({"message": "Password updated. You can now sign in."})
