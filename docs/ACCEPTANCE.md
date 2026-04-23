# Acceptance Notes

## 本轮人工验收重点

1. `other` 模式打开工作台时自动生成 `owner_id`，且要求本地标题。
2. 同一个 `Owner` 下可以建立多张图片项，并在总览页以紧凑卡片矩阵展示。
3. 总览页不是长网页，而是固定工作台：左栏、顶栏、主区都保持稳定。
4. 编辑页不是长网页，而是左版本轨、中画布、右检视器的单屏工作台。
5. `item B` 不能拿 `item A` 的版本去创建 mask 或发起 edit。
6. 选中某个版本后可以“复制为新图片项起点”，得到独立的新图片项和新根版本。
7. 没有 `OPENAI_API_KEY` 时任务中心能看到失败任务和明确报错。
8. 前端报错直接显示后端 `detail`，不出现整段 JSON。
9. 模板区默认折叠，展开后可查看全文；系统模板必须复制后再编辑。
10. 左栏底部可以打开任务、事件、回收站，且不破坏主工作台布局。

## 本轮（Settings + 主题系统）验收重点

11. `GET /api/settings` 返回 `has_openai_api_key` 与非敏感字段，**不含** `openai_api_key` 或 `masked_openai_api_key`。
12. `PUT /api/settings/openai-key` 写入密钥后，`GET /api/settings` 的 `has_openai_api_key` 变为 `true`；`DELETE /api/settings/openai-key` 后回到 `false`。
13. `AppSettings.max_concurrent_jobs = 1` 时，跨图片项同时发起第 2 个 AI 任务会被拒绝，错误信息包含「并发上限」四字。
14. AppSettings 中保存的 `openai_base_url` / `openai_model` 会被 `JobRunner` 读取并传给 OpenAI 客户端（设置即生效）。
15. 无 AppSettings key 且无 ENV key 时，任务仍然 `failed` 且 `error_code = "missing_api_key"`，错误信息提示「请在设置页填入 Key」。
16. 页面首次加载时 `<html data-theme="graphite-light">`（或 localStorage 中的上次值），无白屏闪烁。
17. 点击顶栏月亮/太阳图标会同时：切换 `data-theme` 前缀、写入 localStorage、`PUT /api/settings { theme_mode }`。
18. SettingsPage 外观分区切换 `variant` 会同步更新 4 套主题组合，所有 4 个页面的面板、按钮、描边都跟随变化。
19. `grep -rn "window.prompt" frontend/src/` 返回 0 行；7 处原交互全部走 `InputDialog` 或 `PresetFormDialog`。
20. 清空 API Key 必须通过 `InputDialog` 二次确认（键入「清空」二字），否则操作被取消。

## 第二轮（紧凑化 + 模板搬家 + 选 A 遗留）验收重点

21. 把 `default_export_format` 切到 `jpeg` 后，导出文件的 storage_key 以 `.jpg` 结尾，文件头字节是 `FF D8 FF`（JPEG magic）。
22. `.env` 里填 `LESSON_IMAGE_STUDIO_OPENAI_BASE_URL`（AppSettings 留空），发起改图时 OpenAI 客户端走 ENV 指定的 URL；AppSettings 再填一个值后 ENV 被覆盖。
23. `.env` 有 key、AppSettings 无 key → SettingsPage 显示 `● 已配置 · 来自环境变量`，且**不显示**清空密钥按钮。
24. 模板从 UtilityDrawer 能浏览；编辑页打开时"载入"按钮可用，点击后 preset.prompt_text 填进编辑页 textarea + 弹"已载入"通知。
25. 离开编辑页到总览（`currentImageItemId` 为 null）→ UtilityDrawer templates tab 里的"载入"按钮变灰并带 title 提示。
26. 前端 `grep -rn "template-section" frontend/src/components/ImageEditorPage.tsx` 返回 0；模板区不再嵌在检视器内。
27. `GET /api/settings` 返回字段包括 `openai_api_key_source`；值为 `app_settings` / `env` / `none` 三选一。
28. Pulsar 对齐视觉复测：左栏宽度 240px、编辑页版本轨 260px、h1 字号 ~25–34px、Glass 模式面板圆角 20px。
