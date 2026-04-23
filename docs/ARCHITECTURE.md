# Architecture

## 1. 文档边界

这份文档只描述当前已经存在的真实实现。

下一阶段的额外规划与未来 provider 接入方向请看：

- `docs/NEXT_PHASE_PLAN.md`
- `docs/SETTINGS_SPEC.md`
- `docs/AI_HANDOFF.md`
- `docs/DECISIONS.md`

## 2. 当前真实结构

`lesson-image-studio` 当前是一个本地浏览器工作台，采用前后端分离：

- `frontend/`
  - `React + Vite + TypeScript`
  - `react-query` 管业务数据
  - `zustand` 管全局 UI 状态：通知、当前 `Owner`、当前 `ImageItem`、utility drawer、任务作用域、编辑页 prompt
- `backend/`
  - `FastAPI + SQLAlchemy + Alembic`
  - `uv init --package --python 3.13`
  - SQLite 落库，本地文件系统存图
- `data/`
  - `app.db`
  - `files/imported`
  - `files/generated`
  - `files/exports`
  - `files/masks`

## 3. 当前领域模型

核心链路固定为 `Owner -> ImageItem -> ImageVersion`。

- `Owner`
  - 对应 `question / asset / other`
  - `question/asset` 使用业务 ID
  - `other` 自动生成本地 `owner_id`
  - 最近打开列表按 `last_opened_at` 倒序
- `ImageItem`
  - 一个 `Owner` 下的一张独立图片
  - 支持空图片项
  - `current_final_version_id` 表示当前定稿
- `ImageVersion`
  - 一张图的一个版本
  - `parent_version_id` 只在同一 `ImageItem` 内形成树
  - `origin_type` 当前包括 `imported / generated / edited / duplicated`
- `EditJob`
  - `generate` 或 `edit`
  - 同一 `ImageItem` 同时最多一个 `queued/running`
- `ImageMask`
  - 当前只支持矩形框选
- `EventLog`
  - 用于任务、导入、定稿、恢复、复制起点等留痕
- `PublishRecord`
  - 只做发布占位，不外发
- `PromptPreset`
  - 系统模板 + 个人模板
- `AppSettings`
  - 单例行（`id = 'singleton'`）
  - 由 `alembic upgrade` 时的 `op.bulk_insert` 写入默认值
  - 当前承载官方 OpenAI 相关设置、默认导出格式、主题 mode/variant、并发上限

## 4. 当前硬约束

这些约束是当前实现最重要的“别破坏”规则：

- 一个版本只能属于一张 `ImageItem`
- `/api/masks` 只能基于当前 `ImageItem` 自己的 `base_version`
- `/api/edits` 只能基于当前 `ImageItem` 自己的 `base_version`
- `mask_id` 若参与改图，也必须属于当前 `ImageItem`
- 若老师想复用别的图，必须走 `POST /api/versions/{versionId}/duplicate-to-image-item`
- 复制起点会创建新的 `ImageItem` 和新的根版本，`parent_version_id = null`
- 当前定稿版本不能直接删除
- 只有叶子草稿版本允许软删除
- 图片项在存在当前定稿时不能删除
- 无 `OPENAI_API_KEY` 时允许建任务，但任务必须失败且不生成假图
- `AppSettings` 表永远只有一行；`CheckConstraint("id = 'singleton'")` 是兜底
- `/api/settings` 系列接口不回传 `openai_api_key` 的任何字符
- 跨图片项的 AI 任务并发上限由 `AppSettings.max_concurrent_jobs` 控制（默认 2）

更高层的不可动摇规则请看 `docs/DECISIONS.md`。

## 5. 当前 API 主链路

- 打开 Owner
  - `POST /api/owners/open`
  - `GET /api/owners/recent`
- 管理图片项
  - `POST /api/owners/{ownerId}/image-items`
  - `PATCH /api/owners/{ownerId}/image-items/reorder`
  - `DELETE /api/image-items/{imageItemId}`
  - `POST /api/image-items/{imageItemId}/restore`
- 版本与导入
  - `POST /api/image-items/{imageItemId}/import`
  - `GET /api/image-items/{imageItemId}`
  - `GET /api/image-items/{imageItemId}/versions/tree`
  - `DELETE /api/versions/{versionId}`
  - `POST /api/versions/{versionId}/restore`
  - `POST /api/versions/{versionId}/duplicate-to-image-item`
- AI 生图 / 改图
  - `POST /api/image-items/{imageItemId}/generate`
  - `POST /api/masks`
  - `POST /api/edits`
  - `GET /api/jobs`
  - `GET /api/jobs/{jobId}`
- 定稿 / 导出 / 发布
  - `POST /api/image-items/{imageItemId}/finalize`
  - `POST /api/image-items/{imageItemId}/unfinalize`
  - `POST /api/versions/{versionId}/export`
  - `POST /api/publish`
- 观察与模板
  - `GET /api/events`
  - `GET /api/owners/{ownerId}/recycle-bin`
  - `GET /api/prompt-presets`
  - `POST /api/prompt-presets`
  - `PATCH /api/prompt-presets/{presetId}`
  - `DELETE /api/prompt-presets/{presetId}`
