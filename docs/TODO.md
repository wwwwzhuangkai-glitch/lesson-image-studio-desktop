# TODO / Backlog

## ✅ 已完成（当前）

- 新增正式 `SettingsPage`
- 建立后端本地设置持久化（`AppSettings` 单例 + alembic 默认行）
- 提供设置接口：
  - `GET /api/settings`
  - `PUT /api/settings`
  - `PUT /api/settings/openai-key`
  - `DELETE /api/settings/openai-key`
  - `PUT /api/settings/tal-key`
  - `DELETE /api/settings/tal-key`
- 主题系统：`graphite / glass` 两套 variant × `light / dark` 两套 mode = 4 套完整 token
- `default_export_format` 真正接进导出链路
- 官方 OpenAI 的 key 来源状态可见（`openai_api_key_source`）
- Provider MVP：
  - `default_provider`
  - `openai_official` adapter
  - `tal_gpt_image_2` adapter
  - SettingsPage 公司 AI 服务 key 配置
  - 新任务快照 provider 到 `EditJob.provider`
- Auto Size / Snapshot 修复：
  - 任务创建 API 支持 `size_mode = auto / preset / custom`
  - 默认质量改为 `high`
  - TAL 图改图 auto 按底图归一化到 `16` 对齐并显式传 size
  - 文生图 auto 不传 size
  - 官方 OpenAI 任务使用入队时的模型快照
- 编辑页双图工作台：
  - 左版本轨 + 右上基准图 / 结果图 + 右下控制台
  - 图改图提交对象永远是左栏当前选中版本
  - mask 工具归属到基准图面板，结果图只负责查看输出
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

- UI 视觉重构：OwnerOverviewPage、ImageEditorPage、SettingsPage
- 双图工作台视觉修正：左右齐平、无遮挡、mask 入口稳定可用
- SettingsPage 信息架构继续打磨：provider 专属配置与通用默认参数分离
- TAL `gpt-image-2` 数据流回归：settings -> job -> adapter -> storage -> version -> event
- 保留当前官方 OpenAI 路径，不做替换式重构
- 继续明确“当前前端不支持 TAL 多图输入”的产品边界

## P2（下一轮候选）

- 路由级代码拆分，解决 `build` 的大 chunk 警告
- 补前端测试覆盖（useTheme / Dialog / 更多 provider 分支）
- 接入 TAL `gemini-3.1-flash-image`
- 接入 TAL `gemini-3-pro-image`
- 补采 TAL `gemini` 的 `stream=true` 原始样本与失败样本
- 代码债：
  - `uiStore.ts` 的 `Date.now()+Math.random()` ID
  - `refetchInterval` 的 3 处 3000ms + 1 处 5000ms

## P3

- 图片项排序升级为拖拽排序
- 版本轨来源类型徽标 / 当前定稿更醒目
- utility drawer 键盘可达性与焦点管理
- 接真实发布适配层
- 评估是否需要把当前 OpenAI 的 env 兼容层进一步收口到 SettingsPage 口径
- 如果生成大图确实频繁超时，再补 `openai_request_timeout_ms` 字段
