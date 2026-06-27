from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.deps import get_current_admin, get_optional_admin, require_setup
from app.models import Checklist, ChecklistItem, User
from app.schemas import (
    ChecklistCreate,
    ChecklistItemCreate,
    ChecklistItemRead,
    ChecklistItemUpdate,
    ChecklistRead,
    ChecklistUpdate,
)
from app.services.activity import log_activity

router = APIRouter(prefix="/checklists", tags=["checklists"], dependencies=[Depends(require_setup)])


@router.get("", response_model=list[ChecklistRead])
def list_checklists(
    include_hidden: bool = Query(default=False),
    db: Session = Depends(get_db),
    admin: User | None = Depends(get_optional_admin),
) -> list[Checklist]:
    query = select(Checklist).options(selectinload(Checklist.items)).order_by(Checklist.updated_at.desc())
    if not include_hidden or admin is None:
        query = query.where(Checklist.is_staff_visible.is_(True))
    return list(db.scalars(query).unique().all())


@router.post("", response_model=ChecklistRead, status_code=status.HTTP_201_CREATED)
def create_checklist(
    payload: ChecklistCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> Checklist:
    checklist = Checklist(
        title=payload.title,
        description=payload.description,
        is_staff_visible=payload.is_staff_visible,
    )
    db.add(checklist)
    db.flush()
    for index, label in enumerate(payload.items):
        db.add(ChecklistItem(checklist_id=checklist.id, label=label, sort_order=index))
    log_activity(
        db,
        action="checklist.create",
        target_type="checklist",
        target_id=checklist.id,
        user_id=admin.id,
    )
    db.commit()
    db.refresh(checklist)
    return checklist


@router.patch("/{checklist_id}", response_model=ChecklistRead)
def update_checklist(
    checklist_id: str,
    payload: ChecklistUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> Checklist:
    checklist = db.get(Checklist, checklist_id)
    if not checklist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="チェックリストが見つかりません。")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(checklist, key, value)
    log_activity(
        db,
        action="checklist.update",
        target_type="checklist",
        target_id=checklist.id,
        user_id=admin.id,
    )
    db.commit()
    db.refresh(checklist)
    return checklist


@router.delete("/{checklist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_checklist(
    checklist_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> None:
    checklist = db.get(Checklist, checklist_id)
    if not checklist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="チェックリストが見つかりません。")
    db.delete(checklist)
    log_activity(
        db,
        action="checklist.delete",
        target_type="checklist",
        target_id=checklist_id,
        user_id=admin.id,
    )
    db.commit()


@router.post("/{checklist_id}/items", response_model=ChecklistItemRead, status_code=status.HTTP_201_CREATED)
def create_checklist_item(
    checklist_id: str,
    payload: ChecklistItemCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> ChecklistItem:
    checklist = db.get(Checklist, checklist_id)
    if not checklist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="チェックリストが見つかりません。")
    sort_order = payload.sort_order
    if sort_order is None:
        sort_order = len(checklist.items)
    item = ChecklistItem(checklist_id=checklist_id, label=payload.label, sort_order=sort_order)
    db.add(item)
    log_activity(db, action="checklist.item.create", target_type="checklist_item", target_id=item.id, user_id=admin.id)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{checklist_id}/items/{item_id}", response_model=ChecklistItemRead)
def update_checklist_item(
    checklist_id: str,
    item_id: str,
    payload: ChecklistItemUpdate,
    db: Session = Depends(get_db),
    admin: User | None = Depends(get_optional_admin),
) -> ChecklistItem:
    item = db.get(ChecklistItem, item_id)
    if not item or item.checklist_id != checklist_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="チェック項目が見つかりません。")
    data = payload.model_dump(exclude_unset=True)
    admin_fields = set(data) - {"is_done"}
    if admin_fields and admin is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="管理者ログインが必要です。")
    for key, value in data.items():
        setattr(item, key, value)
    log_activity(
        db,
        action="checklist.item.update",
        target_type="checklist_item",
        target_id=item.id,
        user_id=admin.id if admin else None,
        result=f"is_done={item.is_done}",
    )
    db.commit()
    db.refresh(item)
    return item


@router.post("/{checklist_id}/reset", response_model=ChecklistRead)
def reset_checklist(
    checklist_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> Checklist:
    checklist = db.get(Checklist, checklist_id)
    if not checklist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="チェックリストが見つかりません。")
    for item in checklist.items:
        item.is_done = False
    log_activity(db, action="checklist.reset", target_type="checklist", target_id=checklist.id, user_id=admin.id)
    db.commit()
    db.refresh(checklist)
    return checklist

