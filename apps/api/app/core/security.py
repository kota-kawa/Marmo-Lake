from __future__ import annotations

import base64
import hashlib
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

password_hasher = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=2)


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def random_token(bytes_length: int = 32) -> str:
    return secrets.token_urlsafe(bytes_length)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def session_expiry() -> datetime:
    return utcnow() + timedelta(days=settings.session_days)


def ensure_minimum_password_strength(password: str) -> None:
    if len(password) < 8:
        raise ValueError("パスワードは8文字以上にしてください。")
    if password.isdigit() or password.lower() in {"password", "password123", "marmolake"}:
        raise ValueError("推測されやすいパスワードは使えません。")


def validate_http_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("URLはhttpまたはhttpsで始まる必要があります。")
    return url.strip()


def sanitize_filename(filename: str) -> str:
    name = Path(filename).name.strip()
    name = re.sub(r"[^A-Za-z0-9_.\-ぁ-んァ-ヶ一-龠々ー ]+", "_", name)
    return name[:160] or "file"


def allowed_file_type(content_type: str | None) -> bool:
    if not content_type:
        return False
    return (
        content_type == "application/pdf"
        or content_type.startswith("image/")
        or content_type.startswith("text/")
        or content_type in {"application/json", "text/markdown"}
    )


class SecretBox:
    def __init__(self) -> None:
        settings.ensure_directories()
        self.key = self._load_key()

    def _load_key(self) -> bytes:
        if settings.secret_key:
            raw = settings.secret_key.encode("utf-8")
            try:
                decoded = base64.urlsafe_b64decode(raw)
                if len(decoded) == 32:
                    return decoded
            except Exception:
                pass
            return hashlib.sha256(raw).digest()

        key_path = settings.data_dir / "secret.key"
        if key_path.exists():
            raw = key_path.read_bytes()
            decoded = base64.urlsafe_b64decode(raw)
            if len(decoded) == 32:
                return decoded

        key = os.urandom(32)
        key_path.write_bytes(base64.urlsafe_b64encode(key))
        try:
            key_path.chmod(0o600)
        except OSError:
            pass
        return key

    def encrypt(self, plaintext: str) -> str:
        nonce = os.urandom(12)
        ciphertext = AESGCM(self.key).encrypt(nonce, plaintext.encode("utf-8"), None)
        return base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")

    def decrypt(self, encrypted: str) -> str:
        raw = base64.urlsafe_b64decode(encrypted.encode("ascii"))
        nonce, ciphertext = raw[:12], raw[12:]
        return AESGCM(self.key).decrypt(nonce, ciphertext, None).decode("utf-8")


secret_box = SecretBox()
