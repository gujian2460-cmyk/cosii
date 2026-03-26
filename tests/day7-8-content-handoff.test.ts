import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { openTestDb, seedTradeItem, seedTradeItemWithId, seedUsers } from "./helpers.js";

async function payUnifiedOrder(
  app: ReturnType<typeof buildApp>,
  buyer: string,
  unified_order_id: string,
): Promise<void> {
  const payRes = await app.inject({
    method: "POST",
    url: "/v1/payments/create",
    headers: { "x-user-id": buyer, "content-type": "application/json" },
    payload: { unified_order_id },
  });
  expect(payRes.statusCode).toBe(200);
  const { payment_id, amount_cents } = (payRes.json() as { data: { payment_id: string; amount_cents: number } }).data;
  await app.inject({
    method: "POST",
    url: "/v1/payments/webhook/wechat",
    headers: { "content-type": "application/json" },
    payload: {
      out_trade_no: payment_id,
      transaction_id: `wx_${payment_id}`,
      amount_cents,
      trade_state: "SUCCESS",
    },
  });
}

describe("Day7-8 content + local handoff", () => {
  it("POST /v1/posts requires auth and validates body", async () => {
    const db = openTestDb();
    const app = buildApp(db);

    const noAuth = await app.inject({
      method: "POST",
      url: "/v1/posts",
      headers: { "content-type": "application/json" },
      payload: { image_url: "https://cdn.example.com/a.jpg" },
    });
    expect(noAuth.statusCode).toBe(401);

    seedUsers(db);
    const bad = await app.inject({
      method: "POST",
      url: "/v1/posts",
      headers: { "x-user-id": "usr_seller_1", "content-type": "application/json" },
      payload: { image_url: "" },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("creates post, card with CONTENT_CARD_TARGET_INVALID when target not owned or not listed", async () => {
    const db = openTestDb();
    const { buyer, seller } = seedUsers(db);
    const itemSeller = seedTradeItem(db, seller);
    seedTradeItemWithId(db, buyer, "item_buyer");
    const app = buildApp(db);

    const postRes = await app.inject({
      method: "POST",
      url: "/v1/posts",
      headers: { "x-user-id": seller, "content-type": "application/json" },
      payload: { image_url: "https://cdn.example.com/p1.jpg", caption: "look" },
    });
    expect(postRes.statusCode).toBe(200);
    const postId = (postRes.json() as { data: { post_id: string } }).data.post_id;

    const wrongOwner = await app.inject({
      method: "POST",
      url: `/v1/posts/${postId}/cards`,
      headers: { "x-user-id": seller, "content-type": "application/json" },
      payload: { card_type: "trade_item", target_id: "item_buyer" },
    });
    expect(wrongOwner.statusCode).toBe(400);
    expect((wrongOwner.json() as { code: string }).code).toBe("CONTENT_CARD_TARGET_INVALID");

    db.prepare(`UPDATE trade_items SET status = 'RESERVED' WHERE id = ?`).run(itemSeller);
    const notListed = await app.inject({
      method: "POST",
      url: `/v1/posts/${postId}/cards`,
      headers: { "x-user-id": seller, "content-type": "application/json" },
      payload: { card_type: "trade_item", target_id: itemSeller },
    });
    expect(notListed.statusCode).toBe(400);
    expect((notListed.json() as { code: string }).code).toBe("CONTENT_CARD_TARGET_INVALID");
  });

  it("GET /v1/posts/:id marks card unavailable after item reserved by order", async () => {
    const db = openTestDb();
    const { buyer, seller } = seedUsers(db);
    const itemId = seedTradeItem(db, seller);
    const app = buildApp(db);

    const postRes = await app.inject({
      method: "POST",
      url: "/v1/posts",
      headers: { "x-user-id": seller, "content-type": "application/json" },
      payload: { image_url: "https://cdn.example.com/p2.jpg" },
    });
    const postId = (postRes.json() as { data: { post_id: string } }).data.post_id;

    const cardRes = await app.inject({
      method: "POST",
      url: `/v1/posts/${postId}/cards`,
      headers: { "x-user-id": seller, "content-type": "application/json" },
      payload: { card_type: "trade_item", target_id: itemId },
    });
    expect(cardRes.statusCode).toBe(200);

    let getRes = await app.inject({ method: "GET", url: `/v1/posts/${postId}` });
    expect((getRes.json() as { data: { cards: Array<{ available: boolean }> } }).data.cards[0].available).toBe(true);

    await app.inject({
      method: "POST",
      url: "/v1/trade/orders",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { item_id: itemId },
    });

    getRes = await app.inject({ method: "GET", url: `/v1/posts/${postId}` });
    expect((getRes.json() as { data: { cards: Array<{ available: boolean }> } }).data.cards[0].available).toBe(false);
  });

  it("local handoff: issue → redeem → duplicate; wrong attempts lock; expired rejected", async () => {
    const db = openTestDb();
    const { buyer, seller } = seedUsers(db);
    const itemId = seedTradeItem(db, seller);
    const app = buildApp(db);

    const orderRes = await app.inject({
      method: "POST",
      url: "/v1/trade/orders",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { item_id: itemId },
    });
    const { unified_order_id, trade_order_id } = (
      orderRes.json() as { data: { unified_order_id: string; trade_order_id: string } }
    ).data;

    await payUnifiedOrder(app, buyer, unified_order_id);

    const issueRes = await app.inject({
      method: "POST",
      url: `/v1/trade/orders/${trade_order_id}/local-handoff/issue`,
      headers: { "x-user-id": buyer },
    });
    expect(issueRes.statusCode).toBe(200);
    const { code } = (issueRes.json() as { data: { code: string } }).data;

    const redeem1 = await app.inject({
      method: "POST",
      url: `/v1/trade/orders/${trade_order_id}/local-handoff/redeem`,
      headers: { "x-user-id": seller, "content-type": "application/json" },
      payload: { code },
    });
    expect(redeem1.statusCode).toBe(200);
    expect((redeem1.json() as { data: { duplicate: boolean; unified_status: string } }).data.duplicate).toBe(false);
    expect((redeem1.json() as { data: { unified_status: string } }).data.unified_status).toBe("SHIPPED");

    const redeemDup = await app.inject({
      method: "POST",
      url: `/v1/trade/orders/${trade_order_id}/local-handoff/redeem`,
      headers: { "x-user-id": seller, "content-type": "application/json" },
      payload: { code },
    });
    expect(redeemDup.statusCode).toBe(200);
    expect((redeemDup.json() as { data: { duplicate: boolean } }).data.duplicate).toBe(true);

    const item2 = seedTradeItemWithId(db, seller, "item_handoff_2");
    const order2 = await app.inject({
      method: "POST",
      url: "/v1/trade/orders",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { item_id: item2 },
    });
    const t2 = (order2.json() as { data: { unified_order_id: string; trade_order_id: string } }).data;
    await payUnifiedOrder(app, buyer, t2.unified_order_id);

    await app.inject({
      method: "POST",
      url: `/v1/trade/orders/${t2.trade_order_id}/local-handoff/issue`,
      headers: { "x-user-id": buyer },
    });

    for (let i = 0; i < 7; i++) {
      const r = await app.inject({
        method: "POST",
        url: `/v1/trade/orders/${t2.trade_order_id}/local-handoff/redeem`,
        headers: { "x-user-id": seller, "content-type": "application/json" },
        payload: { code: "BADCODE" },
      });
      expect(r.statusCode).toBe(400);
      expect((r.json() as { code: string }).code).toBe("LOCAL_VERIFICATION_INVALID");
    }
    const lock = await app.inject({
      method: "POST",
      url: `/v1/trade/orders/${t2.trade_order_id}/local-handoff/redeem`,
      headers: { "x-user-id": seller, "content-type": "application/json" },
      payload: { code: "BADCODE" },
    });
    expect(lock.statusCode).toBe(400);
    expect((lock.json() as { code: string }).code).toBe("LOCAL_VERIFICATION_LOCKED");

    const item3 = seedTradeItemWithId(db, seller, "item_handoff_3");
    const order3 = await app.inject({
      method: "POST",
      url: "/v1/trade/orders",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { item_id: item3 },
    });
    const t3 = (order3.json() as { data: { unified_order_id: string; trade_order_id: string } }).data;
    await payUnifiedOrder(app, buyer, t3.unified_order_id);
    await app.inject({
      method: "POST",
      url: `/v1/trade/orders/${t3.trade_order_id}/local-handoff/issue`,
      headers: { "x-user-id": buyer },
    });
    db.prepare(`UPDATE trade_local_verifications SET expires_at = ? WHERE trade_order_id = ?`).run(
      Date.now() - 1000,
      t3.trade_order_id,
    );
    const exp = await app.inject({
      method: "POST",
      url: `/v1/trade/orders/${t3.trade_order_id}/local-handoff/redeem`,
      headers: { "x-user-id": seller, "content-type": "application/json" },
      payload: { code: "ANYTHING" },
    });
    expect(exp.statusCode).toBe(400);
    expect((exp.json() as { code: string }).code).toBe("LOCAL_VERIFICATION_EXPIRED");
  });
});
