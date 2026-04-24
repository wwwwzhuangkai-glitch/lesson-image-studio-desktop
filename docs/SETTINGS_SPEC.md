# Settings Spec

## 1. 目标

`SettingsPage` 是正式的第 4 个页面，让团队成员在本地工作台直接配置运行参数、主题和默认偏好。

这不是云端账户设置，也不是多用户控制台，而是每个成员在自己机器上使用的本地应用设置。

## 2. 设置存储边界

- 存储位置：后端本地数据库（SQLite `app_settings` 表）
- 不使用前端 `localStorage` 作为主存储（仅主题值缓存一份到 localStorage 防首帧闪白）
- 当前 OpenAI Key 和 TAL 公司服务认证值以明文形式落在本地 DB
- 页面和文档都明确标注：Key 仅存于当前机器本地
- 日常使用时，产品级设置以 `SettingsPage -> AppSettings` 为主
- `.env` 只应被视为工程兼容入口，而不是团队日常配置主入口

## 3. 当前已实现的 `AppSettings`

单例 `AppSettings` 行（`id = 'singleton'`，由 `CheckConstraint` 保证），由迁移在首次 `alembic upgrade` 时用 `op.bulk_insert` 写入默认值。

当前已实现字段：

- `id`（固定 `'singleton'`）
- `openai_api_key`（Text，明文，可为空）
- `openai_base_url`（String，默认 `""`；空串等于使用 OpenAI 官方 endpoint）
- `openai_model`（String，默认 `"gpt-image-2"`）
- `default_provider`（`openai_official / tal_gpt_image_2`，默认 `openai_official`）
- `tal_service_api_key`（Text，明文，可为空；格式 `appId:apiKey`）
- `default_export_format`（`png / jpeg / webp`，默认 `png`）
- `theme_mode`（`light / dark`，默认 `light`）
- `theme_variant`（`graphite / glass`，默认 `graphite`）
- `max_concurrent_jobs`（1–10，默认 `2`）
- `created_at` / `updated_at`（`TimestampMixin`）

当前不包含的字段：

- `default_quality` / `default_size`
- `masked_openai_api_key`
- `masked_tal_service_api_key`
- `openai_request_timeout_ms`

保留说明：

- 数据库模型里仍保留 `tal_service_base_url` 兼容字段，但当前产品口径不再暴露或读取它。

## 4. 已锁定的产品方向

Provider MVP 已按下面的产品共识落地：

- `SettingsPage` 是每个成员在自己机器上的本地设置中心
- 当前官方 OpenAI 路径保留
- provider / adapter 是新增层，不替换官方 OpenAI
- provider 选择是全局默认 provider，放在 SettingsPage；新任务入队时快照到 `EditJob.provider`
- 官方 OpenAI 的模型名也在新任务入队时快照到 `EditJob.model`，排队后修改 `openai_model` 不影响已创建任务
- API key 与 base URL 不快照进任务，仍在任务运行时读取本地设置
- 任务质量默认 `high`，尺寸主流程默认 `size_mode=auto`
- 本轮只注册两个可用 provider：
  - `openai_official`
  - `tal_gpt_image_2`
- Gemini 两个 TAL provider 暂不接入，只保留规划文档
- TAL 公司模型共享同一套公司 AI 服务配置：
  - 固定兼容层地址：`http://ai-service.tal.com/openai-compatible/v1`
  - 一个共享认证值
  - 通过不同 adapter / 模型名切换能力
- 多图输入可以在后端 adapter 预留，但当前前端不做入口

## 5. 当前 SettingsPage 分区

### 默认 Provider

- 可选项：`openai_official` / `tal_gpt_image_2`
- 改动写入 `AppSettings.default_provider`
- 已创建任务不受后续切换影响

### OpenAI 官方配置

- 仅在默认 provider 选中 `openai_official` 时展示
- 支持保存 / 更新 / 清空（清空走 `InputDialog` 二次确认，需要键入「清空」二字）
- 状态 badge 只展示状态和来源，不展示任何字符
- 保存后不会再从接口回传 key
- `openai_base_url`：留空走官方 endpoint；非空填自建代理或 OpenAI 兼容端点完整 URL
- `openai_model`：默认 `gpt-image-2`；改动只影响后续新建任务，任务入队后使用当时快照的模型名

### 公司 AI 服务配置

- 仅在默认 provider 选中 `tal_gpt_image_2` 时展示
- 公司兼容层地址由应用固定使用，不在 SettingsPage 暴露输入框
- `tal_service_api_key` 单独保存 / 清空，格式 `appId:apiKey`
- 状态 badge 只展示是否已配置，不展示任何字符

