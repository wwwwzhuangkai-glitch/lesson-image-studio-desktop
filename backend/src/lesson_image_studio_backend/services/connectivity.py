from __future__ import annotations

from time import perf_counter
from typing import TypedDict

import httpx

from ..models import AppSettings
from .providers.tal_gpt_image_2 import TAL_COMPATIBLE_BASE_URL


class ProviderConnectivityResult(TypedDict):
    ok: bool
    provider: str
    method: str
    url: str
    status_code: int | None
    elapsed_ms: int
    error_type: str | None
    error_message: str | None
    response_excerpt: str | None


def test_tal_connectivity(app_settings: AppSettings) -> ProviderConnectivityResult:
    url = f"{TAL_COMPATIBLE_BASE_URL.rstrip('/')}/images/generations"
    api_key = (app_settings.tal_service_api_key or "").strip()
    if not api_key:
        return {
            "ok": False,
            "provider": "tal_gpt_image_2",
            "method": "POST",
            "url": url,
            "status_code": None,
            "elapsed_ms": 0,
            "error_type": "missing_tal_service_api_key",
            "error_message": "未配置公司 AI 服务认证值，请先保存 appId:apiKey。",
            "response_excerpt": None,
        }

    started = perf_counter()
    try:
        with httpx.Client(trust_env=False, timeout=60.0) as client:
            response = client.post(
                url,
                headers={"api-key": api_key, "Content-Type": "application/json"},
                json={
                    "model": "gpt-image-2",
                    "prompt": "connectivity test",
                    "quality": "high",
                },
            )
        elapsed_ms = int((perf_counter() - started) * 1000)
        excerpt = response.text.strip()[:500] if not response.is_success else None
        return {
            "ok": response.is_success,
            "provider": "tal_gpt_image_2",
            "method": "POST",
            "url": url,
            "status_code": response.status_code,
            "elapsed_ms": elapsed_ms,
            "error_type": None if response.is_success else "HTTPStatusError",
            "error_message": None if response.is_success else response.reason_phrase,
            "response_excerpt": excerpt or None,
        }
    except Exception as exc:  # noqa: BLE001 - diagnostics should report raw network/runtime failures.
        elapsed_ms = int((perf_counter() - started) * 1000)
        return {
            "ok": False,
            "provider": "tal_gpt_image_2",
            "method": "POST",
            "url": url,
            "status_code": None,
            "elapsed_ms": elapsed_ms,
            "error_type": exc.__class__.__name__,
            "error_message": str(exc),
            "response_excerpt": None,
        }
