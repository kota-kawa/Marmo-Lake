from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import ActivityLog


def log_activity(
    db: Session,
    *,
    action: str,
    target_type: str = "",
    target_id: str | None = None,
    result: str = "",
    user_id: str | None = None,
) -> ActivityLog:
    entry = ActivityLog(
        action=action,
        target_type=target_type,
        target_id=target_id,
        result=result[:2000],
        user_id=user_id,
    )
    db.add(entry)
    return entry

