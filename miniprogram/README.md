# Cosii 微信小程序（UI 壳）

实现规格：[docs/designs/miniprogram-ui-shell-spec.md](../docs/designs/miniprogram-ui-shell-spec.md)  
视觉真源：仓库根目录 [DESIGN.md](../DESIGN.md)

## 本地开发

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. **导入项目**，目录选本仓库下的 `miniprogram`（或选仓库根后在 `project.config.json` 中配置 `miniprogramRoot`，当前配置为在 `miniprogram` 内打开即可）。
3. **详情 → 本地设置**：勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」，以便请求 `http://127.0.0.1:3000` 的后端。
4. 启动后端：`npm run dev`（默认 `PORT=3000`）。
5. （可选）在 `miniprogram` 目录执行 `npm install`，用于 `miniprogram-api-typings`。页面逻辑使用 **`*.js`**（如 `pages/home/home.js`），便于预览时工具直接解析；勿只保留 `home.ts` 而无同路径 `home.js`，否则会报「找不到 home.js」。

## 配置

- **第一次上预发/生产、真机联调：** 请看 [生产环境变量与真机联调（小白版）](../docs/tutorials/生产环境变量与真机联调（小白版）.md)。
- API 基址与开发用户：`app.js` → `globalData.apiBase`、`globalData.devUserId`（无 Bearer 时对应后端 `X-User-Id`，见 [CLAUDE.md](../CLAUDE.md)）。
- `globalData.useWeChatSession`：为 `true` 时启动后 `wx.login` 并请求 `POST /v1/auth/wechat-login`，写入本地 Bearer；**生产应开启**，并保证后端已配 `WECHAT_APPID` / `WECHAT_SECRET` 与生产鉴权模式。
- `globalData.showDevProbe`：为 `false` 时隐藏首页底部探活 trace 条（自定义导航首页底部区域）。
- `globalData.useMockOrders`：为 `true` 时订单 Tab 使用本地假数据（勿用于正式发布）。
- 首页会请求 `GET /health` 演示 envelope 解析；成功时展示 `trace_id`（可选复制）。

## 分包与路由

- `config/routes.js`：在售列表、订单详情、约妆/内容入口等路径常量。
- **trade**：`packageTrade/` — 在售占位列表、统一订单详情（深链 `order-detail`）。
- **booking / content**：`packageBooking/`、`packageContent/` — 入口占位页。
- 订单列表：`GET /v1/me/unified-orders`；详情按类型请求 `GET /v1/booking/orders/:id` 或 `GET /v1/trade/orders/:id`。

## Tab 图标

`images/tab/inactive.png` / `active.png` 为占位图，上线前请替换为 81×81 左右的品牌图标。

## AppID

`project.config.json` 中默认为 `touristappid`；正式发布请改为你的小程序 AppID。
