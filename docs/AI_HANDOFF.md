# AI Handoff

## 1. 先读什么

后续无论是 AI 还是工程师接力，建议先读：

1. `README.md`
2. `docs/DECISIONS.md`
3. `docs/ARCHITECTURE.md`
4. `docs/UI_WORKBENCH.md`
5. `docs/NEXT_PHASE_PLAN.md`
6. `docs/SETTINGS_SPEC.md`
7. `docs/PROVIDER_ADAPTER_SPEC.md`
8. `docs/PROVIDER_VALIDATION_NOTES.md`
9. 当前要改的页面或 service 文件

## 2. 最重要的不变量

接力开发时，优先保护这些规则：

- 主模型不能从 `Owner -> ImageItem -> ImageVersion` 漂移掉
- 不允许跨 `ImageItem` 串 `ImageVersion`
- 不允许跨 `ImageItem` 串 `ImageMask`
- 复制复用只能走 `duplicate-to-image-item`
- 复制出来的新版本必须是新图片项的根版本
- 工作台不能退化成长网页
- UtilityDrawer 是统一次级信息入口，不要再把任务/事件/回收站拆回多个浮层
- 模板当前在 UtilityDrawer 的 `templates` tab，不要随手做回嵌入式长面板
- 检视器保持“提示词、参数、定稿、导出、发布”这 5 类核心职责

## 3. 当前实现和下一阶段方向不要混淆

当前真实实现：

- 已有 4 页工作台
- 已有 `AppSettings`
- 当前真正接入的 AI 调用仍以官方 OpenAI 兼容路径为主
- 模板当前在 `UtilityDrawer` 的 `templates` tab

下一阶段方向：

- 不删当前官方 OpenAI 路径
- 新增 provider / adapter 架构
- `SettingsPage` 演进成默认 provider + 本地服务配置中心
- 公司模型共享一套公司 AI 服务配置
- 当前已拿到 TAL `gpt-image-2`、`gemini-3.1-flash-image`、`gemini-3-pro-image` 的真实成功样本

## 4. 常见改动入口

如果要继续改功能，优先看这些地方：

- 后端 API 聚合入口：
  - `backend/src/lesson_image_studio_backend/api.py`
- 图片项与版本规则：
  - `backend/src/lesson_image_studio_backend/services/image_items.py`
- 任务与 AI 调用：
  - `backend/src/lesson_image_studio_backend/services/jobs.py`
- 本地设置 service：
  - `backend/src/lesson_image_studio_backend/services/app_settings.py`
- 前端总览页：
  - `frontend/src/components/OwnerOverviewPage.tsx`
- 前端编辑页：
  - `frontend/src/components/ImageEditorPage.tsx`
- 前端设置页：
  - `frontend/src/components/SettingsPage.tsx`
- 全局顶栏：
  - `frontend/src/components/AppTopbar.tsx`
- 统一工具抽屉：
  - `frontend/src/components/UtilityDrawer.tsx`
- 输入 / 表单对话：
  - `frontend/src/components/InputDialog.tsx`
  - `frontend/src/components/PresetFormDialog.tsx`
- 模板卡片组件：
  - `frontend/src/components/PresetCard.tsx`
- 主题 Token 底座：
  - `frontend/src/styles/theme.css`
  - `frontend/src/hooks/useTheme.ts`
  - `frontend/index.html`

## 5. 容易踩坑的点

- `config.py::Settings` 和 `models.py::AppSettings` 不要混淆
- 当前 `JobRunner._load_openai_runtime` 仍有官方 OpenAI 的兼容合并逻辑
- Gemini 家族当前已验证过 `flash-image` 和 `pro-image` 两个模型名，但 `stream=true` 还没有真实样本
- 不要把 `VersionTree` 误改成跨图片项树
- `duplicate-to-image-item` 不是“建立跨树父子关系”，而是“复制出新的根版本”
- `OPENAI_API_KEY` 缺失时不要生成假图
- 前端错误提示要直接显示后端 `detail`
- `AppSettings` 接口绝不回传 `openai_api_key` / `masked_openai_api_key` 任何字符
- 前端主题切换必须三件套同步：Zustand + localStorage + `PUT /api/settings`
- `CanvasWorkbench` 用 `getComputedStyle(document.documentElement).getPropertyValue('--accent')` 读 token
- 编辑页的 prompt textarea state 已经迁到 `uiStore.editorPromptText`
- `uiStore.currentImageItemId` 由 `ImageEditorPage` 的 effect 维护，UtilityDrawer 据此决定模板“载入”是否可用

