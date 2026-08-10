# secure-artifacts 提交说明

本仓库已按“浏览器扩展”审核类型整理。提交者仍需完成 GitHub 组织和身份相关步骤。

## 建议的项目信息

- 审核类型：`浏览器扩展`
- 建议仓库名：`flow-batch-storyboard`
- 项目名称：`Flow 批量生成 · 分镜表`
- 建议 GitHub description：`Google Labs Flow storyboard batch-generation extension for Chromium and Firefox, with checkpoint recovery and multi-output downloads.`
- GitHub 项目 URL：`https://github.com/secure-artifacts/flow-batch-storyboard`
- 开发者名称：`<提交时填写真实姓名>`

平台会从 GitHub 仓库的 description 自动读取项目描述，因此创建仓库后应设置上面的 description 或等价描述。

## 提交前

1. 确认项目不包含内部业务、内部地址、客户信息、真实数据、账号、Cookie、密钥或令牌。
2. 确认拥有原扩展和捆绑第三方代码的公开分发权限。
3. 将本目录作为 Git 仓库根目录；根目录的 `manifest.json` 用于识别浏览器扩展。
4. 如需展示个人或团队名称，把两个 Manifest 的通用作者字段替换为真实、可公开的名称。
5. 在本地运行：

   ```bash
   npm ci
   npm test
   npm run build
   ```

6. 设置 GitHub 仓库 description。
7. 不要提交 `build/`、`release/`、个人断点或媒体文件。

## 加入组织与上传

1. 在平台选择“申请加入组织”，填写 GitHub 用户名/主页和真实开发者名称。
2. 接受 `secure-artifacts` GitHub 组织邀请。
3. 把项目 Fork 或转移到 `secure-artifacts`。
4. 仓库必须公开；涉及内部信息时不得使用此流程。

## 首次 Release

推送代码后通过标签触发 CI：

```bash
git tag -a v2.3.26 -m "Release v2.3.26"
git push origin v2.3.26
```

确认 Actions 成功后检查：

- Release 包含 Chromium 和 Firefox 两个 ZIP。
- 每个 ZIP 解压后根目录直接包含 `manifest.json`。
- 所有 Release asset 的 uploader 都是 `github-actions[bot]`。
- 每个 asset 都有 Attestation。
- 工作流来源是 `refs/tags/v2.3.26`。
- 不要人工上传、替换或补充 Release asset。

## 提交审核表单

1. 选择“提交项目审核”。
2. 审核类型选择“浏览器扩展”。
3. 项目 URL 必须以 `https://github.com/secure-artifacts/` 开头。
4. 填写项目名称和真实开发者名称。
5. 项目描述无需在表单手填，由仓库 description 同步。

官方规范：

- https://tpscsm-docs.pages.dev/developer/submit-project.html
- https://tpscsm-docs.pages.dev/developer/ci-setup.html
- https://tpscsm-docs.pages.dev/developer/attestation.html
- https://tpscsm-docs.pages.dev/developer/workflow-example.html#浏览器扩展项目示例
- https://tpscsm-docs.pages.dev/developer/release-process.html
- https://tpscsm-docs.pages.dev/developer/internal-info-notice.html
