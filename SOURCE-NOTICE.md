# 源码形态说明

这是浏览器可直接加载的完整扩展文件，属于可运行、可修改的“构建后源码”。

已提供 Chrome 和 Firefox 的 Manifest、后台脚本、内容加载器、注入脚本、样式、图标、验证测试和发布工作流。主逻辑位于根目录和 `firefox/` 下的 `injects/index.js`、`assets/background.ts-FwaP8xAx.js` 与 `transformers/flow.js`。

当前资料不包含原始 TypeScript/TSX、React 组件工程、原始构建配置、source map 或上游 Git 历史。主界面文件体积较大，部分变量名已由构建工具缩短。

本仓库的 `npm run build` 不重新编译 UI；它从已经验证的可部署源码中准备干净的 Chromium/Firefox 扩展根目录，供 CI 打包和 Attestation。

