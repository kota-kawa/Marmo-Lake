from __future__ import annotations

from datetime import timedelta

from fastapi import Cookie, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_token, utcnow
from app.models import AuthSession, Setting, User


def is_setup_complete(db: Session) -> bool:
    return (
        db.scalar(select(Setting).where(Setting.key == "setup_complete", Setting.value == "true"))
        is not None
    )


def require_setup(db: Session = Depends(get_db)) -> None:
    if not is_setup_complete(db):
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="初期設定が必要です。")


def get_current_admin(
    request: Request,
    csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
    session_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="管理者ログインが必要です。")
    session = db.scalar(
        select(AuthSession).where(AuthSession.token_hash == hash_token(session_token))
    )
    if not session or session.expires_at <= utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="セッションが無効です。")
    if session.user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="管理者権限が必要です。")
    if request.method not in {"GET", "HEAD", "OPTIONS"} and csrf_token != session.csrf_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRFトークンが無効です。")
    return session.user


def get_optional_admin(
    session_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    if not session_token:
        return None
    session = db.scalar(
        select(AuthSession).where(AuthSession.token_hash == hash_token(session_token))
    )
    if not session or session.expires_at <= utcnow() or session.user.role != "admin":
        return None
    return session.user


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("session_token")
    response.delete_cookie("csrf_token")


def set_auth_cookies(response: Response, session_token: str, csrf_token: str) -> None:
    max_age = int(timedelta(days=7).total_seconds())
    response.set_cookie(
        "session_token",
        session_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=max_age,
    )
    response.set_cookie(
        "csrf_token",
        csrf_token,
        httponly=False,
        secure=False,
        samesite="lax",
        max_age=max_age,
    )

