from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from ..models import AppSettings

_SINGLETON_ID = "singleton"

_ALLOWED_FIELDS = {
    "openai_base_url",
    "openai_model",
    "default_export_format",
    "theme_mode",
    "theme_variant",
    "max_concurrent_jobs",
}

_ALLOWED_EXPORT_FORMATS = {"png", "jpeg", "webp"}
_ALLOWED_THEME_MODES = {"light", "dark"}
_ALLOWED_THEME_VARIANTS = {"graphite", "glass"}


def load_app_settings(db: Session) -> AppSettings:
    row = db.get(AppSettings, _SINGLETON_ID)
    if row is None:
        raise ValueError("AppSettings 单例行缺失，请先运行数据库迁移。")
    return row


def save_app_settings(db: Session, **patch: Any) -> AppSettings:
    row = load_app_settings(db)
    for field, value in patch.items():
        if value is None:
            continue
        if field not in _ALLOWED_FIELDS:
            raise ValueError(f"不支持通过 /api/settings 修改字段：{field}。")
        if field == "default_export_format" and value not in _ALLOWED_EXPORT_FORMATS:
            raise ValueError(f"导出格式必须是 {sorted(_ALLOWED_EXPORT_FORMATS)} 之一。")
        if field == "theme_mode" and value not in _ALLOWED_THEME_MODES:
            raise ValueError(f"主题明暗必须是 {sorted(_ALLOWED_THEME_MODES)} 之一。")
        if field == "theme_variant" and value not in _ALLOWED_THEME_VARIANTS:
            raise ValueError(f"主题风格必须是 {sorted(_ALLOWED_THEME_VARIANTS)} 之一。")
        if field == "max_concurrent_jobs":
            if not isinstance(value, int) or value < 1 or value > 10:
                raise ValueError("并发上限必须是 1–10 之间的整数。")
        if field == "openai_base_url" and value and not isinstance(value, str):
            raise ValueError("openai_base_url 必须是字符串。")
        if field == "openai_model" and (not isinstance(value, str) or not value.strip()):
            raise ValueError("openai_model 不能为空。")
        setattr(row, field, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(row)
    return row


def set_openai_api_key(db: Session, key: str) -> AppSettings:
    cleaned = (key or "").strip()
    if not cleaned:
        raise ValueError("API Key 不能为空。")
    row = load_app_settings(db)
    row.openai_api_key = cleaned
    db.commit()
    db.refresh(row)
    return row


def clear_openai_api_key(db: Session) -> AppSettings:
    row = load_app_settings(db)
    row.openai_api_key = None
    db.commit()
    db.refresh(row)
    return row


def has_openai_api_key(row: AppSettings, env_key: str | None = None) -> bool:
    return bool(
        (row.openai_api_key and row.openai_api_key.strip())
        or (env_key and env_key.strip())
    )


def openai_api_key_source(row: AppSettings, env_key: str | None = None) -> str:
    """Where the key the runtime will use actually comes from."""
    if row.openai_api_key and row.openai_api_key.strip():
        return "app_settings"
    if env_key and env_key.strip():
        return "env"
    return "none"
