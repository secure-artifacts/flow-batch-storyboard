# 技术结构与维护说明

## 运行结构

1. Manifest 在 Flow 页面加载内容脚本。
2. `assets/index.ts-loader-DJMxT1XF.js` 加载扩展依赖和页面注入入口。
3. `injects/index.js` 提供批量表格、任务调度、状态结算、断点和下载控制。
4. `transformers/flow.js` 连接 Flow 页面状态、生成提交和网络响应。
5. `assets/background.ts-FwaP8xAx.js` 处理存储、下载、标签页保护和消息。
6. Chrome 的 `offscreen.html/offscreen.js` 为大断点创建 Blob URL，避免超长 `data:` URL 被拒绝。

## Chrome 与 Firefox 差异

- Chrome 使用 Manifest V3 Service Worker、`offscreen` 和 `power` 权限。
- Firefox 使用后台脚本兼容形式、安全消息桥和页面 Wake Lock。
- Firefox 包具有固定 Gecko 扩展 ID。
- Firefox ZIP 必须使用 `/` 作为包内路径分隔符。

## 任务状态

主要状态包括：

- `pending`
- `submitting`
- `generating`
- `downloading`
- `ready`
- `success`
- `partial_success`
- `failed`
- `validation_failed`
- `missing_image`
- `download_failed`
- `stopped`

## 多输出结算

每次提交保存 `expectedOutputs`（1～4）、`attempt` 和 `bindingKey`。Flow 可能逐个返回任务 ID，因此 `onSubmitSuccess` 只登记当前真实 ID，不再立即推断缺失数量。

每个结果事件按真实任务 ID 汇总：

- 成功结果去重后写入 `results`。
- 明确失败写入 `failedGenerationIds`。
- 成功数与失败数达到 `expectedOutputs` 后才结算并下载。
- 180 秒仍未结算时，缺失项写入 `__flow_stalled_...`，防止永久卡住。

## 关键维护位置

在根目录 Chromium 版本和 `firefox/` 版本的 `injects/index.js` 中搜索以下标记：

- `fbNormalizeRow`
- `fbRepairPrematureMissingOutputs`
- `fbEnsureGridDataVisible`
- `FB_GENERATION_HARD_LIMIT_MS`
- `fbFinalizeStalledGenerationRows`
- `fbSettleGenerationOutputs`
- `fbApplyCheckpoint`

Chrome 和 Firefox 的主逻辑应保持同步，只保留浏览器兼容桥的必要差异。

## 修改后的最低验证

1. 两个 `manifest.json` 能解析且版本一致。
2. 所有 JavaScript 通过 `node --check`。
3. Chrome 必须保留 `power` 和 `offscreen` 权限。
4. Firefox 必须保留 Gecko ID、图标和内容脚本桥。
5. 输出数量 1、2、3、4 分别测试。
6. 模拟任务 ID 分批返回，确认不会提前结算。
7. 测试成功、部分失败、全部失败、下载失败和三分钟超时。
8. 使用真实断点测试保存、恢复、图片重载和补下载。
