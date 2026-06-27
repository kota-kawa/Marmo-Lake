from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import ensure_minimum_password_strength, hash_password, validate_http_url
from app.deps import is_setup_complete
from app.models import AIProviderSetting, Screen, Setting, User, Workspace
from app.schemas import SetupCreate, SetupResult, SetupStatus
from app.services.activity import log_activity
from app.services.bootstrap import (
    mark_setup_complete,
    seed_action_definitions,
    seed_workspace_content,
)
from app.services.secrets import create_secret

router = APIRouter(prefix="/setup", tags=["setup"])


@router.get("/status", response_model=SetupStatus)
def setup_status(db: Session = Depends(get_db)) -> SetupStatus:
    return SetupStatus(is_setup_complete=is_setup_complete(db))


@router.post("", response_model=SetupResult, status_code=status.HTTP_201_CREATED)
def setup(payload: SetupCreate, db: Session = Depends(get_db)) -> SetupResult:
    if is_setup_complete(db):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="初期設定は完了済みです。")
    if db.scalar(select(Setting).where(Setting.key == "setup_complete")):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="初期設定を続行できません。")
    try:
        ensure_minimum_password_strength(payload.admin_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    workspace = Workspace(name=payload.workspace_name, use_case=payload.use_case, theme="lake")
    db.add(workspace)
    db.flush()
    screen = Screen(
        workspace_id=workspace.id,
        name="スタッフホーム",
        mode="staff",
        layout_json='{"density":"comfortable","glass":"balanced"}',
        is_staff_visible=True,
    )
    db.add(screen)
    db.flush()
    workspace.default_screen_id = screen.id

    admin = User(
        name=payload.admin_name,
        role="admin",
        password_hash=hash_password(payload.admin_password),
    )
    db.add(admin)
    seed_workspace_content(db, workspace)
    seed_action_definitions(db)

    if payload.ai_provider:
        endpoint_url = payload.ai_provider.endpoint_url.strip()
        if endpoint_url:
            try:
                endpoint_url = validate_http_url(endpoint_url)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
                ) from exc
        secret = None
        if payload.ai_provider.provider == "openai_compatible":
            secret = create_secret(db, "openai_compatible_api_key", payload.ai_provider.api_key)
        db.add(
            AIProviderSetting(
                provider=payload.ai_provider.provider,
                provider_type="cloud"
                if payload.ai_provider.provider == "openai_compatible"
                else "local",
                display_name=payload.ai_provider.display_name or "AIヘルプ",
                model=payload.ai_provider.model,
                endpoint_url=endpoint_url,
                auth_type="api_key"
                if payload.ai_provider.provider == "openai_compatible"
                else "none",
                api_key_secret_ref=secret.id if secret else None,
                is_enabled=True,
                is_default=True,
            )
        )

    mark_setup_complete(db)
    log_activity(db, action="setup.complete", target_type="workspace", target_id=workspace.id)
    db.commit()
    return SetupResult(workspace_id=workspace.id, admin_id=admin.id)

