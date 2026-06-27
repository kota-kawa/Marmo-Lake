from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_token, random_token, session_expiry, utcnow, verify_password
from app.deps import clear_auth_cookies, get_optional_admin, require_setup, set_auth_cookies
from app.models import AuthSession, User
from app.schemas import AdminLogin, SessionMe
from app.services.activity import log_activity

router = APIRouter(prefix="/session", tags=["session"], dependencies=[Depends(require_setup)])


@router.post("/admin-login", response_model=SessionMe)
def admin_login(payload: AdminLogin, response: Response, db: Session = Depends(get_db)) -> SessionMe:
    admin = db.scalar(select(User).where(User.role == "admin").order_by(User.created_at.asc()))
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="管理者が見つかりません。")
    if admin.locked_until and admin.locked_until > utcnow():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="ログインが一時的にロックされています。",
        )
    if not verify_password(payload.password, admin.password_hash):
        admin.failed_login_count += 1
        if admin.failed_login_count >= 8:
            admin.locked_until = utcnow() + timedelta(minutes=15)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="パスコードが違います。")

    admin.failed_login_count = 0
    admin.locked_until = None
    admin.last_login_at = utcnow()
    token = random_token()
    csrf_token = random_token(24)
    db.add(
        AuthSession(
            user_id=admin.id,
            token_hash=hash_token(token),
            csrf_token=csrf_token,
            expires_at=session_expiry(),
        )
    )
    log_activity(db, action="admin.login", target_type="user", target_id=admin.id, user_id=admin.id)
    db.commit()
    set_auth_cookies(response, token, csrf_token)
    return SessionMe(is_admin=True, admin_name=admin.name, csrf_token=csrf_token)


@router.post("/logout")
def logout(response: Response) -> dict[str, bool]:
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me", response_model=SessionMe)
def me(admin: User | None = Depends(get_optional_admin)) -> SessionMe:
    return SessionMe(
        is_admin=admin is not None,
        admin_name=admin.name if admin else None,
        csrf_token=None,
    )

