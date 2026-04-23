# TODO / Backlog

## ✅ 已完成（本轮）

- 新增正式 `SettingsPage`
- 建立后端本地设置持久化（`AppSettings` 单例 + alembic 默认行）
- 提供设置接口（全部上线）：
  - `GET /api/settings`
  - `PUT /api/settings`
  - `PUT /api/settings/openai-key`
  - `DELETE /api/settings/openai-key`
- 主题系统：`graphite / glass` 两套 variant × `light / dark` 两套 mode = 4 套完整 token
- `default_export_format` 从 AppSettings 读取（回填 SettingsPage）
- `openai_base_url` / `openai_model` 从 AppSettings 驱动 `JobRunner`（设置即生效）
- 跨图片项全局并发上限 `max_concurrent_jobs`
- 7 处 `window.prompt` → `InputDialog` / `PresetFormDialog`

## P2（下一轮候选）

- 路由级代码拆分，解决 `build` 的大 chunk 警告
- 补前端测试覆盖（useTheme / Dialog / SettingsPage / 并发上限前端分支）
- OwnerOverviewPage 在新 token 下进一步打磨卡片视觉 / 缩略图处理
- ImageEditorPage 在新 token 下深化版本轨的来源徽标 / 定稿提示层级
- 代码债：`CanvasWorkbench.tsx:65,79` 2 处 `any`、`uiStore.ts:43` `Date.now()+Math.random()` ID、`refetchInterval` 的 3 处 3000ms + 1 处 5000ms

## P3

- 图片项排序升级为拖拽排序
- 版本轨来源类型徽标 / 当前定稿更醒目
- utility drawer 键盘可达性与焦点管理
- 接真实发布适配层
- 如果生成大图确实频繁超时，再补 `openai_request_timeout_ms` 字段
