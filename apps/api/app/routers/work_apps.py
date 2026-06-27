from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import validate_http_url
from app.deps import get_current_admin, get_optional_admin, require_setup
from app.models import User, WorkApp
from app.schemas import WorkAppCreate, WorkAppRead, WorkAppUpdate
from app.services.activity import log_activity

router = APIRouter(prefix="/work-apps", tags=["work-apps"], dependencies=[Depends(require_setup)])


@router.get("", response_model=list[WorkAppRead])
def list_work_apps(
    include_hidden: bool = Query(default=False),
    db: Session = Depends(get_db),
    admin: User | None = Depends(get_optional_admin),
) -> list[WorkApp]:
    query = select(WorkApp).order_by(WorkApp.sort_order.asc(), WorkApp.created_at.asc())
    if not include_hidden or admin is None:
        query = query.where(WorkApp.is_staff_visible.is_(True))
    return list(db.scalars(query).all())


@router.post("", response_model=WorkAppRead, status_code=status.HTTP_201_CREATED)
def create_work_app(
    payload: WorkAppCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> WorkApp:
    try:
        url = validate_http_url(payload.url)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    app = WorkApp(**payload.model_dump(exclude={"url"}), url=url, source_type="url")
    db.add(app)
    log_activity(db, action="work_app.create", target_type="work_app", target_id=app.id, user_id=admin.id)
    db.commit()
    db.refresh(app)
    return app


@router.patch("/{app_id}", response_model=WorkAppRead)
def update_work_app(
    app_id: str,
    payload: WorkAppUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> WorkApp:
    app = db.get(WorkApp, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="業務画面が見つかりません。")
    data = payload.model_dump(exclude_unset=True)
    if "url" in data:
        try:
            data["url"] = validate_http_url(data["url"])
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    for key, value in data.items():
        setattr(app, key, value)
    log_activity(db, action="work_app.update", target_type="work_app", target_id=app.id, user_id=admin.id)
    db.commit()
    db.refresh(app)
    return app


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_work_app(
    app_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> None:
    app = db.get(WorkApp, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="業務画面が見つかりません。")
    db.delete(app)
    log_activity(db, action="work_app.delete", target_type="work_app", target_id=app_id, user_id=admin.id)
    db.commit()

