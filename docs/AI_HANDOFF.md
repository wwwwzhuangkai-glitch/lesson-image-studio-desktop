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
- 前端总览页：
  - `frontend/src/components/OwnerOverviewPage.tsx`
- 前端编辑页：
  - `frontend/src/components/ImageEditorPage.tsx`
- 统一工具抽屉：
  - `frontend/src/components/UtilityDrawer.tsx`

## 4. 容易踩坑的点

- `Settings` 有实例态和全局缓存态两套入口，接口里优先用 `request.app.state.settings`
- 不要把 `VersionTree` 误改成跨图片项树
- `duplicate-to-image-item` 不是“建立跨树父子关系”，而是“复制出新的根版本”
- `OPENAI_API_KEY` 缺失时不要生成假图
- 前端错误提示要直接显示后端 `detail`

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

- 正式新增 `SettingsPage`
- 主题系统：`light / dark`
- 总览页与编辑页的现代化 UI 重构
- 路由级代码拆分，减小前端 chunk
- 更完整的前端测试覆盖

## 7. 当前 vs 未来

如果文档里出现冲突，优先级按这个顺序理解：

1. `DECISIONS.md`
2. `ARCHITECTURE.md` 描述当前真实实现
3. `NEXT_PHASE_PLAN.md` 和 `SETTINGS_SPEC.md` 描述未来计划
