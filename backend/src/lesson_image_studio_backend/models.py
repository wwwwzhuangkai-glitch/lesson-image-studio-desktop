from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )


class Owner(TimestampMixin, Base):
    __tablename__ = "owner"
    __table_args__ = (UniqueConstraint("owner_type", "owner_id", name="uq_owner_type_owner_id"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: generate_id("own"))
    owner_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    owner_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    local_title: Mapped[str | None] = mapped_column(String(255))
    last_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=utcnow)


class ImageItem(TimestampMixin, Base):
    __tablename__ = "image_item"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: generate_id("item"))
    owner_id: Mapped[str] = mapped_column(String(32), ForeignKey("owner.id"), nullable=False, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    current_final_version_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)


class ImageMask(Base):
    __tablename__ = "image_mask"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: generate_id("mask"))
    image_item_id: Mapped[str] = mapped_column(String(32), ForeignKey("image_item.id"), nullable=False, index=True)
    base_version_id: Mapped[str] = mapped_column(String(32), ForeignKey("image_version.id"), nullable=False, index=True)
    mask_type: Mapped[str] = mapped_column(String(16), nullable=False, default="rect")
    geometry: Mapped[dict[str, int]] = mapped_column(JSON, default=dict)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ImageVersion(Base):
    __tablename__ = "image_version"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: generate_id("ver"))
    image_item_id: Mapped[str] = mapped_column(String(32), ForeignKey("image_item.id"), nullable=False, index=True)
    parent_version_id: Mapped[str | None] = mapped_column(
        String(32),
        ForeignKey("image_version.id"),
        nullable=True,
        index=True,
    )
    origin_type: Mapped[str] = mapped_column(String(32), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(64), nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(128), nullable=False)
    prompt_text: Mapped[str | None] = mapped_column(Text)
    prompt_summary: Mapped[str | None] = mapped_column(String(255))
    mask_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="local")
    model: Mapped[str | None] = mapped_column(String(64))
    quality: Mapped[str | None] = mapped_column(String(16))
    size: Mapped[str | None] = mapped_column(String(32))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class EditJob(Base):
    __tablename__ = "edit_job"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: generate_id("job"))
    owner_id: Mapped[str] = mapped_column(String(32), ForeignKey("owner.id"), nullable=False, index=True)
    image_item_id: Mapped[str] = mapped_column(String(32), ForeignKey("image_item.id"), nullable=False, index=True)
    base_version_id: Mapped[str | None] = mapped_column(
        String(32),
        ForeignKey("image_version.id"),
        nullable=True,
        index=True,
    )
    output_version_id: Mapped[str | None] = mapped_column(
        String(32),
        ForeignKey("image_version.id"),
        nullable=True,
        index=True,
    )
    job_type: Mapped[str] = mapped_column(String(16), nullable=False, default="edit")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued", index=True)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    mask_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("image_mask.id"), nullable=True)
    request_params: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="openai")
    model: Mapped[str] = mapped_column(String(64), nullable=False, default="gpt-image-2")
    quality: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    size: Mapped[str] = mapped_column(String(32), nullable=False, default="1024x1024")
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class EventLog(Base):
    __tablename__ = "event_log"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: generate_id("evt"))
    owner_id: Mapped[str] = mapped_column(String(32), ForeignKey("owner.id"), nullable=False, index=True)
    image_item_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("image_item.id"), nullable=True, index=True)
    version_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("image_version.id"), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    payload: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class PublishRecord(Base):
    __tablename__ = "publish_record"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: generate_id("pub"))
    publish_scope: Mapped[str] = mapped_column(String(32), nullable=False)
    owner_id: Mapped[str] = mapped_column(String(32), ForeignKey("owner.id"), nullable=False, index=True)
    image_item_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("image_item.id"), nullable=True)
    version_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("image_version.id"), nullable=True)
    payload_snapshot: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    publish_status: Mapped[str] = mapped_column(String(32), nullable=False, default="placeholder_recorded")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PromptPreset(TimestampMixin, Base):
    __tablename__ = "prompt_preset"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: generate_id("pst"))
    scope: Mapped[str] = mapped_column(String(16), nullable=False, default="system", index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(String(255), nullable=False)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    discipline: Mapped[str | None] = mapped_column(String(64))
    is_builtin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source_preset_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("prompt_preset.id"), nullable=True)
