# AI Handoff

## 1. 先读什么

后续无论是 AI 还是工程师接力，建议先读：

1. `README.md`
2. `docs/DECISIONS.md`
3. `docs/ARCHITECTURE.md`
4. `docs/UI_WORKBENCH.md`
5. `docs/NEXT_PHASE_PLAN.md`
6. 当前要改的页面或 service 文件

## 2. 最重要的不变量

接力开发时，优先保护这些规则：

- 主模型不能从 `Owner -> ImageItem -> ImageVersion` 漂移掉
- 不允许跨 `ImageItem` 串 `ImageVersion`
- 不允许跨 `ImageItem` 串 `ImageMask`
- 复制复用只能走 `duplicate-to-image-item`
- 复制出来的新版本必须是新图片项的根版本
- 工作台不能退化成长网页
- UtilityDrawer 是统一次级信息入口，不要再把任务/事件/回收站拆回多个浮层
- 模板库默认折叠，不要重新做成弹窗主流程
- 检视器保持“提示词、参数、定稿、导出、发布”这 5 类核心职责

## 3. 常见改动入口

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
- 模板卡片组件（UtilityDrawer 模板 tab 与未来入口复用）：
  - `frontend/src/components/PresetCard.tsx`
- 主题 Token 底座：
  - `frontend/src/styles/theme.css`
  - `frontend/src/hooks/useTheme.ts`
  - `frontend/index.html`（inline 防闪白脚本）

## 4. 容易踩坑的点

- `Settings` 有实例态和全局缓存态两套入口，接口里优先用 `request.app.state.settings`
- **两个 Settings 不要混淆**：
  - `config.py::Settings` 是环境变量级（ENV / `.env`）
  - `models.py::AppSettings` 是产品级（SQLite 单例行，SettingsPage 修改）
  - `JobRunner._load_openai_runtime` 做二者的合并：AppSettings 优先，ENV 回落
- 不要把 `VersionTree` 误改成跨图片项树
- `duplicate-to-image-item` 不是“建立跨树父子关系”，而是“复制出新的根版本”
- `OPENAI_API_KEY` 缺失时不要生成假图
- 前端错误提示要直接显示后端 `detail`
- `AppSettings` 接口**绝不**回传 `openai_api_key` / `masked_openai_api_key` 任何字符
- 前端主题切换必须三件套同步：Zustand store + localStorage + `PUT /api/settings`；少一件都会在重载后露馅
- `CanvasWorkbench` 用 `getComputedStyle(document.documentElement).getPropertyValue('--accent')` 读 token；React 组件 `useMemo` 依赖 `themeMode / themeVariant` 触发重算
- **模板搬家后**：编辑页的 prompt textarea state 从 `useState` 迁到 `uiStore.editorPromptText`；`currentImageItemId` 也在 uiStore 由 ImageEditorPage 的 effect 维护。UtilityDrawer 的模板 tab 会读这两个 state 决定"载入"按钮的启用与行为
- OpenAI 配置三字段（key / base_url / model）**各自独立**走 AppSettings → ENV 回落。model 双层都空会 `ValueError`，不再有硬编码 `gpt-image-2` 的 fallback
- `has_openai_api_key` 返回值综合考虑 AppSettings 和 ENV 两层；想知道 key 到底从哪里来，读 `openai_api_key_source` 字段（`app_settings` / `env` / `none`）

## 5. 推荐接力方式

如果下一轮是 AI 接着做，建议按这个顺序：

1. 先读 `git status` 和最近 commit，确认变更边界
2. 先跑：
   - `cd backend && uv run pytest`
   - `cd frontend && npm run test`
   - `cd frontend && npm run build`
3. 然后确认当前任务属于哪一类：
   - 当前实现维护
   - 下一阶段文档推进
   - 下一阶段 Settings / 主题 / UI 开发

## 6. 适合下一轮继续做的主题

- 路由级代码拆分，减小前端 chunk
- 更完整的前端测试覆盖（useTheme / Dialog / SettingsPage 交互 / 并发上限前端分支）
- OwnerOverviewPage 与 ImageEditorPage 在新 token 下进一步打磨视觉层级
- 代码债：`CanvasWorkbench.tsx` 的 2 处 `any`、`uiStore.ts` 的 ID 生成、轮询频率
- 图片项排序升级为拖拽（见 TODO.md P3）
- 如果 OpenAI 真实生成超时频发，再增加 `openai_request_timeout_ms` 字段

## 7. 当前 vs 未来

如果文档里出现冲突，优先级按这个顺序理解：

1. `DECISIONS.md`
2. `ARCHITECTURE.md` 描述当前真实实现
3. `NEXT_PHASE_PLAN.md` 和 `SETTINGS_SPEC.md` 描述未来计划
