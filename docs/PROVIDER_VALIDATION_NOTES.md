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

TAL `gpt-image-2` 图改图在后续补测中也出现过多次失败：

- 非法尺寸：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gpt-image-2-edit-20260424-110359-response.json`
- 网关超时：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gpt-image-2-edit-20260424-110936-response.json`
- 服务端 500 波动：
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gpt-image-2-edit-20260424-111615-response.json`
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gpt-image-2-edit-20260424-112032-response.json`
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gpt-image-2-edit-20260424-112501-response.json`
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gpt-image-2-edit-20260424-112821-response.json`
  - `/Users/wang/Desktop/codexwork/AIimage/tal-image-smoke-tests/outputs/tal-gpt-image-2-edit-20260424-113206-response.json`

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
- 单图 mask 改图：`1536 x 1024`
- 单图 `size=1024x1536` 改图：`1024 x 1536`
- 单图 `quality=low` 改图：`1536 x 1024`
- 竖图 `quality=low` 改图：`1536 x 1024`
- 横图 `quality=high + tiny mask` 改图：`1536 x 1024`

补充结论：

- `mask` 已真实跑通，返回 `HTTP 200`
- `size` 已真实跑通，并且目标尺寸真的体现在响应体和落盘图片上
- `quality` 已真实跑通；`quality=low` 时，返回体里的 `quality` 也真实变成了 `low`
- 竖图和横图在“不传 `size`”的成功样本里都落到了 `1536x1024`

与产品设计最相关的一点：

- 输入图 `2.png` 的原始尺寸是 `935 x 1683`
- 但在“不传 `size`”的图改图请求里，TAL `gpt-image-2` 返回的是 `1536 x 1024`
- 这说明当前 TAL 兼容层不会自动保持原图规格
- 所以“auto / 不传 size”不能被理解成“沿用输入图尺寸”

进一步补测得到的倾向性结论：

- 输入竖图 `935x1683`，不传 `size`，成功样本返回 `1536x1024`
- 输入横图 `1683x935`，不传 `size`，成功样本同样返回 `1536x1024`
- 因此当前更倾向于把 `1536x1024` 视为 TAL `gpt-image-2` 图改图的默认输出尺寸
- 但由于同一时间段也出现过多次 `500`，这仍应记为“高置信度观察”，而不是“官方保证”

### 5.1.2 尺寸约束和归一化思路

对 TAL `gpt-image-2` 的图改图，本轮还验证到一个明确约束：

- 直接传 `size=935x1683` 会返回 `400`
- 错误信息明确指出：
  - 宽和高都必须是 `16` 的倍数

这说明：

- 不能直接把用户上传图的原始尺寸原样传给 provider
- 需要先做 size 归一化

当前推荐的归一化思路：

1. 读取原图尺寸
2. 如果最长边大于 `3840`，先按比例缩小到最长边 `= 3840`
3. 再把宽高修正到最接近的 `16` 的倍数
4. 把归一化后的结果显式传给 provider

例子：

- 原图：`935x1683`
- 推荐归一化：`928x1680`

需要注意：

- `928x1680` 这类归一化尺寸至少没有被 provider 立刻判成非法
- 但本轮该请求最终撞上了 `504 Gateway Time-out`
- 所以它说明“格式约束方向是对的”，不说明“该尺寸一定稳定”

### 5.1.1 mask 生成方法是否接近官方

本轮测试使用的是本地脚本 `make_alpha_mask.py` 自动生成的测试蒙版。

它的做法是：

- 输出格式：PNG
- 与输入图同尺寸
- 带 alpha 通道
- 外部区域 alpha=255
- 中心待编辑区域 alpha=0

这个方法与 OpenAI 官方文档描述的 mask 要求是一致方向的：

- image 和 mask 同尺寸同格式
- mask 需要 alpha channel

但还要注意两点：

1. 这只是“满足官方 mask 文件要求”，不是说模型一定会严格只改透明区域
2. OpenAI 官方文档本身也强调，GPT Image 的 mask 更像提示性引导，不保证完全按几何边界精确执行

因此：

- 这次尺寸变化**不是因为蒙版文件做错了**
- 更像是 TAL `gpt-image-2` 在“不传 `size`”时采用了自己的默认输出尺寸策略
- 从现有样本看，这个行为在普通单图改图里也存在，不是 mask 独有现象

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
  - `mask / size / quality` 都已实测可用
  - 但默认图改图不会自动保留输入图像素尺寸
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
- 对 TAL `gpt-image-2` 而言：
  - `mask / size / quality` 不能再按“不支持”处理
  - 但“默认保持原图规格”这件事不能依赖 provider 自动完成
  - 更合理的做法是：先做 size 归一化，再显式传入

## 9. 文档使用建议

后续接力开发时，建议同时打开：

1. `docs/PROVIDER_ADAPTER_SPEC.md`
2. 本文档
3. `tal-image-smoke-tests/outputs/` 里的真实样本

不要只看 curl 示例就开始写 adapter。
