from __future__ import annotations

from PIL import Image, ImageDraw
from sqlalchemy.orm import Session

from ..models import ImageMask, ImageVersion, Owner
from .events import log_event
from .storage import StorageService


def get_mask_or_404(db: Session, mask_id: str) -> ImageMask:
    image_mask = db.get(ImageMask, mask_id)
    if image_mask is None:
        raise ValueError("未找到对应的遮罩。")
    return image_mask


def create_rect_mask(
    db: Session,
    *,
    owner: Owner,
    image_item_id: str,
    base_version: ImageVersion,
    geometry: dict[str, int],
    storage: StorageService,
) -> ImageMask:
    if base_version.image_item_id != image_item_id:
        raise ValueError("所选版本不属于当前图片项，不能创建遮罩。")

    source_path = storage.resolve_path(base_version.storage_key)
    source_image = Image.open(source_path).convert("RGBA")
    width, height = source_image.size
    mask = Image.new("RGBA", (width, height), (0, 0, 0, 255))

    x = max(0, min(geometry["x"], width))
    y = max(0, min(geometry["y"], height))
    rect_width = max(1, min(geometry["width"], width - x))
    rect_height = max(1, min(geometry["height"], height - y))
    draw = ImageDraw.Draw(mask)
    draw.rectangle((x, y, x + rect_width, y + rect_height), fill=(0, 0, 0, 0))

    stored = storage.save_pillow_image(mask, category="masks", file_name=f"{base_version.id}_mask.png")
    image_mask = ImageMask(
        image_item_id=image_item_id,
        base_version_id=base_version.id,
        geometry={"x": x, "y": y, "width": rect_width, "height": rect_height},
        storage_key=stored.storage_key,
    )
    db.add(image_mask)
    db.flush()
    log_event(
        db,
        owner_id=owner.id,
        image_item_id=image_item_id,
        version_id=base_version.id,
        event_type="mask_created",
        payload=image_mask.geometry,
    )
    db.commit()
    db.refresh(image_mask)
    return image_mask