### 外观

- `theme_variant`：`graphite`（石板冷静，默认）/ `glass`（浅雾玻璃）
- `theme_mode`：`light` / `dark`
- 改动即时应用到 `document.documentElement.dataset.theme`，并 `PUT /api/settings`
- 顶栏右上角的太阳 / 月亮图标与外观分区的 mode 等效

### 通用默认参数

- `default_export_format`：`png / jpeg / webp`
- `max_concurrent_jobs`：`queued + running` 的全局上限，超过即拒绝新任务
- 这两个字段是 provider 无关的全局工作台配置，不归属 OpenAI 官方配置

## 6. 当前 API 规格

### `GET /api/settings`

返回：

- `has_openai_api_key`
- `openai_api_key_source`
- `has_tal_service_api_key`
- `openai_base_url`
- `openai_model`
- `default_provider`
- `default_export_format`
- `theme_mode`
- `theme_variant`
- `max_concurrent_jobs`
- `updated_at`

不回传 `openai_api_key` / `masked_openai_api_key` / `tal_service_api_key` / `masked_tal_service_api_key`。

### `PUT /api/settings`

当前白名单 patch 支持：

- `openai_base_url`
- `openai_model`
- `default_provider`
- `default_export_format`
- `theme_mode`
- `theme_variant`
- `max_concurrent_jobs`

### `PUT /api/settings/openai-key`

单独更新 key。空字符串会被拒绝。

### `DELETE /api/settings/openai-key`

清空 key。

### `PUT /api/settings/tal-key`

单独更新 TAL 公司服务认证值。body：

```json
{ "tal_service_api_key": "appId:apiKey" }
```

### `DELETE /api/settings/tal-key`

清空 TAL 公司服务认证值。

### `POST /api/edits` / `POST /api/image-items/{id}/generate`

AI 任务创建接口当前支持：

- `quality`：`low / medium / high`，默认 `high`
- `size_mode`：`auto / preset / custom`，默认 `auto`
- `size`：可为空；`custom` 时允许 `928x1680` 这类 `^\d+x\d+$` 字符串进入 service 校验

尺寸决策由后端在创建任务时复算，并写入：

- `EditJob.size`：最终对用户可见规格
- `EditJob.request_params.size_mode`
- `EditJob.request_params.requested_size`
- `EditJob.request_params.resolved_size`
- `EditJob.request_params.provider_size`

当前策略：

- TAL 图改图 `auto`：按底图宽高归一化到 `16` 对齐、最长边不超过 `3840`，并显式传给 provider
- 文生图 `auto`：`EditJob.size = auto`，adapter 不传 `size`
- `preset`：只接受 `1024x1024 / 1536x1024 / 1024x1536`
- `custom`：当前只允许 TAL，要求正整数、`16` 对齐、最长边不超过 `3840`

## 7. 当前前端行为要求

- 顶栏右上角放明暗快切 + 设置齿轮
- variant 切换集中在 SettingsPage 内完成
- SettingsPage 保存改动后通过 `NotificationCenter` 弹通知
- `ThemeBridge` 在 App 启动时拉 `/api/settings` 并把 `theme_mode / theme_variant` 同步到 Zustand store 与 localStorage
- 首帧通过 `index.html` 的 inline 脚本从 localStorage 预设 `data-theme`，避免闪白

## 8. 当前后端 Provider 调用

`services/jobs.py::JobRunner` 当前只负责任务状态、读取底图 / mask、调用 provider adapter、落盘图片、写入 `ImageVersion` 和事件。

新建 AI 任务时，`create_edit_job / create_generate_job` 会把当前 `AppSettings.default_provider` 快照到 `EditJob.provider`，避免排队期间切换设置影响已创建任务。

官方 OpenAI 任务还会把当前 `openai_model` 快照到 `EditJob.model`；`JobRunner` 创建 adapter 时使用这个快照模型。Key 与 base URL 不快照，仍从运行时 AppSettings / env 读取。

尺寸决策集中在 `services/image_sizes.py`，`JobRunner` 只消费已经落库的 `EditJob.size`，并把 `auto` 转成 adapter 的 `size=None`。

Provider registry 当前注册：

- `openai_official`
- `tal_gpt_image_2`

历史 `openai` 记录不迁移；registry 会把它兼容到官方 OpenAI adapter。

### 官方 OpenAI adapter

