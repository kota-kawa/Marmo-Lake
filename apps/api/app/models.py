from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.security import utcnow


def new_id() -> str:
    return uuid.uuid4().hex


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Workspace(Base, TimestampMixin):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    use_case: Mapped[str] = mapped_column(String(60), default="empty")
    theme: Mapped[str] = mapped_column(String(60), default="lake")
    default_screen_id: Mapped[str | None] = mapped_column(String, nullable=True)


class Screen(Base, TimestampMixin):
    __tablename__ = "screens"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(String, ForeignKey("workspaces.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    mode: Mapped[str] = mapped_column(String(40), default="staff")
    layout_json: Mapped[str] = mapped_column(Text, default="{}")
    is_staff_visible: Mapped[bool] = mapped_column(Boolean, default=True)


class Tile(Base, TimestampMixin):
    __tablename__ = "tiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    screen_id: Mapped[str] = mapped_column(String, ForeignKey("screens.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    icon: Mapped[str] = mapped_column(String(60), default="app")
    category: Mapped[str] = mapped_column(String(80), default="general")
    position: Mapped[int] = mapped_column(Integer, default=0)
    size: Mapped[str] = mapped_column(String(20), default="medium")
    target_id: Mapped[str | None] = mapped_column(String, nullable=True)


class WorkApp(Base, TimestampMixin):
    __tablename__ = "work_apps"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(String(40), default="url")
    display_mode: Mapped[str] = mapped_column(String(40), default="embed")
    category: Mapped[str] = mapped_column(String(80), default="業務")
    icon: Mapped[str] = mapped_column(String(60), default="briefcase")
    description: Mapped[str] = mapped_column(Text, default="")
    is_staff_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Note(Base, TimestampMixin):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="")
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_staff_visible: Mapped[bool] = mapped_column(Boolean, default=True)


class Announcement(Base, TimestampMixin):
    __tablename__ = "announcements"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(30), default="normal")
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Checklist(Base, TimestampMixin):
    __tablename__ = "checklists"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    reset_policy: Mapped[str] = mapped_column(String(40), default="manual")
    is_staff_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    items: Mapped[list[ChecklistItem]] = relationship(
        back_populates="checklist", cascade="all, delete-orphan", order_by="ChecklistItem.sort_order"
    )


class ChecklistItem(Base, TimestampMixin):
    __tablename__ = "checklist_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    checklist_id: Mapped[str] = mapped_column(String, ForeignKey("checklists.id"), nullable=False)
    label: Mapped[str] = mapped_column(String(220), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)
    checklist: Mapped[Checklist] = relationship(back_populates="items")


class FileItem(Base, TimestampMixin):
    __tablename__ = "file_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(80), default="書類")
    is_staff_visible: Mapped[bool] = mapped_column(Boolean, default=True)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str] = mapped_column(String(40), default="admin")
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AuthSession(Base, TimestampMixin):
    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    csrf_token: Mapped[str] = mapped_column(String(120), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    user: Mapped[User] = relationship()


class Setting(Base, TimestampMixin):
    __tablename__ = "settings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    key: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    value: Mapped[str] = mapped_column(Text, default="")
    scope: Mapped[str] = mapped_column(String(60), default="system")


class Secret(Base, TimestampMixin):
    __tablename__ = "secrets"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    encrypted_value: Mapped[str] = mapped_column(Text, nullable=False)


class AIProviderSetting(Base, TimestampMixin):
    __tablename__ = "ai_provider_settings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    provider: Mapped[str] = mapped_column(String(60), nullable=False)
    provider_type: Mapped[str] = mapped_column(String(60), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    model: Mapped[str] = mapped_column(String(120), default="")
    endpoint_url: Mapped[str] = mapped_column(Text, default="")
    auth_type: Mapped[str] = mapped_column(String(60), default="api_key")
    api_key_secret_ref: Mapped[str | None] = mapped_column(String, ForeignKey("secrets.id"), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    config_json: Mapped[str] = mapped_column(Text, default="{}")
    capabilities_json: Mapped[str] = mapped_column(Text, default="{}")


class AIConversation(Base, TimestampMixin):
    __tablename__ = "ai_conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    workspace_id: Mapped[str | None] = mapped_column(String, nullable=True)
    title: Mapped[str] = mapped_column(String(160), default="AIヘルプ")
    provider: Mapped[str] = mapped_column(String(60), default="")
    model: Mapped[str] = mapped_column(String(120), default="")


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    conversation_id: Mapped[str] = mapped_column(String, ForeignKey("ai_conversations.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(40), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AIActionDefinition(Base, TimestampMixin):
    __tablename__ = "ai_action_definitions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    key: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    module_key: Mapped[str] = mapped_column(String(80), nullable=False)
    input_schema_json: Mapped[str] = mapped_column(Text, default="{}")
    result_schema_json: Mapped[str] = mapped_column(Text, default="{}")
    required_role: Mapped[str] = mapped_column(String(40), default="staff")
    risk_level: Mapped[str] = mapped_column(String(40), default="low")
    requires_confirmation: Mapped[bool] = mapped_column(Boolean, default=True)
    is_undoable: Mapped[bool] = mapped_column(Boolean, default=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class AIActionExecution(Base, TimestampMixin):
    __tablename__ = "ai_action_executions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    action_key: Mapped[str] = mapped_column(String(120), nullable=False)
    conversation_id: Mapped[str | None] = mapped_column(String, nullable=True)
    requested_by_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    approved_by_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="pending")
    input_json: Mapped[str] = mapped_column(Text, default="{}")
    result_json: Mapped[str] = mapped_column(Text, default="{}")
    risk_level: Mapped[str] = mapped_column(String(40), default="low")
    requires_confirmation: Mapped[bool] = mapped_column(Boolean, default=True)
    undo_action_key: Mapped[str | None] = mapped_column(String, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    target_type: Mapped[str] = mapped_column(String(80), default="")
    target_id: Mapped[str | None] = mapped_column(String, nullable=True)
    result: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

