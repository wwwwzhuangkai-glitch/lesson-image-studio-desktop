from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import EditJob, ImageItem, ImageVersion, Owner
from .events import log_event
from .storage import StorageService


@dataclass(slots=True)
class OwnerTaskSummary:
    queued: int = 0
    running: int = 0
    succeeded: int = 0
    failed: int = 0


def create_image_item(db: Session, *, owner: Owner, title: str) -> ImageItem:
    max_order = _next_sort_order(db, owner.id)
    image_item = ImageItem(
        owner_id=owner.id,
        title=title.strip(),
        sort_order=max_order,
        status="active",
    )
    db.add(image_item)
    db.flush()
    log_event(
        db,
        owner_id=owner.id,
        image_item_id=image_item.id,
        event_type="image_item_created",
        payload={"title": image_item.title},
    )
    db.commit()
    db.refresh(image_item)
    return image_item


def _next_sort_order(db: Session, owner_id: str) -> int:
    max_order = db.scalar(
        select(func.max(ImageItem.sort_order)).where(ImageItem.owner_id == owner_id)
    )
    return (max_order or 0) + 1


def reorder_image_items(db: Session, *, owner: Owner, entries: list[tuple[str, int]]) -> None:
    items = {
        item.id: item
        for item in db.scalars(
            select(ImageItem).where(ImageItem.owner_id == owner.id, ImageItem.status != "deleted")
        ).all()
    }
    for item_id, sort_order in entries:
        if item_id in items:
            items[item_id].sort_order = sort_order

    log_event(
        db,
        owner_id=owner.id,
        event_type="image_items_reordered",
        payload={"items": [{"image_item_id": item_id, "sort_order": sort_order} for item_id, sort_order in entries]},
    )
    db.commit()


def get_image_item_or_404(db: Session, image_item_id: str) -> ImageItem:
    image_item = db.get(ImageItem, image_item_id)
    if image_item is None:
        raise ValueError("未找到对应的图片项。")
    return image_item


def get_active_items_for_owner(db: Session, owner_id: str) -> list[ImageItem]:
    return list(
        db.scalars(
            select(ImageItem)
            .where(ImageItem.owner_id == owner_id, ImageItem.status != "deleted")
            .order_by(ImageItem.sort_order.asc(), ImageItem.created_at.asc())
        ).all()
    )


def get_deleted_items_for_owner(db: Session, owner_id: str) -> list[ImageItem]:
    return list(
        db.scalars(
            select(ImageItem)
            .where(ImageItem.owner_id == owner_id, ImageItem.status == "deleted")
            .order_by(ImageItem.updated_at.desc())
        ).all()
    )


def get_versions_for_items(
    db: Session,
    item_ids: list[str],
    *,
    include_deleted: bool = False,
) -> list[ImageVersion]:
    if not item_ids:
        return []
    query = select(ImageVersion).where(ImageVersion.image_item_id.in_(item_ids))
    if not include_deleted:
        query = query.where(ImageVersion.is_deleted.is_(False))
    query = query.order_by(ImageVersion.created_at.asc())
    return list(db.scalars(query).all())


def get_running_jobs_for_items(db: Session, item_ids: list[str]) -> dict[str, EditJob]:
    if not item_ids:
        return {}
    jobs = db.scalars(
        select(EditJob).where(
            EditJob.image_item_id.in_(item_ids),
            EditJob.status.in_(("queued", "running")),
        )
    ).all()
    return {job.image_item_id: job for job in jobs}


def get_task_summary(db: Session, *, owner_id: str | None = None) -> OwnerTaskSummary:
    query = select(EditJob.status, func.count(EditJob.id)).group_by(EditJob.status)
    if owner_id:
        query = query.where(EditJob.owner_id == owner_id)
    rows = db.execute(query).all()
    summary = OwnerTaskSummary()
    for status, count in rows:
        if hasattr(summary, status):
            setattr(summary, status, count)
    return summary


