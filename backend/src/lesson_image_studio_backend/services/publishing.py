from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ImageItem, PublishRecord
from .events import log_event


def create_publish_record(
    db: Session,
    *,
    owner_id: str,
    publish_scope: str,
    image_item_id: str | None,
    version_id: str | None,
) -> PublishRecord:
    payload: dict[str, object]
    if publish_scope == "owner_bundle":
        image_items = db.scalars(
            select(ImageItem).where(
                ImageItem.owner_id == owner_id,
                ImageItem.status != "deleted",
                ImageItem.current_final_version_id.is_not(None),
            )
        ).all()
        payload = {
            "owner_id": owner_id,
            "final_versions": [
                {
                    "image_item_id": item.id,
                    "version_id": item.current_final_version_id,
                }
                for item in image_items
            ],
        }
    else:
        payload = {
            "owner_id": owner_id,
            "image_item_id": image_item_id,
            "version_id": version_id,
        }

    record = PublishRecord(
        publish_scope=publish_scope,
        owner_id=owner_id,
        image_item_id=image_item_id,
        version_id=version_id,
        payload_snapshot=payload,
    )
    db.add(record)
    db.flush()
    log_event(
        db,
        owner_id=owner_id,
        image_item_id=image_item_id,
        version_id=version_id,
        event_type="publish_placeholder_recorded",
        payload=payload,
    )
    db.commit()
    db.refresh(record)
    return record
