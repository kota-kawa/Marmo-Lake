from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import allowed_file_type, sanitize_filename
from app.deps import get_current_admin, get_optional_admin, require_setup
from app.models import FileItem, User, new_id
from app.schemas import FileItemRead
from app.services.activity import log_activity

router = APIRouter(prefix="/files", tags=["files"], dependencies=[Depends(require_setup)])


@router.get("", response_model=list[FileItemRead])
def list_files(
    include_hidden: bool = Query(default=False),
    db: Session = Depends(get_db),
    admin: User | None = Depends(get_optional_admin),
) -> list[FileItem]:
    query = select(FileItem).order_by(FileItem.updated_at.desc())
    if not include_hidden or admin is None:
        query = query.where(FileItem.is_staff_visible.is_(True))
    return list(db.scalars(query).all())


@router.post("/upload", response_model=FileItemRead, status_code=status.HTTP_201_CREATED)
def upload_file(
    upload: UploadFile = File(...),
    category: str = "書類",
    is_staff_visible: bool = True,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> FileItem:
    if not allowed_file_type(upload.content_type):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="対応していないファイル形式です。")

    settings.ensure_directories()
    file_id = new_id()
    name = sanitize_filename(upload.filename or "file")
    storage_path = settings.upload_dir / f"{file_id}_{name}"
    size = 0
    with storage_path.open("wb") as target:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > settings.upload_max_bytes:
                target.close()
                storage_path.unlink(missing_ok=True)
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="ファイルが大きすぎます。")
            target.write(chunk)

    item = FileItem(
        id=file_id,
        name=name,
        mime_type=upload.content_type or "application/octet-stream",
        size=size,
        storage_path=str(storage_path),
        category=category[:80],
        is_staff_visible=is_staff_visible,
    )
    db.add(item)
    log_activity(db, action="file.upload", target_type="file", target_id=item.id, user_id=admin.id)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{file_id}")
def get_file(
    file_id: str,
    db: Session = Depends(get_db),
    admin: User | None = Depends(get_optional_admin),
) -> FileResponse:
    item = db.get(FileItem, file_id)
    if not item or (not item.is_staff_visible and admin is None):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ファイルが見つかりません。")
    path = Path(item.storage_path)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ファイル本体が見つかりません。")
    return FileResponse(path, media_type=item.mime_type, filename=item.name, content_disposition_type="inline")


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> None:
    item = db.get(FileItem, file_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ファイルが見つかりません。")
    path = Path(item.storage_path)
    trash_dir = settings.data_dir / "deleted"
    trash_dir.mkdir(parents=True, exist_ok=True)
    if path.exists():
        shutil.move(str(path), str(trash_dir / path.name))
    db.delete(item)
    log_activity(db, action="file.delete", target_type="file", target_id=file_id, user_id=admin.id)
    db.commit()

