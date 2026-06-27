from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_admin, get_optional_admin, require_setup
from app.models import Announcement, User
from app.schemas import AnnouncementCreate, AnnouncementRead, AnnouncementUpdate
from app.services.activity import log_activity

router = APIRouter(prefix="/announcements", tags=["announcements"], dependencies=[Depends(require_setup)])


@router.get("", response_model=list[AnnouncementRead])
def list_announcements(
    include_hidden: bool = Query(default=False),
    db: Session = Depends(get_db),
    admin: User | None = Depends(get_optional_admin),
) -> list[Announcement]:
    query = select(Announcement).order_by(Announcement.priority.desc(), Announcement.updated_at.desc())
    if not include_hidden or admin is None:
        query = query.where(Announcement.is_visible.is_(True))
    return list(db.scalars(query).all())


@router.post("", response_model=AnnouncementRead, status_code=status.HTTP_201_CREATED)
def create_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> Announcement:
    announcement = Announcement(**payload.model_dump())
    db.add(announcement)
    log_activity(
        db,
        action="announcement.create",
        target_type="announcement",
        target_id=announcement.id,
        user_id=admin.id,
    )
    db.commit()
    db.refresh(announcement)
    return announcement


@router.patch("/{announcement_id}", response_model=AnnouncementRead)
def update_announcement(
    announcement_id: str,
    payload: AnnouncementUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> Announcement:
    announcement = db.get(Announcement, announcement_id)
    if not announcement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="お知らせが見つかりません。")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(announcement, key, value)
    log_activity(
        db,
        action="announcement.update",
        target_type="announcement",
        target_id=announcement.id,
        user_id=admin.id,
    )
    db.commit()
    db.refresh(announcement)
    return announcement


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(
    announcement_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> None:
    announcement = db.get(Announcement, announcement_id)
    if not announcement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="お知らせが見つかりません。")
    db.delete(announcement)
    log_activity(
        db,
        action="announcement.delete",
        target_type="announcement",
        target_id=announcement_id,
        user_id=admin.id,
    )
    db.commit()

