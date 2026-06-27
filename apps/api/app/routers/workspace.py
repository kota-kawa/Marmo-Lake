from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_admin, require_setup
from app.models import Screen, User, Workspace
from app.schemas import (
    ScreenCreate,
    ScreenRead,
    ScreenUpdate,
    WorkspaceRead,
    WorkspaceUpdate,
)
from app.services.activity import log_activity

router = APIRouter(tags=["workspace"], dependencies=[Depends(require_setup)])


def _workspace(db: Session) -> Workspace:
    workspace = db.scalar(select(Workspace).order_by(Workspace.created_at.asc()))
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ワークスペースがありません。")
    return workspace


@router.get("/workspace", response_model=WorkspaceRead)
def get_workspace(db: Session = Depends(get_db)) -> Workspace:
    return _workspace(db)


@router.patch("/workspace", response_model=WorkspaceRead)
def update_workspace(
    payload: WorkspaceUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> Workspace:
    workspace = _workspace(db)
    if payload.name is not None:
        workspace.name = payload.name
    if payload.theme is not None:
        workspace.theme = payload.theme
    log_activity(db, action="workspace.update", target_type="workspace", target_id=workspace.id, user_id=admin.id)
    db.commit()
    db.refresh(workspace)
    return workspace


@router.get("/screens", response_model=list[ScreenRead])
def list_screens(db: Session = Depends(get_db)) -> list[Screen]:
    return list(db.scalars(select(Screen).where(Screen.is_staff_visible.is_(True))).all())


@router.post("/screens", response_model=ScreenRead, status_code=status.HTTP_201_CREATED)
def create_screen(
    payload: ScreenCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> Screen:
    workspace = _workspace(db)
    screen = Screen(workspace_id=workspace.id, **payload.model_dump())
    db.add(screen)
    log_activity(db, action="screen.create", target_type="screen", target_id=screen.id, user_id=admin.id)
    db.commit()
    db.refresh(screen)
    return screen


@router.patch("/screens/{screen_id}", response_model=ScreenRead)
def update_screen(
    screen_id: str,
    payload: ScreenUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> Screen:
    screen = db.get(Screen, screen_id)
    if not screen:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画面が見つかりません。")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(screen, key, value)
    log_activity(db, action="screen.update", target_type="screen", target_id=screen.id, user_id=admin.id)
    db.commit()
    db.refresh(screen)
    return screen


@router.delete("/screens/{screen_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_screen(
    screen_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> None:
    screen = db.get(Screen, screen_id)
    if not screen:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画面が見つかりません。")
    db.delete(screen)
    log_activity(db, action="screen.delete", target_type="screen", target_id=screen_id, user_id=admin.id)
    db.commit()

