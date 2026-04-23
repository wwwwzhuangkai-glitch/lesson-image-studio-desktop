from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from lesson_image_studio_backend.config import Settings
from lesson_image_studio_backend.main import create_app


def build_png_bytes(color: str = "white") -> bytes:
    image = Image.new("RGB", (64, 64), color=color)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_open_other_owner_and_recent_list(client):
    response = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "牛顿第二定律草稿"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["owner"]["owner_type"] == "other"
    assert payload["owner"]["owner_id"].startswith("other_")
    assert payload["recent_owners"]


def test_create_image_item_and_import_root_version(client):
    owner = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "多图工作区"}).json()["owner"]
    item = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "受力分析图"}).json()["image_item"]
    file_response = client.post(
        f"/api/image-items/{item['id']}/import",
        files={"file": ("force.png", build_png_bytes(), "image/png")},
    )
    assert file_response.status_code == 200
    imported = file_response.json()
    assert imported["origin_type"] == "imported"

    detail = client.get(f"/api/image-items/{item['id']}").json()
    assert len(detail["versions"]) == 1


def test_same_image_item_jobs_are_serialized(client):
    client.app.state.job_runner.run_job = lambda _: None
    owner = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "任务串行"}).json()["owner"]
    item = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "装置图"}).json()["image_item"]
    version = client.post(
        f"/api/image-items/{item['id']}/import",
        files={"file": ("setup.png", build_png_bytes("blue"), "image/png")},
    ).json()

    first = client.post(
        "/api/edits",
        json={
            "image_item_id": item["id"],
            "base_version_id": version["id"],
            "prompt_text": "把线条画得更清晰",
            "quality": "medium",
            "size": "1024x1024",
        },
    )
    assert first.status_code == 200

    second = client.post(
        "/api/edits",
        json={
            "image_item_id": item["id"],
            "base_version_id": version["id"],
            "prompt_text": "再来一次",
            "quality": "medium",
            "size": "1024x1024",
        },
    )
    assert second.status_code == 400


def test_rejects_cross_item_version_for_mask_and_edit(client):
    owner = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "跨图校验"}).json()["owner"]
    item_a = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "A 图"}).json()["image_item"]
    item_b = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "B 图"}).json()["image_item"]
    version_a = client.post(
        f"/api/image-items/{item_a['id']}/import",
        files={"file": ("a.png", build_png_bytes("purple"), "image/png")},
    ).json()

    mask = client.post(
        "/api/masks",
        json={
            "image_item_id": item_b["id"],
            "base_version_id": version_a["id"],
            "geometry": {"x": 4, "y": 4, "width": 20, "height": 20},
        },
    )
    assert mask.status_code == 400

    edit = client.post(
        "/api/edits",
        json={
            "image_item_id": item_b["id"],
            "base_version_id": version_a["id"],
            "prompt_text": "不允许跨图",
            "quality": "medium",
            "size": "1024x1024",
        },
    )
    assert edit.status_code == 400


def test_rejects_mask_from_another_image_item(client):
    owner = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "mask 归属"}).json()["owner"]
    item_a = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "A 图"}).json()["image_item"]
    item_b = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "B 图"}).json()["image_item"]
    version_a = client.post(
        f"/api/image-items/{item_a['id']}/import",
        files={"file": ("a.png", build_png_bytes("pink"), "image/png")},
    ).json()
    version_b = client.post(
        f"/api/image-items/{item_b['id']}/import",
        files={"file": ("b.png", build_png_bytes("orange"), "image/png")},
    ).json()
    mask = client.post(
        "/api/masks",
        json={
            "image_item_id": item_a["id"],
            "base_version_id": version_a["id"],
            "geometry": {"x": 4, "y": 4, "width": 20, "height": 20},
        },
    ).json()

    edit = client.post(
        "/api/edits",
        json={
            "image_item_id": item_b["id"],
            "base_version_id": version_b["id"],
            "mask_id": mask["id"],
            "prompt_text": "错误 mask",
            "quality": "medium",
            "size": "1024x1024",
        },
    )
    assert edit.status_code == 400


def test_missing_key_job_fails_without_output_version(client):
    owner = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "无 key 测试"}).json()["owner"]
    item = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "生物图"}).json()["image_item"]
    version = client.post(
        f"/api/image-items/{item['id']}/import",
        files={"file": ("bio.png", build_png_bytes("green"), "image/png")},
    ).json()

    job = client.post(
        "/api/edits",
        json={
            "image_item_id": item["id"],
            "base_version_id": version["id"],
            "prompt_text": "变成教材风格",
            "quality": "medium",
            "size": "1024x1024",
        },
    ).json()

    payload = client.get(f"/api/jobs/{job['job_id']}").json()
    assert payload["status"] == "failed"
    assert payload["output_version_id"] is None
    assert "API Key" in payload["error_message"]


def test_duplicate_version_creates_independent_root_item(client):
    owner = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "复制起点"}).json()["owner"]
    item = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "函数图"}).json()["image_item"]
    version = client.post(
        f"/api/image-items/{item['id']}/import",
        files={"file": ("function.png", build_png_bytes("teal"), "image/png")},
    ).json()

    duplicated = client.post(
        f"/api/versions/{version['id']}/duplicate-to-image-item",
        json={"title": "函数图 - 副本"},
    )
    assert duplicated.status_code == 200
    payload = duplicated.json()
    assert payload["image_item"]["id"] != item["id"]
    assert payload["image_item"]["title"] == "函数图 - 副本"
    assert len(payload["versions"]) == 1
    assert payload["versions"][0]["parent_version_id"] is None

    original_tree = client.get(f"/api/image-items/{item['id']}/versions/tree").json()
    duplicated_tree = client.get(f"/api/image-items/{payload['image_item']['id']}/versions/tree").json()
    assert len(original_tree) == 1
    assert len(duplicated_tree) == 1
    assert original_tree[0]["id"] != duplicated_tree[0]["id"]


