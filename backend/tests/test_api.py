from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from lesson_image_studio_backend.config import Settings
from lesson_image_studio_backend.main import create_app
from lesson_image_studio_backend.models import ImageVersion
from lesson_image_studio_backend.services.image_sizes import normalize_tal_edit_size
from lesson_image_studio_backend.services.providers.base import (
    ProviderCallResult,
    ProviderEditInput,
    ProviderGenerateInput,
    ProviderImageOutput,
)


def build_png_bytes(color: str = "white", *, width: int = 64, height: int = 64) -> bytes:
    image = Image.new("RGB", (width, height), color=color)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


class FakeTalAdapter:
    provider_id = "tal_gpt_image_2"
    model = "gpt-image-2"

    def __init__(self) -> None:
        self.generate_requests: list[ProviderGenerateInput] = []
        self.edit_requests: list[ProviderEditInput] = []

    def generate(self, request: ProviderGenerateInput) -> ProviderCallResult:
        assert request.prompt
        self.generate_requests.append(request)
        return ProviderCallResult(
            provider=self.provider_id,
            provider_model=self.model,
            request_id="req_fixture",
            trace_id="trace_fixture",
            images=[
                ProviderImageOutput(
                    bytes=build_png_bytes("purple"),
                    mime_type="image/png",
                    filename_hint="fake-tal.png",
                )
            ],
        )

    def edit(self, request: ProviderEditInput) -> ProviderCallResult:
        assert request.images
        self.edit_requests.append(request)
        return ProviderCallResult(
            provider=self.provider_id,
            provider_model=self.model,
            request_id="req_fixture",
            trace_id="trace_fixture",
            images=[
                ProviderImageOutput(
                    bytes=build_png_bytes("purple"),
                    mime_type="image/png",
                    filename_hint="fake-tal.png",
                )
            ],
        )


class FakeTalRegistry:
    def __init__(self) -> None:
        self.adapter = FakeTalAdapter()

    def get_adapter(self, provider_id: str, **_: object) -> FakeTalAdapter:
        assert provider_id == "tal_gpt_image_2"
        return self.adapter


class FakeOpenAIAdapter:
    provider_id = "openai_official"

    def __init__(self, model: str) -> None:
        self.model = model

    def generate(self, request: ProviderGenerateInput) -> ProviderCallResult:
        return ProviderCallResult(
            provider=self.provider_id,
            provider_model=self.model,
            images=[
                ProviderImageOutput(
                    bytes=build_png_bytes("purple"),
                    mime_type="image/png",
                    filename_hint="fake-openai.png",
                )
            ],
        )

    def edit(self, request: ProviderEditInput) -> ProviderCallResult:
        return self.generate(
            ProviderGenerateInput(
                prompt=request.prompt,
                size=request.size,
                quality=request.quality,
            )
        )


class FakeOpenAIRegistry:
    def __init__(self) -> None:
        self.model_overrides: list[str | None] = []

    def get_adapter(self, provider_id: str, **kwargs: object) -> FakeOpenAIAdapter:
        assert provider_id == "openai_official"
        model_override = kwargs.get("model_override")
        assert isinstance(model_override, str)
        self.model_overrides.append(model_override)
        return FakeOpenAIAdapter(model_override)


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


def test_invalid_image_upload_returns_400_and_leaves_no_bad_file(client):
    owner = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "坏图上传"}).json()["owner"]
    item = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "坏图"}).json()["image_item"]

    response = client.post(
        f"/api/image-items/{item['id']}/import",
        files={"file": ("bad.png", b"not an image", "image/png")},
    )

    assert response.status_code == 400
    assert "图片" in response.json()["detail"]
    imported_dir = Path(client.app.state.settings.file_storage_dir) / "imported"
    assert list(imported_dir.iterdir()) == []


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


def test_tal_auto_size_helper_normalizes_to_sixteen_grid():
    assert normalize_tal_edit_size(935, 1683) == "928x1680"
    # 5000x2500 first scales to 3840x1920, already aligned to 16.
    assert normalize_tal_edit_size(5000, 2500) == "3840x1920"


