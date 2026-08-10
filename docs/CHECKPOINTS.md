# 断点格式与恢复

## 文件格式

断点是 UTF-8 JSON 文件，主要字段包括：

- `format`：固定为 `flow-batch-storyboard-checkpoint`。
- `schemaVersion`：当前为 1。
- `pluginVersion`：导出断点的插件版本。
- `checkpointId`：断点唯一标识。
- `exportedAt` / `exportedAtLocal`：导出时间。
- `timeZone`：导出浏览器时区。
- `downloadFolder`：下载子目录。
- `settings`：批处理配置。
- `rows`：最多 500 条分镜记录。
- `checksum`：用于检测内容损坏或被错误修改。

## 行数据

每行通常包含：

- `id`、`rowNumber`
- `imageName`、`endImageName`
- `clipName`、`prompt`
- `mode`、`seconds`
- `status`、`message`
- `attempt`、`expectedOutputs`
- `generationIds`
- `successfulGenerationIds`、`failedGenerationIds`
- `results`
- `downloadedFiles`
- `successfulOutputs`、`failedOutputs`

断点不会嵌入图片二进制，`image` 和 `endImage` 会被清空；恢复后必须重新上传并匹配图片。

## 状态恢复规则

- `success`、`partial_success`：保留完成状态。
- `generating` 且已有结果：恢复为待下载，避免丢失视频。
- `generating` 且没有结果：旧运行任务无法继续跟踪时转为可继续处理状态。
- `downloading` 且已有结果：恢复为下载失败/待重新下载。

## v2.3.25 多输出修复

v2.3.25 曾在第一次任务 ID 回调后写入 `__flow_missing_...` 假失败标记。2.3.26 检测到以下条件时自动迁移：

1. 行内存在 `__flow_missing_` 标记。
2. `generationIds` 已经达到要求的输出数量。
3. 真实任务 ID 可用于重建结果地址。

迁移会保留原 `results` 顺序，把缺少的任务地址追加在后面。这样已下载的 `-1` 文件仍能正确跳过，只补下载后续文件。

## 安全提示

断点可能包含分镜文本、文件名和临时媒体地址。分享源码项目时不要把个人断点一起打包。媒体地址可能随登录状态或时间失效，但断点不应包含 Cookie 或登录令牌。

