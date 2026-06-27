from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import validate_http_url
from app.deps import get_current_admin, get_optional_admin, require_setup
from app.models import AIActionDefinition, AIProviderSetting, Secret, User
from app.schemas import (
    AIActionDefinitionRead,
    AIActionExecuteRequest,
    AIActionExecuteResponse,
    AIActionPlanRequest,
    AIActionPlanResponse,
    AIChatRequest,
    AIChatResponse,
    AIProviderCreate,
    AIProviderRead,
    AIProviderUpdate,
)
from app.services.activity import log_activity
from app.services.ai import (
    chat_with_provider,
    execute_action,
    get_default_provider,
    persist_chat,
    plan_actions,
    serialize_provider,
    test_provider,
)
from app.services.bootstrap import seed_action_definitions
from app.services.secrets import create_secret, update_secret

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(require_setup)])


@router.get("/providers", response_model=list[AIProviderRead])
def list_providers(db: Session = Depends(get_db)) -> list[dict]:
    providers = db.scalars(select(AIProviderSetting).order_by(AIProviderSetting.created_at.asc())).all()
    return [serialize_provider(provider) for provider in providers]


@router.post("/providers", response_model=AIProviderRead, status_code=status.HTTP_201_CREATED)
def create_provider(
    payload: AIProviderCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> dict:
    endpoint_url = payload.endpoint_url.strip()
    if endpoint_url:
        try:
            endpoint_url = validate_http_url(endpoint_url)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    if payload.is_default:
        for provider in db.scalars(select(AIProviderSetting)).all():
            provider.is_default = False
    secret = None
    if payload.provider == "openai_compatible":
        secret = create_secret(db, "openai_compatible_api_key", payload.api_key)
    provider = AIProviderSetting(
        provider=payload.provider,
        provider_type="cloud" if payload.provider == "openai_compatible" else "local",
        display_name=payload.display_name,
        model=payload.model,
        endpoint_url=endpoint_url,
        auth_type="api_key" if payload.provider == "openai_compatible" else "none",
        api_key_secret_ref=secret.id if secret else None,
        is_enabled=payload.is_enabled,
        is_default=payload.is_default,
        capabilities_json=json.dumps({"chat": True, "actions": True}, ensure_ascii=False),
    )
    db.add(provider)
    log_activity(db, action="ai.provider.create", target_type="ai_provider", target_id=provider.id, user_id=admin.id)
    db.commit()
    db.refresh(provider)
    return serialize_provider(provider)


@router.patch("/providers/{provider_id}", response_model=AIProviderRead)
def update_provider(
    provider_id: str,
    payload: AIProviderUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> dict:
    provider = db.get(AIProviderSetting, provider_id)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AIプロバイダーが見つかりません。")
    data = payload.model_dump(exclude_unset=True)
    if data.get("endpoint_url"):
        try:
            data["endpoint_url"] = validate_http_url(data["endpoint_url"])
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    api_key = data.pop("api_key", None)
    if api_key:
        secret = db.get(Secret, provider.api_key_secret_ref) if provider.api_key_secret_ref else None
        secret = update_secret(db, secret, f"{provider.provider}_api_key", api_key)
        provider.api_key_secret_ref = secret.id if secret else provider.api_key_secret_ref
    if data.get("is_default") is True:
        for other in db.scalars(select(AIProviderSetting)).all():
            other.is_default = False
    for key, value in data.items():
        setattr(provider, key, value)
    log_activity(db, action="ai.provider.update", target_type="ai_provider", target_id=provider.id, user_id=admin.id)
    db.commit()
    db.refresh(provider)
    return serialize_provider(provider)


@router.post("/providers/{provider_id}/test")
async def test_ai_provider(
    provider_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> dict:
    provider = db.get(AIProviderSetting, provider_id)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AIプロバイダーが見つかりません。")
    try:
        result = await test_provider(db, provider)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"接続できません: {exc}") from exc
    log_activity(db, action="ai.provider.test", target_type="ai_provider", target_id=provider.id, user_id=admin.id)
    db.commit()
    return result


@router.post("/chat", response_model=AIChatResponse)
async def chat(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
) -> AIChatResponse:
    provider = get_default_provider(db, payload.provider_id)
    messages = [
        {
            "role": "system",
            "content": (
                "You are Marmo Lake AI Help. Be brief, practical, and safe. "
                "Do not claim to perform actions outside registered Marmo Lake actions."
            ),
        }
    ]
    if payload.send_context_summary:
        messages.append({"role": "system", "content": f"Visible workspace context: {payload.send_context_summary}"})
    messages.append({"role": "user", "content": payload.message})
    try:
        reply = await chat_with_provider(db, provider, messages)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI応答に失敗しました: {exc}") from exc
    conversation_id = persist_chat(
        db,
        provider=provider,
        user_message=payload.message,
        assistant_message=reply,
        conversation_id=payload.conversation_id,
    )
    log_activity(db, action="ai.chat", target_type="ai_conversation", target_id=conversation_id)
    db.commit()
    return AIChatResponse(
        conversation_id=conversation_id,
        message=reply,
        provider=provider.display_name,
        model=provider.model,
    )


@router.get("/actions", response_model=list[AIActionDefinitionRead])
def actions(db: Session = Depends(get_db)) -> list:
    seed_action_definitions(db)
    db.commit()
    return list(db.scalars(select(AIActionDefinition)).all())


@router.post("/actions/plan", response_model=AIActionPlanResponse)
def action_plan(payload: AIActionPlanRequest, db: Session = Depends(get_db)) -> AIActionPlanResponse:
    return AIActionPlanResponse(proposals=plan_actions(db, payload.prompt))


@router.post("/actions/execute", response_model=AIActionExecuteResponse)
def action_execute(
    payload: AIActionExecuteRequest,
    db: Session = Depends(get_db),
    admin: User | None = Depends(get_optional_admin),
) -> AIActionExecuteResponse:
    result = execute_action(
        db,
        action_key=payload.action_key,
        input_data=payload.input,
        confirmed=payload.confirmed,
        user_id=admin.id if admin else None,
    )
    return AIActionExecuteResponse(**result)
