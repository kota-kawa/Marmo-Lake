from __future__ import annotations

import json
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import (
    AIActionDefinition,
    AIActionExecution,
    AIConversation,
    AIMessage,
    AIProviderSetting,
    Announcement,
    Checklist,
    ChecklistItem,
    FileItem,
    Note,
    Secret,
    WorkApp,
)
from app.schemas import AIActionProposal
from app.services.activity import log_activity
from app.services.secrets import read_secret


def serialize_provider(provider: AIProviderSetting) -> dict[str, Any]:
    return {
        "id": provider.id,
        "provider": provider.provider,
        "provider_type": provider.provider_type,
        "display_name": provider.display_name,
        "model": provider.model,
        "endpoint_url": provider.endpoint_url,
        "auth_type": provider.auth_type,
        "is_enabled": provider.is_enabled,
        "is_default": provider.is_default,
        "has_api_key": bool(provider.api_key_secret_ref),
        "created_at": provider.created_at,
        "updated_at": provider.updated_at,
    }


def get_default_provider(db: Session, provider_id: str | None = None) -> AIProviderSetting:
    query = select(AIProviderSetting).where(AIProviderSetting.is_enabled.is_(True))
    if provider_id:
        query = query.where(AIProviderSetting.id == provider_id)
    else:
        query = query.where(AIProviderSetting.is_default.is_(True))
    provider = db.scalar(query)
    if not provider and not provider_id:
        provider = db.scalar(select(AIProviderSetting).where(AIProviderSetting.is_enabled.is_(True)))
    if not provider:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="AIプロバイダーが未設定です。")
    return provider


def _provider_secret(db: Session, provider: AIProviderSetting) -> str:
    if not provider.api_key_secret_ref:
        return ""
    secret = db.get(Secret, provider.api_key_secret_ref)
    return read_secret(secret)


