from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings
from ..models import PromptPreset


def ensure_builtin_presets(db: Session, settings: Settings) -> None:
    existing = {
        preset.name
        for preset in db.scalars(select(PromptPreset).where(PromptPreset.is_builtin.is_(True))).all()
    }
    raw_presets = json.loads(settings.builtin_preset_path.read_text(encoding="utf-8"))
    changed = False
    for raw in raw_presets:
        if raw["name"] in existing:
            continue
        db.add(
            PromptPreset(
                scope="system",
                name=raw["name"],
                summary=raw["summary"],
                prompt_text=raw["prompt_text"],
                discipline=raw.get("discipline"),
                is_builtin=True,
            )
        )
        changed = True
    if changed:
        db.commit()


def list_presets(db: Session, scope: str) -> list[PromptPreset]:
    query = select(PromptPreset)
    if scope in {"system", "personal"}:
        query = query.where(PromptPreset.scope == scope)
    return list(db.scalars(query.order_by(PromptPreset.is_builtin.desc(), PromptPreset.updated_at.desc())).all())


def create_personal_preset(
    db: Session,
    *,
    name: str,
    summary: str,
    prompt_text: str,
    discipline: str | None,
    source_preset_id: str | None,
) -> PromptPreset:
    preset = PromptPreset(
        scope="personal",
        name=name.strip(),
        summary=summary.strip(),
        prompt_text=prompt_text.strip(),
        discipline=discipline,
        is_builtin=False,
        source_preset_id=source_preset_id,
    )
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return preset


def get_preset_or_404(db: Session, preset_id: str) -> PromptPreset:
    preset = db.get(PromptPreset, preset_id)
    if preset is None:
        raise ValueError("未找到对应模板。")
    return preset


def update_personal_preset(
    db: Session,
    *,
    preset: PromptPreset,
    name: str | None,
    summary: str | None,
    prompt_text: str | None,
    discipline: str | None,
) -> PromptPreset:
    if preset.is_builtin:
        raise ValueError("系统模板不能直接编辑，请先复制为个人模板。")
    if name is not None:
        preset.name = name.strip()
    if summary is not None:
        preset.summary = summary.strip()
    if prompt_text is not None:
        preset.prompt_text = prompt_text.strip()
    if discipline is not None:
        preset.discipline = discipline
    db.commit()
    db.refresh(preset)
    return preset


def delete_personal_preset(db: Session, *, preset: PromptPreset) -> None:
    if preset.is_builtin:
        raise ValueError("系统模板不能删除。")
    db.delete(preset)
    db.commit()
