# Cosii 微信小程序（UI 壳）

实现规格：[docs/designs/miniprogram-ui-shell-spec.md](../docs/designs/miniprogram-ui-shell-spec.md)  
视觉真源：仓库根目录 [DESIGN.md](../DESIGN.md)

## 本地开发

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. **导入项目**，目录选本仓库下的 `miniprogram`（或选仓库根后在 `project.config.json` 中配置 `miniprogramRoot`，当前配置为在 `miniprogram` 内打开即可）。
3. **详情 → 本地设置**：勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」，以便请求 `http://127.0.0.1:3000` 的后端。
4. 启动后端：`npm run dev`（默认 `PORT=3000`）。
5. （可选）在 `miniprogram` 目录执行 `npm install`，仅用于编辑器里的 `miniprogram-api-typings` 提示；**运行时逻辑为 `.js`，不依赖 TS 编译**。

## 配置

- API 基址与开发用户：`app.js` → `globalData.apiBase`、`globalData.devUserId`（对应后端 `X-User-Id`，见根目录 [CLAUDE.md](../CLAUDE.md)）。
- 首页会请求 `GET /health` 演示 envelope 解析；成功时展示 `trace_id`（可选复制）。

## Tab 图标

`images/tab/inactive.png` / `active.png` 为占位图，上线前请替换为 81×81 左右的品牌图标。

## AppID

`project.config.json` 中默认为 `touristappid`；正式发布请改为你的小程序 AppID。