def test_finalize_and_delete_rules(client):
    owner = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "定稿测试"}).json()["owner"]
    item = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "地图"}).json()["image_item"]
    version = client.post(
        f"/api/image-items/{item['id']}/import",
        files={"file": ("map.png", build_png_bytes("yellow"), "image/png")},
    ).json()

    finalize = client.post(f"/api/image-items/{item['id']}/finalize", json={"version_id": version["id"]})
    assert finalize.status_code == 200

    delete_item = client.delete(f"/api/image-items/{item['id']}")
    assert delete_item.status_code == 400

    unfinalize = client.post(f"/api/image-items/{item['id']}/unfinalize")
    assert unfinalize.status_code == 200

    delete_item = client.delete(f"/api/image-items/{item['id']}")
    assert delete_item.status_code == 200


def test_personal_prompt_presets(client):
    presets = client.get("/api/prompt-presets").json()
    assert presets
    created = client.post(
        "/api/prompt-presets",
        json={
            "name": "我的物理模板",
            "summary": "更偏试题风格",
            "prompt_text": "请把图整理成高中物理试题风格",
            "source_preset_id": presets[0]["id"],
        },
    )
    assert created.status_code == 200
    preset = created.json()
    updated = client.patch(
        f"/api/prompt-presets/{preset['id']}",
        json={"summary": "更新后的摘要"},
    )
    assert updated.status_code == 200


def test_app_settings_defaults_after_migration(client):
    response = client.get("/api/settings")
    assert response.status_code == 200
    payload = response.json()
    assert payload["has_openai_api_key"] is False
    assert payload["openai_base_url"] == ""
    assert payload["openai_model"] == "gpt-image-2"
    assert payload["default_export_format"] == "png"
    assert payload["theme_mode"] == "light"
    assert payload["theme_variant"] == "graphite"
    assert payload["max_concurrent_jobs"] == 2
    # 绝不暴露任何 key 字符
    assert "openai_api_key" not in payload
    assert "masked_openai_api_key" not in payload


def test_app_settings_update_fields(client):
    response = client.put(
        "/api/settings",
        json={
            "theme_mode": "dark",
            "theme_variant": "glass",
            "openai_base_url": "https://proxy.example.com/v1",
            "max_concurrent_jobs": 5,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["theme_mode"] == "dark"
    assert payload["theme_variant"] == "glass"
    assert payload["openai_base_url"] == "https://proxy.example.com/v1"
    assert payload["max_concurrent_jobs"] == 5


def test_app_settings_rejects_invalid_enum(client):
    response = client.put("/api/settings", json={"theme_mode": "sepia"})
    assert response.status_code == 422


def test_openai_key_set_and_clear(client):
    set_resp = client.put("/api/settings/openai-key", json={"openai_api_key": "sk-test-123"})
    assert set_resp.status_code == 200
    assert set_resp.json()["has_openai_api_key"] is True

    clear_resp = client.delete("/api/settings/openai-key")
    assert clear_resp.status_code == 200
    assert clear_resp.json()["has_openai_api_key"] is False


def test_global_concurrency_blocks_cross_item_jobs(client):
    client.app.state.job_runner.run_job = lambda _: None
    client.put("/api/settings", json={"max_concurrent_jobs": 1})
    owner = client.post(
        "/api/owners/open",
        json={"owner_type": "other", "local_title": "并发上限"},
    ).json()["owner"]
    item_a = client.post(
        f"/api/owners/{owner['id']}/image-items",
        json={"title": "A 图"},
    ).json()["image_item"]
    item_b = client.post(
        f"/api/owners/{owner['id']}/image-items",
        json={"title": "B 图"},
    ).json()["image_item"]
    version_a = client.post(
        f"/api/image-items/{item_a['id']}/import",
        files={"file": ("a.png", build_png_bytes("red"), "image/png")},
    ).json()
    version_b = client.post(
        f"/api/image-items/{item_b['id']}/import",
        files={"file": ("b.png", build_png_bytes("blue"), "image/png")},
    ).json()

    first = client.post(
        "/api/edits",
        json={
            "image_item_id": item_a["id"],
            "base_version_id": version_a["id"],
            "prompt_text": "第一张",
            "quality": "medium",
            "size": "1024x1024",
        },
    )
    assert first.status_code == 200

    second = client.post(
        "/api/edits",
        json={
            "image_item_id": item_b["id"],
            "base_version_id": version_b["id"],
            "prompt_text": "第二张跨图",
            "quality": "medium",
            "size": "1024x1024",
        },
    )
    assert second.status_code == 400
    assert "并发上限" in second.json()["detail"]


def test_recent_owner_limit_uses_app_settings(tmp_path: Path):
    settings = Settings(
        data_dir=str(tmp_path / "data"),
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        openai_api_key=None,
        recent_owner_limit=1,
    )
    settings.resolved_data_dir.mkdir(parents=True, exist_ok=True)
    alembic_cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.resolved_database_url)
    command.upgrade(alembic_cfg, "head")
    app = create_app(settings)

    with TestClient(app) as client:
        client.post("/api/owners/open", json={"owner_type": "other", "local_title": "一号"})
        client.post("/api/owners/open", json={"owner_type": "other", "local_title": "二号"})
        recent = client.get("/api/owners/recent")
        assert recent.status_code == 200
        assert len(recent.json()) == 1
