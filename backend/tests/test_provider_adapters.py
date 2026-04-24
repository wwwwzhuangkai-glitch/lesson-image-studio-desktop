from __future__ import annotations

import base64
from io import BytesIO
from types import SimpleNamespace

import httpx
from PIL import Image

from lesson_image_studio_backend.services.providers.openai_official import OpenAIOfficialAdapter
from lesson_image_studio_backend.services.providers.tal_gpt_image_2 import (
    TAL_COMPATIBLE_BASE_URL,
    TalGptImage2Adapter,
)


def build_png_bytes(color: str = "white") -> bytes:
    image = Image.new("RGB", (8, 8), color=color)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_openai_adapter_parses_existing_b64_shape():
    adapter = OpenAIOfficialAdapter(
        settings=SimpleNamespace(openai_api_key="", openai_base_url="", openai_model="gpt-image-2"),
        app_settings=SimpleNamespace(openai_api_key=None, openai_base_url="", openai_model="gpt-image-2"),
    )
    raw = build_png_bytes("red")
    response = SimpleNamespace(
        id="resp_fixture",
        data=[SimpleNamespace(b64_json=base64.b64encode(raw).decode("ascii"))],
    )

    result = adapter._parse_image_response(response)

    assert result.provider == "openai_official"
    assert result.provider_model == "gpt-image-2"
    assert result.request_id == "resp_fixture"
    assert result.images[0].bytes == raw
    assert result.images[0].mime_type == "image/png"


def test_tal_gpt_image_2_adapter_parses_wrapped_body_b64_shape():
    adapter = TalGptImage2Adapter(
        settings=SimpleNamespace(),
        app_settings=SimpleNamespace(tal_service_api_key="app-id:api-key"),
    )
    raw = build_png_bytes("blue")
    payload = {
        "body": {
            "data": [{"b64_json": base64.b64encode(raw).decode("ascii")}],
            "output_format": "png",
            "usage": {"total_tokens": 1},
        }
    }

    result = adapter._parse_response(
        payload,
        headers=httpx.Headers({"x-request-id": "req_fixture", "traceid": "trace_fixture"}),
    )

    assert result.provider == "tal_gpt_image_2"
    assert result.provider_model == "gpt-image-2"
    assert result.request_id == "req_fixture"
    assert result.trace_id == "trace_fixture"
    assert result.usage == {"total_tokens": 1}
    assert result.images[0].bytes == raw
    assert result.images[0].mime_type == "image/png"


def test_tal_gpt_image_2_adapter_uses_fixed_company_base_url():
    adapter = TalGptImage2Adapter(
        settings=SimpleNamespace(),
        app_settings=SimpleNamespace(tal_service_api_key="app-id:api-key"),
    )

    assert adapter._url("/images/generations") == f"{TAL_COMPATIBLE_BASE_URL}/images/generations"
    assert adapter._url("/images/edits") == f"{TAL_COMPATIBLE_BASE_URL}/images/edits"
