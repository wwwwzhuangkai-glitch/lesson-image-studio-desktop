# Settings Spec

## 1. 目标

下一阶段新增正式 `SettingsPage`，让团队成员在自己的本地工作台里直接配置密钥和偏好。

这不是云端账户设置，也不是多用户控制台，而是本地应用设置。

## 2. 设置存储边界

- 存储位置：后端本地持久化
- 不使用前端 `localStorage` 作为主存储
- 不采用“环境变量只读，页面只能看不能改”的模式
- `OPENAI_API_KEY` 第一版允许本地明文持久化
- 页面和文档都必须明确标注：Key 仅存于当前机器本地

## 3. 数据模型

第一版建议使用单例本地配置，而不是复杂设置表体系。

`AppSettings`

- `id`
- `openai_api_key_encrypted_or_plaintext`
- `theme_mode`
- `default_quality`
- `default_size`
- `default_export_format`
- `updated_at`

字段说明：

- `openai_api_key_encrypted_or_plaintext`
  - 第一版允许 plaintext
  - 字段命名保留将来升级空间
- `theme_mode`
  - 第一版支持 `light / dark`
- `default_quality`
  - `low / medium / high`
- `default_size`
  - 当前支持的图片尺寸集合
- `default_export_format`
  - 第一版只覆盖默认导出格式

## 4. 页面分区

`SettingsPage` 第一版固定包含 4 个分区：

### 密钥设置

- `OpenAI API Key`
- 支持保存
- 支持更新
- 支持清空
- 页面显示：
  - `已配置 / 未配置`
  - 遮罩后的摘要

### 外观设置

- 主题系统第一版直接支持：
  - `light`
  - `dark`
- 目标是 token 化主题能力
- 不是只换背景色

### 默认参数

- 默认质量：
  - `low`
  - `medium`
  - `high`
- 默认尺寸：
  - 当前支持的图片尺寸集合
- 这些值需要自动回填到：
  - 编辑页
  - 空图片项生图入口

### 导出偏好

- 第一版最小集合固定为：
  - `default_export_format`
- 本阶段不扩展复杂命名模板或导出工作流

## 5. API 规格

### `GET /api/settings`

返回非敏感字段，并额外返回：

- `has_openai_api_key`
- `masked_openai_api_key`

默认不回传完整 Key 明文。

### `PUT /api/settings`

更新非敏感设置字段：

- `theme_mode`
- `default_quality`
- `default_size`
- `default_export_format`

### `PUT /api/settings/openai-key`

单独更新 Key。

### `DELETE /api/settings/openai-key`

清空 Key。

## 6. 前端行为要求

- 设置页入口固定在右上角
- 设置页是正式页面，不做临时抽屉
- 修改设置后要有清晰保存反馈
- 编辑页和空图片项生图页在重新进入时，默认带入最新设置值

## 7. 非目标

这一阶段不做：

- 多用户账号设置
- 云端同步
- 权限控制
- 团队共享密钥
- 复杂导出模板系统
