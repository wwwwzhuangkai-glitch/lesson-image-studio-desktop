# Provider Adapter Spec

## 1. 目标

这份文档描述 `lesson-image-studio` 的 provider adapter 方式。Provider MVP 已接入官方 OpenAI 和 TAL `gpt-image-2`；Gemini provider 仍是后续规划。

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
- 新任务入队时快照 `default_provider` 和当时的模型名到 `EditJob.provider / EditJob.model`
- API key 与 base URL 不快照进任务，仍在任务运行时读取本地设置，避免把敏感值复制到任务记录
- 公司内部模型共享一套公司 AI 服务配置：
  - 固定兼容层地址：`http://ai-service.tal.com/openai-compatible/v1`
  - 一个共享认证值
  - 不按模型拆两套服务配置
- TAL 多图输入当前不做前端入口
- 任务质量默认是 `high`
- 任务尺寸由 `size_mode = auto / preset / custom` 表达意图，后端创建任务时复算最终可见规格

## 3. 当前后端结构

TAL 逻辑不放在 `services/jobs.py`，而是抽成明确的 provider 目录。

当前结构：

- `backend/src/lesson_image_studio_backend/services/providers/base.py`
  - 定义统一 adapter 接口与统一结果类型
- `.../providers/openai_official.py`
- `.../providers/tal_gpt_image_2.py`
- `.../providers/registry.py`
  - 根据 `default_provider` 返回 adapter

后续规划但本轮未注册：

- `.../providers/tal_gemini_flash_image.py`
- `.../providers/tal_gemini_pro_image.py`

`jobs.py` 只保留：

- 任务编排
- 状态流转
- 调 provider adapter
- 写回 `StorageService / ImageVersion / EventLog`

## 4. 统一 adapter 接口

不要直接把各家 SDK 或 HTTP 细节暴露给 `jobs.py`。当前统一成两个能力：

- `generate()`
- `edit()`

当前输入形态：

```python
class ProviderGenerateInput(TypedDict):
    prompt: str
    size: str | None
    quality: str | None
    extra_options: dict[str, Any]


class ProviderEditInput(TypedDict):
    prompt: str
    images: list[ProviderInputImage]
    mask: ProviderInputImage | None
    size: str | None
    quality: str | None
    extra_options: dict[str, Any]


class ProviderInputImage(TypedDict):
    bytes: bytes
    filename: str
    mime_type: str
```

当前统一输出形态：

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
    images: list[ProviderImageOutput]
    provider_metadata: dict[str, Any]
```

## 5. SettingsPage Provider MVP

`SettingsPage` 当前新增这些产品级字段：

- `default_provider`
  - `openai_official`
  - `tal_gpt_image_2`
- `tal_service_api_key`

Gemini provider 不在本轮 SettingsPage 展示。

注意：

- 这是“一套公司 AI 服务配置”
- SettingsPage 只让老师配置 `tal_service_api_key`
- 公司兼容层地址不暴露为表单项，由 adapter 固定使用
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
- 新任务创建时会把当时的 `openai_model` 快照到 `EditJob.model`
- adapter 运行时用 `EditJob.model` 作为 `model_override`，避免排队后改设置影响旧任务
- `size = None` 时不向官方接口传 `size`
- 官方 OpenAI 暂不接受 `size_mode=custom`

### 6.2 TAL `gpt-image-2`

请求：

- 文生图：
  - `POST http://ai-service.tal.com/openai-compatible/v1/images/generations`
- 图生图：
  - `POST http://ai-service.tal.com/openai-compatible/v1/images/edits`
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

实现口径：

- SettingsPage 不暴露公司服务地址输入框
- adapter 固定使用 `http://ai-service.tal.com/openai-compatible/v1`
- 不把具体 endpoint 写进设置项，避免生图、改图、Gemini 的路径互相污染

当前已实测验证：

- `supports_edit = true`
- `supports_mask = true`
- `supports_size = true`
- `supports_quality = true`

但要特别注意：

