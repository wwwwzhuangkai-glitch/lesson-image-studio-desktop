from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="LESSON_IMAGE_STUDIO_",
        env_file=".env",
        extra="ignore",
    )

    app_name: str = "Lesson Image Studio API"
    database_url: str | None = None
    data_dir: str | None = None
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    openai_model: str | None = None
    recent_owner_limit: int = 5
    default_export_format: str = "png"
    cors_origins: list[str] = ["http://127.0.0.1:5173", "http://localhost:5173"]

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parents[3]

    @property
    def resolved_data_dir(self) -> Path:
        if self.data_dir:
            return Path(self.data_dir).expanduser().resolve()
        return self.project_root / "data"

    @property
    def file_storage_dir(self) -> Path:
        return self.resolved_data_dir / "files"

    @property
    def database_path(self) -> Path:
        return self.resolved_data_dir / "app.db"

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"sqlite:///{self.database_path}"

    @property
    def builtin_preset_path(self) -> Path:
        return Path(__file__).resolve().parent / "data" / "system_presets.json"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def reset_settings_cache() -> None:
    get_settings.cache_clear()
