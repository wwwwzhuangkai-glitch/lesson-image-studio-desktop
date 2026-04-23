# Decisions

这份文档只记录已经锁定、后续 AI 或工程师不得擅自推翻的产品决定。

## 1. 主模型不可动

- 主模型始终是 `Owner -> ImageItem -> ImageVersion`
- `Owner` 必须绑定在：
  - `题目ID`
  - `素材ID`
  - `other + 本地生成 id`
- 一个 `Owner` 下可以有多张图
- 每张图独立维护自己的版本演进路线

## 2. 图片边界不可动

- `ImageVersion` 不能跨 `ImageItem`
- `ImageMask` 不能跨 `ImageItem`
- 改图请求不能跨 `ImageItem`
- 如果老师想复用别的图，只能走“复制为新图片项起点”
- “复制为新图片项起点”复制出的是新图片项的根版本，不与旧树相连

## 3. 工作台骨架不可退化

- Lesson Image Studio 必须保持单屏工作台气质
- 不能退化成长网页
- 正式页面总数固定为 4 个：
  - `OwnerEntryPage`
  - `OwnerOverviewPage`
  - `ImageEditorPage`
  - `SettingsPage`
- 编辑页必须维持：
  - 左版本轨
  - 中画布
  - 右检视器
- 次级信息不能重新散成多个各自漂浮的小面板

## 4. 产品定位不可漂移

- 它首先是教研工作台
- 它不是面向 C 端用户的消费产品
- 数据流、数据库架构、接口边界优先级高于视觉包装

## 5. 设置体系的产品定位已锁定

- `SettingsPage` 是团队成员各自在自己机器上使用的本地设置中心
- UI 写入的设置必须落到后端 `AppSettings`，再本地持久化
- 日常使用场景下，产品级设置的可信来源是 `SettingsPage -> AppSettings`
- 当前不做：
  - 云端共享设置
  - 团队统一在线密钥中心
  - 多用户账号与权限系统

## 6. Provider 策略已锁定

- 当前官方 OpenAI 调用方式必须保留，不能被替换掉
- 后续要做的是新增 provider / adapter，不是覆盖现有实现
- `default_provider` 应该是 SettingsPage 里的全局默认 provider
- 公司内部模型不是两套服务配置，而是一套共享的公司 AI 服务配置：
  - 一个共享 `base_url`
  - 一个共享认证值
  - 通过不同请求体和模型名切 provider / adapter
- 计划中的公司 provider 至少包含：
  - TAL `gpt-image-2`
  - TAL `gemini-3.1-flash-image`
- TAL 多图输入能力可以在后端 / adapter 预留，但当前前端不做这个功能入口

## 7. UI 允许大改，但边界不能破

- 允许大改：
  - 整体视觉风格
  - 卡片布局
  - 组件编排
  - 主题表现
  - 动效与图标
- 不允许破坏：
  - 单屏工作台骨架
  - 图片边界与版本边界
  - 4 页结构
- 当前模板放在 `UtilityDrawer` 的 `templates` tab，这属于当前实现
- 未来允许继续调整模板入口，但它始终应当是次级能力，不应抢主工作流

## 8. 主题系统（当前实现）不可随意回退

- 两套 variant：`graphite`（默认，石板冷静）+ `glass`（浅雾玻璃）
- 两套 mode：`light`（默认）+ `dark`
- 合计 4 套 `data-theme`：`graphite-light` / `graphite-dark` / `glass-light` / `glass-dark`
- 切换入口只有两个：
  - 顶栏的明暗图标（只切 mode）
  - SettingsPage 的外观分区（切 variant 与 mode）
- 明暗态的写入必须同时落到 Zustand、localStorage、`PUT /api/settings`
- 新页面、新组件必须先走 token，不允许再引入大面积硬编码色值

## 9. 设置接口的安全边界不可动

- `AppSettings` 是单例：`id = 'singleton'` + `CheckConstraint` 兜底
- 首次 `alembic upgrade` 即写入默认行
- API 永远不回传 `openai_api_key` 的任何字符
- 当前清空 key 必须二次确认
- 并发上限 `max_concurrent_jobs` 默认 `2`，范围 1–10

## 10. 接力开发的文档纪律不可动

- “当前真实实现”和“未来计划”必须分开写
- 当前实现写进：
  - `ARCHITECTURE.md`
  - `UI_WORKBENCH.md`
- 未来计划写进：
  - `NEXT_PHASE_PLAN.md`
  - `SETTINGS_SPEC.md`
  - `AI_HANDOFF.md`
- 如果数据模型、provider 策略、页面数量要改，必须先更新本文件
