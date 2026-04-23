# Settings Spec

## 1. 目标

`SettingsPage` 是正式的第 4 个页面，让团队成员在本地工作台直接配置密钥、主题和默认参数。

这不是云端账户设置，也不是多用户控制台，而是本地应用设置。

## 2. 设置存储边界

- 存储位置：后端本地数据库（SQLite `app_settings` 表）
- 不使用前端 `localStorage` 作为主存储（仅主题值缓存一份到 localStorage 防首帧闪白）
- `OPENAI_API_KEY` 第一版以明文形式落在本地 DB
- 页面和文档都明确标注：Key 仅存于当前机器本地

## 3. 数据模型

单例 `AppSettings` 行（`id = 'singleton'`，由 `CheckConstraint` 保证），由迁移在首次 `alembic upgrade` 时用 `op.bulk_insert` 写入默认值。

字段：

- `id`（固定 `'singleton'`）
- `openai_api_key`（Text，明文，可为空）
- `openai_base_url`（String，默认 `""`；空串等于使用 OpenAI 官方 endpoint）
- `openai_model`（String，默认 `"gpt-image-2"`）
- `default_export_format`（`png / jpeg / webp`，默认 `png`）
- `theme_mode`（`light / dark`，默认 `light`）
- `theme_variant`（`graphite / glass`，默认 `graphite`）
- `max_concurrent_jobs`（1–10，默认 `2`）
- `created_at` / `updated_at`（`TimestampMixin`）

本轮**不包含**的字段：

- `default_quality` / `default_size`（质量和尺寸每次改图都不同，不应当默认）
- `masked_openai_api_key`（接口不回传任何字符，只回 `has_openai_api_key: bool`）
- `openai_request_timeout_ms`（留给下一轮视情况加）

## 4. 页面分区

`SettingsPage` 固定包含 3 个分区：

### 密钥

- `OpenAI API Key`
  - 支持保存 / 更新 / 清空（清空走 `InputDialog` 二次确认，需要键入「清空」二字）
  - 状态 badge：`● 已配置` / `○ 未配置`，**绝不输出任何字符的遮罩摘要**
  - 保存后不会再从接口回传 key

### 外观

- `theme_variant`：`graphite`（石板冷静，默认）/ `glass`（浅雾玻璃）
- `theme_mode`：`light` / `dark`
- 改动即时应用到 `document.documentElement.dataset.theme`，并 `PUT /api/settings`
- 顶栏右上角的太阳/月亮图标与外观分区的 mode 等效

### 默认参数

- `openai_base_url`：留空走官方 endpoint；非空填自建代理或 OpenAI 兼容端点完整 URL
- `openai_model`：默认 `gpt-image-2`；改动立刻应用到后续所有 AI 任务（设置即生效）
- `default_export_format`：`png / jpeg / webp`
- `max_concurrent_jobs`：`queued + running` 的全局上限，超过即拒绝新任务（错误从后端 `detail` 透传）

## 5. API 规格

### `GET /api/settings`

返回：

- `has_openai_api_key`（bool，综合看 AppSettings 行和环境变量）
- `openai_api_key_source`（`"app_settings"` / `"env"` / `"none"` — 运行时实际会拿的 key 来自哪里）
- `openai_base_url`
- `openai_model`
- `default_export_format`
- `theme_mode`
- `theme_variant`
- `max_concurrent_jobs`
- `updated_at`

**不回传 `openai_api_key` / `masked_openai_api_key`**。前端仅能根据 `openai_api_key_source` 得知 key 的来源口径，不能拿到任何 key 字符。

### `PUT /api/settings`

白名单 patch，支持字段：

- `openai_base_url`
- `openai_model`
- `default_export_format`
- `theme_mode`
- `theme_variant`
- `max_concurrent_jobs`（1–10）

### `PUT /api/settings/openai-key`

单独更新 Key。Body：`{ "openai_api_key": "sk-..." }`，空字符串会被拒。

### `DELETE /api/settings/openai-key`

清空 Key。

## 6. 前端行为要求

- 顶栏右上角放明暗快切 + 设置齿轮（均在各页面现有 topbar 内嵌）
- variant 切换集中在 SettingsPage 内完成
- SettingsPage 保存改动后通过 `NotificationCenter` 弹通知
- `ThemeBridge` 在 App 启动时拉 `/api/settings` 并把 `theme_mode / theme_variant` 同步到 Zustand store 与 localStorage 缓存
- 首帧通过 `index.html` 的 inline 脚本从 localStorage 预设 `data-theme`，避免闪白

## 7. 后端与 OpenAI 调用

`services/jobs.py::JobRunner._load_openai_runtime` 的读取优先级（本轮明确）：

| 字段 | 第 1 层 | 第 2 层（回落） | 都空 |
|---|---|---|---|
| `openai_api_key` | `AppSettings.openai_api_key` | `LESSON_IMAGE_STUDIO_OPENAI_API_KEY` | 任务 failed + `error_code="missing_api_key"` |
| `openai_base_url` | `AppSettings.openai_base_url` | `LESSON_IMAGE_STUDIO_OPENAI_BASE_URL` | 走 OpenAI 官方 endpoint |
| `openai_model` | `AppSettings.openai_model` | `LESSON_IMAGE_STUDIO_OPENAI_MODEL` | `ValueError`（任务 failed，提示去设置页填） |

`max_concurrent_jobs` 在 `create_edit_job / create_generate_job` 的入口用 `_ensure_global_concurrency` 校验。

### 默认导出格式落地

`POST /api/versions/{id}/export` 会读取 `AppSettings.default_export_format`，由 `StorageService.export_copy` 用 Pillow 转码到对应格式（PNG 走字节直拷、JPEG 先 `convert("RGB")` 展平透明度、WEBP 直接编码）。事件流的 `version_exported` payload 同时记录 `export_format`。

## 8. 环境变量一览

`.env` 可以预设以下字段（都作为 AppSettings 的回落）：

```bash
LESSON_IMAGE_STUDIO_OPENAI_API_KEY=sk-xxx
LESSON_IMAGE_STUDIO_OPENAI_BASE_URL=https://your-proxy/v1
LESSON_IMAGE_STUDIO_OPENAI_MODEL=gpt-image-2
LESSON_IMAGE_STUDIO_RECENT_OWNER_LIMIT=5
LESSON_IMAGE_STUDIO_DATABASE_URL=sqlite:///...
LESSON_IMAGE_STUDIO_DATA_DIR=/path/to/data
```

`.env` **不会**被前端写回。任何 UI 改动只写到 AppSettings 表。

## 9. 非目标

这一阶段不做：

- 多用户账号设置
- 云端同步
- 权限控制
- 团队共享密钥
- 复杂导出模板系统
- `openai_request_timeout_ms`（下一轮如有必要再加）
- 默认 `quality / size`（每次改图单独选）
