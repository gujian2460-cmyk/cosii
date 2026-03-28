import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { openTestDb, seedTradeItem, seedUsers } from "./helpers.js";

describe("GET /v1/me/unified-orders", () => {
  it("returns 401 without X-User-Id", async () => {
    const db = openTestDb();
    const app = buildApp(db);
    const res = await app.inject({ method: "GET", url: "/v1/me/unified-orders" });
    expect(res.statusCode).toBe(401);
  });

  it("lists trade orders for buyer and supports cursor", async () => {
    const db = openTestDb();
    const { buyer, seller } = seedUsers(db);
    const itemId = seedTradeItem(db, seller);
    const app = buildApp(db);

    const create = await app.inject({
      method: "POST",
      url: "/v1/trade/orders",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { item_id: itemId },
    });
    expect(create.statusCode).toBe(200);
    const body = create.json() as { data: { trade_order_id: string; unified_order_id: string } };

    const list1 = await app.inject({
      method: "GET",
      url: "/v1/me/unified-orders?limit=10",
      headers: { "x-user-id": buyer },
    });
    expect(list1.statusCode).toBe(200);
    const j1 = list1.json() as {
      data: { items: Array<{ unified_order_id: string; title: string; order_type: string }> };
    };
    expect(j1.data.items.length).toBe(1);
    expect(j1.data.items[0].unified_order_id).toBe(body.data.unified_order_id);
    expect(j1.data.items[0].order_type).toBe("trade");
    expect(j1.data.items[0].title).toBe("Wig");

    const listSeller = await app.inject({
      method: "GET",
      url: "/v1/me/unified-orders",
      headers: { "x-user-id": seller },
    });
    expect(listSeller.statusCode).toBe(200);
    const jS = listSeller.json() as { data: { items: unknown[] } };
    expect(jS.data.items.length).toBe(1);

    const u = j1.data.items[0].unified_order_id;
    const one = await app.inject({
      method: "GET",
      url: `/v1/me/unified-orders/${u}`,
      headers: { "x-user-id": buyer },
    });
    expect(one.statusCode).toBe(200);
    const jo = one.json() as { data: { unified_order_id: string } };
    expect(jo.data.unified_order_id).toBe(u);

    const tradeDetail = await app.inject({
      method: "GET",
      url: `/v1/trade/orders/${body.data.trade_order_id}`,
      headers: { "x-user-id": buyer },
    });
    expect(tradeDetail.statusCode).toBe(200);
    const td = tradeDetail.json() as { data: { item_title: string; unified_order_id: string } };
    expect(td.data.item_title).toBe("Wig");
    expect(td.data.unified_order_id).toBe(u);
  });

  it("returns 404 for unified order not visible to user", async () => {
    const db = openTestDb();
    const { buyer, seller } = seedUsers(db);
    seedTradeItem(db, seller);
    const app = buildApp(db);

    const create = await app.inject({
      method: "POST",
      url: "/v1/trade/orders",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { item_id: "item_1" },
    });
    expect(create.statusCode).toBe(200);
    const unifiedId = (create.json() as { data: { unified_order_id: string } }).data.unified_order_id;

    const other = await app.inject({
      method: "GET",
      url: `/v1/me/unified-orders/${unifiedId}`,
      headers: { "x-user-id": "usr_artist_1" },
    });
    expect(other.statusCode).toBe(404);
  });
});
