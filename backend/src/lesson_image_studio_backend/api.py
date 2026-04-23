from __future__ import annotations

from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy.orm import Session

from .config import Settings
from .database import get_db
from .models import EditJob, ImageMask, ImageVersion
from .schemas import (
    CreateEditJobRequest,
    CreateGenerateJobRequest,
    CreateImageItemRequest,
    CreateJobResponse,
    DuplicateToImageItemRequest,
    EventQueryResponse,
    ExportResponse,
    FinalizeRequest,
    ImageItemDetailResponse,
    JobResponse,
    MaskCreateRequest,
    MaskCreateResponse,
    MessageResponse,
    OpenOwnerResponse,
    OwnerOpenRequest,
    OwnerOverviewResponse,
    OwnerResponse,
    PromptPresetCreateRequest,
    PromptPresetResponse,
    PromptPresetUpdateRequest,
    PublishRecordResponse,
    PublishRequest,
    RecycleBinResponse,
    ReorderImageItemsRequest,
    TaskSummaryResponse,
    VersionResponse,
    VersionTreeNode,
)
from .services.image_items import (
    OwnerTaskSummary,
    build_version_tree,
    create_image_item,
    duplicate_version_to_new_item,
    ensure_version_belongs_to_item,
    finalize_version,
    get_active_items_for_owner,
    get_deleted_items_for_owner,
    get_deleted_versions_for_owner,
    get_image_item_or_404,
    get_recent_events,
    get_recent_jobs_for_item,
    get_running_jobs_for_items,
    get_task_summary,
    get_version_or_404,
    get_versions_for_item,
    get_versions_for_items,
    import_root_version,
    reorder_image_items,
    restore_image_item,
    restore_version,
    soft_delete_image_item,
    soft_delete_version,
    unfinalize_version,
)
from .services.jobs import JobRunner, create_edit_job, create_generate_job, get_job_or_404, list_jobs
from .services.masks import create_rect_mask, get_mask_or_404
from .services.owners import get_owner_or_404, list_recent_owners, open_owner
from .services.presets import (
    create_personal_preset,
    delete_personal_preset,
    get_preset_or_404,
    list_presets,
    update_personal_preset,
)
from .services.publishing import create_publish_record
from .services.storage import StorageService

router = APIRouter(prefix="/api")


def get_storage(request: Request) -> StorageService:
    return request.app.state.storage


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_job_runner(request: Request) -> JobRunner:
    return request.app.state.job_runner


def serialize_version(
    *,
    version: ImageVersion,
    storage: StorageService,
    child_count: int = 0,
    is_current_final: bool = False,
) -> VersionResponse:
    return VersionResponse(
        id=version.id,
        image_item_id=version.image_item_id,
        parent_version_id=version.parent_version_id,
        origin_type=version.origin_type,
        file_name=version.file_name,
        file_url=storage.build_url(version.storage_key),
        mime_type=version.mime_type,
        width=version.width,
        height=version.height,
        file_size=version.file_size,
        prompt_text=version.prompt_text,
        prompt_summary=version.prompt_summary,
        provider=version.provider,
        model=version.model,
        quality=version.quality,
        size=version.size,
        is_deleted=version.is_deleted,
        is_current_final=is_current_final,
        child_count=child_count,
        created_at=version.created_at,
    )


def serialize_job(job: EditJob, storage: StorageService, output_version: ImageVersion | None = None):
    return {
        "id": job.id,
        "owner_id": job.owner_id,
        "image_item_id": job.image_item_id,
        "base_version_id": job.base_version_id,
        "output_version_id": job.output_version_id,
        "job_type": job.job_type,
        "status": job.status,
        "prompt_text": job.prompt_text,
        "normalized_prompt": job.normalized_prompt,
        "mask_id": job.mask_id,
        "request_params": job.request_params,
        "provider": job.provider,
        "model": job.model,
        "quality": job.quality,
        "size": job.size,
        "error_code": job.error_code,
        "error_message": job.error_message,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
        "created_at": job.created_at,
        "output_version": serialize_version(
            version=output_version,
            storage=storage,
            is_current_final=False,
        )
        if output_version
        else None,
    }


def _task_summary_response(summary: OwnerTaskSummary) -> TaskSummaryResponse:
    return TaskSummaryResponse(
        queued=summary.queued,
        running=summary.running,
        succeeded=summary.succeeded,
        failed=summary.failed,
    )


