from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.database import Base, get_db
from app.main import app


@pytest.fixture()
def client(tmp_path) -> Generator[TestClient, None, None]:
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def setup_workspace(client: TestClient) -> str:
    response = client.post(
        "/api/setup",
        json={
            "admin_name": "Owner",
            "admin_password": "strong-pass-123",
            "workspace_name": "Test Lake",
            "use_case": "store",
        },
    )
    assert response.status_code == 201, response.text
    login = client.post("/api/session/admin-login", json={"password": "strong-pass-123"})
    assert login.status_code == 200, login.text
    token = client.cookies.get("csrf_token")
    assert token
    return token


def test_setup_locks_and_creates_initial_workspace(client: TestClient) -> None:
    assert client.get("/api/setup/status").json() == {"is_setup_complete": False}
    token = setup_workspace(client)
    assert token
    assert client.get("/api/setup/status").json() == {"is_setup_complete": True}
    workspace = client.get("/api/workspace").json()
    assert workspace["name"] == "Test Lake"
    assert client.get("/api/notes").json()
    assert client.get("/api/checklists").json()


def test_admin_can_create_work_app_and_staff_can_read_it(client: TestClient) -> None:
    token = setup_workspace(client)
    response = client.post(
        "/api/work-apps",
        headers={"X-CSRF-Token": token},
        json={
            "name": "予約",
            "url": "http://localhost:3000",
            "category": "受付",
            "display_mode": "embed",
            "is_staff_visible": True,
        },
    )
    assert response.status_code == 201, response.text
    apps = client.get("/api/work-apps").json()
    assert apps[0]["name"] == "予約"
    assert apps[0]["url"] == "http://localhost:3000"


def test_staff_can_toggle_checklist_item(client: TestClient) -> None:
    setup_workspace(client)
    checklist = client.get("/api/checklists").json()[0]
    item = checklist["items"][0]
    response = client.patch(
        f"/api/checklists/{checklist['id']}/items/{item['id']}",
        json={"is_done": True},
    )
    assert response.status_code == 200, response.text
    assert response.json()["is_done"] is True


def test_ai_action_create_note_requires_confirmation(client: TestClient) -> None:
    setup_workspace(client)
    conflict = client.post(
        "/api/ai/actions/execute",
        json={"action_key": "create_note", "input": {"title": "AI", "body": "memo"}, "confirmed": False},
    )
    assert conflict.status_code == 409
    ok = client.post(
        "/api/ai/actions/execute",
        json={"action_key": "create_note", "input": {"title": "AI", "body": "memo"}, "confirmed": True},
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["result"]["title"] == "AI"


def test_backup_excludes_secret_values(client: TestClient) -> None:
    token = setup_workspace(client)
    provider = client.post(
        "/api/ai/providers",
        headers={"X-CSRF-Token": token},
        json={
            "provider": "openai_compatible",
            "display_name": "OpenAI",
            "endpoint_url": "https://api.openai.com/v1",
            "model": "gpt-4o-mini",
            "api_key": "sk-secret",
            "is_default": True,
            "is_enabled": True,
        },
    )
    assert provider.status_code == 201, provider.text
    backup = client.post("/api/backup/create", headers={"X-CSRF-Token": token})
    assert backup.status_code == 200, backup.text
    raw = backup.text
    assert "sk-secret" not in raw
    assert "has_api_key" in raw

