import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { openTestDb, seedUsers } from "./helpers.js";

describe("GET /v1/trade/items/:itemId", () => {
  it("returns listed item with available true", async () => {
    const db = openTestDb();
    const { seller } = seedUsers(db);
    const app = buildApp(db);
    const create = await app.inject({
      method: "POST",
      url: "/v1/trade/items",
      headers: { "x-user-id": seller, "content-type": "application/json" },
      payload: { title: "Listed Wig", category: "wig", price_cents: 1200 },
    });
    expect(create.statusCode).toBe(200);
    const itemId = (create.json() as { data: { item_id: string } }).data.item_id;

    const res = await app.inject({
      method: "GET",
      url: `/v1/trade/items/${encodeURIComponent(itemId)}`,
    });
    expect(res.statusCode).toBe(200);
    const j = res.json() as {
      data: { item_id: string; title: string; category: string; price_cents: number; available: boolean };
    };
    expect(j.data.item_id).toBe(itemId);
    expect(j.data.title).toBe("Listed Wig");
    expect(j.data.available).toBe(true);
  });

  it("returns 404 for unknown id", async () => {
    const db = openTestDb();
    seedUsers(db);
    const app = buildApp(db);
    const res = await app.inject({
      method: "GET",
      url: "/v1/trade/items/00000000-0000-0000-0000-000000000000",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns available false when item is reserved", async () => {
    const db = openTestDb();
    const { buyer, seller } = seedUsers(db);
    const app = buildApp(db);
    const create = await app.inject({
      method: "POST",
      url: "/v1/trade/items",
      headers: { "x-user-id": seller, "content-type": "application/json" },
      payload: { title: "Reserved", category: "props", price_cents: 500 },
    });
    const itemId = (create.json() as { data: { item_id: string } }).data.item_id;
    await app.inject({
      method: "POST",
      url: "/v1/trade/orders",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { item_id: itemId },
    });

    const res = await app.inject({
      method: "GET",
      url: `/v1/trade/items/${encodeURIComponent(itemId)}`,
    });
    expect(res.statusCode).toBe(200);
    const j = res.json() as { data: { available: boolean } };
    expect(j.data.available).toBe(false);
  });
});
