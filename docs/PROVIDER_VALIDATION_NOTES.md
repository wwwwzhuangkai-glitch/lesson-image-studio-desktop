# Provider Validation Notes

## 1. 文档目的

这份文档记录 2026-04-24 在本地独立测试目录里拿到的真实 provider 样本，用来帮助后续 `lesson-image-studio` 接 provider / adapter。

它不是正式接口文档，也不替代供应方文档；它的价值在于：

- 留下真实返回体结构
- 留下请求成功与失败样本的位置
- 记录已经观察到的字段差异和已知限制

## 2. 测试目录

本次测试不在主项目里进行，而是在独立目录：

- `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests`

测试图片：

- `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/2.png`
- `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/IMG_3186.JPG`

认证值在测试时通过命令行传入，未写入本仓库文档。

## 3. 已拿到的成功样本

### TAL `gpt-image-2`

文生图：

- 响应：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gpt-image-2-generate-20260424-095622-response.json`
- 图片：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gpt-image-2-generate-20260424-095622-image-1.png`

双图改图：

- 响应：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gpt-image-2-edit-20260424-095913-response.json`
- 图片：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gpt-image-2-edit-20260424-095913-image-1.png`

### TAL `gemini-3.1-flash-image`

文生图：

- 响应：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gemini-generate-20260424-095941-response.json`
- 图片：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gemini-generate-20260424-095941-image-1.png`

单图改图：

- 响应：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gemini-edit-20260424-100044-response.json`
- 图片：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gemini-edit-20260424-100044-image-1.png`

### TAL `gemini-3-pro-image`

文生图：

- 响应：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gemini-generate-20260424-100508-response.json`
- 图片：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gemini-generate-20260424-100508-image-1.png`

4K 文生图：

- 响应：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gemini-generate-20260424-100640-response.json`
- 图片：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gemini-generate-20260424-100640-image-1.png`

单图改图：

- 响应：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gemini-edit-20260424-100718-response.json`
- 图片：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gemini-edit-20260424-100718-image-1.png`

## 4. 已拿到的失败样本

TAL `gpt-image-2` 文生图曾出现过 500：

- `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gpt-image-2-generate-20260423-180346-response.json`

这个样本对后续错误归一化有用，建议不要删。

## 5. 返回体结构观察

### 5.1 TAL `gpt-image-2`

成功返回体关键特征：

- 顶层不是 `choices[]`
- 图片在：
  - `body.data[0].b64_json`
- 还有这些字段：
  - `output_format`
  - `quality`
  - `size`
  - `usage.input_tokens`
  - `usage.output_tokens`

成功样本里的图片尺寸：

- 文生图：`1024 x 1536`
- 双图改图：`1536 x 1024`

### 5.2 TAL `gemini-3.1-flash-image`

成功返回体关键特征：

- `object = "chat.completion"`
- 图片在：
  - `body.choices[0].message.images[0].image_url.url`
- 这里的 `url` 实际上是：
  - `data:image/png;base64,...`
- 还可能返回：
  - `message.content`
  - `message.reasoning_content`

成功样本里的图片尺寸：

- 文生图：`1200 x 896`
- 单图改图：`768 x 1382`

服务端返回的模型名是：

- `gemini-3-1-flash-image`

注意它和请求里使用的：

- `gemini-3.1-flash-image`

格式不完全一致，后续不要用“请求模型名必须等于响应模型名字符串”做强校验。

### 5.3 TAL `gemini-3-pro-image`

成功返回体结构与 `flash-image` 同族：

- 仍然是 `chat.completion`
- 图片仍然在：
  - `choices[0].message.images[0].image_url.url`
- 仍然会带：
  - `reasoning_content`
  - `usage.prompt_tokens`
  - `usage.completion_tokens`

成功样本里的图片尺寸：

- 文生图：`1408 x 768`
- 4K 文生图：`5632 x 3072`
- 单图改图：`768 x 1392`

这说明：

- `imageSize = 4K` 至少在当前样本里是生效的
- 返回体里不直接给最终像素尺寸，需要从图片文件或后处理阶段读取

## 6. 已知真实差异

### `gpt-image-2` vs `gemini`

- `gpt-image-2`
  - 图片在 `b64_json`
  - 更像专门的图像生成接口
  - 有明确的 `output_format / quality / size`
- `gemini`
  - 图片在 `message.images[].image_url.url`
  - 更像聊天补全接口
  - 可能同时返回文本说明和推理内容
  - usage 字段命名也不同

### `flash-image` vs `pro-image`

在本次成功样本里：

- 两者返回结构基本一致
- `pro-image` 支持的 4K 请求已经实测拿到高分辨率结果
- 当前还没有看到必须为 `pro-image` 单独发明完全不同解析器的证据

更合理的实现方式是：

- 共用 Gemini 基础解析逻辑
- 在 provider registry 里保留两个独立 provider 名

## 7. 已知限制和待补样本

本轮还没有拿到这些样本：

- TAL `gemini` 的 `stream=true` 原始流式返回
- TAL `gemini` 的失败返回体
- TAL `gpt-image-2` 的单图改图成功样本
- TAL `gpt-image-2` 的非 200 鉴权失败样本

另外，`gemini` 单图改图成功返回里明确提到：

- 小字和密集表格中的文字可能出现乱码

这对教研场景很重要，后续接入文档和 UI 提示里建议保留这一条“已知限制”。

## 8. 对接 `lesson-image-studio` 的直接建议

下一阶段开发时，至少要把这些事实写死在 adapter 层：

- 不同 provider 的图片结果字段位置不同
- 不同 provider 的 usage 字段名字不同
- Gemini 类 provider 可能返回图片 + 文本 + reasoning
- `x-request-id` 和 `traceid` 都值得保留到任务元数据里
- 图片的最终 `width / height` 不应完全依赖 provider 返回体，必要时要从落盘后的图片文件读取

## 9. 文档使用建议

后续接力开发时，建议同时打开：

1. `docs/PROVIDER_ADAPTER_SPEC.md`
2. 本文档
3. `tal-image-smoke-tests/outputs/` 里的真实样本

不要只看 curl 示例就开始写 adapter。
