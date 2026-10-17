"""SQLite-backed accounts and one-time environment-configured admin bootstrap."""

from __future__ import annotations

import re
import hmac
import hashlib
import secrets
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

from werkzeug.security import check_password_hash, generate_password_hash


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LENGTH = 12


class AccountError(ValueError):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


class AccountStore:
    def __init__(
        self,
        database_path: str,
        admin_email: str = "",
        admin_password: str = "",
        reset_secret: str = "",
        reset_ttl_seconds: int = 600,
    ) -> None:
        if database_path != ":memory:":
            Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(database_path, timeout=10, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute("PRAGMA busy_timeout = 10000")
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS account_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('user', 'admin')),
                full_name TEXT NOT NULL DEFAULT 'Account',
                phone TEXT NOT NULL DEFAULT '',
                city TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
            """
        )
        columns = {
            row["name"]
            for row in self._connection.execute("PRAGMA table_info(account_users)").fetchall()
        }
        for name, definition in (
            ("full_name", "TEXT NOT NULL DEFAULT 'Account'"),
            ("phone", "TEXT NOT NULL DEFAULT ''"),
            ("city", "TEXT NOT NULL DEFAULT ''"),
        ):
            if name not in columns:
                self._connection.execute(f"ALTER TABLE account_users ADD COLUMN {name} {definition}")
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS password_reset_codes (
                user_id INTEGER PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
                code_hash TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                requested_at INTEGER NOT NULL
            )
            """
        )
        self._connection.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS account_users_phone_unique
            ON account_users(phone) WHERE phone <> ''
            """
        )
        self._connection.commit()
        self._lock = threading.RLock()
        self._reset_secret = reset_secret.encode("utf-8")
        self._reset_ttl_seconds = reset_ttl_seconds
        if bool(admin_email) != bool(admin_password):
            raise RuntimeError(
                "Set both CITYFLOW_ADMIN_EMAIL and CITYFLOW_ADMIN_PASSWORD to bootstrap the admin."
            )
        if admin_email:
            self._bootstrap_admin(admin_email, admin_password)

    def _bootstrap_admin(self, email: str, password: str) -> None:
        normalized_email = self._validate_email(email)
        self._validate_password(password)
        with self._lock:
            existing = self._connection.execute(
                "SELECT id, role FROM account_users WHERE email = ?",
                (normalized_email,),
            ).fetchone()
            if existing:
                if existing["role"] != "admin":
                    raise RuntimeError(
                        "CITYFLOW_ADMIN_EMAIL already belongs to a non-admin account."
                    )
                return
            self._connection.execute(
                """
                INSERT INTO account_users (email, password_hash, role, full_name, phone, city)
                VALUES (?, ?, 'admin', 'FluxGRID Administrator', '', '')
                """,
                (normalized_email, generate_password_hash(password)),
            )
            self._connection.commit()

    @staticmethod
    def _validate_email(email: str) -> str:
        normalized = email.strip().lower()
        if len(normalized) > 254 or not EMAIL_PATTERN.fullmatch(normalized):
            raise AccountError("Enter a valid email address.")
        return normalized

    @staticmethod
    def _validate_password(password: str) -> None:
        if len(password) < MIN_PASSWORD_LENGTH:
            raise AccountError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
        if len(password) > 1024:
            raise AccountError("Password is too long.")

    @staticmethod
    def normalize_phone(phone: str) -> str:
        digits = re.sub(r"\D", "", phone)
        if not 7 <= len(digits) <= 15:
            raise AccountError("Enter a phone number containing 7 to 15 digits.")
        return ("+" if phone.strip().startswith("+") else "") + digits

    @classmethod
    def _validate_profile(cls, full_name: str, phone: str, city: str) -> tuple[str, str, str]:
        name = full_name.strip()
        town = city.strip()
        if not 2 <= len(name) <= 100:
            raise AccountError("Full name must be between 2 and 100 characters.")
        if not 2 <= len(town) <= 100:
            raise AccountError("City must be between 2 and 100 characters.")
        normalized_phone = cls.normalize_phone(phone)
        return name, normalized_phone, town

    @staticmethod
    def _public_account(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "email": row["email"],
            "role": row["role"],
            "fullName": row["full_name"],
            "phone": row["phone"],
            "city": row["city"],
        }

    def register(self, email: str, password: str, full_name: str, phone: str, city: str) -> dict[str, Any]:
        normalized_email = self._validate_email(email)
        self._validate_password(password)
        profile = self._validate_profile(full_name, phone, city)
        with self._lock:
            existing_phone = self._connection.execute(
                "SELECT 1 FROM account_users WHERE phone = ?",
                (profile[1],),
            ).fetchone()
            if existing_phone:
                raise AccountError("This mobile number is already linked to an account.", 409)
            try:
                cursor = self._connection.execute(
                    """
                    INSERT INTO account_users (email, password_hash, role, full_name, phone, city)
                    VALUES (?, ?, 'user', ?, ?, ?)
                    """,
                    (normalized_email, generate_password_hash(password), *profile),
                )
                self._connection.commit()
            except sqlite3.IntegrityError as exc:
                if self._connection.execute(
                    "SELECT 1 FROM account_users WHERE phone = ?",
                    (profile[1],),
                ).fetchone():
                    raise AccountError(
                        "This mobile number is already linked to an account.",
                        409,
                    ) from exc
                raise AccountError("An account with this email already exists.", 409) from exc
            return self.get_by_id(cursor.lastrowid)

    def authenticate(self, email: str, password: str) -> dict[str, Any]:
        normalized_email = self._validate_email(email)
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM account_users WHERE email = ?",
                (normalized_email,),
            ).fetchone()
        if row is None or not check_password_hash(row["password_hash"], password):
            raise AccountError("Email or password is incorrect.", 401)
        return self._public_account(row)

    def get_by_id(self, user_id: int) -> dict[str, Any]:
        with self._lock:
            row = self._connection.execute(
                "SELECT id, email, role, full_name, phone, city FROM account_users WHERE id = ?",
                (user_id,),
            ).fetchone()
        if row is None:
            raise AccountError("Account no longer exists. Please sign in again.", 401)
        return self._public_account(row)

    def prepare_password_reset(self, email: str, now: int | None = None) -> tuple[int, str, str] | None:
        normalized_email = self._validate_email(email)
        current_time = int(time.time()) if now is None else now
        with self._lock:
            account = self._connection.execute(
                "SELECT id, email FROM account_users WHERE email = ?",
                (normalized_email,),
            ).fetchone()
            if account is None:
                return None
            previous = self._connection.execute(
                "SELECT requested_at FROM password_reset_codes WHERE user_id = ?",
                (account["id"],),
            ).fetchone()
            if previous and current_time - previous["requested_at"] < 60:
                raise AccountError("Please wait one minute before requesting another code.", 429)
            code = f"{secrets.randbelow(1_000_000):06d}"
            code_hash = hmac.new(self._reset_secret, code.encode("ascii"), hashlib.sha256).hexdigest()
            self._connection.execute(
                """
                INSERT INTO password_reset_codes (user_id, code_hash, expires_at, attempts, requested_at)
                VALUES (?, ?, ?, 0, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    code_hash = excluded.code_hash,
                    expires_at = excluded.expires_at,
                    attempts = 0,
                    requested_at = excluded.requested_at
                """,
                (account["id"], code_hash, current_time + self._reset_ttl_seconds, current_time),
            )
            self._connection.commit()
            return account["id"], account["email"], code

    def cancel_password_reset(self, user_id: int) -> None:
        with self._lock:
            self._connection.execute(
                "DELETE FROM password_reset_codes WHERE user_id = ?",
                (user_id,),
            )
            self._connection.commit()

    def reset_password(
        self,
        email: str,
        code: str,
        new_password: str,
        now: int | None = None,
    ) -> None:
        normalized_email = self._validate_email(email)
        self._validate_password(new_password)
        if not re.fullmatch(r"\d{6}", code):
            raise AccountError("Enter the six-digit code from your email.")
        current_time = int(time.time()) if now is None else now
        with self._lock:
            row = self._connection.execute(
                """
                SELECT a.id, r.code_hash, r.expires_at, r.attempts
                FROM account_users a
                JOIN password_reset_codes r ON r.user_id = a.id
                WHERE a.email = ?
                """,
                (normalized_email,),
            ).fetchone()
            if row is None:
                raise AccountError("The code is invalid or expired.", 400)
            if row["expires_at"] <= current_time:
                self._connection.execute(
                    "DELETE FROM password_reset_codes WHERE user_id = ?",
                    (row["id"],),
                )
                self._connection.commit()
                raise AccountError("The code is invalid or expired.", 400)
            if row["attempts"] >= 5:
                self._connection.execute(
                    "DELETE FROM password_reset_codes WHERE user_id = ?",
                    (row["id"],),
                )
                self._connection.commit()
                raise AccountError("Too many incorrect codes. Request a new code.", 429)
            supplied_hash = hmac.new(self._reset_secret, code.encode("ascii"), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(row["code_hash"], supplied_hash):
                attempts = row["attempts"] + 1
                if attempts >= 5:
                    self._connection.execute(
                        "DELETE FROM password_reset_codes WHERE user_id = ?",
                        (row["id"],),
                    )
                else:
                    self._connection.execute(
                        "UPDATE password_reset_codes SET attempts = ? WHERE user_id = ?",
                        (attempts, row["id"]),
                    )
                self._connection.commit()
                raise AccountError("The code is incorrect.")
            self._connection.execute(
                "UPDATE account_users SET password_hash = ? WHERE id = ?",
                (generate_password_hash(new_password), row["id"]),
            )
            self._connection.execute(
                "DELETE FROM password_reset_codes WHERE user_id = ?",
                (row["id"],),
            )
            self._connection.commit()

    def close(self) -> None:
        with self._lock:
            self._connection.close()