def test_tal_custom_size_reaches_service_validation(client):
    client.app.state.job_runner.run_job = lambda _: None
    client.put("/api/settings", json={"default_provider": "tal_gpt_image_2"})
    owner = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "自定义尺寸"}).json()["owner"]
    item = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "尺寸"}).json()["image_item"]
    version = client.post(
        f"/api/image-items/{item['id']}/import",
        files={"file": ("base.png", build_png_bytes("green", width=935, height=1683), "image/png")},
    ).json()

    accepted = client.post(
        "/api/edits",
        json={
            "image_item_id": item["id"],
            "base_version_id": version["id"],
            "prompt_text": "按归一化尺寸改图",
            "size_mode": "custom",
            "size": "928x1680",
        },
    )
    assert accepted.status_code == 200
    payload = client.get(f"/api/jobs/{accepted.json()['job_id']}").json()
    assert payload["size"] == "928x1680"
    assert payload["quality"] == "high"
    assert payload["request_params"]["size_mode"] == "custom"

    item_b = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "非法尺寸"}).json()["image_item"]
    version_b = client.post(
        f"/api/image-items/{item_b['id']}/import",
        files={"file": ("base-b.png", build_png_bytes("green", width=935, height=1683), "image/png")},
    ).json()
    rejected = client.post(
        "/api/edits",
        json={
            "image_item_id": item_b["id"],
            "base_version_id": version_b["id"],
            "prompt_text": "非法尺寸",
            "size_mode": "custom",
            "size": "935x1683",
        },
    )
    assert rejected.status_code == 400
    assert "16 的倍数" in rejected.json()["detail"]


def test_openai_custom_size_is_rejected_at_create_time(client):
    client.app.state.job_runner.run_job = lambda _: None
    owner = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "官方尺寸"}).json()["owner"]
    item = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "官方尺寸"}).json()["image_item"]
    version = client.post(
        f"/api/image-items/{item['id']}/import",
        files={"file": ("base.png", build_png_bytes("green"), "image/png")},
    ).json()

    rejected = client.post(
        "/api/edits",
        json={
            "image_item_id": item["id"],
            "base_version_id": version["id"],
            "prompt_text": "官方 custom",
            "size_mode": "custom",
            "size": "928x1680",
        },
    )
    assert rejected.status_code == 400
    assert "OpenAI 官方" in rejected.json()["detail"]


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


def test_openai_job_uses_model_snapshot_when_settings_change(client):
    runner = client.app.state.job_runner
    original_run_job = runner.run_job
    runner.run_job = lambda _: None
    client.put("/api/settings", json={"openai_model": "snapshot-model"})
    owner = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "模型快照"}).json()["owner"]
    item = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "快照"}).json()["image_item"]

    created = client.post(
        f"/api/image-items/{item['id']}/generate",
        json={"prompt_text": "测试模型快照"},
    ).json()
    client.put("/api/settings", json={"openai_model": "new-model"})
    registry = FakeOpenAIRegistry()
    runner.provider_registry = registry
    runner.run_job = original_run_job
    runner.run_job(created["job_id"])

    payload = client.get(f"/api/jobs/{created['job_id']}").json()
    assert registry.model_overrides == ["snapshot-model"]
    assert payload["status"] == "succeeded"
    assert payload["model"] == "snapshot-model"
    assert payload["output_version"]["model"] == "snapshot-model"


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


def test_deleted_child_still_blocks_parent_version_delete(client):
    owner = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "删除链路"}).json()["owner"]
    item = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "树"}).json()["image_item"]
    root = client.post(
        f"/api/image-items/{item['id']}/import",
        files={"file": ("root.png", build_png_bytes("white"), "image/png")},
    ).json()

    with client.app.state.db.session() as db:
        stored = client.app.state.storage.save_bytes(
            build_png_bytes("blue"),
            category="generated",
            file_name="child.png",
            mime_type="image/png",
        )
        child = ImageVersion(
            image_item_id=item["id"],
            parent_version_id=root["id"],
            origin_type="edited",
            storage_key=stored.storage_key,
            file_name=stored.file_name,
            mime_type=stored.mime_type,
            width=stored.width,
            height=stored.height,
            file_size=stored.file_size,
            sha256=stored.sha256,
            prompt_text="child",
            prompt_summary="child",
            provider="tal_gpt_image_2",
            model="gpt-image-2",
            quality="medium",
            size="1024x1024",
        )
        db.add(child)
        db.commit()
        child_id = child.id

    delete_child = client.delete(f"/api/versions/{child_id}")
    assert delete_child.status_code == 200

    delete_root = client.delete(f"/api/versions/{root['id']}")
    assert delete_root.status_code == 400
    assert "子版本" in delete_root.json()["detail"]


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
    assert payload["openai_api_key_source"] == "none"
    assert payload["has_tal_service_api_key"] is False
    assert payload["openai_base_url"] == ""
    assert payload["openai_model"] == "gpt-image-2"
    assert payload["default_provider"] == "openai_official"
    assert payload["default_export_format"] == "png"
    assert payload["theme_mode"] == "light"
    assert payload["theme_variant"] == "graphite"
    assert payload["max_concurrent_jobs"] == 2
    # 绝不暴露任何 key 字符
    assert "openai_api_key" not in payload
    assert "masked_openai_api_key" not in payload
    assert "tal_service_api_key" not in payload
    assert "masked_tal_service_api_key" not in payload


