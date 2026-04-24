from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass(slots=True)
class ProviderInputImage:
    bytes: bytes
    filename: str
    mime_type: str


@dataclass(slots=True)
class ProviderGenerateInput:
    prompt: str
    size: str | None
    quality: str | None
    extra_options: dict[str, object] = field(default_factory=dict)


@dataclass(slots=True)
class ProviderEditInput:
    prompt: str
    images: list[ProviderInputImage]
    mask: ProviderInputImage | None
    size: str | None
    quality: str | None
    extra_options: dict[str, object] = field(default_factory=dict)


@dataclass(slots=True)
class ProviderImageOutput:
    bytes: bytes
    mime_type: str
    filename_hint: str | None = None
    width: int | None = None
    height: int | None = None


@dataclass(slots=True)
class ProviderCallResult:
    provider: str
    provider_model: str
    images: list[ProviderImageOutput]
    request_id: str | None = None
    trace_id: str | None = None
    text_content: str | None = None
    reasoning_content: str | None = None
    usage: dict[str, object] | None = None
    provider_metadata: dict[str, object] = field(default_factory=dict)


class ProviderConfigurationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class ImageProviderAdapter(Protocol):
    provider_id: str
    model: str

    def generate(self, request: ProviderGenerateInput) -> ProviderCallResult:
        """Generate an image from text."""

    def edit(self, request: ProviderEditInput) -> ProviderCallResult:
        """Edit an image from image inputs and optional mask."""

