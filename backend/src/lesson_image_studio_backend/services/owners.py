from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Owner
from .events import log_event


def open_owner(
    db: Session,
    *,
    owner_type: str,
    owner_id: str | None,
    local_title: str | None,
) -> Owner:
    normalized_type = owner_type.strip().lower()
    normalized_id = (owner_id or "").strip()
    normalized_title = (local_title or "").strip() or None

    if normalized_type == "other":
        if not normalized_title:
            raise ValueError("other 模式需要本地标题。")
        if not normalized_id:
            normalized_id = f"other_{uuid4().hex[:10]}"
    elif not normalized_id:
        raise ValueError("question / asset 模式需要输入 owner_id。")

    owner = db.scalar(
        select(Owner).where(
            Owner.owner_type == normalized_type,
            Owner.owner_id == normalized_id,
        )
    )

    if owner is None:
        owner = Owner(
            owner_type=normalized_type,
            owner_id=normalized_id,
            local_title=normalized_title,
        )
        db.add(owner)
        db.flush()
        log_event(
            db,
            owner_id=owner.id,
            event_type="owner_created",
            payload={"owner_type": owner.owner_type, "owner_id": owner.owner_id},
        )
    elif normalized_title and owner.local_title != normalized_title:
        owner.local_title = normalized_title

    owner.last_opened_at = datetime.now(UTC)
    log_event(
        db,
        owner_id=owner.id,
        event_type="owner_opened",
        payload={"owner_type": owner.owner_type, "owner_id": owner.owner_id},
    )
    db.commit()
    db.refresh(owner)
    return owner


def list_recent_owners(db: Session, *, limit: int) -> list[Owner]:
    owners = db.scalars(select(Owner).order_by(Owner.last_opened_at.desc()).limit(limit)).all()
    return list(owners)


def get_owner_or_404(db: Session, owner_pk: str) -> Owner:
    owner = db.get(Owner, owner_pk)
    if owner is None:
        raise ValueError("未找到对应的 Owner。")
    return owner
