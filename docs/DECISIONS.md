# Decisions

这份文档只记录当前已锁定、后续 AI 或工程师不得擅自推翻的产品决定。

## 1. 主模型不可动

- 主模型始终是 `Owner -> ImageItem -> ImageVersion`
- `Owner` 必须绑定在：
  - `题目ID`
  - `素材ID`
  - `other + 本地生成 id`
- 一个 `Owner` 下可以有多张图
- 每张图有自己的版本演进路线

## 2. 图片边界不可动

- 版本不能跨 `ImageItem`
- mask 不能跨 `ImageItem`
- 改图请求不能跨 `ImageItem`
- 如果老师想复用别的图，只能走“复制为新图片项起点”
- “复制为新图片项起点”复制出的是新图片项的根版本，不与旧树相连

## 3. 工作台骨架不可退化

- Lesson Image Studio 必须保持单屏工作台气质
- 不能退化成长网页
- 编辑页必须维持：
  - 左版本轨
  - 中画布
  - 右检视器
- 次级信息不能重新散成多个各自漂浮的小面板

## 4. 产品定位不可漂移

- 它首先是教研工作台
- 它不是面向 C 端用户的消费产品
- 数据流、数据库架构、接口边界优先级高于视觉包装

## 5. 下一阶段明确允许改变的部分

- 整体视觉风格
- 卡片布局
- 组件编排
- 主题表现
- 动效与图标
- 设置页新增

这些都可以大胆重做，但前提是不破坏本文件前 4 节的硬规则。

## 6. 主题系统（本轮锁定）

- 两套 variant：`graphite`（默认，石板冷静）+ `glass`（浅雾玻璃，第一版延续）
- 两套 mode：`light`（默认）+ `dark`
- 合计 4 套 `data-theme`：`graphite-light` / `graphite-dark` / `glass-light` / `glass-dark`
- 切换入口只有两个：顶栏的明暗图标（只切 mode）+ SettingsPage 的外观分区（可切 variant 与 mode）
- 明暗态的写入必须同时落到 Zustand、localStorage、`PUT /api/settings`，不能只改其中一处
- 任何新页面、新组件必须先走 token，不允许再引入硬编码色值

## 7. 设置体系（本轮锁定）

- `AppSettings` 是**单例**：`id = 'singleton'` + `CheckConstraint` 兜底
- 首次 `alembic upgrade` 即通过 `op.bulk_insert` 写入默认行，service 层永远 `db.get(AppSettings, "singleton")` 非空
- API 永远不回传 `openai_api_key` 的任何字符，`has_openai_api_key: bool` 是唯一出口
- 清空 Key 必须二次确认（当前实现是 `InputDialog` 键入「清空」）
- 并发上限 `max_concurrent_jobs` 默认 `2`，上限范围 1–10

## 8. 复用 vs 新增

- 不引入 UI 库（shadcn / Tailwind / MUI），继续纯 CSS token
- 前端依赖保持最小：不加 icon 库（SVG inline）、不加 dialog 库（imperative Root 组件）
- 数据模型任何新增必须单独写一条 DECISION，不可静默加字段

## 9. 模板与编辑器 prompt state（本轮锁定）

- 模板（PresetCard）的**唯一展示位置**是 UtilityDrawer 的 "templates" tab
- 编辑页检视器里不再嵌入模板库；如果未来要在编辑页加"快速载入模板"入口，只能通过调用 `useUiStore` 的 `setUtilityTab('templates') + openUtilityDrawer('templates')`
- 编辑页 prompt textarea 的 state 从 `useState` 迁到 `uiStore.editorPromptText`，因为 UtilityDrawer 的"载入"按钮需要跨组件写入
- `uiStore.currentImageItemId` 由 `ImageEditorPage` 的 `useEffect` 维护（挂载写 itemId，卸载清空），UtilityDrawer 据此决定"载入"按钮是否可用

## 10. OpenAI 配置回落（本轮锁定）

- 三个字段**各自独立**回落到环境变量：
  - `openai_api_key` ← `LESSON_IMAGE_STUDIO_OPENAI_API_KEY`
  - `openai_base_url` ← `LESSON_IMAGE_STUDIO_OPENAI_BASE_URL`
  - `openai_model` ← `LESSON_IMAGE_STUDIO_OPENAI_MODEL`
- ENV 值**从不**被前端覆盖写回；AppSettings 与 ENV 是读侧合并，不是写侧同步
- model 双层都空时直接 `ValueError`（不保留硬编码 `"gpt-image-2"` 兜底）
- `has_openai_api_key` 口径统一为"任一层有值"，并新增 `openai_api_key_source` 字段告诉前端真实来源
