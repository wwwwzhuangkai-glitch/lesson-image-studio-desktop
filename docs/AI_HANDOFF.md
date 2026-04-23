# AI Handoff

## 1. 先读什么

后续无论是 AI 还是工程师接力，建议先读：

1. `README.md`
2. `docs/ARCHITECTURE.md`
3. `docs/UI_WORKBENCH.md`
4. 当前要改的页面或 service 文件

## 2. 最重要的不变量

接力开发时，优先保护这些规则：

- 不允许跨 `ImageItem` 串 `ImageVersion`
- 不允许跨 `ImageItem` 串 `ImageMask`
- 复制复用只能走 `duplicate-to-image-item`
- 复制出来的新版本必须是新图片项的根版本
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
3. 再决定是改后端规则、改 UI，还是只补文档

## 6. 适合下一轮继续做的主题

- 路由级代码拆分，减小前端 chunk
- 总览页更细的卡片交互与拖拽排序
- 编辑页更强的版本对比模式
- 真实发布适配层
- 更完整的前端测试覆盖
