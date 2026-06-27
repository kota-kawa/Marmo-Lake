from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.security import secret_box
from app.models import Secret


def create_secret(db: Session, name: str, plaintext: str) -> Secret | None:
    if not plaintext:
        return None
    secret = Secret(name=name, encrypted_value=secret_box.encrypt(plaintext))
    db.add(secret)
    db.flush()
    return secret


def update_secret(db: Session, secret: Secret | None, name: str, plaintext: str) -> Secret | None:
    if not plaintext:
        return secret
    if secret is None:
        return create_secret(db, name, plaintext)
    secret.encrypted_value = secret_box.encrypt(plaintext)
    return secret


def read_secret(secret: Secret | None) -> str:
    if not secret:
        return ""
    return secret_box.decrypt(secret.encrypted_value)

