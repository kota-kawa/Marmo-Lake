from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_DATA_DIR = REPO_ROOT / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="MARMO_", extra="ignore")

    app_name: str = "Marmo Lake"
    data_dir: Path = DEFAULT_DATA_DIR
    database_url: str = f"sqlite:///{DEFAULT_DATA_DIR / 'marmo.db'}"
    allowed_origins: str = "http://127.0.0.1:5173,http://localhost:5173"
    secret_key: str | None = None
    session_days: int = 7
    upload_max_bytes: int = 10 * 1024 * 1024
    request_timeout_seconds: float = 45.0
    public_base_url: str = "http://127.0.0.1:5173"
    environment: str = Field(default="development")

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def upload_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def backup_dir(self) -> Path:
        return self.data_dir / "backups"

    def ensure_directories(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.backup_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()

