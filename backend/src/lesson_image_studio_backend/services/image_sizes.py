from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal


SizeMode = Literal["auto", "preset", "custom"]

PRESET_SIZES = frozenset({"1024x1024", "1536x1024", "1024x1536"})
DEFAULT_PRESET_SIZE = "1024x1024"
MAX_PROVIDER_SIDE = 3840
TARGET_TAL_EDIT_SIDE = 2048
SIZE_STEP = 16

_SIZE_RE = re.compile(r"^([1-9]\d*)x([1-9]\d*)$")


@dataclass(slots=True, frozen=True)
class SizeResolution:
    size_mode: SizeMode
    requested_size: str | None
    resolved_size: str
    provider_size: str | None

    def request_params(self) -> dict[str, str]:
        return {
            "size_mode": self.size_mode,
            "requested_size": self.requested_size or "",
            "resolved_size": self.resolved_size,
            "provider_size": self.provider_size or "",
        }


def resolve_job_size(
    *,
    provider_id: str,
    job_type: str,
    size_mode: SizeMode,
    requested_size: str | None,
    base_width: int | None = None,
    base_height: int | None = None,
) -> SizeResolution:
    requested_size = requested_size.strip() if requested_size else None
    effective_mode = _effective_size_mode(size_mode, requested_size)
    if effective_mode == "auto":
        if job_type == "generate":
            return SizeResolution(
                size_mode="auto",
                requested_size=requested_size,
                resolved_size="auto",
                provider_size=None,
            )
        if provider_id == "tal_gpt_image_2":
            if base_width is None or base_height is None:
                raise ValueError("自动归一化尺寸需要底图宽高。")
            resolved = normalize_tal_edit_size(base_width, base_height)
            return SizeResolution(
                size_mode="auto",
                requested_size=requested_size,
                resolved_size=resolved,
                provider_size=resolved,
            )
        return SizeResolution(
            size_mode="auto",
            requested_size=requested_size,
            resolved_size=DEFAULT_PRESET_SIZE,
            provider_size=DEFAULT_PRESET_SIZE,
        )

    if effective_mode == "preset":
        resolved = requested_size or DEFAULT_PRESET_SIZE
        if resolved not in PRESET_SIZES:
            raise ValueError(f"预设尺寸必须是 {sorted(PRESET_SIZES)} 之一。")
        return SizeResolution(
            size_mode="preset",
            requested_size=requested_size,
            resolved_size=resolved,
            provider_size=resolved,
        )

    if provider_id != "tal_gpt_image_2":
        raise ValueError("OpenAI 官方 provider 暂不支持自定义输出尺寸。")
    resolved = _validate_custom_size(requested_size)
    return SizeResolution(
        size_mode="custom",
        requested_size=requested_size,
        resolved_size=resolved,
        provider_size=resolved,
    )


def provider_size_from_resolved(size: str) -> str | None:
    return None if size == "auto" else size


def normalize_tal_edit_size(width: int, height: int) -> str:
    if width <= 0 or height <= 0:
        raise ValueError("底图尺寸必须是正整数。")
    target_side = min(TARGET_TAL_EDIT_SIDE, MAX_PROVIDER_SIDE)
    scale = target_side / max(width, height)
    normalized_width = _round_to_step(width * scale)
    normalized_height = _round_to_step(height * scale)
    return f"{normalized_width}x{normalized_height}"


def parse_size(size: str) -> tuple[int, int]:
    match = _SIZE_RE.fullmatch(size.strip())
    if not match:
        raise ValueError("尺寸格式必须是 宽x高，例如 1024x1024。")
    return int(match.group(1)), int(match.group(2))


def _effective_size_mode(size_mode: SizeMode, requested_size: str | None) -> SizeMode:
    # Backward compatibility for clients that sent a preset size before
    # size_mode existed.
    if size_mode == "auto" and requested_size in PRESET_SIZES:
        return "preset"
    return size_mode


def _validate_custom_size(size: str | None) -> str:
    if not size:
        raise ValueError("自定义尺寸不能为空。")
    width, height = parse_size(size)
    if width % SIZE_STEP != 0 or height % SIZE_STEP != 0:
        raise ValueError("自定义尺寸的宽和高都必须是 16 的倍数。")
    if max(width, height) > MAX_PROVIDER_SIDE:
        raise ValueError("自定义尺寸最长边不能超过 3840。")
    return f"{width}x{height}"


def _round_to_step(value: float) -> int:
    return max(SIZE_STEP, int((value + (SIZE_STEP / 2)) // SIZE_STEP) * SIZE_STEP)
