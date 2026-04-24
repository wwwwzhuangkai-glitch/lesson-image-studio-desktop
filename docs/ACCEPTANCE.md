# Acceptance Notes

## 当前人工验收重点

1. `other` 模式打开工作台时自动生成 `owner_id`，且要求本地标题。
2. 同一个 `Owner` 下可以建立多张图片项，并在总览页以紧凑卡片矩阵展示。
3. 总览页不是长网页，而是固定工作台：左栏、顶栏、主区都保持稳定。
4. 编辑页不是长网页，而是左版本轨、中画布、右检视器的单屏工作台。
5. `item B` 不能拿 `item A` 的版本去创建 mask 或发起 edit。
6. 选中某个版本后可以“复制为新图片项起点”，得到独立的新图片项和新根版本。
7. 没有 `OPENAI_API_KEY` 时任务中心能看到失败任务和明确报错。
8. 前端报错直接显示后端 `detail`，不出现整段 JSON。
9. 模板从 `UtilityDrawer` 能浏览；编辑页打开时“载入”按钮可用。
10. 左栏底部可以打开任务、事件、回收站、模板，且不破坏主工作台布局。

## Settings + 主题系统验收重点

11. `GET /api/settings` 返回非敏感字段，且不含 `openai_api_key` / `masked_openai_api_key`。
12. `PUT /api/settings/openai-key` 写入密钥后，`GET /api/settings` 的状态会更新；`DELETE /api/settings/openai-key` 后恢复。
13. `AppSettings.max_concurrent_jobs = 1` 时，跨图片项同时发起第 2 个 AI 任务会被拒绝。
14. `AppSettings.default_export_format = jpeg` 时，导出文件以 `.jpg` 结尾且文件头是 JPEG magic bytes。
15. `.env` 有 key、AppSettings 无 key 时，SettingsPage 会显示“已配置 · 来自环境变量”，且不显示清空按钮。
16. 页面首次加载时 `<html data-theme="graphite-light">`（或 localStorage 中的上次值），无白屏闪烁。
17. 点击顶栏月亮 / 太阳图标会同时切换 `data-theme`、写入 localStorage、调用 `PUT /api/settings`。
18. 前端 `grep -rn "window.prompt" frontend/src/` 返回 0 行。

## Provider MVP 验收重点

19. 新增 provider / adapter 后，官方 OpenAI 路径仍可正常工作，不被删除或替换。
20. SettingsPage 可以选择全局默认 provider，并且这个选择会影响后续新建的 AI 任务。
21. `GET /api/settings` 不含 `tal_service_api_key` / `masked_tal_service_api_key`，只返回 `has_tal_service_api_key`。
22. TAL `gpt-image-2` adapter 可以接文生图 / 图生图；官方 `EditJob -> ImageVersion` 主链路不需要改模型结构。
23. SettingsPage 不再暴露 TAL 服务地址输入框；adapter 固定使用 `http://ai-service.tal.com/openai-compatible/v1`。
24. 当前前端不出现“多图输入”入口，即使 TAL `gpt-image-2` 后端先支持多图，也不提前暴露 UI。
25. 图改图主流程不再固定提交 `1024x1024`；前端展示输入图规格，TAL `auto` 由后端归一化并落库最终输出规格，例如 `935x1683 -> 928x1680`。
26. 文生图 `auto` 落库为 `size = auto`，adapter 不向 provider 传 `size`。
27. 官方 OpenAI 任务使用入队时快照的模型名，排队后修改 `openai_model` 不会改写旧任务的执行模型。
28. `AI_HANDOFF.md` 和 `SETTINGS_SPEC.md` 能让下一位 AI 直接回答：
   - 默认 provider 放哪配
   - 公司服务配置是一套还是两套
   - 官方 OpenAI 路径是否保留
   - TAL 两类模型各走什么请求形态

## 后续 Gemini Provider 验收重点

29. TAL `gemini-3.1-flash-image` adapter 可以接文生图 / 图生图；其 `chat/completions` 差异被封装在 adapter 内，而不是扩散到前端页面。
30. TAL `gemini-3-pro-image` 与 flash adapter 复用 Gemini 解析逻辑，并保持独立 provider id。
31. TAL `gpt-image-2` 和 TAL Gemini provider 共享固定公司兼容层地址和同一个 key。