- 本地设置
  - `GET /api/settings`
  - `PUT /api/settings`
  - `PUT /api/settings/openai-key`
  - `DELETE /api/settings/openai-key`

## 6. 当前前端页面结构

当前有 4 个正式页面：

- `OwnerEntryPage`
  - 左侧入口说明
  - 右侧打开 `Owner` 的表单
  - 下方最近打开列表
- `OwnerOverviewPage`
  - 左侧应用栏
  - 顶部工具栏
  - 中间为摘要条 + 紧凑图片项矩阵
  - 左栏底部打开 `UtilityDrawer`
- `ImageEditorPage`
  - 左侧版本轨
  - 中间主画布
  - 右侧固定检视器
  - 模板不再嵌在检视器里，而是通过按钮打开 `UtilityDrawer`
- `SettingsPage`
  - 当前的本地设置中心
  - 顶栏包含全局 `AppTopbar`
  - 主区是单列卡片堆

次级面板与对话：

- `UtilityDrawer`
  - 当前承载任务、事件、回收站、模板四个 tab
  - 默认从左栏底部入口打开
  - 模板 tab 的“载入”会把选中 preset 的 `prompt_text` 写入 `uiStore.editorPromptText`
- `InputDialog` / `PresetFormDialog`
  - 由 `AppShell` 单次挂载，替换了之前所有的 `window.prompt`
  - 支持 Enter 确认、Esc / 背景点击取消

## 7. 当前主题和导出实现

- `frontend/src/styles/theme.css` 定义 4 套主题：
  - `graphite-light`
  - `graphite-dark`
  - `glass-light`
  - `glass-dark`
- `index.css` 已完成 token 化
- `index.html` 头部 inline script 在 React 挂载前从 localStorage 写入 `data-theme`，避免首帧闪白
- `ThemeBridge` 启动时拉 `GET /api/settings`，把后端 `theme_mode / theme_variant` 同步到 Zustand 与 localStorage
- `POST /api/versions/{id}/export` 读取 `AppSettings.default_export_format`
  - PNG 走字节直拷
  - JPEG 用 Pillow 转码并展平 alpha
  - WEBP 用 Pillow 转码

## 8. 当前设置与运行方式

### 8.1 当前真实实现

当前代码里的 AI 运行时仍然围绕官方 OpenAI 兼容调用组织：

- `services/jobs.py::JobRunner` 统一处理生图 / 改图
- 当前真正接入的 provider 只有“官方 OpenAI 兼容路径”
- `AppSettings` 当前保存的是这一路径所需的设置项：
  - `openai_api_key`
  - `openai_base_url`
  - `openai_model`
  - `default_export_format`
  - `theme_mode`
  - `theme_variant`
  - `max_concurrent_jobs`

### 8.2 团队当前的使用约定

虽然当前代码里还保留了一部分环境变量兼容入口，但团队日常使用约定已经明确为：

- `SettingsPage` 是每个成员自己机器上的本地设置中心
- 日常使用时，以 `SettingsPage -> AppSettings` 为主
- 环境变量只应被视为工程兼容入口，而不是产品主入口

这点对后续 provider 接入非常重要：下一阶段应该在 `SettingsPage` 和 `AppSettings` 上扩展 provider 能力，而不是继续把更多产品语义塞回 `.env`。

### 8.3 当前代码里的兼容层

当前实现里，`config.py::Settings` 仍然提供这些工程级配置：

- `LESSON_IMAGE_STUDIO_RECENT_OWNER_LIMIT`
- `LESSON_IMAGE_STUDIO_OPENAI_API_KEY`
- `LESSON_IMAGE_STUDIO_OPENAI_BASE_URL`
- `LESSON_IMAGE_STUDIO_OPENAI_MODEL`
- `LESSON_IMAGE_STUDIO_DATABASE_URL`
- `LESSON_IMAGE_STUDIO_DATA_DIR`

`services/jobs.py::JobRunner._load_openai_runtime` 会从 `AppSettings` 和 `Settings` 合并出当前运行所需的 `(api_key, base_url, model)`。

这里需要特别注意：

- 这是当前代码层面的兼容实现
- 不是后续 provider 架构的最终设计目标
- 未来如果把 `base_url / model` 收口为纯 `SettingsPage -> AppSettings`，应该优先更新 `SETTINGS_SPEC.md` 和 `AI_HANDOFF.md`

## 9. 面向下一阶段的扩展缝

下一阶段最重要的结构性扩展不是改主模型，而是把“单一官方 OpenAI 路径”演进成“多 provider / 多 adapter 架构”。

这层扩展必须遵守：

- 不删当前官方 OpenAI 路径
- 不改 `Owner -> ImageItem -> ImageVersion`
- 不改 Job 主链路
- 把 provider 差异收敛到 adapter 层，而不是扩散进页面和数据库主模型

从产品决策看，后续至少要支持：

1. 官方 OpenAI
2. TAL `gpt-image-2`
3. TAL `gemini-3.1-flash-image`

其中 TAL 两种模型共享同一套公司 AI 服务配置，而不是各配一套 `base_url` / `key`。

## 10. 当前已知非阻塞项

- 前端生产构建仍有大 chunk 警告，当前不是功能阻塞
- 移动端只保证基本可访问，不追求完整工作台体验