def test_openai_api_key_source_reflects_env(tmp_path: Path):
    settings = Settings(
        data_dir=str(tmp_path / "data"),
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        openai_api_key="sk-from-env",
    )
    settings.resolved_data_dir.mkdir(parents=True, exist_ok=True)
    alembic_cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.resolved_database_url)
    command.upgrade(alembic_cfg, "head")
    app = create_app(settings)

    with TestClient(app) as client:
        # AppSettings empty, env has the key -> source=env
        initial = client.get("/api/settings").json()
        assert initial["has_openai_api_key"] is True
        assert initial["openai_api_key_source"] == "env"

        # Writing a key into AppSettings wins over env -> source=app_settings
        client.put("/api/settings/openai-key", json={"openai_api_key": "sk-in-db"})
        stored = client.get("/api/settings").json()
        assert stored["openai_api_key_source"] == "app_settings"

        # Clearing AppSettings falls back to env
        client.delete("/api/settings/openai-key")
        cleared = client.get("/api/settings").json()
        assert cleared["has_openai_api_key"] is True
        assert cleared["openai_api_key_source"] == "env"


def test_openai_api_key_source_none_when_both_empty(client):
    # baseline client fixture has openai_api_key=None, so source should be none
    payload = client.get("/api/settings").json()
    assert payload["has_openai_api_key"] is False
    assert payload["openai_api_key_source"] == "none"


def test_app_settings_update_fields(client):
    response = client.put(
        "/api/settings",
        json={
            "theme_mode": "dark",
            "theme_variant": "glass",
            "openai_base_url": "https://proxy.example.com/v1",
            "default_provider": "tal_gpt_image_2",
            "max_concurrent_jobs": 5,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["theme_mode"] == "dark"
    assert payload["theme_variant"] == "glass"
    assert payload["openai_base_url"] == "https://proxy.example.com/v1"
    assert payload["default_provider"] == "tal_gpt_image_2"
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


def test_tal_key_set_and_clear_without_leaking_secret(client):
    set_resp = client.put("/api/settings/tal-key", json={"tal_service_api_key": "app-id:api-key"})
    assert set_resp.status_code == 200
    payload = set_resp.json()
    assert payload["has_tal_service_api_key"] is True
    assert "tal_service_api_key" not in payload
    assert "app-id" not in str(payload)

    clear_resp = client.delete("/api/settings/tal-key")
    assert clear_resp.status_code == 200
    assert clear_resp.json()["has_tal_service_api_key"] is False


def test_tal_key_requires_app_id_api_key_shape(client):
    response = client.put("/api/settings/tal-key", json={"tal_service_api_key": "missing-colon"})
    assert response.status_code == 400
    assert "appId:apiKey" in response.json()["detail"]


def test_tal_provider_missing_config_fails_job_without_500(client):
    client.put("/api/settings", json={"default_provider": "tal_gpt_image_2"})
    owner = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "TAL 缺配置"}).json()["owner"]
    item = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "空配置"}).json()["image_item"]

    job = client.post(
        f"/api/image-items/{item['id']}/generate",
        json={
            "prompt_text": "生成一张示意图",
            "quality": "medium",
            "size": "1024x1024",
        },
    ).json()

    payload = client.get(f"/api/jobs/{job['job_id']}").json()
    assert payload["status"] == "failed"
    assert payload["provider"] == "tal_gpt_image_2"
    assert payload["output_version_id"] is None
    assert payload["error_code"] == "missing_tal_service_api_key"


