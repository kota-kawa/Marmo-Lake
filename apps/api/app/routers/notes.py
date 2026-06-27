from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_admin, get_optional_admin, require_setup
from app.models import Note, User
from app.schemas import NoteCreate, NoteRead, NoteUpdate
from app.services.activity import log_activity

router = APIRouter(prefix="/notes", tags=["notes"], dependencies=[Depends(require_setup)])


@router.get("", response_model=list[NoteRead])
def list_notes(
    include_hidden: bool = Query(default=False),
    db: Session = Depends(get_db),
    admin: User | None = Depends(get_optional_admin),
) -> list[Note]:
    query = select(Note).order_by(Note.is_pinned.desc(), Note.updated_at.desc())
    if not include_hidden or admin is None:
        query = query.where(Note.is_staff_visible.is_(True))
    return list(db.scalars(query).all())


@router.post("", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
def create_note(
    payload: NoteCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> Note:
    note = Note(**payload.model_dump())
    db.add(note)
    log_activity(db, action="note.create", target_type="note", target_id=note.id, user_id=admin.id)
    db.commit()
    db.refresh(note)
    return note


@router.patch("/{note_id}", response_model=NoteRead)
def update_note(
    note_id: str,
    payload: NoteUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> Note:
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="メモが見つかりません。")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(note, key, value)
    log_activity(db, action="note.update", target_type="note", target_id=note.id, user_id=admin.id)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> None:
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="メモが見つかりません。")
    db.delete(note)
    log_activity(db, action="note.delete", target_type="note", target_id=note_id, user_id=admin.id)
    db.commit()

