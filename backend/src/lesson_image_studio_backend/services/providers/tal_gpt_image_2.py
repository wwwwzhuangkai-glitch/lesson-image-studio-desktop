from __future__ import annotations

import base64
import binascii
from typing import Any

import httpx

from ...config import Settings
from ...models import AppSettings
from .base import (
    ProviderCallResult,
    ProviderConfigurationError,
    ProviderEditInput,
    ProviderGenerateInput,
    ProviderImageOutput,
)

TAL_COMPATIBLE_BASE_URL = "http://ai-service.tal.com/openai-compatible/v1"


class TalGptImage2Adapter:
    provider_id = "tal_gpt_image_2"
    model = "gpt-image-2"

    def __init__(self, *, settings: Settings, app_settings: AppSettings) -> None:
        _ = settings
        self.base_url = TAL_COMPATIBLE_BASE_URL
        self.api_key = (app_settings.tal_service_api_key or "").strip()

    def generate(self, request: ProviderGenerateInput) -> ProviderCallResult:
        self._ensure_configured()
        payload: dict[str, object] = {
            "model": self.model,
            "prompt": request.prompt,
        }
        if request.size:
            payload["size"] = request.size
        if request.quality:
            payload["quality"] = request.quality
        response = self._post_json("/images/generations", payload)
        return self._parse_response(response.json(), headers=response.headers)

    def edit(self, request: ProviderEditInput) -> ProviderCallResult:
        self._ensure_configured()
        if not request.images:
            raise ValueError("缺少改图底图。")
        data = {"model": self.model, "prompt": request.prompt}
        if request.size:
            data["size"] = request.size
        if request.quality:
            data["quality"] = request.quality
        image_field = "image" if len(request.images) == 1 else "image[]"
        files = [
            (image_field, (image.filename, image.bytes, image.mime_type))
            for image in request.images
        ]
        if request.mask:
            files.append(("mask", (request.mask.filename, request.mask.bytes, request.mask.mime_type)))
        response = self._post_form("/images/edits", data=data, files=files)
        return self._parse_response(response.json(), headers=response.headers)

    def _ensure_configured(self) -> None:
        if not self.api_key:
            raise ProviderConfigurationError(
                "missing_tal_service_api_key",
                "未配置公司 AI 服务认证值，请在设置页填写 appId:apiKey。",
            )

    def _post_json(self, path: str, payload: dict[str, object]) -> httpx.Response:
        with httpx.Client(trust_env=False, timeout=1200.0) as client:
            response = client.post(
                self._url(path),
                headers={"api-key": self.api_key, "Content-Type": "application/json"},
                json=payload,
            )
        _raise_for_provider_status(response)
        return response

    def _post_form(
        self,
        path: str,
        *,
        data: dict[str, str],
        files: list[tuple[str, tuple[str, bytes, str]]],
    ) -> httpx.Response:
        with httpx.Client(trust_env=False, timeout=1200.0) as client:
            response = client.post(
                self._url(path),
                headers={"api-key": self.api_key},
                data=data,
                files=files,
            )
        _raise_for_provider_status(response)
        return response

    def _url(self, path: str) -> str:
        return f"{self.base_url.rstrip('/')}{path}"

    def _parse_response(self, payload: dict[str, Any], *, headers: httpx.Headers | dict[str, str]) -> ProviderCallResult:
        body = payload.get("body") if isinstance(payload.get("body"), dict) else payload
        data = body.get("data")
        if not isinstance(data, list) or not data:
            raise ValueError("TAL gpt-image-2 未返回可用图片数据。")

        images: list[ProviderImageOutput] = []
        output_format = str(body.get("output_format") or "png").lower()
        mime_type = output_format if output_format.startswith("image/") else f"image/{output_format}"
        for index, item in enumerate(data, start=1):
            b64_json = item.get("b64_json") if isinstance(item, dict) else None
            if not b64_json:
                continue
            try:
                raw = base64.b64decode(b64_json)
            except (binascii.Error, ValueError) as exc:
                raise ValueError("TAL gpt-image-2 返回了无法解码的 base64 图片。") from exc
            images.append(
                ProviderImageOutput(
                    bytes=raw,
                    mime_type=mime_type,
                    filename_hint=f"tal-gpt-image-2-{index}.{output_format.removeprefix('image/')}",
                )
            )

        if not images:
            raise ValueError("TAL gpt-image-2 未返回 base64 图片结果。")

        usage = body.get("usage") if isinstance(body.get("usage"), dict) else None
        return ProviderCallResult(
            provider=self.provider_id,
            provider_model=self.model,
            request_id=_header_value(headers, "x-request-id"),
            trace_id=_header_value(headers, "traceid"),
            usage=usage,
            provider_metadata={
                "output_format": body.get("output_format"),
                "quality": body.get("quality"),
                "size": body.get("size"),
            },
            images=images,
        )


def _raise_for_provider_status(response: httpx.Response) -> None:
    if response.is_success:
        return
    detail = response.text.strip()[:500] or response.reason_phrase
    raise ValueError(f"TAL gpt-image-2 请求失败（HTTP {response.status_code}）：{detail}")


def _header_value(headers: httpx.Headers | dict[str, str], name: str) -> str | None:
    value = headers.get(name)
    return value.strip() if isinstance(value, str) and value.strip() else None
