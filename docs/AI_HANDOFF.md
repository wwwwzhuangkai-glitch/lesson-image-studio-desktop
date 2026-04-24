# AI Handoff

## 0. 下一轮短版

下一位 AI 的主任务是 **UI 视觉重构**，不是继续重写 provider。

当前状态：

- Provider MVP 已接入官方 OpenAI 和 TAL `gpt-image-2`
- SettingsPage 已按 provider 分组：OpenAI 配置只在选中 OpenAI 时展示；TAL 只配置公司认证值；导出格式和并发上限是通用默认参数
- 编辑页已经形成“左版本轨 + 基准图/结果图双图对照 + 底部控制台”的工作台骨架

下一轮目标：

- 可以大胆重做视觉、密度、层级、控件样式和页面质感
- 重点让 `OwnerOverviewPage`、`ImageEditorPage`、`SettingsPage` 更像专业内部教研工具
- 不要求保留当前视觉细节，当前样式只是功能骨架

必须保护：

- 不改 `Owner -> ImageItem -> ImageVersion` 主模型
- 不重写 `JobRunner`、provider registry、TAL adapter
- 不删除官方 OpenAI 路径
- 不把 TAL 配置拆成多套地址 / key
- 不把 provider 配置塞进编辑页主流程

UI 改完至少跑：

- `cd frontend && npm run lint`
- `cd frontend && npm run test`
- `cd frontend && npm run build`
- `cd backend && uv run pytest`（如果碰到任务、settings、provider、version、mask 相关代码）

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
- 编辑页保持“左版本轨 + 双图对照 + 底部控制台”，不要随手做回长表单或旧检视器结构
- 左版本轨只做导航与上下文，不承载 prompt、参数、导出、发布

## 3. 当前实现和下一阶段方向不要混淆

当前真实实现：

- 已有 4 页工作台
- 已有 `AppSettings`
- 当前 AI 调用已通过 provider adapter 进入官方 OpenAI 或 TAL `gpt-image-2`
- 模板当前在 `UtilityDrawer` 的 `templates` tab

下一阶段方向：

- 不删当前官方 OpenAI 路径
- UI 视觉重构优先，Provider / TAL 数据流作为验收护栏
- `SettingsPage` 已有默认 provider + 本地服务配置中心
- 公司模型共享一套公司 AI 服务配置
- Gemini provider 暂放后续，不作为下一轮第一目标

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
- `JobRunner` 不直接放 provider HTTP/SDK 细节，provider 差异收在 `services/providers/*`
- 尺寸策略在 `services/image_sizes.py`，不要把归一化规则散落到 adapter 或页面里
- 官方 OpenAI 的模型名在任务创建时快照到 `EditJob.model`；key/base URL 不快照
- Gemini 家族当前已验证过 `flash-image` 和 `pro-image` 两个模型名，但 `stream=true` 还没有真实样本
- 不要把 `VersionTree` 误改成跨图片项树
- `duplicate-to-image-item` 不是“建立跨树父子关系”，而是“复制出新的根版本”
- `OPENAI_API_KEY` 缺失时不要生成假图
- 前端错误提示要直接显示后端 `detail`
- `AppSettings` 接口绝不回传 `openai_api_key` / `tal_service_api_key` / masked key 任何字符
- 前端主题切换必须三件套同步：Zustand + localStorage + `PUT /api/settings`
- `CanvasWorkbench` 用 `getComputedStyle(document.documentElement).getPropertyValue('--accent')` 读 token
- 编辑页的 prompt textarea state 已经迁到 `uiStore.editorPromptText`
- `uiStore.currentImageItemId` 由 `ImageEditorPage` 的 effect 维护，UtilityDrawer 据此决定模板“载入”是否可用

### 编辑页双图数据关系

当前 `ImageEditorPage` 已重构为：

- 左栏：版本轨、当前选中版本信息、定稿状态、任务 / 事件 / 回收站 / 模板入口
- 右上：基准图 / 结果图双图对照
- 右下：提示词、生成参数、动作按钮组成的紧凑控制台

交互规则必须保持：

- 左栏选中哪个版本，基准图就显示哪个版本
- 图改图提交对象永远是左栏当前选中版本，也就是请求里的 `base_version_id`
- 结果图显示当前选中版本的最新直接子版本，优先显示基于它的最近任务产物
- 没有直接结果时，结果图必须展示明确空态
- mask 只在基准图面板工具条里编辑；当前只支持矩形框选、清除、显示 / 隐藏选区
- 结果图面板只负责查看输出，不要把 mask、prompt 或参数入口放进去
- 底部控制台不要做成长表单，保持提示词 / 参数 / 动作三组紧凑布局

## 6. Provider 接入建议

Provider MVP 已接 TAL `gpt-image-2`。后续接 `gemini-3.1-flash-image` 和 `gemini-3-pro-image` 时，继续沿用 adapter 层，不要往 `jobs.py` 里硬塞 provider 分支。

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
- `EditJob.provider / EditJob.model` 是任务级快照；`request_params` 记录尺寸决策元数据
- adapter 负责把各家 provider 的调用差异归一化成：
  - 输出图片字节
  - 文件名 / mime type
  - 可选元数据
- 最终仍然回到同一条：
  - `EditJob -> StorageService -> ImageVersion -> EventLog`

### TAL 公司的接入规则

- 公司模型不是两套服务配置，而是一套共享配置
- TAL 兼容层地址固定为 `http://ai-service.tal.com/openai-compatible/v1`
- SettingsPage 只配置 TAL key，不配置 TAL base URL
- 不要把 TAL `gpt-image-2` 和 TAL `gemini` 各自做一套地址 / key
- 当前前端不做多图输入入口；即使 TAL `gpt-image-2` adapter 先支持多图，UI 也不要提前暴露
- 当前编辑页不开放图改图尺寸下拉；图改图主流程提交 `size_mode=auto`
- TAL 图改图前端展示输入图原始规格，后端复算结果才是最终落库值

### 已知的 TAL 请求形态

这些是接力开发时必须知道的方向。TAL `gpt-image-2` 已按固定兼容层地址 + adapter 拼 operation path 的口径接入；Gemini 真正开发时用户还会再提供一次细节：

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
2. 先看 `docs/UI_WORKBENCH.md`，确认这次是视觉重构，不是 provider 重构
3. UI 修改优先从 `OwnerOverviewPage`、`ImageEditorPage`、`SettingsPage` 入手
4. 修改时把 TAL 当作已有数据流保护：
   - Settings 只配置 TAL key
   - adapter 固定 TAL base URL
   - 新任务入队快照 provider
   - 图改图尺寸由后端复算并落库
5. 收尾跑前端质量门；如果碰到后端数据流，再跑后端 pytest

## 8. 适合下一轮继续做的主题

- UI 视觉重构：页面质感、控件层级、双图工作台、Settings 信息架构
- TAL 全链路回归：settings -> job -> adapter -> storage -> version -> event
- 路由级代码拆分，减小前端 chunk
- 更完整的前端测试覆盖
- Gemini provider 接入放到 UI 主线之后
- 代码债：`uiStore.ts` 的 ID 生成、轮询频率

## 9. 当前 vs 未来

如果文档里出现冲突，优先级按这个顺序理解：

1. `DECISIONS.md`
2. `ARCHITECTURE.md` 描述当前真实实现
3. `NEXT_PHASE_PLAN.md` 和 `SETTINGS_SPEC.md` 描述未来计划
