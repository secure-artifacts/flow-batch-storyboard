# 安全审核就绪报告

## 本地已完成

| 规范要求 | 项目落实 | 状态 |
|---|---|---|
| 审核类型为浏览器扩展 | 根目录包含 Manifest V3、`content_scripts`、`background`、`action` | 通过 |
| 自动化 CI | `.github/workflows/release.yml` | 通过 |
| Tag 触发发布 | 仅 `push.tags: v*` | 通过 |
| OIDC / Release / Attestation 权限 | 三项权限均在 build job 中 | 通过 |
| 最终产物 Attestation | `subject-path: 'release/*.zip'` | 通过 |
| Bot 上传 Release | `softprops/action-gh-release@v2` 使用默认 GitHub Token | 通过 |
| Release ZIP 根含 Manifest | 构建 staging 和本地 ZIP 已检查 | 通过 |
| JavaScript 语法 | 23 个 JavaScript/MJS 文件 | 通过 |
| 多输出回归 | 2、3、4 输出 | 通过 |
| 常见密钥和私人绝对路径 | 本地预检 | 通过 |
| 个人断点和媒体文件 | 仓库检查 | 未发现 |

## 必须由提交者在 GitHub 完成

| 外部步骤 | 当前状态 |
|---|---|
| 使用真实 GitHub 账号申请加入 `secure-artifacts` | 未执行 |
| 接受组织邀请 | 未执行 |
| 创建或转移公开仓库 | 未执行 |
| 设置仓库 description | 未执行 |
| 推送代码 | 未执行 |
| 推送 `v2.3.26` 标签并运行 GitHub Actions | 未执行 |
| 在 GitHub Release 验证 uploader 和 Attestation | 未执行 |
| 提交安全审核表单和真实开发者名称 | 未执行 |

## 重要限制

本地检查不能代替平台审核，也不能提前证明 GitHub L2 Attestation 已通过。只有代码推送到目标公开仓库、由标签触发 GitHub-hosted runner 构建、由 `github-actions[bot]` 上传最终资产后，平台才能完成来源、构建器、上传者和标签引用的交叉校验。

