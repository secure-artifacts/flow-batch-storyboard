# 安装说明

## 环境要求

- Chrome/Chromium：Chrome 116 或更高版本。
- Firefox：桌面版 Firefox 140 或更高版本。
- 已登录且可以正常使用 Google Labs Flow。

## Chrome

1. 解压 Chrome 安装包。
2. 打开 `chrome://extensions/`。
3. 开启开发者模式。
4. 点击“加载已解压的扩展程序”。
5. 选择包含 `manifest.json` 的目录。
6. 刷新已经打开的 Flow 页面。

更新版本时，替换整个扩展目录，然后在扩展管理页点击“重新加载”，最后刷新 Flow 页面。不要只覆盖单个 `index.js`，否则可能造成版本文件不一致。

## Firefox 临时安装

1. 打开 `about:debugging`。
2. 点击“此 Firefox”。
3. 移除旧的临时版本。
4. 点击“临时载入附加组件”。
5. 选择解压目录中的 `manifest.json`，或选择 ZIP/XPI。
6. 确认扩展显示图标且后台脚本为运行状态。
7. 刷新 Flow 页面。

Firefox 正式版的长期安装通常需要 Mozilla 签名。未签名 XPI 主要用于开发、测试或允许关闭签名验证的 Firefox 版本。

## 安装后检查

- 扩展版本应为 2.3.26。
- Flow 页面能够看到“分镜批量”入口。
- 扩展具有 `labs.google` 的站点访问权限。
- 浏览器允许多个文件下载。
- Windows 下载目录有足够空间。

## 常见安装问题

### Firefox 没有图标或页面没有入口

- 确认载入的是包根目录的 `manifest.json`。
- 不要使用包含反斜杠 ZIP 条目的旧包；正式包应由 Tag 触发的 GitHub Actions 生成，本地测试可运行 `tools/package-local.ps1`。
- 在 `about:debugging` 中移除旧版本后重新载入，并刷新 Flow。

### 更新后仍显示旧行为

- 检查扩展版本号。
- 重新加载扩展。
- 关闭旧 Flow 标签页并重新打开。
- Firefox 临时扩展应先移除旧实例，再载入新实例。
