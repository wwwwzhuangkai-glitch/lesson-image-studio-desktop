from __future__ import annotations

import base64
import httpx
from datetime import UTC, datetime
from pathlib import Path

from openai import OpenAI
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import Settings
from ..database import Database
from ..models import EditJob, ImageItem, ImageMask, ImageVersion, Owner
from .app_settings import load_app_settings
from .events import log_event
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
    size: str,
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
    job = EditJob(
        owner_id=owner.id,
        image_item_id=image_item.id,
        base_version_id=base_version.id,
        job_type="edit",
        prompt_text=prompt_text.strip(),
        normalized_prompt=prompt_text.strip(),
        mask_id=mask_id,
        quality=quality,
        size=size,
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
    size: str,
) -> EditJob:
    settings_row = load_app_settings(db)
    _ensure_global_concurrency(db, settings_row.max_concurrent_jobs)
    _ensure_no_active_job(db, image_item.id)
    job = EditJob(
        owner_id=owner.id,
        image_item_id=image_item.id,
        base_version_id=None,
        job_type="generate",
        prompt_text=prompt_text.strip(),
        normalized_prompt=prompt_text.strip(),
        quality=quality,
        size=size,
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
    def __init__(self, *, settings: Settings, db: Database, storage: StorageService) -> None:
        self.settings = settings
        self.db = db
        self.storage = storage

    def _load_openai_runtime(self, db: Session) -> tuple[str | None, str | None, str]:
        row = load_app_settings(db)
        api_key = (row.openai_api_key or self.settings.openai_api_key or "").strip() or None
        base_url = (
            row.openai_base_url.strip()
            or (self.settings.openai_base_url or "").strip()
        ) or None
        model = (
            row.openai_model.strip()
            or (self.settings.openai_model or "").strip()
        )
        if not model:
            raise ValueError(
                "AppSettings 与环境变量都没有配置 openai_model，"
                "请在设置页填写可用的生图模型名称。"
            )
        return api_key, base_url, model

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

            api_key, base_url, model = self._load_openai_runtime(db)
            if not api_key:
                self._fail_job(
                    db,
                    job,
                    owner_id=owner.id,
                    image_item_id=image_item.id,
                    message="未配置 OpenAI API Key，无法执行 AI 生图/改图。请在设置页填入 Key 或通过环境变量注入。",
                    code="missing_api_key",
                )
                return

            try:
                output = self._run_openai_job(db, job, api_key=api_key, base_url=base_url, model=model)
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
                    provider="openai",
                    model=model,
                    quality=job.quality,
                    size=job.size,
                )
                db.add(version)
                db.flush()
                job.output_version_id = version.id
                job.model = model
                job.status = "succeeded"
                job.finished_at = datetime.now(UTC)
                log_event(
                    db,
                    owner_id=owner.id,
                    image_item_id=image_item.id,
                    version_id=version.id,
                    event_type="job_succeeded",
                    payload={"job_id": job.id, "job_type": job.job_type},
                )
                db.commit()
            except Exception as exc:  # noqa: BLE001
                self._fail_job(
                    db,
                    job,
                    owner_id=owner.id,
                    image_item_id=image_item.id,
                    message=str(exc),
                    code="job_failed",
                )

    def _run_openai_job(
        self,
        db: Session,
        job: EditJob,
        *,
        api_key: str,
        base_url: str | None,
        model: str,
    ):
        client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            http_client=httpx.Client(trust_env=False),
        )

        if job.job_type == "generate":
            response = client.images.generate(
                model=model,
                prompt=job.prompt_text,
                quality=job.quality,
                size=job.size,
                output_format="png",
            )
        else:
            base_version = db.get(ImageVersion, job.base_version_id)
            if base_version is None:
                raise ValueError("缺少改图底图版本。")
            mask_path: Path | None = None
            if job.mask_id:
                image_mask = db.get(ImageMask, job.mask_id)
                if image_mask is None:
                    raise ValueError("找不到对应的遮罩。")
                mask_path = self.storage.resolve_path(image_mask.storage_key)
            with Path(self.storage.resolve_path(base_version.storage_key)).open("rb") as image_file:
                kwargs = {
                    "model": model,
                    "prompt": job.prompt_text,
                    "quality": job.quality,
                    "size": job.size,
                    "output_format": "png",
                    "image": image_file,
                }
                if mask_path:
                    with mask_path.open("rb") as mask_file:
                        kwargs["mask"] = mask_file
                        response = client.images.edit(**kwargs)
                else:
                    response = client.images.edit(**kwargs)

        if not response.data:
            raise ValueError("图像接口未返回可用数据。")
        image_data = response.data[0]
        if not image_data.b64_json:
            raise ValueError("图像接口未返回 base64 图片结果。")
        raw = base64.b64decode(image_data.b64_json)
        return self.storage.save_bytes(
            raw,
            category="generated",
            file_name=f"{job.id}.png",
            mime_type="image/png",
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
