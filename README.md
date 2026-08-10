# Flow 批量生成 · 分镜表

[![Release](https://img.shields.io/badge/release-v2.3.26-blue)](https://github.com/secure-artifacts/flow-batch-storyboard/releases)
[![Browser Extension](https://img.shields.io/badge/type-browser%20extension-green)](#安装)

用于 Google Labs Flow 的分镜表批量生成浏览器扩展，支持 Chromium 与 Firefox。项目根目录是可直接加载的 Chromium 扩展；Firefox 版本位于 `firefox/`。

## 功能

- 按分镜表批量匹配素材图、首帧图和尾帧图。
- 素材模式与帧模式。
- 1～4 个视频输出的真实任务跟踪、结算和命名下载。
- 生成间隔、并发上限、失败补跑和三分钟卡住保护。
- 本地 JSON 断点保存、校验、恢复和旧版本数据迁移。
- Chrome 标签页/系统唤醒保护与 Firefox 兼容桥。

## 仓库结构

```text
.
├── manifest.json                 # Chromium Manifest；审核系统从根目录识别扩展
├── assets/                       # Chromium 后台脚本、加载器和图标
├── injects/                      # 主界面和样式
├── transformers/                 # Flow 页面桥和防冻结逻辑
├── offscreen.html / offscreen.js # Chromium 大断点 Blob 下载
├── firefox/                      # Firefox 完整扩展根目录
├── tests/                        # 2/3/4 输出回归测试
├── tools/                        # 仓库验证、密钥预检和发布准备
├── docs/                         # 安装、使用、断点与维护说明
└── .github/workflows/release.yml # Tag 触发、Attestation、GitHub Release
```

## 本地验证

要求 Node.js 20 或更高版本：

```bash
npm ci
npm test
npm run build
```

`npm test` 会检查两个 Manifest、全部 JavaScript 语法、关键修复、隐私文件、常见密钥模式，以及 2、3、4 个输出的回归行为。

## 安装

### Chromium

1. 从 [Releases](https://github.com/secure-artifacts/flow-batch-storyboard/releases) 下载带 `-chrome.zip` 的文件。
2. 解压到稳定目录。
3. 打开 `chrome://extensions/` 并开启开发者模式。
4. 点击“加载已解压的扩展程序”，选择解压目录。

也可以在开发阶段直接把本仓库根目录加载为扩展。

### Firefox

1. 从 [Releases](https://github.com/secure-artifacts/flow-batch-storyboard/releases) 下载带 `-firefox.zip` 的文件。
2. 打开 `about:debugging` → “此 Firefox”。
3. 点击“临时载入附加组件”，选择 ZIP 或解压后的 `manifest.json`。

Firefox 正式版长期安装通常需要 Mozilla 签名。

## 发布

Release 只能由 GitHub Actions 通过 `v*` 标签创建：

```bash
git tag -a v2.3.26 -m "Release v2.3.26"
git push origin v2.3.26
```

工作流会测试项目、生成 Chromium/Firefox ZIP、为最终 ZIP 生成 GitHub Artifact Attestation，并由 `github-actions[bot]` 上传 Release。请勿在 GitHub 网页中人工添加或替换 Release 文件。

### 如何发布新版本

每次发布前，先把代码提交到 `main`：

```bash
git status
git add .
git commit -m "说明本次改动"
git push origin main
```

然后创建并推送以 `v` 开头的版本标签（将示例版本号替换为实际版本）：

```bash
git tag -a v2.3.27 -m "Release version 2.3.27"
git push origin v2.3.27
```

标签推送后，前往 GitHub 仓库的 **Actions** 页面查看构建进度；成功后在 **Releases** 页面下载 Chrome 或 Firefox ZIP。若构建失败，修复代码或工作流后删除失败标签并重新创建：

```bash
git tag -d v2.3.27
git push origin :refs/tags/v2.3.27
```

## 验证发布来源

安装 GitHub CLI 后可验证下载文件：

```bash
gh attestation verify flow-batch-storyboard-v2.3.26-chrome.zip --repo secure-artifacts/flow-batch-storyboard
```

## 安全与隐私

- 仓库不得包含个人断点、图片、视频、Cookie、令牌或内部信息。
- 扩展使用当前 Flow 页面登录状态，但源码中不应硬编码账号或凭据。
- 安全问题请通过 GitHub 仓库的 Private vulnerability reporting 报告，参见 [SECURITY.md](SECURITY.md)。
- 本项目不隶属于 Google，Flow 页面或接口更新可能导致扩展需要适配。

## 源码形态与授权

当前主体是可部署、可修改的构建后 JavaScript，不包含原始 TypeScript/React 工程或 source map。详情见 [SOURCE-NOTICE.md](SOURCE-NOTICE.md)。公开分发前还必须确认原项目和捆绑依赖的授权，参见 [LICENSE-NOTICE.md](LICENSE-NOTICE.md) 与 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

## 审核提交

面向 `secure-artifacts` 的仓库准备和表单字段见 [SUBMISSION.md](SUBMISSION.md)，本地检查与仍需人工完成的外部步骤见 [审核就绪报告](docs/AUDIT-READINESS.md)。