def import_root_version(
    db: Session,
    *,
    owner: Owner,
    image_item: ImageItem,
    storage: StorageService,
    upload: UploadFile,
) -> ImageVersion:
    stored = storage.save_upload(upload, "imported")
    version = ImageVersion(
        image_item_id=image_item.id,
        parent_version_id=None,
        origin_type="imported",
        storage_key=stored.storage_key,
        file_name=stored.file_name,
        mime_type=stored.mime_type,
        width=stored.width,
        height=stored.height,
        file_size=stored.file_size,
        sha256=stored.sha256,
        provider="local",
        model=None,
        quality=None,
        size=f"{stored.width}x{stored.height}",
        prompt_summary="导入底图",
    )
    db.add(version)
    db.flush()
    log_event(
        db,
        owner_id=owner.id,
        image_item_id=image_item.id,
        version_id=version.id,
        event_type="image_imported",
        payload={"file_name": stored.file_name},
    )
    db.commit()
    db.refresh(version)
    return version


def get_versions_for_item(
    db: Session,
    image_item_id: str,
    *,
    include_deleted: bool = False,
) -> list[ImageVersion]:
    query = select(ImageVersion).where(ImageVersion.image_item_id == image_item_id)
    if not include_deleted:
        query = query.where(ImageVersion.is_deleted.is_(False))
    return list(db.scalars(query.order_by(ImageVersion.created_at.asc())).all())


def get_version_or_404(db: Session, version_id: str) -> ImageVersion:
    version = db.get(ImageVersion, version_id)
    if version is None:
        raise ValueError("未找到对应的版本。")
    return version


def ensure_version_belongs_to_item(*, image_item: ImageItem, version: ImageVersion, action: str) -> None:
    if version.image_item_id != image_item.id:
        raise ValueError(f"{action}时只能使用当前图片项自己的版本。")
    if version.is_deleted:
        raise ValueError("不能使用已删除版本。")


def get_recent_jobs_for_item(db: Session, image_item_id: str, *, limit: int = 10) -> list[EditJob]:
    return list(
        db.scalars(
            select(EditJob)
            .where(EditJob.image_item_id == image_item_id)
            .order_by(EditJob.created_at.desc())
            .limit(limit)
        ).all()
    )


def get_recent_events(db: Session, *, owner_id: str, image_item_id: str | None = None, limit: int = 20) -> list[Any]:
    from ..models import EventLog

    event_query = select(EventLog).where(EventLog.owner_id == owner_id)
    if image_item_id:
        event_query = event_query.where(EventLog.image_item_id == image_item_id)
    event_query = event_query.order_by(EventLog.created_at.desc()).limit(limit)
    return list(db.scalars(event_query).all())


def finalize_version(db: Session, *, owner: Owner, image_item: ImageItem, version: ImageVersion) -> None:
    if version.image_item_id != image_item.id or version.is_deleted:
        raise ValueError("无法将该版本设为定稿。")
    image_item.current_final_version_id = version.id
    log_event(
        db,
        owner_id=owner.id,
        image_item_id=image_item.id,
        version_id=version.id,
        event_type="version_finalized",
        payload={"version_id": version.id},
    )
    db.commit()


def unfinalize_version(db: Session, *, owner: Owner, image_item: ImageItem) -> None:
    if image_item.current_final_version_id is None:
        return
    old_version_id = image_item.current_final_version_id
    image_item.current_final_version_id = None
    log_event(
        db,
        owner_id=owner.id,
        image_item_id=image_item.id,
        version_id=old_version_id,
        event_type="version_unfinalized",
        payload={"version_id": old_version_id},
    )
    db.commit()


def soft_delete_image_item(db: Session, *, owner: Owner, image_item: ImageItem) -> None:
    if image_item.current_final_version_id:
        raise ValueError("请先取消当前定稿后再删除图片项。")
    image_item.status = "deleted"
    log_event(
        db,
        owner_id=owner.id,
        image_item_id=image_item.id,
        event_type="image_item_deleted",
        payload={"image_item_id": image_item.id},
    )
    db.commit()


def restore_image_item(db: Session, *, owner: Owner, image_item: ImageItem) -> None:
    image_item.status = "active"
    log_event(
        db,
        owner_id=owner.id,
        image_item_id=image_item.id,
        event_type="image_item_restored",
        payload={"image_item_id": image_item.id},
    )
    db.commit()