def serialize_image_item(item, storage: StorageService, versions_map, running_jobs_map) -> dict[str, Any]:
    versions = versions_map.get(item.id, [])
    latest_version = versions[-1] if versions else None
    child_counts = {version.parent_version_id: 0 for version in versions}
    for version in versions:
        child_counts[version.parent_version_id] = child_counts.get(version.parent_version_id, 0) + 1
    latest_payload = (
        serialize_version(
            version=latest_version,
            storage=storage,
            child_count=child_counts.get(latest_version.id, 0),
            is_current_final=item.current_final_version_id == latest_version.id,
        )
        if latest_version
        else None
    )
    final_version = next((version for version in versions if version.id == item.current_final_version_id), None)
    final_payload = (
        serialize_version(
            version=final_version,
            storage=storage,
            child_count=child_counts.get(final_version.id, 0),
            is_current_final=True,
        )
        if final_version
        else None
    )
    running_job = running_jobs_map.get(item.id)
    return {
        "id": item.id,
        "owner_id": item.owner_id,
        "sort_order": item.sort_order,
        "title": item.title,
        "status": item.status,
        "current_final_version_id": item.current_final_version_id,
        "latest_version": latest_payload,
        "current_final_version": final_payload,
        "running_job": serialize_job(running_job, storage) if running_job else None,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


@router.post("/owners/open", response_model=OpenOwnerResponse)
def open_owner_endpoint(
    payload: OwnerOpenRequest,
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
    settings: Settings = Depends(get_app_settings),
) -> OpenOwnerResponse:
    try:
        owner = open_owner(
            db,
            owner_type=payload.owner_type,
            owner_id=payload.owner_id,
            local_title=payload.local_title,
        )
        items = get_active_items_for_owner(db, owner.id)
        versions = get_versions_for_items(db, [item.id for item in items])
        versions_map = {}
        for version in versions:
            versions_map.setdefault(version.image_item_id, []).append(version)
        jobs_map = get_running_jobs_for_items(db, [item.id for item in items])
        recent = list_recent_owners(db, limit=settings.recent_owner_limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return OpenOwnerResponse(
        owner=OwnerResponse.model_validate(owner),
        image_items=[
            serialize_image_item(item, storage, versions_map, jobs_map)
            for item in items
        ],
        task_summary=_task_summary_response(get_task_summary(db, owner_id=owner.id)),
        recent_owners=[OwnerResponse.model_validate(entry) for entry in recent],
    )


@router.get("/owners/recent", response_model=list[OwnerResponse])
def get_recent_owners_endpoint(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> list[OwnerResponse]:
    recent = list_recent_owners(db, limit=settings.recent_owner_limit)
    return [OwnerResponse.model_validate(owner) for owner in recent]


@router.get("/owners/{owner_pk}", response_model=OwnerOverviewResponse)
def get_owner_overview_endpoint(
    owner_pk: str,
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> OwnerOverviewResponse:
    try:
        owner = get_owner_or_404(db, owner_pk)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    items = get_active_items_for_owner(db, owner.id)
    versions = get_versions_for_items(db, [item.id for item in items])
    versions_map = {}
    for version in versions:
        versions_map.setdefault(version.image_item_id, []).append(version)
    jobs_map = get_running_jobs_for_items(db, [item.id for item in items])
    return OwnerOverviewResponse(
        owner=OwnerResponse.model_validate(owner),
        image_items=[
            serialize_image_item(item, storage, versions_map, jobs_map)
            for item in items
        ],
        task_summary=_task_summary_response(get_task_summary(db, owner_id=owner.id)),
    )


@router.post("/owners/{owner_pk}/image-items", response_model=ImageItemDetailResponse)
def create_image_item_endpoint(
    owner_pk: str,
    payload: CreateImageItemRequest,
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> ImageItemDetailResponse:
    try:
        owner = get_owner_or_404(db, owner_pk)
        image_item = create_image_item(db, owner=owner, title=payload.title)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ImageItemDetailResponse(
        image_item=serialize_image_item(image_item, storage, {image_item.id: []}, {}),
        current_final_version=None,
        versions=[],
        recent_jobs=[],
        recent_events=[],
    )


@router.patch("/owners/{owner_pk}/image-items/reorder", response_model=MessageResponse)
def reorder_image_items_endpoint(
    owner_pk: str,
    payload: ReorderImageItemsRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        owner = get_owner_or_404(db, owner_pk)
        reorder_image_items(
            db,
            owner=owner,
            entries=[(entry.image_item_id, entry.sort_order) for entry in payload.items],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MessageResponse(message="排序已更新。")


@router.get("/owners/{owner_pk}/recycle-bin", response_model=RecycleBinResponse)
def get_recycle_bin_endpoint(
    owner_pk: str,
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> RecycleBinResponse:
    try:
        owner = get_owner_or_404(db, owner_pk)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    deleted_items = get_deleted_items_for_owner(db, owner.id)
    deleted_versions = get_deleted_versions_for_owner(db, owner.id)
    versions_map = {}
    jobs_map = {}
    return RecycleBinResponse(
        deleted_items=[
            serialize_image_item(item, storage, versions_map, jobs_map) for item in deleted_items
        ],
        deleted_versions=[
            serialize_version(
                version=version,
                storage=storage,
                child_count=0,
                is_current_final=False,
            )
            for version in deleted_versions
        ],
    )


@router.get("/image-items/{image_item_id}", response_model=ImageItemDetailResponse)
def get_image_item_detail_endpoint(
    image_item_id: str,
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> ImageItemDetailResponse:
    try:
        image_item = get_image_item_or_404(db, image_item_id)
        owner = get_owner_or_404(db, image_item.owner_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    versions = get_versions_for_item(db, image_item.id)
    child_map = {version.id: 0 for version in versions}
    for version in versions:
        if version.parent_version_id:
            child_map[version.parent_version_id] = child_map.get(version.parent_version_id, 0) + 1
    recent_jobs = get_recent_jobs_for_item(db, image_item.id)
    recent_events = get_recent_events(db, owner_id=owner.id, image_item_id=image_item.id)

    serialized_versions = [
        serialize_version(
            version=version,
            storage=storage,
            child_count=child_map.get(version.id, 0),
            is_current_final=image_item.current_final_version_id == version.id,
        )
        for version in versions
    ]
    final_version = next((entry for entry in serialized_versions if entry.id == image_item.current_final_version_id), None)
    return ImageItemDetailResponse(
        image_item=serialize_image_item(image_item, storage, {image_item.id: versions}, get_running_jobs_for_items(db, [image_item.id])),
        current_final_version=final_version,
        versions=serialized_versions,
        recent_jobs=[serialize_job(job, storage, db.get(ImageVersion, job.output_version_id) if job.output_version_id else None) for job in recent_jobs],
        recent_events=recent_events,
    )


@router.get("/image-items/{image_item_id}/versions/tree", response_model=list[VersionTreeNode])
def get_image_item_version_tree_endpoint(
    image_item_id: str,
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> list[VersionTreeNode]:
    try:
        image_item = get_image_item_or_404(db, image_item_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    versions = get_versions_for_item(db, image_item.id)
    tree = build_version_tree(versions)

    def serialize_node(node: dict[str, Any]) -> VersionTreeNode:
        version = node["version"]
        children = [serialize_node(child) for child in node["children"]]
        payload = serialize_version(
            version=version,
            storage=storage,
            child_count=node["child_count"],
            is_current_final=image_item.current_final_version_id == version.id,
        ).model_dump()
        payload["children"] = children
        return VersionTreeNode(**payload)

    return [serialize_node(node) for node in tree]


@router.post("/image-items/{image_item_id}/import", response_model=VersionResponse)
def import_image_endpoint(
    image_item_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> VersionResponse:
    try:
        image_item = get_image_item_or_404(db, image_item_id)
        owner = get_owner_or_404(db, image_item.owner_id)
        version = import_root_version(
            db,
            owner=owner,
            image_item=image_item,
            storage=storage,
            upload=file,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return serialize_version(version=version, storage=storage, child_count=0, is_current_final=False)


@router.post("/masks", response_model=MaskCreateResponse)
def create_mask_endpoint(
    payload: MaskCreateRequest,
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> MaskCreateResponse:
    try:
        image_item = get_image_item_or_404(db, payload.image_item_id)
        owner = get_owner_or_404(db, image_item.owner_id)
        version = get_version_or_404(db, payload.base_version_id)
        ensure_version_belongs_to_item(
            image_item=image_item,
            version=version,
            action="创建遮罩",
        )
        image_mask = create_rect_mask(
            db,
            owner=owner,
            image_item_id=image_item.id,
            base_version=version,
            geometry=payload.geometry.model_dump(),
            storage=storage,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MaskCreateResponse(
        id=image_mask.id,
        file_url=storage.build_url(image_mask.storage_key),
        geometry=payload.geometry,
        width=version.width,
        height=version.height,
    )


@router.post("/edits", response_model=CreateJobResponse)
def create_edit_job_endpoint(
    payload: CreateEditJobRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    runner: JobRunner = Depends(get_job_runner),
) -> CreateJobResponse:
    try:
        image_item = get_image_item_or_404(db, payload.image_item_id)
        owner = get_owner_or_404(db, image_item.owner_id)
        base_version = get_version_or_404(db, payload.base_version_id)
        ensure_version_belongs_to_item(
            image_item=image_item,
            version=base_version,
            action="发起改图",
        )
        if payload.mask_id:
            image_mask = get_mask_or_404(db, payload.mask_id)
            if image_mask.image_item_id != image_item.id:
                raise ValueError("mask 必须属于当前图片项。")
        job = create_edit_job(
            db,
            owner=owner,
            image_item=image_item,
            base_version=base_version,
            prompt_text=payload.prompt_text,
            mask_id=payload.mask_id,
            quality=payload.quality,
            size=payload.size,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    background_tasks.add_task(runner.run_job, job.id)
    return CreateJobResponse(job_id=job.id, status=job.status)


@router.post("/image-items/{image_item_id}/generate", response_model=CreateJobResponse)
def create_generate_job_endpoint(
    image_item_id: str,
    payload: CreateGenerateJobRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    runner: JobRunner = Depends(get_job_runner),
) -> CreateJobResponse:
    try:
        image_item = get_image_item_or_404(db, image_item_id)
        owner = get_owner_or_404(db, image_item.owner_id)
        job = create_generate_job(
            db,
            owner=owner,
            image_item=image_item,
            prompt_text=payload.prompt_text,
            quality=payload.quality,
            size=payload.size,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    background_tasks.add_task(runner.run_job, job.id)
    return CreateJobResponse(job_id=job.id, status=job.status)


@router.get("/jobs", response_model=list[JobResponse])
def list_jobs_endpoint(
    owner_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> list[dict[str, Any]]:
    jobs = list_jobs(db, owner_id=owner_id, status=status)
    return [
        serialize_job(job, storage, db.get(ImageVersion, job.output_version_id) if job.output_version_id else None)
        for job in jobs
    ]


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job_endpoint(
    job_id: str,
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> dict[str, Any]:
    try:
        job = get_job_or_404(db, job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    output = db.get(ImageVersion, job.output_version_id) if job.output_version_id else None
    return serialize_job(job, storage, output)


@router.post("/image-items/{image_item_id}/finalize", response_model=MessageResponse)
def finalize_version_endpoint(
    image_item_id: str,
    payload: FinalizeRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        image_item = get_image_item_or_404(db, image_item_id)
        owner = get_owner_or_404(db, image_item.owner_id)
        version = get_version_or_404(db, payload.version_id)
        finalize_version(db, owner=owner, image_item=image_item, version=version)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MessageResponse(message="已设为当前定稿。")


@router.post("/image-items/{image_item_id}/unfinalize", response_model=MessageResponse)
def unfinalize_version_endpoint(
    image_item_id: str,
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        image_item = get_image_item_or_404(db, image_item_id)
        owner = get_owner_or_404(db, image_item.owner_id)
        unfinalize_version(db, owner=owner, image_item=image_item)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MessageResponse(message="已取消定稿。")


@router.delete("/image-items/{image_item_id}", response_model=MessageResponse)
def delete_image_item_endpoint(
    image_item_id: str,
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        image_item = get_image_item_or_404(db, image_item_id)
        owner = get_owner_or_404(db, image_item.owner_id)
        soft_delete_image_item(db, owner=owner, image_item=image_item)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MessageResponse(message="图片项已移入回收站。")


@router.post("/image-items/{image_item_id}/restore", response_model=MessageResponse)
def restore_image_item_endpoint(
    image_item_id: str,
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        image_item = get_image_item_or_404(db, image_item_id)
        owner = get_owner_or_404(db, image_item.owner_id)
        restore_image_item(db, owner=owner, image_item=image_item)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MessageResponse(message="图片项已恢复。")


@router.delete("/versions/{version_id}", response_model=MessageResponse)
def delete_version_endpoint(version_id: str, db: Session = Depends(get_db)) -> MessageResponse:
    try:
        version = get_version_or_404(db, version_id)
        image_item = get_image_item_or_404(db, version.image_item_id)
        owner = get_owner_or_404(db, image_item.owner_id)
        soft_delete_version(db, owner=owner, image_item=image_item, version=version)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MessageResponse(message="版本已移入回收站。")


@router.post("/versions/{version_id}/restore", response_model=MessageResponse)
def restore_version_endpoint(version_id: str, db: Session = Depends(get_db)) -> MessageResponse:
    try:
        version = get_version_or_404(db, version_id)
        image_item = get_image_item_or_404(db, version.image_item_id)
        owner = get_owner_or_404(db, image_item.owner_id)
        restore_version(db, owner=owner, image_item=image_item, version=version)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MessageResponse(message="版本已恢复。")


@router.post("/versions/{version_id}/duplicate-to-image-item", response_model=ImageItemDetailResponse)
def duplicate_version_to_image_item_endpoint(
    version_id: str,
    payload: DuplicateToImageItemRequest,
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> ImageItemDetailResponse:
    try:
        version = get_version_or_404(db, version_id)
        source_item = get_image_item_or_404(db, version.image_item_id)
        owner = get_owner_or_404(db, source_item.owner_id)
        image_item, duplicated_version = duplicate_version_to_new_item(
            db,
            owner=owner,
            source_item=source_item,
            source_version=version,
            title=payload.title,
            storage=storage,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ImageItemDetailResponse(
        image_item=serialize_image_item(image_item, storage, {image_item.id: [duplicated_version]}, {}),
        current_final_version=None,
        versions=[
            serialize_version(
                version=duplicated_version,
                storage=storage,
                child_count=0,
                is_current_final=False,
            )
        ],
        recent_jobs=[],
        recent_events=get_recent_events(db, owner_id=owner.id, image_item_id=image_item.id),
    )


@router.post("/versions/{version_id}/export", response_model=ExportResponse)
def export_version_endpoint(
    version_id: str,
    db: Session = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> ExportResponse:
    try:
        version = get_version_or_404(db, version_id)
        image_item = get_image_item_or_404(db, version.image_item_id)
        owner = get_owner_or_404(db, image_item.owner_id)
        stored = storage.export_copy(version.storage_key, export_name=version.file_name)
        from .services.events import log_event

        log_event(
            db,
            owner_id=owner.id,
            image_item_id=image_item.id,
            version_id=version.id,
            event_type="version_exported",
            payload={"export_storage_key": stored.storage_key},
        )
        db.commit()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ExportResponse(version_id=version.id, file_url=storage.build_url(stored.storage_key), storage_key=stored.storage_key)


@router.post("/publish", response_model=PublishRecordResponse)
def publish_placeholder_endpoint(
    payload: PublishRequest,
    db: Session = Depends(get_db),
) -> PublishRecordResponse:
    try:
        record = create_publish_record(
            db,
            owner_id=payload.owner_id,
            publish_scope=payload.publish_scope,
            image_item_id=payload.image_item_id,
            version_id=payload.version_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PublishRecordResponse.model_validate(record)


@router.get("/events", response_model=EventQueryResponse)
def list_events_endpoint(
    owner_id: str,
    image_item_id: str | None = Query(default=None),
    limit: int = Query(default=30, le=100),
    db: Session = Depends(get_db),
) -> EventQueryResponse:
    events = get_recent_events(db, owner_id=owner_id, image_item_id=image_item_id, limit=limit)
    return EventQueryResponse(events=events)


@router.get("/prompt-presets", response_model=list[PromptPresetResponse])
def list_prompt_presets_endpoint(
    scope: str = Query(default="all"),
    db: Session = Depends(get_db),
) -> list[PromptPresetResponse]:
    presets = list_presets(db, scope)
    return [PromptPresetResponse.model_validate(preset) for preset in presets]


@router.post("/prompt-presets", response_model=PromptPresetResponse)
def create_prompt_preset_endpoint(
    payload: PromptPresetCreateRequest,
    db: Session = Depends(get_db),
) -> PromptPresetResponse:
    preset = create_personal_preset(
        db,
        name=payload.name,
        summary=payload.summary,
        prompt_text=payload.prompt_text,
        discipline=payload.discipline,
        source_preset_id=payload.source_preset_id,
    )
    return PromptPresetResponse.model_validate(preset)


@router.patch("/prompt-presets/{preset_id}", response_model=PromptPresetResponse)
def update_prompt_preset_endpoint(
    preset_id: str,
    payload: PromptPresetUpdateRequest,
    db: Session = Depends(get_db),
) -> PromptPresetResponse:
    try:
        preset = get_preset_or_404(db, preset_id)
        preset = update_personal_preset(
            db,
            preset=preset,
            name=payload.name,
            summary=payload.summary,
            prompt_text=payload.prompt_text,
            discipline=payload.discipline,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PromptPresetResponse.model_validate(preset)


@router.delete("/prompt-presets/{preset_id}", response_model=MessageResponse)
def delete_prompt_preset_endpoint(preset_id: str, db: Session = Depends(get_db)) -> MessageResponse:
    try:
        preset = get_preset_or_404(db, preset_id)
        delete_personal_preset(db, preset=preset)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MessageResponse(message="模板已删除。")
