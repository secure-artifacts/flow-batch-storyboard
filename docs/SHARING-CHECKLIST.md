# 公开审核提交检查单

- [ ] 已确认拥有原扩展和全部捆绑依赖的公开分发权限。
- [ ] 已确认仓库中没有内部业务逻辑、内部地址、客户信息或内部项目代号。
- [ ] 已确认没有个人断点、图片、视频、Cookie、令牌或浏览器配置。
- [ ] 已填写真实的仓库 description 和提交者名称。
- [ ] 项目位于公开的 `secure-artifacts` 组织仓库。
- [ ] 项目根目录直接包含 Chromium `manifest.json`。
- [ ] 已运行 `npm ci && npm test && npm run build`。
- [ ] 已测试 1、2、3、4 个输出。
- [ ] `.github/workflows/release.yml` 只由 `v*` 标签触发正式发布。
- [ ] 工作流具有 `id-token: write`、`contents: write`、`attestations: write`。
- [ ] Attestation 指向最终 `release/*.zip`。
- [ ] Release 由 `github-actions[bot]` 上传，没有人工添加的 asset。
- [ ] Chromium 和 Firefox ZIP 解压后根目录都直接包含 `manifest.json`。
- [ ] 已用 `gh attestation verify` 验证 Release 文件。
- [ ] 审核类型选择“浏览器扩展”，仓库 URL 以 `https://github.com/secure-artifacts/` 开头。

涉及任何内部信息时，不得使用此公开审核流程。

