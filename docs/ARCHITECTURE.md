# Architecture

## 1. 文档边界

这份文档只描述当前已经存在的真实实现。

它不会把下一阶段计划中的 `SettingsPage`、主题系统或新的设置接口写成“已完成”。  
未来规划请看：

- `docs/NEXT_PHASE_PLAN.md`
- `docs/SETTINGS_SPEC.md`
- `docs/DECISIONS.md`

## 2. 当前真实结构

`lesson-image-studio` 当前是一个本地浏览器工作台，采用前后端分离：

- `frontend/`
  - `React + Vite + TypeScript`
  - `react-query` 管业务数据
  - `zustand` 管全局 UI 状态：通知、当前 `Owner`、utility drawer、任务作用域
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
  - `origin_type` 目前包括 `imported / generated / edited / duplicated`
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
- AI 生图/改图
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

## 6. 当前前端页面结构

当前只有 3 个正式页面：

- `OwnerEntryPage`
  - 左侧入口说明
  - 右侧进入工作台表单
  - 下方最近打开列表
- `OwnerOverviewPage`
  - 左侧应用栏
  - 顶部轻量工具栏
  - 中间为摘要条 + 紧凑图片项矩阵
  - 左栏底部打开 utility drawer
- `ImageEditorPage`
  - 左侧版本轨
  - 中间主画布
  - 右侧固定检视器
  - 模板区默认折叠

次级面板：

- `UtilityDrawer`
  - 统一承载任务、事件、回收站
  - 默认从左栏底部入口打开

## 7. 当前配置与运行

- `LESSON_IMAGE_STUDIO_RECENT_OWNER_LIMIT`
  - 默认 `5`
  - 来自 `create_app(settings)` 当前实例，不再读全局缓存
- `LESSON_IMAGE_STUDIO_OPENAI_API_KEY`
  - 有值时走真实 `gpt-image-2`
  - 无值时任务失败但链路可观测

## 8. 当前已知非阻塞项

- 前端生产构建仍有大 chunk 警告，当前不是功能阻塞
- 移动端只保证基本可访问，不追求完整工作台体验
