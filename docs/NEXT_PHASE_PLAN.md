# Next Phase Plan

## 1. 目标

下一阶段的目标不是改数据主模型，也不是继续重写 provider，而是在保护现有 TAL / Provider 数据流的前提下，把产品推进到“更成熟的内部教研工作台”。

本阶段产出包含三条线：

- UI 视觉重构优先，偏重现代感、结构感和工作台质感
- TAL `gpt-image-2` 全链路作为回归护栏
- Provider 架构保持稳定，Gemini provider 放到后续阶段

## 2. 页面结构

下一阶段总页数仍固定为 4 页：

- `OwnerEntryPage`
- `OwnerOverviewPage`
- `ImageEditorPage`
- `SettingsPage`

说明：

- 不新增第 5 个正式页面
- `SettingsPage` 已存在，下一阶段继续强化它
- 入口固定在右上角，不放左栏

## 3. 产品边界

下一阶段仍然是本地团队工具，不进入多用户系统：

- 团队成员各自使用同一产品
- 每个人配置自己的本地 key 和偏好
- 不引入：
  - 账号体系
  - 权限系统
  - 实时协同编辑
  - 共享在线设置中心

## 4. 已确认的 provider 方向

- 当前官方 OpenAI 方式必须保留
- 已新增 provider / adapter 架构，而不是替换官方 OpenAI
- provider 由 SettingsPage 的全局默认项控制
- TAL 模型共享一套公司 AI 服务配置：
  - 固定兼容层地址：`http://ai-service.tal.com/openai-compatible/v1`
  - 一个共享认证值
  - 不按模型拆两套配置
- TAL 多图输入当前不做前端功能
- 已完成外部联调验证的公司模型包括：
  - `gpt-image-2`
  - `gemini-3.1-flash-image`
  - `gemini-3-pro-image`

## 5. 开发优先级

下一阶段执行顺序：

1. 先做 UI 视觉重构，重点是 `OwnerOverviewPage`、`ImageEditorPage`、`SettingsPage`
2. 重构中保护 TAL 数据流：settings -> job -> adapter -> storage -> version -> event
3. UI 收尾时补齐 SettingsPage / ImageEditorPage 的前端回归测试
4. TAL Gemini provider 接入放到 UI 主线之后
5. `chunk` 拆分仍然是 P2，并行处理但不是最高优先级产品目标

## 6. UI 约束

下一个偏 UI 的 AI 可以大胆重做，但要遵守这些方向：

- 保留当前偏冷静、专业、内部工具气质
- 保留浅色和深色两套主题能力
- 不做消费级、炫技型、过度卡通的界面
- 不做大段展示型页面
- 更像教研工作台 / 内部 SaaS / 专业编辑工具
- `ImageEditorPage` 当前已进入“左版本轨 + 双图对照 + 底部控制台”结构；后续只能在这个骨架上深化，不要退回旧检视器结构

## 7. 工程约束

- 不改主模型
- 不改跨图边界
- 不把设置体系先做成复杂权限系统或云端配置中心
- 允许重排组件，但不能让工作台骨架退化
- 不要把 provider 差异扩散到页面主逻辑里
- 不要把 TAL 模型拆成两套公司服务配置
- 不要在 UI 重构中改动 `JobRunner`、provider registry 或 adapter HTTP 细节，除非是明确 bugfix

详细设置规格请看 `docs/SETTINGS_SPEC.md`。  
不可动摇规则请看 `docs/DECISIONS.md`。

## 8. 已交付摘要（归档）

2026-04-23 已完成：

- 后端 `AppSettings` 单例模型 + alembic 迁移（含默认行）+ service 层 + 4 条 `/api/settings*` 路由
- 当时 `JobRunner` 仍围绕官方 OpenAI 路径运行
- 跨图片项全局并发上限 `max_concurrent_jobs`（默认 2）
- 前端 4 套主题 token 系统
- `index.css` token 化，`index.html` inline 脚本防首帧闪白
- 新增 `SettingsPage`
- 顶栏全局 `AppTopbar`
- `InputDialog` + `PresetFormDialog` 取代所有 `window.prompt`
- 模板已迁移到 `UtilityDrawer` 的 `templates` tab

2026-04-24 Provider MVP 已完成：

- 修复版本删除规则：有任何子版本的版本都不能删除，即使子版本已删除
- 无效图片上传先验证再落盘，返回 400 且不留下坏文件
- 新增 provider adapter 层：`openai_official` / `tal_gpt_image_2`
- `JobRunner` 改为调用 adapter，并在新任务中快照 `default_provider`
- `SettingsPage` 新增默认 provider 和 TAL 公司服务配置
- TAL `gpt-image-2` adapter 固定使用 `http://ai-service.tal.com/openai-compatible/v1`
- Auto Size / Snapshot 修复已完成：
  - 默认 `quality = high`
  - 主流程提交 `size_mode = auto`
  - TAL 图改图 auto 会按底图宽高归一化后显式传 `size`
  - 文生图 auto 不传 `size`
  - 官方 OpenAI 任务使用入队时的模型快照

2026-04-24 编辑页双图工作台已完成：

- `ImageEditorPage` 重构为左版本轨 + 双图对照 + 底部控制台
- 左栏当前选中版本就是基准图和图改图提交对象
- 结果图显示当前选中版本的最近直接子版本或最近任务产物
- 矩形 mask 工具迁入基准图面板，结果图只负责查看输出
- 提示词、provider、quality、尺寸说明、定稿、导出、发布等动作统一收进底部控制台
