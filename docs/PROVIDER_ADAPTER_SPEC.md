# Provider Adapter Spec

## 1. 目标

这份文档描述 `lesson-image-studio` 下一阶段接入多 provider 的推荐方式。

它不描述当前已经上线的页面细节，而是专门回答下面这些问题：

- provider 层应该长什么样
- TAL 公司模型和官方 OpenAI 如何共存
- 各 provider 的请求 / 返回差异该收在哪里
- 最终如何归一化回当前的 `EditJob -> ImageVersion` 主链路

当前真实实现请看：

- `docs/ARCHITECTURE.md`
- `docs/SETTINGS_SPEC.md`

真实联调样本与观察请看：

- `docs/PROVIDER_VALIDATION_NOTES.md`

## 2. 已锁定的产品规则

- 当前官方 OpenAI 路径必须保留
- 下一阶段是新增 provider / adapter，而不是替换现有实现
- 主模型不能改：`Owner -> ImageItem -> ImageVersion`
- 不允许跨 `ImageItem` 串版本、mask、改图输入
- `SettingsPage` 是本地设置中心
- provider 选择是全局默认项，放在 `SettingsPage`
- 公司内部模型共享一套公司 AI 服务配置：
  - 一个共享 `base_url`
  - 一个共享认证值
  - 不按模型拆两套服务配置
- TAL 多图输入当前不做前端入口

## 3. 推荐的后端结构

不要把 TAL 逻辑继续堆进 `services/jobs.py`。推荐抽成明确的 provider 目录。

建议结构：

- `backend/src/lesson_image_studio_backend/services/providers/base.py`
  - 定义统一 adapter 接口与统一结果类型
- `.../providers/openai_official.py`
- `.../providers/tal_gpt_image_2.py`
- `.../providers/tal_gemini_flash_image.py`
- `.../providers/tal_gemini_pro_image.py`
- `.../providers/registry.py`
  - 根据 `default_provider` 返回 adapter

`jobs.py` 只保留：

- 任务编排
- 状态流转
- 调 provider adapter
- 写回 `StorageService / ImageVersion / EventLog`

## 4. 推荐的统一 adapter 接口

建议不要直接把各家 SDK 或 HTTP 细节暴露给 `jobs.py`。推荐统一成两个能力：

- `generate()`
- `edit()`

建议的输入形态：

```python
class ProviderGenerateInput(TypedDict):
    prompt: str
    size: str | None
    quality: str | None
    extra_options: dict[str, Any]


class ProviderEditInput(TypedDict):
    prompt: str
    images: list[ProviderInputImage]
    size: str | None
    quality: str | None
    extra_options: dict[str, Any]


class ProviderInputImage(TypedDict):
    bytes: bytes
    filename: str
    mime_type: str
```

建议的统一输出形态：

```python
class ProviderImageOutput(TypedDict):
    bytes: bytes
    mime_type: str
    filename_hint: str | None
    width: int | None
    height: int | None


class ProviderCallResult(TypedDict):
    provider: str
    provider_model: str
    request_id: str | None
    trace_id: str | None
    text_content: str | None
    reasoning_content: str | None
    usage: dict[str, Any] | None
    raw_response_path: str | None
    images: list[ProviderImageOutput]
    provider_metadata: dict[str, Any]
```

## 5. SettingsPage 推荐演进

下一阶段 `SettingsPage` 推荐新增这些产品级字段：

- `default_provider`
  - `openai_official`
  - `tal_gpt_image_2`
  - `tal_gemini_flash_image`
  - `tal_gemini_pro_image`
- `tal_service_base_url`
- `tal_service_api_key`

注意：

- 这是“一套公司 AI 服务配置”
- 不要做成：
  - `tal_gpt_base_url`
  - `tal_gemini_base_url`
  - `tal_gpt_key`
  - `tal_gemini_key`

## 6. Provider 差异映射

### 6.1 官方 OpenAI

当前真实实现已经在用，仍然保留。

特点：

- 文生图 / 图生图走 OpenAI 官方兼容接口
- 当前系统设置字段已经存在：
  - `openai_api_key`
  - `openai_base_url`
  - `openai_model`

