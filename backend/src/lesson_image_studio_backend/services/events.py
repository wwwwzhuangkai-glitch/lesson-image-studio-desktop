from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import EventLog


def log_event(
    db: Session,
    *,
    owner_id: str,
    event_type: str,
    image_item_id: str | None = None,
    version_id: str | None = None,
    payload: dict[str, object] | None = None,
) -> EventLog:
    event = EventLog(
        owner_id=owner_id,
        image_item_id=image_item_id,
        version_id=version_id,
        event_type=event_type,
        payload=payload or {},
    )
    db.add(event)
    db.flush()
    return event