## 6. 下一阶段 provider 接入建议

后续接 TAL `gpt-image-2`、`gemini-3.1-flash-image` 和 `gemini-3-pro-image` 时，推荐不要继续往 `jobs.py` 里硬塞 `if provider == ...` 分支，而是明确做 adapter 层。

推荐的后端形态：

- `backend/src/lesson_image_studio_backend/services/providers/base.py`
  - 定义统一 adapter 接口
- `.../providers/openai_official.py`
- `.../providers/tal_gpt_image_2.py`
- `.../providers/tal_gemini_flash_image.py`
- `.../providers/tal_gemini_pro_image.py`
- `.../providers/registry.py`
  - 负责根据 `default_provider` 找 adapter

推荐的统一职责边界：

- 页面和 API 不关心 provider 的请求体差异
- `EditJob` 仍然是统一队列实体
- adapter 负责把各家 provider 的调用差异归一化成：
  - 输出图片字节
  - 文件名 / mime type
  - 可选元数据
- 最终仍然回到同一条：
  - `EditJob -> StorageService -> ImageVersion -> EventLog`

### TAL 公司的接入规则

- 公司模型不是两套服务配置，而是一套共享配置
- 不要把 TAL `gpt-image-2` 和 TAL `gemini` 各自做一套 `base_url` / `key`
- 当前前端不做多图输入入口；即使 TAL `gpt-image-2` adapter 先支持多图，UI 也不要提前暴露

### 已知的 TAL 请求形态

这些是接力开发时必须知道的方向，但用户在真正开发那一步还会再提供一次：

- TAL `gpt-image-2`
  - 文生图：`/openai-compatible/v1/images/generations`
  - 图生图：`/openai-compatible/v1/images/edits`
  - header：`api-key: appId:apiKey`
- TAL `gemini-3.1-flash-image`
  - 走 `/openai-compatible/v1/chat/completions`
  - `modalities` 要包含 `"text"` 和 `"image"`
  - 图生图通过 `messages[].content[].image_url`
  - 可以带 `extra_body.generationConfig.imageConfig`
- TAL `gemini-3-pro-image`
  - 目前真实样本显示它和 `flash-image` 同族，返回结构可复用大部分 Gemini 解析逻辑

真实样本路径和字段差异请先看：

- `docs/PROVIDER_ADAPTER_SPEC.md`
- `docs/PROVIDER_VALIDATION_NOTES.md`

## 7. 推荐接力方式

如果下一轮是 AI 接着做，建议按这个顺序：

1. 先读 `git status` 和最近 commit，确认变更边界
2. 先跑：
   - `cd backend && uv run pytest`
   - `cd frontend && npm run test`
   - `cd frontend && npm run build`
3. 然后确认当前任务属于哪一类：
   - 当前实现维护
   - 下一阶段文档推进
   - 下一阶段 provider / Settings / UI 开发

## 8. 适合下一轮继续做的主题

- provider 抽象层
- SettingsPage 的默认 provider 与公司 AI 服务配置
- TAL `gpt-image-2` adapter
- TAL `gemini-3.1-flash-image` adapter
- TAL `gemini-3-pro-image` adapter
- 文档与真实实现继续对齐
- 路由级代码拆分，减小前端 chunk
- 更完整的前端测试覆盖
- OwnerOverviewPage 与 ImageEditorPage 继续打磨视觉层级
- 代码债：`CanvasWorkbench.tsx` 的 `any`、`uiStore.ts` 的 ID 生成、轮询频率

## 9. 当前 vs 未来

如果文档里出现冲突，优先级按这个顺序理解：

1. `DECISIONS.md`
2. `ARCHITECTURE.md` 描述当前真实实现
3. `NEXT_PHASE_PLAN.md` 和 `SETTINGS_SPEC.md` 描述未来计划
