/**
 * P2 小程序自动化：不依赖微信开发者工具；校验消息页数据源与通知 API 契约。
 * - 静态：inbox 必须请求 /v1/me/notifications
 * - 动态：内存库写入一条通知后 GET 列表与用户隔离
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildApp } from "../src/app.js";
import { insertUserNotification } from "../src/modules/notification/service.js";
import { openTestDb, seedUsers } from "../tests/helpers.js";

const appPath = join(process.cwd(), "miniprogram", "app.js");
const appSrc = readFileSync(appPath, "utf8");
if (!appSrc.includes("/v1/auth/wechat-login")) {
  console.error("miniprogram-smoke: app.js must call POST /v1/auth/wechat-login for WeChat session");
  process.exit(1);
}

const inboxPath = join(process.cwd(), "miniprogram", "pages", "inbox", "inbox.js");
const inboxSrc = readFileSync(inboxPath, "utf8");
if (!inboxSrc.includes("/v1/me/notifications")) {
  console.error("miniprogram-smoke: inbox.js must call GET /v1/me/notifications");
  process.exit(1);
}

const ordersPath = join(process.cwd(), "miniprogram", "pages", "orders", "orders.js");
const ordersSrc = readFileSync(ordersPath, "utf8");
if (!ordersSrc.includes("order_type=") || !ordersSrc.includes("status=")) {
  console.error("miniprogram-smoke: orders.js buildOrdersPath must pass order_type and status query params");
  process.exit(1);
}

const publishItemPath = join(process.cwd(), "miniprogram", "packageTrade", "pages", "publish-item", "publish-item.js");
const publishItemSrc = readFileSync(publishItemPath, "utf8");
if (!publishItemSrc.includes("/v1/trade/items")) {
  console.error("miniprogram-smoke: publish-item.js must POST /v1/trade/items");
  process.exit(1);
}

const db = openTestDb();
const { buyer, seller } = seedUsers(db);
insertUserNotification(db, {
  userId: buyer,
  eventType: "smoke",
  title: "冒烟检查",
  subtitle: "子标题",
});

const app = buildApp(db);
const rBuyer = await app.inject({
  method: "GET",
  url: "/v1/me/notifications?limit=10",
  headers: { "x-user-id": buyer },
});
if (rBuyer.statusCode !== 200) {
  console.error("miniprogram-smoke: buyer list failed", rBuyer.statusCode, rBuyer.body);
  process.exit(1);
}
const j = rBuyer.json() as { data: { items: unknown[] } };
if (!Array.isArray(j.data?.items) || j.data.items.length < 1) {
  console.error("miniprogram-smoke: expected at least one notification for buyer");
  process.exit(1);
}

const rSeller = await app.inject({
  method: "GET",
  url: "/v1/me/notifications",
  headers: { "x-user-id": seller },
});
const j2 = rSeller.json() as { data: { items: unknown[] } };
if (j2.data.items.length !== 0) {
  console.error("miniprogram-smoke: seller should have zero notifications");
  process.exit(1);
}

console.log("miniprogram-smoke: ok");
