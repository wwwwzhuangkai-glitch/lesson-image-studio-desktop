from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


ProviderId = Literal["openai_official", "tal_gpt_image_2"]
Quality = Literal["low", "medium", "high"]
SizeMode = Literal["auto", "preset", "custom"]


class OwnerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_type: str
    owner_id: str
    local_title: str | None
    created_at: datetime
    updated_at: datetime
    last_opened_at: datetime | None


class TaskSummaryResponse(BaseModel):
    queued: int = 0
    running: int = 0
    succeeded: int = 0
    failed: int = 0


class VersionResponse(BaseModel):
    id: str
    image_item_id: str
    parent_version_id: str | None
    origin_type: str
    file_name: str
    file_url: str
    mime_type: str
    width: int
    height: int
    file_size: int
    prompt_text: str | None
    prompt_summary: str | None
    provider: str
    model: str | None
    quality: str | None
    size: str | None
    is_deleted: bool
    is_current_final: bool
    child_count: int
    created_at: datetime


class VersionTreeNode(VersionResponse):
    children: list["VersionTreeNode"] = Field(default_factory=list)


VersionTreeNode.model_rebuild()


class ImageItemSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    sort_order: int
    title: str
    status: str
    current_final_version_id: str | None
    latest_version: VersionResponse | None = None
    current_final_version: VersionResponse | None = None
    running_job: "JobResponse | None" = None
    created_at: datetime
    updated_at: datetime


class OwnerOverviewResponse(BaseModel):
    owner: OwnerResponse
    image_items: list[ImageItemSummaryResponse]
    task_summary: TaskSummaryResponse


class OpenOwnerResponse(OwnerOverviewResponse):
    recent_owners: list[OwnerResponse]


class EventLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    image_item_id: str | None
    version_id: str | None
    event_type: str
    payload: dict[str, Any]
    created_at: datetime


class ImageItemDetailResponse(BaseModel):
    image_item: ImageItemSummaryResponse
    current_final_version: VersionResponse | None
    versions: list[VersionResponse]
    recent_jobs: list["JobResponse"]
    recent_events: list[EventLogResponse]


class RecycleBinResponse(BaseModel):
    deleted_items: list[ImageItemSummaryResponse]
    deleted_versions: list[VersionResponse]


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    image_item_id: str
    base_version_id: str | None
    output_version_id: str | None
    job_type: str
    status: str
    prompt_text: str
    normalized_prompt: str
    mask_id: str | None
    request_params: dict[str, Any]
    provider: str
    model: str
    quality: str
    size: str
    error_code: str | None
    error_message: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    output_version: VersionResponse | None = None


class PublishRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    publish_scope: str
    owner_id: str
    image_item_id: str | None
    version_id: str | None
    payload_snapshot: dict[str, Any]
    publish_status: str
    created_at: datetime


class PromptPresetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    scope: str
    name: str
    summary: str
    prompt_text: str
    discipline: str | None
    is_builtin: bool
    source_preset_id: str | None
    created_at: datetime
    updated_at: datetime


class OwnerOpenRequest(BaseModel):
    owner_type: str
    owner_id: str | None = None
    local_title: str | None = None


class CreateImageItemRequest(BaseModel):
    title: str


class ReorderEntry(BaseModel):
    image_item_id: str
    sort_order: int


class ReorderImageItemsRequest(BaseModel):
    items: list[ReorderEntry]


class RectGeometry(BaseModel):
    x: int
    y: int
    width: int
    height: int


class MaskCreateRequest(BaseModel):
    image_item_id: str
    base_version_id: str
    geometry: RectGeometry


class MaskCreateResponse(BaseModel):
    id: str
    file_url: str
    geometry: RectGeometry
    width: int
    height: int


class CreateEditJobRequest(BaseModel):
    image_item_id: str
    base_version_id: str
    prompt_text: str
    mask_id: str | None = None
    quality: Quality = "high"
    size_mode: SizeMode = "auto"
    size: str | None = None


class CreateGenerateJobRequest(BaseModel):
    prompt_text: str
    quality: Quality = "high"
    size_mode: SizeMode = "auto"
    size: str | None = None


class DuplicateToImageItemRequest(BaseModel):
    title: str | None = None


class CreateJobResponse(BaseModel):
    job_id: str
    status: str


class FinalizeRequest(BaseModel):
    version_id: str


class ExportResponse(BaseModel):
    version_id: str
    file_url: str
    storage_key: str
    file_name: str


class PublishRequest(BaseModel):
    publish_scope: Literal["image_item", "owner_bundle"]
    owner_id: str
    image_item_id: str | None = None
    version_id: str | None = None


class EventQueryResponse(BaseModel):
    events: list[EventLogResponse]


class PromptPresetCreateRequest(BaseModel):
    name: str
    summary: str
    prompt_text: str
    discipline: str | None = None
    source_preset_id: str | None = None


class PromptPresetUpdateRequest(BaseModel):
    name: str | None = None
    summary: str | None = None
    prompt_text: str | None = None
    discipline: str | None = None


class MessageResponse(BaseModel):
    success: bool = True
    message: str


class AppSettingsResponse(BaseModel):
    has_openai_api_key: bool
    openai_api_key_source: Literal["app_settings", "env", "none"]
    has_tal_service_api_key: bool
    openai_base_url: str
    openai_model: str
    default_provider: ProviderId
    default_export_format: Literal["png", "jpeg", "webp"]
    theme_mode: Literal["light", "dark"]
    theme_variant: Literal["graphite", "glass"]
    max_concurrent_jobs: int
    updated_at: datetime


class AppSettingsUpdateRequest(BaseModel):
    openai_base_url: str | None = None
    openai_model: str | None = None
    default_provider: ProviderId | None = None
    default_export_format: Literal["png", "jpeg", "webp"] | None = None
    theme_mode: Literal["light", "dark"] | None = None
    theme_variant: Literal["graphite", "glass"] | None = None
    max_concurrent_jobs: int | None = Field(default=None, ge=1, le=10)


class OpenAIKeyUpdateRequest(BaseModel):
    openai_api_key: str = Field(min_length=1)


class TalKeyUpdateRequest(BaseModel):
    tal_service_api_key: str = Field(min_length=1)


ImageItemSummaryResponse.model_rebuild()
ImageItemDetailResponse.model_rebuild()
