from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import Settings
from ..database import Database
from ..models import EditJob, ImageItem, ImageMask, ImageVersion, Owner
from .app_settings import load_app_settings
from .events import log_event
from .image_sizes import SizeMode, provider_size_from_resolved, resolve_job_size
from .providers.base import (
    ProviderConfigurationError,
    ProviderEditInput,
    ProviderGenerateInput,
    ProviderInputImage,
)
from .providers.registry import ProviderRegistry
from .storage import StorageService


def create_edit_job(
    db: Session,
    *,
    owner: Owner,
    image_item: ImageItem,
    base_version: ImageVersion,
    prompt_text: str,
    mask_id: str | None,
    quality: str,
    size_mode: SizeMode,
    requested_size: str | None,
) -> EditJob:
    settings_row = load_app_settings(db)
    _ensure_global_concurrency(db, settings_row.max_concurrent_jobs)
    _ensure_no_active_job(db, image_item.id)
    if base_version.image_item_id != image_item.id:
        raise ValueError("base_version 必须属于当前图片项。")
    if base_version.is_deleted:
        raise ValueError("不能基于已删除版本发起改图。")
    if mask_id:
        image_mask = db.get(ImageMask, mask_id)
        if image_mask is None:
            raise ValueError("未找到对应的遮罩。")
        if image_mask.image_item_id != image_item.id:
            raise ValueError("mask 必须属于当前图片项。")
        if image_mask.base_version_id != base_version.id:
            raise ValueError("遮罩必须来自当前选中的基础版本。")
    size_resolution = resolve_job_size(
        provider_id=settings_row.default_provider,
        job_type="edit",
        size_mode=size_mode,
        requested_size=requested_size,
        base_width=base_version.width,
        base_height=base_version.height,
    )
    job = EditJob(
        owner_id=owner.id,
        image_item_id=image_item.id,
        base_version_id=base_version.id,
        job_type="edit",
        prompt_text=prompt_text.strip(),
        normalized_prompt=prompt_text.strip(),
        mask_id=mask_id,
        provider=settings_row.default_provider,
        model=_snapshot_model(settings_row.default_provider, settings_row.openai_model),
        quality=quality,
        size=size_resolution.resolved_size,
        request_params=size_resolution.request_params(),
    )
    db.add(job)
    db.flush()
    log_event(
        db,
        owner_id=owner.id,
        image_item_id=image_item.id,
        version_id=base_version.id,
        event_type="edit_job_created",
        payload={"job_id": job.id, "job_type": "edit"},
    )
    db.commit()
    db.refresh(job)
    return job


def create_generate_job(
    db: Session,
    *,
    owner: Owner,
    image_item: ImageItem,
    prompt_text: str,
    quality: str,
    size_mode: SizeMode,
    requested_size: str | None,
) -> EditJob:
    settings_row = load_app_settings(db)
    _ensure_global_concurrency(db, settings_row.max_concurrent_jobs)
    _ensure_no_active_job(db, image_item.id)
    size_resolution = resolve_job_size(
        provider_id=settings_row.default_provider,
        job_type="generate",
        size_mode=size_mode,
        requested_size=requested_size,
    )
    job = EditJob(
        owner_id=owner.id,
        image_item_id=image_item.id,
        base_version_id=None,
        job_type="generate",
        prompt_text=prompt_text.strip(),
        normalized_prompt=prompt_text.strip(),
        provider=settings_row.default_provider,
        model=_snapshot_model(settings_row.default_provider, settings_row.openai_model),
        quality=quality,
        size=size_resolution.resolved_size,
        request_params=size_resolution.request_params(),
    )
    db.add(job)
    db.flush()
    log_event(
        db,
        owner_id=owner.id,
        image_item_id=image_item.id,
        event_type="generate_job_created",
        payload={"job_id": job.id, "job_type": "generate"},
    )
    db.commit()
    db.refresh(job)
    return job


def list_jobs(db: Session, *, owner_id: str | None = None, status: str | None = None) -> list[EditJob]:
    query = select(EditJob).order_by(EditJob.created_at.desc())
    if owner_id:
        query = query.where(EditJob.owner_id == owner_id)
    if status:
        query = query.where(EditJob.status == status)
    return list(db.scalars(query).all())


def get_job_or_404(db: Session, job_id: str) -> EditJob:
    job = db.get(EditJob, job_id)
    if job is None:
        raise ValueError("未找到对应任务。")
    return job


