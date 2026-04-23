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