### 6.2 TAL `gpt-image-2`

请求：

- 文生图：
  - `POST {tal_service_base_url}/images/generations`
- 图生图：
  - `POST {tal_service_base_url}/images/edits`
- header：
  - `api-key: appId:apiKey`
- 模型名：
  - `gpt-image-2`

返回体关键位置：

- 图片：
  - `body.data[].b64_json`
- 元信息：
  - `output_format`
  - `quality`
  - `size`
  - `usage`
- 请求标识：
  - `x-request-id`
  - `traceid`

适配建议：

- `b64_json` 解码成二进制图片
- `output_format` 转成 `mime_type`
- 把 `quality / size / usage` 记入 `provider_metadata`

### 6.3 TAL `gemini-3.1-flash-image`

请求：

- `POST {tal_service_base_url}/chat/completions`
- header：
  - `api-key: appId:apiKey`
- 模型名：
  - `gemini-3.1-flash-image`
- 必须带：
  - `messages`
  - `modalities: ["text", "image"]`

图生图输入：

- `messages[].content[]`
- 其中图片是：
  - `{"type":"image_url","image_url":{"url":"..."}}`

返回体关键位置：

- 图片：
  - `body.choices[0].message.images[].image_url.url`
- 文本：
  - `body.choices[0].message.content`
- 推理文字：
  - `body.choices[0].message.reasoning_content`
- usage：
  - `prompt_tokens`
  - `completion_tokens`
  - `completion_tokens_details.reasoning_tokens`

适配建议：

- `image_url.url` 如果是 `data:image/...;base64,...`，先拆 data URL 再解码
- `content` 和 `reasoning_content` 都保留到 `ProviderCallResult`
- 不要假设 `modalities` 会回显在响应体里

### 6.4 TAL `gemini-3-pro-image`

调用方式与 `flash-image` 同族：

- 一样走 `/chat/completions`
- 一样使用 `messages + modalities`
- 一样支持 `extra_body.generationConfig.imageConfig.imageSize`
- 一样把图片结果放在：
  - `choices[0].message.images[].image_url.url`

适配建议：

- 可以和 `flash-image` 共用大部分解析逻辑
- 但 adapter 名仍建议分开，方便后续单独调参、限流、默认超时和已知问题管理

## 7. 已知真实差异

根据 2026-04-24 的真实样本：

- TAL `gpt-image-2`
  - 返回的是纯图片生成风格对象
  - 不在 `choices[]` 下
  - 图片直接是 `b64_json`
- TAL `gemini` 两个模型
  - 返回的是 `chat.completion`
  - 图片在 `choices[0].message.images[]`
  - `image_url.url` 实际上是 `data:image/png;base64,...`
  - 可能同时返回：
    - `content`
    - `reasoning_content`

这意味着：

- 不能假设所有 provider 都能复用同一种解析器
- 不能假设所有 provider 的 usage 字段同名
- 不能假设图片结果永远在 `b64_json`

## 8. 建议的错误归一化

不同 provider 最终都应尽量归一成统一错误结构，便于前端与任务中心展示：

```python
class ProviderError(TypedDict):
    provider: str
    provider_model: str | None
    request_id: str | None
    trace_id: str | None
    error_code: str | None
    message: str
    raw_response_path: str | None
```

建议保留的原始信息：

- HTTP 状态码
- provider 返回体
- `x-request-id`
- `traceid`

## 9. 当前不做什么

- 不在这一轮修改主模型
- 不让页面直接理解 provider 的请求体差异
- 不在前端开放 TAL 多图输入入口
- 不把公司 AI 服务配置拆成两份
- 不把 `SettingsPage` 变成云端团队配置中心

## 10. 下一步推荐顺序

1. 先把 `default_provider + tal_service_base_url + tal_service_api_key` 补进 `SettingsPage / AppSettings`
2. 抽 provider registry 和 base adapter
3. 先接 TAL `gpt-image-2`
4. 再接 TAL `gemini-3.1-flash-image`
5. 再接 TAL `gemini-3-pro-image`
6. 最后再评估是否需要 `stream=true` 的专门处理与 TAL 多图改图后端支持