`openai_official` adapter 会合并官方 OpenAI 所需的运行时参数：

| 字段 | 第 1 层 | 第 2 层（兼容） | 都空 |
|---|---|---|---|
| `openai_api_key` | `AppSettings.openai_api_key` | `LESSON_IMAGE_STUDIO_OPENAI_API_KEY` | 任务 failed + `error_code="missing_api_key"` |
| `openai_base_url` | `AppSettings.openai_base_url` | `LESSON_IMAGE_STUDIO_OPENAI_BASE_URL` | 走 OpenAI 官方 endpoint |
| `openai_model` | `AppSettings.openai_model` | `LESSON_IMAGE_STUDIO_OPENAI_MODEL` | `ValueError` |

### TAL `gpt-image-2` adapter

- adapter 固定使用 `http://ai-service.tal.com/openai-compatible/v1`
- `gpt-image-2` 文生图拼接 `/images/generations`，图生图拼接 `/images/edits`
- header 使用 `api-key: appId:apiKey`
- 返回解析 `body.data[].b64_json`
- 缺认证值时任务失败为明确配置错误，不返回 500
- 图改图 `size_mode=auto` 时使用后端归一化尺寸；文生图 `auto` 不传 `size`

`max_concurrent_jobs` 在 `create_edit_job / create_generate_job` 的入口用 `_ensure_global_concurrency` 校验。

### 默认导出格式落地

`POST /api/versions/{id}/export` 会读取 `AppSettings.default_export_format`，由 `StorageService.export_copy` 用 Pillow 转码到对应格式：

- PNG 走字节直拷
- JPEG 先 `convert("RGB")` 展平透明度
- WEBP 直接编码

## 9. 后续 provider 化演进

### 9.1 已交付的 Provider MVP

本轮已经把 Settings 体系扩成“全局默认 provider + provider 配置中心”，并接入 TAL `gpt-image-2` adapter。

当前可用 provider：

- `openai_official`
- `tal_gpt_image_2`

### 9.2 暂未接入

- `tal_gemini_flash_image`
- `tal_gemini_pro_image`

Gemini 两个 provider 的接口规划继续保留在 provider 文档中，但本轮不注册、不在 SettingsPage 展示。

### 9.3 已确认的团队规则

- TAL `gpt-image-2` 和后续 TAL `gemini-3.1-flash-image` 共享固定公司兼容层地址和同一个认证值
- 不要把公司模型拆成两份地址 / key
- model 名由内部 adapter 决定或切换，不要求老师分别维护两套服务地址
- TAL 多图输入当前不做前端入口

## 10. 提供给下一位 AI 的 TAL 接口提醒

TAL `gpt-image-2` 已在 Provider MVP 中接入；Gemini 仍是后续规划。

### TAL `gpt-image-2`

- 文生图：`POST http://ai-service.tal.com/openai-compatible/v1/images/generations`
- 图生图：`POST http://ai-service.tal.com/openai-compatible/v1/images/edits`
- 认证 header：`api-key: appId:apiKey`
- 模型名：`gpt-image-2`

### TAL `gemini` 图片模型

- 文生图 / 图生图：`POST http://ai-service.tal.com/openai-compatible/v1/chat/completions`
- 认证 header：同上
- 模型名当前至少包括：
  - `gemini-3.1-flash-image`
  - `gemini-3-pro-image`
- 需要：
  - `messages`
  - `modalities: ["text", "image"]`
  - 图生图时传 `messages[].content[].image_url`
  - 部分场景可用 `extra_body.generationConfig.imageConfig`

## 11. 环境变量一览

`.env` 当前仍可预设以下字段：

```bash
LESSON_IMAGE_STUDIO_OPENAI_API_KEY=sk-xxx
LESSON_IMAGE_STUDIO_OPENAI_BASE_URL=https://your-proxy/v1
LESSON_IMAGE_STUDIO_OPENAI_MODEL=gpt-image-2
LESSON_IMAGE_STUDIO_RECENT_OWNER_LIMIT=5
LESSON_IMAGE_STUDIO_DATABASE_URL=sqlite:///...
LESSON_IMAGE_STUDIO_DATA_DIR=/path/to/data
```

`.env` 不会被前端写回。任何 UI 改动只写到 `AppSettings` 表。

## 12. 非目标

这一阶段不做：

- 多用户账号设置
- 云端同步
- 权限控制
- 团队共享密钥
- 复杂导出模板系统
- `openai_request_timeout_ms`
- 全局默认 `quality / size` 设置项