async def chat_with_provider(
    db: Session,
    provider: AIProviderSetting,
    messages: list[dict[str, str]],
) -> str:
    if provider.provider == "ollama":
        endpoint = (provider.endpoint_url or "http://127.0.0.1:11434").rstrip("/")
        model = provider.model or "llama3.1"
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            response = await client.post(
                f"{endpoint}/api/chat",
                json={"model": model, "messages": messages, "stream": False},
            )
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "").strip()

    endpoint = (provider.endpoint_url or "https://api.openai.com/v1").rstrip("/")
    model = provider.model or "gpt-4o-mini"
    api_key = _provider_secret(db, provider)
    if not api_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="APIキーが未設定です。")
    headers = {"Authorization": f"Bearer {api_key}"}
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        response = await client.post(
            f"{endpoint}/chat/completions",
            headers=headers,
            json={"model": model, "messages": messages, "temperature": 0.3},
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()


async def test_provider(db: Session, provider: AIProviderSetting) -> dict[str, Any]:
    if provider.provider == "ollama":
        endpoint = (provider.endpoint_url or "http://127.0.0.1:11434").rstrip("/")
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(f"{endpoint}/api/tags")
            response.raise_for_status()
            data = response.json()
            return {"ok": True, "models": [item.get("name") for item in data.get("models", [])]}
    reply = await chat_with_provider(
        db,
        provider,
        [{"role": "user", "content": "Reply with exactly: OK"}],
    )
    return {"ok": True, "message": reply[:120]}


def persist_chat(
    db: Session,
    *,
    provider: AIProviderSetting,
    user_message: str,
    assistant_message: str,
    conversation_id: str | None,
) -> str:
    conversation = db.get(AIConversation, conversation_id) if conversation_id else None
    if not conversation:
        conversation = AIConversation(
            title=user_message[:80],
            provider=provider.provider,
            model=provider.model,
        )
        db.add(conversation)
        db.flush()
    db.add(AIMessage(conversation_id=conversation.id, role="user", content=user_message))
    db.add(AIMessage(conversation_id=conversation.id, role="assistant", content=assistant_message))
    return conversation.id


def list_search_hits(db: Session, query: str, limit: int = 8) -> list[dict[str, Any]]:
    token = f"%{query.strip()}%"
    if not query.strip():
        return []
    hits: list[dict[str, Any]] = []
    for app in db.scalars(
        select(WorkApp)
        .where(WorkApp.is_staff_visible.is_(True))
        .where(or_(WorkApp.name.like(token), WorkApp.category.like(token), WorkApp.url.like(token)))
        .limit(limit)
    ):
        hits.append({"type": "work_app", "id": app.id, "title": app.name, "subtitle": app.category})
    for note in db.scalars(
        select(Note)
        .where(Note.is_staff_visible.is_(True))
        .where(or_(Note.title.like(token), Note.body.like(token)))
        .limit(limit)
    ):
        hits.append({"type": "note", "id": note.id, "title": note.title, "subtitle": "メモ"})
    for announcement in db.scalars(
        select(Announcement)
        .where(Announcement.is_visible.is_(True))
        .where(or_(Announcement.title.like(token), Announcement.body.like(token)))
        .limit(limit)
    ):
        hits.append({"type": "announcement", "id": announcement.id, "title": announcement.title, "subtitle": "お知らせ"})
    for checklist in db.scalars(
        select(Checklist)
        .where(Checklist.is_staff_visible.is_(True))
        .where(or_(Checklist.title.like(token), Checklist.description.like(token)))
        .limit(limit)
    ):
        hits.append({"type": "checklist", "id": checklist.id, "title": checklist.title, "subtitle": "チェック"})
    for file_item in db.scalars(
        select(FileItem)
        .where(FileItem.is_staff_visible.is_(True))
        .where(or_(FileItem.name.like(token), FileItem.category.like(token)))
        .limit(limit)
    ):
        hits.append({"type": "file", "id": file_item.id, "title": file_item.name, "subtitle": file_item.category})
    return hits[:limit]


def plan_actions(db: Session, prompt: str) -> list[AIActionProposal]:
    text = prompt.lower()
    proposals: list[AIActionProposal] = []

    for app in db.scalars(select(WorkApp).where(WorkApp.is_staff_visible.is_(True))).all():
        if app.name.lower() in text or app.category.lower() in text:
            proposals.append(
                AIActionProposal(
                    action_key="open_app",
                    title=f"{app.name}を開く",
                    summary=f"{app.category}の画面を開きます。",
                    input={"target_type": "work_app", "target_id": app.id},
                    risk_level="low",
                    requires_confirmation=False,
                )
            )
            break

    if "チェック" in prompt or "完了" in prompt or "済" in prompt:
        for item in db.scalars(select(ChecklistItem)).all():
            if item.label.lower() in text:
                proposals.append(
                    AIActionProposal(
                        action_key="update_checklist_item",
                        title=f"{item.label}を完了にする",
                        summary="チェックリスト項目を更新します。",
                        input={"item_id": item.id, "is_done": True},
                        risk_level="medium",
                        requires_confirmation=True,
                    )
                )
                break

    if "メモ" in prompt or "申し送り" in prompt or "下書き" in prompt:
        title = "AI下書き"
        if "作成" in prompt or "残" in prompt:
            proposals.append(
                AIActionProposal(
                    action_key="create_note",
                    title="メモを作成",
                    summary="内容を確認してから共有メモとして保存します。",
                    input={"title": title, "body": prompt, "is_pinned": True, "is_staff_visible": True},
                    risk_level="medium",
                    requires_confirmation=True,
                )
            )
        else:
            proposals.append(
                AIActionProposal(
                    action_key="draft_note",
                    title="メモ下書き",
                    summary="保存せずに下書きを作ります。",
                    input={"prompt": prompt},
                    risk_level="low",
                    requires_confirmation=False,
                )
            )

    if not proposals:
        proposals.append(
            AIActionProposal(
                action_key="search_workspace_basic",
                title="ワークスペースを探す",
                summary="登録済みの画面、メモ、書類から探します。",
                input={"query": prompt},
                risk_level="low",
                requires_confirmation=False,
            )
        )
    return proposals[:3]


def execute_action(
    db: Session,
    *,
    action_key: str,
    input_data: dict[str, Any],
    confirmed: bool,
    user_id: str | None = None,
) -> dict[str, Any]:
    definition = db.scalar(
        select(AIActionDefinition).where(
            AIActionDefinition.key == action_key,
            AIActionDefinition.is_enabled.is_(True),
        )
    )
    if not definition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Actionが登録されていません。")
    if definition.requires_confirmation and not confirmed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="実行前の確認が必要です。")

    execution = AIActionExecution(
        action_key=action_key,
        requested_by_user_id=user_id,
        approved_by_user_id=user_id if confirmed else None,
        status="running",
        input_json=json.dumps(input_data, ensure_ascii=False),
        risk_level=definition.risk_level,
        requires_confirmation=definition.requires_confirmation,
    )
    db.add(execution)
    db.flush()

    result: dict[str, Any]
    if action_key == "open_app":
        result = _execute_open_app(db, input_data)
    elif action_key == "search_workspace_basic":
        result = {"hits": list_search_hits(db, str(input_data.get("query", "")))}
    elif action_key == "draft_note":
        result = {"title": "下書き", "body": str(input_data.get("prompt", "")).strip()}
    elif action_key == "create_note":
        note = Note(
            title=str(input_data.get("title") or "AIメモ")[:140],
            body=str(input_data.get("body") or ""),
            is_pinned=bool(input_data.get("is_pinned", True)),
            is_staff_visible=bool(input_data.get("is_staff_visible", True)),
        )
        db.add(note)
        db.flush()
        result = {"note_id": note.id, "title": note.title}
    elif action_key == "update_checklist_item":
        item = _find_checklist_item(db, input_data)
        item.is_done = bool(input_data.get("is_done", True))
        result = {"item_id": item.id, "label": item.label, "is_done": item.is_done}
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="未対応のActionです。")

    execution.status = "completed"
    execution.result_json = json.dumps(result, ensure_ascii=False)
    from app.core.security import utcnow

    execution.completed_at = utcnow()
    log_activity(
        db,
        action=f"ai_action.{action_key}",
        target_type="ai_action",
        target_id=execution.id,
        result=json.dumps(result, ensure_ascii=False),
        user_id=user_id,
    )
    db.commit()
    return {"execution_id": execution.id, "status": execution.status, "result": result}


def _execute_open_app(db: Session, input_data: dict[str, Any]) -> dict[str, Any]:
    if input_data.get("target_type") == "work_app":
        app = db.get(WorkApp, input_data.get("target_id"))
        if not app or not app.is_staff_visible:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="画面が見つかりません。")
        return {
            "target_type": "work_app",
            "target_id": app.id,
            "name": app.name,
            "url": app.url,
            "display_mode": app.display_mode,
        }
    return {"target_type": str(input_data.get("target_type", "home")), "target_id": input_data.get("target_id")}


def _find_checklist_item(db: Session, input_data: dict[str, Any]) -> ChecklistItem:
    if input_data.get("item_id"):
        item = db.get(ChecklistItem, input_data["item_id"])
        if item:
            return item
    label = str(input_data.get("label", "")).strip()
    if label:
        item = db.scalar(select(ChecklistItem).where(ChecklistItem.label.like(f"%{label}%")))
        if item:
            return item
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="チェック項目が見つかりません。")