def soft_delete_version(db: Session, *, owner: Owner, image_item: ImageItem, version: ImageVersion) -> None:
    children_count = db.scalar(
        select(func.count(ImageVersion.id)).where(ImageVersion.parent_version_id == version.id, ImageVersion.is_deleted.is_(False))
    )
    running_refs = db.scalar(
        select(func.count(EditJob.id)).where(
            EditJob.base_version_id == version.id,
            EditJob.status.in_(("queued", "running")),
        )
    )
    if image_item.current_final_version_id == version.id:
        raise ValueError("当前定稿版本不能直接删除。")
    if children_count:
        raise ValueError("只有叶子草稿版本可以删除。")
    if running_refs:
        raise ValueError("该版本仍被运行中的任务引用，不能删除。")
    version.is_deleted = True
    log_event(
        db,
        owner_id=owner.id,
        image_item_id=image_item.id,
        version_id=version.id,
        event_type="version_deleted",
        payload={"version_id": version.id},
    )
    db.commit()


def restore_version(db: Session, *, owner: Owner, image_item: ImageItem, version: ImageVersion) -> None:
    version.is_deleted = False
    log_event(
        db,
        owner_id=owner.id,
        image_item_id=image_item.id,
        version_id=version.id,
        event_type="version_restored",
        payload={"version_id": version.id},
    )
    db.commit()


def get_deleted_versions_for_owner(db: Session, owner_id: str) -> list[ImageVersion]:
    return list(
        db.scalars(
            select(ImageVersion)
            .join(ImageItem, ImageVersion.image_item_id == ImageItem.id)
            .where(ImageItem.owner_id == owner_id, ImageVersion.is_deleted.is_(True))
            .order_by(ImageVersion.created_at.desc())
        ).all()
    )


def duplicate_version_to_new_item(
    db: Session,
    *,
    owner: Owner,
    source_item: ImageItem,
    source_version: ImageVersion,
    title: str | None,
    storage: StorageService,
) -> tuple[ImageItem, ImageVersion]:
    ensure_version_belongs_to_item(
        image_item=source_item,
        version=source_version,
        action="复制起点",
    )

    normalized_title = (title or "").strip() or f"{source_item.title} - 副本"
    image_item = ImageItem(
        owner_id=owner.id,
        title=normalized_title,
        sort_order=_next_sort_order(db, owner.id),
        status="active",
    )
    db.add(image_item)
    db.flush()

    source_bytes = storage.read_bytes(source_version.storage_key)
    stored = storage.save_bytes(
        source_bytes,
        category="imported",
        file_name=source_version.file_name,
        mime_type=source_version.mime_type,
    )
    version = ImageVersion(
        image_item_id=image_item.id,
        parent_version_id=None,
        origin_type="duplicated",
        storage_key=stored.storage_key,
        file_name=stored.file_name,
        mime_type=stored.mime_type,
        width=stored.width,
        height=stored.height,
        file_size=stored.file_size,
        sha256=stored.sha256,
        prompt_text=source_version.prompt_text,
        prompt_summary=source_version.prompt_summary or "复制起点",
        mask_id=None,
        provider=source_version.provider,
        model=source_version.model,
        quality=source_version.quality,
        size=source_version.size or f"{stored.width}x{stored.height}",
    )
    db.add(version)
    db.flush()

    log_event(
        db,
        owner_id=owner.id,
        image_item_id=image_item.id,
        event_type="image_item_created",
        payload={"title": image_item.title, "source_version_id": source_version.id},
    )
    log_event(
        db,
        owner_id=owner.id,
        image_item_id=image_item.id,
        version_id=version.id,
        event_type="image_item_duplicated_from_version",
        payload={
            "source_image_item_id": source_item.id,
            "source_version_id": source_version.id,
            "title": image_item.title,
        },
    )
    db.commit()
    db.refresh(image_item)
    db.refresh(version)
    return image_item, version


def build_version_tree(versions: list[ImageVersion]) -> list[dict[str, Any]]:
    children_map: dict[str | None, list[ImageVersion]] = defaultdict(list)
    for version in versions:
        children_map[version.parent_version_id].append(version)

    def build_node(version: ImageVersion) -> dict[str, Any]:
        children = [build_node(child) for child in children_map.get(version.id, [])]
        return {"version": version, "children": children, "child_count": len(children)}

    return [build_node(root) for root in children_map.get(None, [])]
