from __future__ import annotations

import base64
import io

import httpx
from openai import OpenAI

from ...config import Settings
from ...models import AppSettings
from .base import (
    ProviderCallResult,
    ProviderConfigurationError,
    ProviderEditInput,
    ProviderGenerateInput,
    ProviderImageOutput,
)


class OpenAIOfficialAdapter:
    provider_id = "openai_official"

    def __init__(
        self,
        *,
        settings: Settings,
        app_settings: AppSettings,
        model_override: str | None = None,
    ) -> None:
        self.api_key = (app_settings.openai_api_key or settings.openai_api_key or "").strip()
        self.base_url = (
            app_settings.openai_base_url.strip()
            or (settings.openai_base_url or "").strip()
        ) or None
        self.model = (
            (model_override or "").strip()
            or app_settings.openai_model.strip()
            or (settings.openai_model or "").strip()
        )
        if not self.model:
            raise ProviderConfigurationError(
                "missing_openai_model",
                "AppSettings 与环境变量都没有配置 openai_model，请在设置页填写可用的生图模型名称。",
            )

    def _client(self) -> OpenAI:
        if not self.api_key:
            raise ProviderConfigurationError(
                "missing_api_key",
                "未配置 OpenAI API Key，无法执行 AI 生图/改图。请在设置页填入 Key 或通过环境变量注入。",
            )
        return OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            http_client=httpx.Client(trust_env=False),
        )

    def generate(self, request: ProviderGenerateInput) -> ProviderCallResult:
        kwargs = {
            "model": self.model,
            "prompt": request.prompt,
            "quality": request.quality,
            "output_format": "png",
        }
        if request.size:
            kwargs["size"] = request.size
        response = self._client().images.generate(**kwargs)
        return self._parse_image_response(response)

    def edit(self, request: ProviderEditInput) -> ProviderCallResult:
        if not request.images:
            raise ValueError("缺少改图底图。")
        image_file = _named_bytes_io(request.images[0].bytes, request.images[0].filename)
        kwargs = {
            "model": self.model,
            "prompt": request.prompt,
            "quality": request.quality,
            "output_format": "png",
            "image": image_file,
        }
        if request.size:
            kwargs["size"] = request.size
        if request.mask:
            kwargs["mask"] = _named_bytes_io(request.mask.bytes, request.mask.filename)
        response = self._client().images.edit(**kwargs)
        return self._parse_image_response(response)

    def _parse_image_response(self, response: object) -> ProviderCallResult:
        data = getattr(response, "data", None) or []
        if not data:
            raise ValueError("图像接口未返回可用数据。")
        image_data = data[0]
        b64_json = getattr(image_data, "b64_json", None)
        if not b64_json:
            raise ValueError("图像接口未返回 base64 图片结果。")
        return ProviderCallResult(
            provider=self.provider_id,
            provider_model=self.model,
            request_id=getattr(response, "id", None),
            images=[
                ProviderImageOutput(
                    bytes=base64.b64decode(b64_json),
                    mime_type="image/png",
                    filename_hint="openai-output.png",
                )
            ],
        )


def _named_bytes_io(data: bytes, name: str) -> io.BytesIO:
    buffer = io.BytesIO(data)
    buffer.name = name
    return buffer