- 当请求里不显式传 `size` 时，当前 TAL `gpt-image-2` 的图改图结果**不会自动保留原图尺寸**
- 后续前端不能假设“图改图默认沿用输入图规格”
- 如果产品希望“尽量保持规格稳定”，必须在产品层单独定义策略，而不是依赖 provider 默认行为
- 当前实现已经采用这条策略：TAL 图改图 `size_mode=auto` 时，后端按底图宽高归一化后显式传 `size`
- TAL 文生图 `size_mode=auto` 时，任务记录 `size = auto`，adapter 不传 `size`

### 6.3 TAL `gemini-3.1-flash-image`

请求：

- `POST http://ai-service.tal.com/openai-compatible/v1/chat/completions`
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

## 8. 前端默认策略建议

对于 TAL `gpt-image-2`，当前更合理的前端策略是：

- 默认 `quality = high`
- `size` 不作为高频主控项暴露，主流程提交 `size_mode = auto`
- 图改图时前端展示当前输入图原始规格，并说明最终规格以后端落库结果为准
- 文生图默认 `auto`；可以开放标准预设尺寸
- `mask` 保留为正式能力，不应再视为“前端有、后端不可用”

但需要额外强调：

- 当前样本表明，“不传 `size`”不等于“保留输入图尺寸”
- 如果产品以后非常强调“规格不变”，需要单独定义：
  - 是否总是显式传一个标准 size
  - 是否在后处理阶段做裁切 / 缩放
  - 或是否在 UI 上明确提示“模型可能返回标准尺寸而不是原始像素尺寸”

### 8.1 当前 size 归一化策略

当前已经把“尽量保持原图规格”做成产品层和 adapter 层的显式逻辑，而不是依赖 provider 默认行为。

TAL 图改图 `size_mode=auto` 的后端流程：

1. 读取输入图原始宽高
2. 如果最长边大于 `3840`，先按原始比例等比缩小到最长边 `= 3840`
3. 把宽高分别修正到最接近的 `16` 的倍数
4. 若修正后宽高出现 0 或比例异常，再退回到安全标准档位
5. 把归一化后的 `size` 显式传给 provider，并写入 `EditJob.size / ImageVersion.size`

其他模式：

- 文生图 `size_mode=auto`：`EditJob.size = auto`，adapter 收到 `size = None`
- `size_mode=preset`：只接受 `1024x1024 / 1536x1024 / 1024x1536`
- `size_mode=custom`：当前只允许 TAL `gpt-image-2`，要求正整数、宽高都是 `16` 的倍数、最长边不超过 `3840`
- OpenAI 官方收到 `custom` 会在创建任务阶段返回 400

当前这样做的原因：

- TAL `gpt-image-2` 已明确报过错：
  - 宽高都必须是 `16` 的倍数
- 不传 `size` 时，图改图成功样本多次落到 `1536x1024`
- 也就是说，当前 provider 默认行为并不等于“沿用输入图尺寸”

### 8.2 归一化策略的例子

输入图：

- `935x1683`

推荐归一化：

- `928x1680`

理由：

- 与原图比例接近
- 宽高都满足 `16` 的倍数
- 比直接传原图尺寸更可能通过 provider 参数校验

但要注意：

- 这只是当前推荐策略，不是对 TAL 兼容层所有隐藏约束的最终证明
- 即使尺寸参数合法，服务端仍可能因波动返回 `500/504`

## 9. 建议的错误归一化

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

## 10. 当前不做什么

- 不在这一轮修改主模型
- 不让页面直接理解 provider 的请求体差异
- 不在前端开放 TAL 多图输入入口
- 不把公司 AI 服务配置拆成两份
- 不把 `SettingsPage` 变成云端团队配置中心

## 11. 下一步推荐顺序

1. 接 TAL `gemini-3.1-flash-image`
2. 接 TAL `gemini-3-pro-image`
3. 补采 Gemini `stream=true` 原始样本和失败样本
4. 评估是否需要 TAL 多图改图后端支持
5. 如果 provider 错误样本稳定，再把错误结构进一步归一化
