import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { openTestDb, seedSlot, seedTradeItemWithId, seedUsers } from "./helpers.js";

describe("P1 backend: filters, profile, trade items", () => {
  it("filters unified orders by order_type and status", async () => {
    const db = openTestDb();
    const { buyer, seller, artist } = seedUsers(db);
    const slotId = seedSlot(db, artist);
    seedTradeItemWithId(db, seller, "item_trade_filter");
    const app = buildApp(db);

    const tradeRes = await app.inject({
      method: "POST",
      url: "/v1/trade/orders",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { item_id: "item_trade_filter" },
    });
    expect(tradeRes.statusCode).toBe(200);

    const bookingRes = await app.inject({
      method: "POST",
      url: "/v1/booking/orders",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { slot_id: slotId, deposit_amount: 2000, final_amount: 5000 },
    });
    expect(bookingRes.statusCode).toBe(200);

    const onlyTrade = await app.inject({
      method: "GET",
      url: "/v1/me/unified-orders?order_type=trade",
      headers: { "x-user-id": buyer },
    });
    expect(onlyTrade.statusCode).toBe(200);
    const tj = onlyTrade.json() as { data: { items: Array<{ order_type: string }> } };
    expect(tj.data.items.length).toBe(1);
    expect(tj.data.items[0].order_type).toBe("trade");

    const onlyService = await app.inject({
      method: "GET",
      url: "/v1/me/unified-orders?order_type=service",
      headers: { "x-user-id": buyer },
    });
    expect(onlyService.statusCode).toBe(200);
    const sj = onlyService.json() as { data: { items: Array<{ order_type: string; status: string }> } };
    expect(sj.data.items.length).toBe(1);
    expect(sj.data.items[0].order_type).toBe("service");
    expect(sj.data.items[0].status).toBe("SLOT_HELD");

    const byStatus = await app.inject({
      method: "GET",
      url: "/v1/me/unified-orders?status=PENDING_PAYMENT",
      headers: { "x-user-id": buyer },
    });
    expect(byStatus.statusCode).toBe(200);
    const st = byStatus.json() as { data: { items: Array<{ status: string }> } };
    expect(st.data.items.length).toBe(1);
    expect(st.data.items[0].status).toBe("PENDING_PAYMENT");
  });

  it("returns login state from /v1/me/profile", async () => {
    const db = openTestDb();
    const { buyer } = seedUsers(db);
    const app = buildApp(db);

    const loggedOut = await app.inject({
      method: "GET",
      url: "/v1/me/profile",
    });
    expect(loggedOut.statusCode).toBe(200);
    const outBody = loggedOut.json() as { data: { is_logged_in: boolean; profile: unknown } };
    expect(outBody.data.is_logged_in).toBe(false);
    expect(outBody.data.profile).toBeNull();

    const loggedIn = await app.inject({
      method: "GET",
      url: "/v1/me/profile",
      headers: { "x-user-id": buyer },
    });
    expect(loggedIn.statusCode).toBe(200);
    const inBody = loggedIn.json() as {
      data: {
        is_logged_in: boolean;
        profile: { user_id: string; role: string; nickname: string };
      };
    };
    expect(inBody.data.is_logged_in).toBe(true);
    expect(inBody.data.profile.user_id).toBe(buyer);
    expect(inBody.data.profile.role).toBe("buyer");
    expect(inBody.data.profile.nickname.length).toBeGreaterThan(2);
  });

  it("lists listed trade items with category and price filters", async () => {
    const db = openTestDb();
    const { seller } = seedUsers(db);
    const app = buildApp(db);

    const now = Date.now();
    db.prepare(
      `INSERT INTO trade_items (id, seller_id, title, category, price, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'LISTED', ?)`,
    ).run("item_wig_1", seller, "Wig A", "wig", 19900, now);
    db.prepare(
      `INSERT INTO trade_items (id, seller_id, title, category, price, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'LISTED', ?)`,
    ).run("item_props_1", seller, "Prop A", "props", 9900, now - 1);
    db.prepare(
      `INSERT INTO trade_items (id, seller_id, title, category, price, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'RESERVED', ?)`,
    ).run("item_reserved", seller, "Reserved", "wig", 10000, now - 2);

    const all = await app.inject({
      method: "GET",
      url: "/v1/trade/items?limit=10",
    });
    expect(all.statusCode).toBe(200);
    const allBody = all.json() as { data: { items: Array<{ item_id: string }> } };
    expect(allBody.data.items.map((x) => x.item_id)).toEqual(["item_wig_1", "item_props_1"]);

    const wigOnly = await app.inject({
      method: "GET",
      url: "/v1/trade/items?category=wig&limit=10",
    });
    expect(wigOnly.statusCode).toBe(200);
    const wigBody = wigOnly.json() as { data: { items: Array<{ item_id: string; category: string }> } };
    expect(wigBody.data.items.length).toBe(1);
    expect(wigBody.data.items[0].item_id).toBe("item_wig_1");
    expect(wigBody.data.items[0].category).toBe("wig");

    const cheapOnly = await app.inject({
      method: "GET",
      url: "/v1/trade/items?price_max=10000&limit=10",
    });
    expect(cheapOnly.statusCode).toBe(200);
    const cheap = cheapOnly.json() as { data: { items: Array<{ item_id: string }> } };
    expect(cheap.data.items.length).toBe(1);
    expect(cheap.data.items[0].item_id).toBe("item_props_1");
  });
});

