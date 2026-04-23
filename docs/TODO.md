# TODO / Backlog

## P1

- 新增正式 `SettingsPage`
- 建立后端本地设置持久化
- 提供设置接口：
  - `GET /api/settings`
  - `PUT /api/settings`
  - `PUT /api/settings/openai-key`
  - `DELETE /api/settings/openai-key`
- 建立 `light / dark` 两套主题 token 底座
- 让默认质量、默认尺寸、默认导出格式从设置回填到前端入口

## P2

- 重做 `OwnerOverviewPage` 的视觉和卡片结构
- 重做 `ImageEditorPage` 的精细交互与主题适配
- 做前端按路由拆包，解决当前 `build` 的大 chunk 警告
- 补更完整的前端测试覆盖

## P3

- 把图片项排序从“上移/下移”升级成拖拽排序
- 给版本轨加入更明确的来源类型徽标和当前定稿标记
- 给 utility drawer 加键盘可达性和焦点管理
- 接真实发布适配层
