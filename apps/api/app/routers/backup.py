from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import utcnow
from app.deps import get_current_admin, require_setup
from app.models import (
    AIActionDefinition,
    AIProviderSetting,
    Announcement,
    Checklist,
    ChecklistItem,
    FileItem,
    Note,
    Screen,
    User,
    WorkApp,
    Workspace,
)
from app.schemas import BackupCreateResponse
from app.services.activity import log_activity

router = APIRouter(prefix="/backup", tags=["backup"], dependencies=[Depends(require_setup)])


def _rows(db: Session, model: type) -> list[dict]:
    return [
        {key: value for key, value in row.__dict__.items() if not key.startswith("_")}
        for row in db.scalars(select(model)).all()
    ]


def _json_safe(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


@router.post("/create", response_model=BackupCreateResponse)
def create_backup(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> BackupCreateResponse:
    exported_at = utcnow()
    providers = []
    for provider in db.scalars(select(AIProviderSetting)).all():
        providers.append(
            {
                "id": provider.id,
                "provider": provider.provider,
                "provider_type": provider.provider_type,
                "display_name": provider.display_name,
                "model": provider.model,
                "endpoint_url": provider.endpoint_url,
                "auth_type": provider.auth_type,
                "is_enabled": provider.is_enabled,
                "is_default": provider.is_default,
                "has_api_key": bool(provider.api_key_secret_ref),
                "created_at": provider.created_at,
                "updated_at": provider.updated_at,
            }
        )
    data = {
        "version": "0.1.0",
        "exported_at": exported_at,
        "workspace": _rows(db, Workspace),
        "screens": _rows(db, Screen),
        "work_apps": _rows(db, WorkApp),
        "notes": _rows(db, Note),
        "announcements": _rows(db, Announcement),
        "checklists": _rows(db, Checklist),
        "checklist_items": _rows(db, ChecklistItem),
        "files": _rows(db, FileItem),
        "ai_providers": providers,
        "ai_actions": _rows(db, AIActionDefinition),
        "excluded": ["secret values", "uploaded file bodies", "sessions"],
    }
    filename = f"marmo-lake-backup-{exported_at.strftime('%Y%m%d-%H%M%S')}.json"
    settings.ensure_directories()
    backup_path = settings.backup_dir / filename
    backup_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, default=_json_safe),
        encoding="utf-8",
    )
    log_activity(db, action="backup.create", target_type="backup", target_id=filename, user_id=admin.id)
    db.commit()
    return BackupCreateResponse(filename=filename, exported_at=exported_at, data=data)

