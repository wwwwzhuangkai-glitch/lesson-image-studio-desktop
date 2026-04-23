# Settings Spec

## 1. 目标

`SettingsPage` 是正式的第 4 个页面，让团队成员在本地工作台直接配置运行参数、主题和默认偏好。

这不是云端账户设置，也不是多用户控制台，而是每个成员在自己机器上使用的本地应用设置。

## 2. 设置存储边界

- 存储位置：后端本地数据库（SQLite `app_settings` 表）
- 不使用前端 `localStorage` 作为主存储（仅主题值缓存一份到 localStorage 防首帧闪白）
- 当前 `OPENAI_API_KEY` 以明文形式落在本地 DB
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
- `default_export_format`（`png / jpeg / webp`，默认 `png`）
- `theme_mode`（`light / dark`，默认 `light`）
- `theme_variant`（`graphite / glass`，默认 `graphite`）
- `max_concurrent_jobs`（1–10，默认 `2`）
- `created_at` / `updated_at`（`TimestampMixin`）

当前不包含的字段：

- `default_quality` / `default_size`
- `masked_openai_api_key`
- `openai_request_timeout_ms`
- `default_provider`
- 公司 AI 服务配置字段

## 4. 已锁定的产品方向

后续 settings 体系必须按下面的产品共识演进：

- `SettingsPage` 是每个成员在自己机器上的本地设置中心
- 当前官方 OpenAI 路径保留
- 后续新增 provider / adapter，而不是替换掉官方 OpenAI
- provider 选择是全局默认 provider，放在 SettingsPage
- 公司内部模型共享同一套公司 AI 服务配置：
  - 一个共享 `base_url`
  - 一个共享认证值
  - 通过不同 adapter / 模型名切换能力
- 多图输入可以在后端 adapter 预留，但当前前端不做入口

## 5. 当前 SettingsPage 分区

### 密钥

- 当前是官方 OpenAI 的 key
- 支持保存 / 更新 / 清空（清空走 `InputDialog` 二次确认，需要键入「清空」二字）
- 状态 badge 只展示状态和来源，不展示任何字符
- 保存后不会再从接口回传 key

### 外观

- `theme_variant`：`graphite`（石板冷静，默认）/ `glass`（浅雾玻璃）
- `theme_mode`：`light` / `dark`
- 改动即时应用到 `document.documentElement.dataset.theme`，并 `PUT /api/settings`
- 顶栏右上角的太阳 / 月亮图标与外观分区的 mode 等效

### 默认参数

- `openai_base_url`：留空走官方 endpoint；非空填自建代理或 OpenAI 兼容端点完整 URL
- `openai_model`：默认 `gpt-image-2`；改动立刻应用到后续所有 AI 任务（设置即生效）
- `default_export_format`：`png / jpeg / webp`
- `max_concurrent_jobs`：`queued + running` 的全局上限，超过即拒绝新任务

## 6. 当前 API 规格

### `GET /api/settings`

返回：

- `has_openai_api_key`
- `openai_api_key_source`
- `openai_base_url`
- `openai_model`
- `default_export_format`
- `theme_mode`
- `theme_variant`
- `max_concurrent_jobs`
- `updated_at`

不回传 `openai_api_key` / `masked_openai_api_key`。

### `PUT /api/settings`

当前白名单 patch 支持：

- `openai_base_url`
- `openai_model`
- `default_export_format`
- `theme_mode`
- `theme_variant`
- `max_concurrent_jobs`

### `PUT /api/settings/openai-key`

单独更新 key。空字符串会被拒绝。

### `DELETE /api/settings/openai-key`

清空 key。

## 7. 当前前端行为要求

- 顶栏右上角放明暗快切 + 设置齿轮
- variant 切换集中在 SettingsPage 内完成
- SettingsPage 保存改动后通过 `NotificationCenter` 弹通知
- `ThemeBridge` 在 App 启动时拉 `/api/settings` 并把 `theme_mode / theme_variant` 同步到 Zustand store 与 localStorage
- 首帧通过 `index.html` 的 inline 脚本从 localStorage 预设 `data-theme`，避免闪白

## 8. 当前后端与官方 OpenAI 调用

`services/jobs.py::JobRunner._load_openai_runtime` 当前会合并官方 OpenAI 所需的运行时参数：

| 字段 | 第 1 层 | 第 2 层（兼容） | 都空 |
|---|---|---|---|
| `openai_api_key` | `AppSettings.openai_api_key` | `LESSON_IMAGE_STUDIO_OPENAI_API_KEY` | 任务 failed + `error_code="missing_api_key"` |
| `openai_base_url` | `AppSettings.openai_base_url` | `LESSON_IMAGE_STUDIO_OPENAI_BASE_URL` | 走 OpenAI 官方 endpoint |
| `openai_model` | `AppSettings.openai_model` | `LESSON_IMAGE_STUDIO_OPENAI_MODEL` | `ValueError` |

`max_concurrent_jobs` 在 `create_edit_job / create_generate_job` 的入口用 `_ensure_global_concurrency` 校验。

### 默认导出格式落地

`POST /api/versions/{id}/export` 会读取 `AppSettings.default_export_format`，由 `StorageService.export_copy` 用 Pillow 转码到对应格式：

- PNG 走字节直拷
- JPEG 先 `convert("RGB")` 展平透明度
- WEBP 直接编码

## 9. 下一阶段建议的 provider 化演进

### 9.1 推荐的方向

下一阶段不要继续把更多产品设置塞回 `openai_*` 字段，而是应该把 Settings 体系扩成“全局默认 provider + provider 配置中心”。

推荐新增的产品级概念：

- `default_provider`
  - 推荐值：
    - `openai_official`
    - `tal_gpt_image_2`
    - `tal_gemini_flash_image`
- `tal_service_base_url`
  - 公司内部模型共享
- `tal_service_api_key`
  - 直接保存最终 header 值，格式就是 `appId:apiKey`

### 9.2 推荐的设置页呈现方式

下一阶段 SettingsPage 可以演进成下面几组，而不新增页面：

1. 默认 provider
2. 官方 OpenAI 配置
3. 公司 AI 服务配置
4. 外观
5. 导出与运行时偏好

### 9.3 已确认的团队规则

- TAL `gpt-image-2` 和 TAL `gemini-3.1-flash-image` 共享一套公司 AI 服务配置
- 不要把公司模型拆成两份 `base_url` / `key`
- model 名由内部 adapter 决定或切换，不要求老师分别维护两套服务地址
- TAL 多图输入当前不做前端入口

## 10. 提供给下一位 AI 的 TAL 接口提醒

这些属于未来接入目标，不是当前代码已经实现的功能。真正开始接入时，用户还会再提供一次请求体；本文件只做第一轮落点说明。

### TAL `gpt-image-2`

- 文生图：`POST {tal_service_base_url}/openai-compatible/v1/images/generations`
- 图生图：`POST {tal_service_base_url}/openai-compatible/v1/images/edits`
- 认证 header：`api-key: appId:apiKey`
- 模型名：`gpt-image-2`

### TAL `gemini-3.1-flash-image`

- 文生图 / 图生图：`POST {tal_service_base_url}/openai-compatible/v1/chat/completions`
- 认证 header：同上
- 模型名：`gemini-3.1-flash-image`
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
- 默认 `quality / size`