class JobRunner:
    def __init__(
        self,
        *,
        settings: Settings,
        db: Database,
        storage: StorageService,
        provider_registry: ProviderRegistry | None = None,
    ) -> None:
        self.settings = settings
        self.db = db
        self.storage = storage
        self.provider_registry = provider_registry or ProviderRegistry()

    def run_job(self, job_id: str) -> None:
        with self.db.session() as db:
            job = get_job_or_404(db, job_id)
            owner = db.get(Owner, job.owner_id)
            image_item = db.get(ImageItem, job.image_item_id)
            if owner is None or image_item is None:
                return

            job.status = "running"
            job.started_at = datetime.now(UTC)
            db.commit()

            try:
                result = self._run_provider_job(db, job)
                if not result.images:
                    raise ValueError("图像 provider 未返回可用图片。")
                output_image = result.images[0]
                output = self.storage.save_bytes(
                    output_image.bytes,
                    category="generated",
                    file_name=output_image.filename_hint or f"{job.id}.png",
                    mime_type=output_image.mime_type,
                )
                version = ImageVersion(
                    image_item_id=image_item.id,
                    parent_version_id=job.base_version_id,
                    origin_type="generated" if job.job_type == "generate" else "edited",
                    storage_key=output.storage_key,
                    file_name=output.file_name,
                    mime_type=output.mime_type,
                    width=output.width,
                    height=output.height,
                    file_size=output.file_size,
                    sha256=output.sha256,
                    prompt_text=job.prompt_text,
                    prompt_summary=_summarize_prompt(job.prompt_text),
                    mask_id=job.mask_id,
                    provider=result.provider,
                    model=result.provider_model,
                    quality=job.quality,
                    size=job.size,
                )
                db.add(version)
                db.flush()
                job.output_version_id = version.id
                job.provider = result.provider
                job.model = result.provider_model
                job.status = "succeeded"
                job.finished_at = datetime.now(UTC)
                log_event(
                    db,
                    owner_id=owner.id,
                    image_item_id=image_item.id,
                    version_id=version.id,
                    event_type="job_succeeded",
                    payload={
                        "job_id": job.id,
                        "job_type": job.job_type,
                        "provider": result.provider,
                        "model": result.provider_model,
                        "request_id": result.request_id,
                        "trace_id": result.trace_id,
                    },
                )
                db.commit()
            except ProviderConfigurationError as exc:
                self._fail_job(
                    db,
                    job,
                    owner_id=owner.id,
                    image_item_id=image_item.id,
                    message=str(exc),
                    code=exc.code,
                )
            except Exception as exc:  # noqa: BLE001
                self._fail_job(
                    db,
                    job,
                    owner_id=owner.id,
                    image_item_id=image_item.id,
                    message=f"{exc.__class__.__name__}: {exc}",
                    code="job_failed",
                )

    def _run_provider_job(self, db: Session, job: EditJob):
        app_settings = load_app_settings(db)
        adapter = self.provider_registry.get_adapter(
            job.provider,
            settings=self.settings,
            app_settings=app_settings,
            model_override=job.model,
        )
        provider_size = provider_size_from_resolved(job.size)
        if job.job_type == "generate":
            return adapter.generate(
                ProviderGenerateInput(
                    prompt=job.prompt_text,
                    size=provider_size,
                    quality=job.quality,
                )
            )
        base_version = db.get(ImageVersion, job.base_version_id)
        if base_version is None:
            raise ValueError("缺少改图底图版本。")
        image_input = ProviderInputImage(
            bytes=self.storage.read_bytes(base_version.storage_key),
            filename=base_version.file_name,
            mime_type=base_version.mime_type,
        )
        mask_input: ProviderInputImage | None = None
        if job.mask_id:
            image_mask = db.get(ImageMask, job.mask_id)
            if image_mask is None:
                raise ValueError("找不到对应的遮罩。")
            mask_input = ProviderInputImage(
                bytes=self.storage.read_bytes(image_mask.storage_key),
                filename=f"{image_mask.id}.png",
                mime_type="image/png",
            )
        return adapter.edit(
            ProviderEditInput(
                prompt=job.prompt_text,
                images=[image_input],
                mask=mask_input,
                size=provider_size,
                quality=job.quality,
            )
        )

    @staticmethod
    def _fail_job(
        db: Session,
        job: EditJob,
        *,
        owner_id: str,
        image_item_id: str,
        message: str,
        code: str,
    ) -> None:
        job.status = "failed"
        job.error_code = code
        job.error_message = message
        job.finished_at = datetime.now(UTC)
        log_event(
            db,
            owner_id=owner_id,
            image_item_id=image_item_id,
            version_id=job.base_version_id,
            event_type="job_failed",
            payload={"job_id": job.id, "error_code": code, "error_message": message},
        )
        db.commit()


def _ensure_no_active_job(db: Session, image_item_id: str) -> None:
    existing = db.scalar(
        select(EditJob).where(
            EditJob.image_item_id == image_item_id,
            EditJob.status.in_(("queued", "running")),
        )
    )
    if existing:
        raise ValueError("同一图片项已有运行中任务，请等待完成后再提交。")


def _ensure_global_concurrency(db: Session, max_concurrent: int) -> None:
    active = (
        db.scalar(
            select(func.count())
            .select_from(EditJob)
            .where(EditJob.status.in_(("queued", "running")))
        )
        or 0
    )
    if active >= max_concurrent:
        raise ValueError(
            f"已有 {active} 个 AI 任务在排队或执行，达到并发上限 {max_concurrent}。"
            "请等待任一任务完成后再提交，或在设置页调整上限。"
        )


def _summarize_prompt(prompt_text: str) -> str:
    cleaned = " ".join(prompt_text.split())
    return cleaned[:80]


def _snapshot_model(provider_id: str, openai_model: str) -> str:
    if provider_id == "tal_gpt_image_2":
        return "gpt-image-2"
    return openai_model.strip() or "gpt-image-2"
