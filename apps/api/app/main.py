from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.routers import (
    ai,
    announcements,
    backup,
    checklists,
    files,
    notes,
    session,
    setup,
    work_apps,
    workspace,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Marmo Lake API",
    version="0.1.0",
    description="Local-first workspace API for Marmo Lake V1.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}


app.include_router(setup.router, prefix="/api")
app.include_router(session.router, prefix="/api")
app.include_router(workspace.router, prefix="/api")
app.include_router(work_apps.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(announcements.router, prefix="/api")
app.include_router(checklists.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(backup.router, prefix="/api")
app.include_router(ai.router, prefix="/api")

