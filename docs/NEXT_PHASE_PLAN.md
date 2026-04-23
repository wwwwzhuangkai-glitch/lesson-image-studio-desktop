# Next Phase Plan

## 1. 目标

下一阶段的目标不是改数据主模型，而是在不动核心边界的前提下，把产品推进到“更成熟的内部教研工作台”，并把 AI 调用从“单一官方 OpenAI 路径”演进到“多 provider / 多 adapter 架构”。

本阶段产出包含三条线：

- 设置体系从“已有本地设置页”演进成“provider 配置中心”
- 新增 provider / adapter 架构，同时保留官方 OpenAI 路径
- UI 继续打磨，偏重现代感、结构感和工作台质感

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
- 下一阶段新增 provider / adapter，而不是替换现有实现
- provider 由 SettingsPage 的全局默认项控制
- TAL 模型共享一套公司 AI 服务配置：
  - 一个共享 `base_url`
  - 一个共享认证值
  - 不按模型拆两套配置
- TAL 多图输入当前不做前端功能

## 5. 开发优先级

下一阶段建议按下面顺序推进：

1. 先完成 docs 与真实实现的统一
2. 再抽 provider / adapter 底座
3. 再扩 `SettingsPage`：默认 provider + 公司 AI 服务配置
4. 接入 TAL `gpt-image-2`
5. 接入 TAL `gemini-3.1-flash-image`
6. 在 provider 结构稳定后继续打磨 `OwnerOverviewPage` 和 `ImageEditorPage`
7. `chunk` 拆分仍然是 P2，并行处理但不是最高优先级产品目标

## 6. UI 约束

下一个偏 UI 的 AI 可以大胆重做，但要遵守这些方向：

- 保留当前偏冷静、专业、内部工具气质
- 保留浅色和深色两套主题能力
- 不做消费级、炫技型、过度卡通的界面
- 不做大段展示型页面
- 更像教研工作台 / 内部 SaaS / 专业编辑工具

## 7. 工程约束

- 不改主模型
- 不改跨图边界
- 不把设置体系先做成复杂权限系统或云端配置中心
- 允许重排组件，但不能让工作台骨架退化
- 不要把 provider 差异扩散到页面主逻辑里
- 不要把 TAL 模型拆成两套公司服务配置

详细设置规格请看 `docs/SETTINGS_SPEC.md`。  
不可动摇规则请看 `docs/DECISIONS.md`。

## 8. 本轮已交付摘要（归档）

本轮（2026-04-23）已完成：

- 后端 `AppSettings` 单例模型 + alembic 迁移（含默认行）+ service 层 + 4 条 `/api/settings*` 路由
- `JobRunner` 当前仍围绕官方 OpenAI 路径运行
- 跨图片项全局并发上限 `max_concurrent_jobs`（默认 2）
- 前端 4 套主题 token 系统
- `index.css` token 化，`index.html` inline 脚本防首帧闪白
- 新增 `SettingsPage`
- 顶栏全局 `AppTopbar`
- `InputDialog` + `PresetFormDialog` 取代所有 `window.prompt`
- 模板已迁移到 `UtilityDrawer` 的 `templates` tab

当前 repo 已具备承接 provider 接入的工作台骨架，但尚未有正式 adapter 层。
