import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { openTestDb, seedUsers } from "./helpers.js";

describe("POST /v1/trade/items", () => {
  it("creates listing for seller", async () => {
    const db = openTestDb();
    const { seller } = seedUsers(db);
    const app = buildApp(db);
    const res = await app.inject({
      method: "POST",
      url: "/v1/trade/items",
      headers: { "x-user-id": seller, "content-type": "application/json" },
      payload: { title: "  Test Wig  ", category: "wig", price_cents: 9900 },
    });
    expect(res.statusCode).toBe(200);
    const j = res.json() as { data: { item_id: string } };
    expect(j.data.item_id).toBeTruthy();
    const row = db.prepare(`SELECT title, price, seller_id FROM trade_items WHERE id = ?`).get(j.data.item_id) as {
      title: string;
      price: number;
      seller_id: string;
    };
    expect(row.title).toBe("Test Wig");
    expect(row.price).toBe(9900);
    expect(row.seller_id).toBe(seller);
  });

  it("returns 401 without user", async () => {
    const db = openTestDb();
    seedUsers(db);
    const app = buildApp(db);
    const res = await app.inject({
      method: "POST",
      url: "/v1/trade/items",
      headers: { "content-type": "application/json" },
      payload: { title: "x", category: "wig", price_cents: 100 },
    });
    expect(res.statusCode).toBe(401);
  });
});
