from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class APIError(BaseModel):
    detail: str


class SetupStatus(BaseModel):
    is_setup_complete: bool


class AIProviderSetup(BaseModel):
    provider: Literal["openai_compatible", "ollama"]
    display_name: str = "AIヘルプ"
    endpoint_url: str = ""
    model: str = ""
    api_key: str = ""


class SetupCreate(BaseModel):
    admin_name: str = Field(min_length=1, max_length=80)
    admin_password: str = Field(min_length=8, max_length=200)
    workspace_name: str = Field(min_length=1, max_length=100)
    use_case: Literal["store", "classroom", "office", "community", "personal", "empty"] = "store"
    ai_provider: AIProviderSetup | None = None


class SetupResult(BaseModel):
    workspace_id: str
    admin_id: str


class AdminLogin(BaseModel):
    password: str


class SessionMe(BaseModel):
    is_admin: bool
    admin_name: str | None = None
    csrf_token: str | None = None


class WorkspaceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    use_case: str
    theme: str
    default_screen_id: str | None = None
    created_at: datetime
    updated_at: datetime


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    theme: str | None = Field(default=None, max_length=60)


class ScreenRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    name: str
    mode: str
    layout_json: str
    is_staff_visible: bool
    created_at: datetime
    updated_at: datetime


class ScreenCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    mode: str = "staff"
    layout_json: str = "{}"
    is_staff_visible: bool = True


class ScreenUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    mode: str | None = None
    layout_json: str | None = None
    is_staff_visible: bool | None = None


class WorkAppRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    url: str
    source_type: str
    display_mode: str
    category: str
    icon: str
    description: str
    is_staff_visible: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class WorkAppCreate(BaseModel):
    name: str = Field(min_length=1, max_length=140)
    url: str = Field(min_length=4, max_length=2000)
    display_mode: Literal["embed", "external"] = "embed"
    category: str = Field(default="業務", max_length=80)
    icon: str = Field(default="briefcase", max_length=60)
    description: str = Field(default="", max_length=1000)
    is_staff_visible: bool = True
    sort_order: int = 0


class WorkAppUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=140)
    url: str | None = Field(default=None, min_length=4, max_length=2000)
    display_mode: Literal["embed", "external"] | None = None
    category: str | None = Field(default=None, max_length=80)
    icon: str | None = Field(default=None, max_length=60)
    description: str | None = Field(default=None, max_length=1000)
    is_staff_visible: bool | None = None
    sort_order: int | None = None


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    body: str
    is_pinned: bool
    is_staff_visible: bool
    created_at: datetime
    updated_at: datetime


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    body: str = Field(default="", max_length=8000)
    is_pinned: bool = False
    is_staff_visible: bool = True


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=140)
    body: str | None = Field(default=None, max_length=8000)
    is_pinned: bool | None = None
    is_staff_visible: bool | None = None


class AnnouncementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    body: str
    priority: str
    is_visible: bool
    starts_at: datetime | None
    ends_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    body: str = Field(default="", max_length=6000)
    priority: Literal["normal", "important"] = "normal"
    is_visible: bool = True


class AnnouncementUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=140)
    body: str | None = Field(default=None, max_length=6000)
    priority: Literal["normal", "important"] | None = None
    is_visible: bool | None = None


class ChecklistItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    checklist_id: str
    label: str
    sort_order: int
    is_done: bool
    created_at: datetime
    updated_at: datetime


class ChecklistRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str
    reset_policy: str
    is_staff_visible: bool
    items: list[ChecklistItemRead] = []
    created_at: datetime
    updated_at: datetime


class ChecklistCreate(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    description: str = Field(default="", max_length=2000)
    is_staff_visible: bool = True
    items: list[str] = Field(default_factory=list)


class ChecklistUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=140)
    description: str | None = Field(default=None, max_length=2000)
    is_staff_visible: bool | None = None


class ChecklistItemCreate(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    sort_order: int | None = None


class ChecklistItemUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=200)
    sort_order: int | None = None
    is_done: bool | None = None


class FileItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    mime_type: str
    size: int
    category: str
    is_staff_visible: bool
    created_at: datetime
    updated_at: datetime


class AIProviderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provider: str
    provider_type: str
    display_name: str
    model: str
    endpoint_url: str
    auth_type: str
    is_enabled: bool
    is_default: bool
    has_api_key: bool = False
    created_at: datetime
    updated_at: datetime


class AIProviderCreate(BaseModel):
    provider: Literal["openai_compatible", "ollama"]
    display_name: str = Field(default="AIヘルプ", max_length=120)
    endpoint_url: str = Field(default="", max_length=1000)
    model: str = Field(default="", max_length=120)
    api_key: str = Field(default="", max_length=4000)
    is_default: bool = True
    is_enabled: bool = True


class AIProviderUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    endpoint_url: str | None = Field(default=None, max_length=1000)
    model: str | None = Field(default=None, max_length=120)
    api_key: str | None = Field(default=None, max_length=4000)
    is_default: bool | None = None
    is_enabled: bool | None = None


class AIChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class AIChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    provider_id: str | None = None
    conversation_id: str | None = None
    send_context_summary: str = Field(default="", max_length=2000)


class AIChatResponse(BaseModel):
    conversation_id: str
    message: str
    provider: str
    model: str


class AIActionDefinitionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    key: str
    name: str
    description: str
    module_key: str
    required_role: str
    risk_level: str
    requires_confirmation: bool
    is_undoable: bool
    is_enabled: bool


class AIActionPlanRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)


class AIActionProposal(BaseModel):
    action_key: str
    title: str
    summary: str
    input: dict[str, Any]
    risk_level: str
    requires_confirmation: bool


class AIActionPlanResponse(BaseModel):
    proposals: list[AIActionProposal]


class AIActionExecuteRequest(BaseModel):
    action_key: str
    input: dict[str, Any] = Field(default_factory=dict)
    confirmed: bool = False


class AIActionExecuteResponse(BaseModel):
    execution_id: str
    status: str
    result: dict[str, Any]


class BackupCreateResponse(BaseModel):
    filename: str
    exported_at: datetime
    data: dict[str, Any]