def test_tal_default_provider_is_snapshotted_and_fake_runner_creates_version(client):
    registry = FakeTalRegistry()
    client.app.state.job_runner.provider_registry = registry
    client.put("/api/settings", json={"default_provider": "tal_gpt_image_2"})
    client.put("/api/settings/tal-key", json={"tal_service_api_key": "app-id:api-key"})
    owner = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "TAL fake"}).json()["owner"]
    item = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "fake"}).json()["image_item"]

    job = client.post(
        f"/api/image-items/{item['id']}/generate",
        json={
            "prompt_text": "生成一张 TAL fake 图",
        },
    ).json()

    payload = client.get(f"/api/jobs/{job['job_id']}").json()
    assert payload["status"] == "succeeded"
    assert payload["provider"] == "tal_gpt_image_2"
    assert payload["model"] == "gpt-image-2"
    assert payload["quality"] == "high"
    assert payload["size"] == "auto"
    assert registry.adapter.generate_requests[-1].size is None
    assert registry.adapter.generate_requests[-1].quality == "high"
    assert payload["output_version"]["provider"] == "tal_gpt_image_2"


def test_tal_edit_auto_size_is_resolved_and_passed_to_adapter(client):
    registry = FakeTalRegistry()
    client.app.state.job_runner.provider_registry = registry
    client.put("/api/settings", json={"default_provider": "tal_gpt_image_2"})
    owner = client.post("/api/owners/open", json={"owner_type": "other", "local_title": "TAL auto edit"}).json()["owner"]
    item = client.post(f"/api/owners/{owner['id']}/image-items", json={"title": "auto"}).json()["image_item"]
    version = client.post(
        f"/api/image-items/{item['id']}/import",
        files={"file": ("portrait.png", build_png_bytes("green", width=935, height=1683), "image/png")},
    ).json()

    job = client.post(
        "/api/edits",
        json={
            "image_item_id": item["id"],
            "base_version_id": version["id"],
            "prompt_text": "保持比例优化",
        },
    ).json()

    payload = client.get(f"/api/jobs/{job['job_id']}").json()
    assert payload["status"] == "succeeded"
    assert payload["size"] == "928x1680"
    assert payload["quality"] == "high"
    assert payload["request_params"]["size_mode"] == "auto"
    assert payload["request_params"]["resolved_size"] == "928x1680"
    assert payload["output_version"]["size"] == "928x1680"
    assert registry.adapter.edit_requests[-1].size == "928x1680"


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


def test_export_uses_default_export_format(client):
    client.put("/api/settings", json={"default_export_format": "jpeg"})

    owner = client.post(
        "/api/owners/open",
        json={"owner_type": "other", "local_title": "导出格式"},
    ).json()["owner"]
    item = client.post(
        f"/api/owners/{owner['id']}/image-items",
        json={"title": "导出图"},
    ).json()["image_item"]
    version = client.post(
        f"/api/image-items/{item['id']}/import",
        files={"file": ("root.png", build_png_bytes("white"), "image/png")},
    ).json()

    response = client.post(f"/api/versions/{version['id']}/export")
    assert response.status_code == 200
    payload = response.json()
    # Storage key and URL should now carry a JPEG extension
    assert payload["storage_key"].endswith(".jpg")
    assert payload["file_url"].endswith(".jpg")
    assert payload["file_name"] == "root.jpg"

    # And the file on disk should actually be a JPEG (magic bytes FF D8 FF)
    data_dir = Path(client.app.state.settings.file_storage_dir)
    exported_bytes = (data_dir / payload["storage_key"]).read_bytes()
    assert exported_bytes[:3] == b"\xff\xd8\xff"


def test_export_default_png_keeps_original_bytes(client):
    # default is PNG; the export path should pass through without re-encoding.
    owner = client.post(
        "/api/owners/open",
        json={"owner_type": "other", "local_title": "默认导出"},
    ).json()["owner"]
    item = client.post(
        f"/api/owners/{owner['id']}/image-items",
        json={"title": "默认导出图"},
    ).json()["image_item"]
    source_bytes = build_png_bytes("red")
    version = client.post(
        f"/api/image-items/{item['id']}/import",
        files={"file": ("root.png", source_bytes, "image/png")},
    ).json()

    response = client.post(f"/api/versions/{version['id']}/export")
    assert response.status_code == 200
    payload = response.json()
    assert payload["file_name"] == "root.png"
    data_dir = Path(client.app.state.settings.file_storage_dir)
    exported_bytes = (data_dir / payload["storage_key"]).read_bytes()
    # PNG default flows through save_bytes as raw copy
    assert exported_bytes[:8] == b"\x89PNG\r\n\x1a\n"


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
