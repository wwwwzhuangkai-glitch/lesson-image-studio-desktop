# TODO / Backlog

## ✅ 已完成（当前）

- 新增正式 `SettingsPage`
- 建立后端本地设置持久化（`AppSettings` 单例 + alembic 默认行）
- 提供设置接口：
  - `GET /api/settings`
  - `PUT /api/settings`
  - `PUT /api/settings/openai-key`
  - `DELETE /api/settings/openai-key`
- 主题系统：`graphite / glass` 两套 variant × `light / dark` 两套 mode = 4 套完整 token
- `default_export_format` 真正接进导出链路
- 官方 OpenAI 的 key 来源状态可见（`openai_api_key_source`）
- 跨图片项全局并发上限 `max_concurrent_jobs`
- 7 处 `window.prompt` → `InputDialog` / `PresetFormDialog`
- 模板搬到 `UtilityDrawer` 的 `templates` tab
- 补齐 provider 接入文档：
  - `docs/PROVIDER_ADAPTER_SPEC.md`
  - `docs/PROVIDER_VALIDATION_NOTES.md`
- 已收集真实样本：
  - TAL `gpt-image-2`
  - TAL `gemini-3.1-flash-image`
  - TAL `gemini-3-pro-image`

## P1（下一轮主线）

- 文档继续与真实实现收口，避免 `ARCHITECTURE / UI_WORKBENCH / AI_HANDOFF / SETTINGS_SPEC` 再次漂移
- 抽正式的 provider / adapter 层，避免把 TAL 接口逻辑直接堆进 `jobs.py`
- 扩 `SettingsPage`：
  - 全局默认 provider
  - 公司 AI 服务共享配置
- 接入 TAL `gpt-image-2`
- 接入 TAL `gemini-3.1-flash-image`
- 接入 TAL `gemini-3-pro-image`
- 保留当前官方 OpenAI 路径，不做替换式重构
- 明确“当前前端不支持 TAL 多图输入”的产品边界
- 补采 TAL `gemini` 的 `stream=true` 原始样本与失败样本

## P2（下一轮候选）

- 路由级代码拆分，解决 `build` 的大 chunk 警告
- 补前端测试覆盖（useTheme / Dialog / SettingsPage / provider 相关分支）
- OwnerOverviewPage 在现有 token 下进一步打磨卡片视觉 / 缩略图处理
- ImageEditorPage 在现有 token 下深化版本轨的来源徽标 / 定稿提示层级
- 代码债：
  - `CanvasWorkbench.tsx` 的 `any`
  - `uiStore.ts` 的 `Date.now()+Math.random()` ID
  - `refetchInterval` 的 3 处 3000ms + 1 处 5000ms

## P3

- 图片项排序升级为拖拽排序
- 版本轨来源类型徽标 / 当前定稿更醒目
- utility drawer 键盘可达性与焦点管理
- 接真实发布适配层
- 评估是否需要把当前 OpenAI 的 env 兼容层进一步收口到 SettingsPage 口径
- 如果生成大图确实频繁超时，再补 `openai_request_timeout_ms` 字段
