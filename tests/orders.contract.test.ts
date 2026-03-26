import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { openTestDb, seedSlot, seedTradeItem, seedUsers } from "./helpers.js";

describe("Day1-2 API contract", () => {
  it("GET /health returns OK envelope", async () => {
    const db = openTestDb();
    const app = buildApp(db);
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { code: string; data: { ok: boolean }; trace_id: string };
    expect(body.code).toBe("OK");
    expect(body.data.ok).toBe(true);
    expect(typeof body.trace_id).toBe("string");
  });

  it("creates trade order with envelope + reserves item", async () => {
    const db = openTestDb();
    const { buyer, seller } = seedUsers(db);
    const itemId = seedTradeItem(db, seller);

    const app = buildApp(db);
    const res = await app.inject({
      method: "POST",
      url: "/v1/trade/orders",
      headers: {
        "x-user-id": buyer,
        "content-type": "application/json",
      },
      payload: { item_id: itemId },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      code: string;
      data: { trade_order_id: string; unified_order_id: string; status: string };
    };
    expect(body.code).toBe("OK");
    expect(body.data.status).toBe("PENDING_PAYMENT");

    const item = db.prepare(`SELECT status FROM trade_items WHERE id = ?`).get(itemId) as { status: string };
    expect(item.status).toBe("RESERVED");
  });

  it("rejects self-purchase", async () => {
    const db = openTestDb();
    const { seller } = seedUsers(db);
    const itemId = seedTradeItem(db, seller);

    const app = buildApp(db);
    const res = await app.inject({
      method: "POST",
      url: "/v1/trade/orders",
      headers: {
        "x-user-id": seller,
        "content-type": "application/json",
      },
      payload: { item_id: itemId },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as { code: string; error?: { user_title?: string } };
    expect(body.code).toBe("BUSINESS_RULE_VIOLATION");
    expect(body.error?.user_title).toBeDefined();
  });

  it("replays idempotent trade order create", async () => {
    const db = openTestDb();
    const { buyer, seller } = seedUsers(db);
    const itemId = seedTradeItem(db, seller);

    const app = buildApp(db);
    const headers = {
      "x-user-id": buyer,
      "content-type": "application/json",
      "idempotency-key": "k_trade_1",
    };

    const first = await app.inject({
      method: "POST",
      url: "/v1/trade/orders",
      headers,
      payload: { item_id: itemId },
    });
    const second = await app.inject({
      method: "POST",
      url: "/v1/trade/orders",
      headers,
      payload: { item_id: itemId },
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const a = first.json() as { data: { trade_order_id: string } };
    const b = second.json() as { data: { trade_order_id: string } };
    expect(a.data.trade_order_id).toBe(b.data.trade_order_id);
  });

  it("flags idempotency conflict on payload mismatch", async () => {
    const db = openTestDb();
    const { buyer, seller } = seedUsers(db);
    const itemA = seedTradeItem(db, seller);
    const itemB = "item_2";
    db.prepare(
      `INSERT INTO trade_items (id, seller_id, title, category, price, status, created_at)
       VALUES (?, ?, 'Suit', 'suit', 29900, 'LISTED', ?)`,
    ).run(itemB, seller, Date.now());

    const app = buildApp(db);
    const headers = {
      "x-user-id": buyer,
      "content-type": "application/json",
      "idempotency-key": "k_conflict",
    };

    await app.inject({
      method: "POST",
      url: "/v1/trade/orders",
      headers,
      payload: { item_id: itemA },
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/trade/orders",
      headers,
      payload: { item_id: itemB },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json() as { code: string };
    expect(body.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("creates booking order and holds slot", async () => {
    const db = openTestDb();
    const { buyer, artist } = seedUsers(db);
    const slotId = seedSlot(db, artist);

    const app = buildApp(db);
    const res = await app.inject({
      method: "POST",
      url: "/v1/booking/orders",
      headers: {
        "x-user-id": buyer,
        "content-type": "application/json",
      },
      payload: { slot_id: slotId, deposit_amount: 5000, final_amount: 15000 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { code: string; data: { status: string } };
    expect(body.code).toBe("OK");
    expect(body.data.status).toBe("SLOT_HELD");

    const slot = db.prepare(`SELECT slot_status FROM artist_slots WHERE id = ?`).get(slotId) as {
      slot_status: string;
    };
    expect(slot.slot_status).toBe("HELD");
  });

  it("returns slot conflict on double booking", async () => {
    const db = openTestDb();
    const { buyer, artist } = seedUsers(db);
    const slotId = seedSlot(db, artist);

    const app = buildApp(db);
    await app.inject({
      method: "POST",
      url: "/v1/booking/orders",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { slot_id: slotId, deposit_amount: 5000, final_amount: 15000 },
    });

    const otherBuyer = "usr_buyer_2";
    db.prepare(
      `INSERT INTO users (id, wx_openid, role, status, created_at) VALUES (?, ?, 'buyer', 'active', ?)`,
    ).run(otherBuyer, `wx_${otherBuyer}`, Date.now());

    const res = await app.inject({
      method: "POST",
      url: "/v1/booking/orders",
      headers: { "x-user-id": otherBuyer, "content-type": "application/json" },
      payload: { slot_id: slotId, deposit_amount: 5000, final_amount: 15000 },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json() as { code: string };
    expect(body.code).toBe("BOOKING_SLOT_CONFLICT");
  });

  it("requires auth header", async () => {
    const db = openTestDb();
    seedUsers(db);
    const app = buildApp(db);

    const res = await app.inject({
      method: "POST",
      url: "/v1/trade/orders",
      headers: { "content-type": "application/json" },
      payload: { item_id: "missing" },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as { code: string };
    expect(body.code).toBe("AUTH_UNAUTHORIZED");
  });
});
