from __future__ import annotations

from ...config import Settings
from ...models import AppSettings
from .base import ImageProviderAdapter
from .openai_official import OpenAIOfficialAdapter
from .tal_gpt_image_2 import TalGptImage2Adapter


class ProviderRegistry:
    def get_adapter(
        self,
        provider_id: str,
        *,
        settings: Settings,
        app_settings: AppSettings,
        model_override: str | None = None,
    ) -> ImageProviderAdapter:
        if provider_id in {"openai", "openai_official"}:
            return OpenAIOfficialAdapter(
                settings=settings,
                app_settings=app_settings,
                model_override=model_override,
            )
        if provider_id == "tal_gpt_image_2":
            return TalGptImage2Adapter(settings=settings, app_settings=app_settings)
        raise ValueError(f"不支持的 provider：{provider_id}。")
