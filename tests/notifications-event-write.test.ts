import { describe, expect, it } from "vitest";
import { createDispute } from "../src/modules/dispute/service.js";
import { createPayment, processWechatWebhook } from "../src/modules/payment/service.js";
import { createTradeOrder } from "../src/modules/trade/service.js";
import { openTestDb, seedTradeItem, seedUsers } from "./helpers.js";

describe("notification event writes", () => {
  it("createTradeOrder inserts buyer and seller notifications", () => {
    const db = openTestDb();
    const { buyer, seller } = seedUsers(db);
    const itemId = seedTradeItem(db, seller);
    createTradeOrder(db, { buyerId: buyer, itemId, bodyForHash: {} });
    const rows = db
      .prepare(`SELECT user_id, event_type FROM user_notifications ORDER BY user_id, event_type`)
      .all() as { user_id: string; event_type: string }[];
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.user_id === buyer && r.event_type === "trade_order_created_buyer")).toBe(true);
    expect(rows.some((r) => r.user_id === seller && r.event_type === "trade_order_created_seller")).toBe(true);
  });

  it("processWechatWebhook notifies both parties after trade payment", () => {
    const db = openTestDb();
    const { buyer, seller } = seedUsers(db);
    const itemId = seedTradeItem(db, seller);
    const { trade_order_id, unified_order_id } = createTradeOrder(db, { buyerId: buyer, itemId, bodyForHash: {} });
    const { payment_id } = createPayment(db, { userId: buyer, unifiedOrderId: unified_order_id });
    processWechatWebhook(
      db,
      { out_trade_no: payment_id, transaction_id: "wx_txn_1", amount_cents: 19900 },
      "trace",
    );
    const types = db
      .prepare(`SELECT event_type, user_id FROM user_notifications WHERE event_type LIKE 'payment_%'`)
      .all() as { event_type: string; user_id: string }[];
    expect(types.some((t) => t.user_id === buyer && t.event_type === "payment_success_buyer")).toBe(true);
    expect(types.some((t) => t.user_id === seller && t.event_type === "payment_success_seller")).toBe(true);
    const link = db
      .prepare(
        `SELECT unified_order_id, order_type, domain_order_id FROM user_notifications WHERE event_type = 'payment_success_buyer' LIMIT 1`,
      )
      .get() as { unified_order_id: string; order_type: string; domain_order_id: string };
    expect(link.unified_order_id).toBe(unified_order_id);
    expect(link.order_type).toBe("trade");
    expect(link.domain_order_id).toBe(trade_order_id);
  });

  it("createDispute notifies the other party", () => {
    const db = openTestDb();
    const { buyer, seller } = seedUsers(db);
    const itemId = seedTradeItem(db, seller);
    const { unified_order_id } = createTradeOrder(db, { buyerId: buyer, itemId, bodyForHash: {} });
    const { payment_id } = createPayment(db, { userId: buyer, unifiedOrderId: unified_order_id });
    processWechatWebhook(
      db,
      { out_trade_no: payment_id, transaction_id: "wx_txn_dispute", amount_cents: 19900 },
      "t",
    );
    createDispute(db, buyer, unified_order_id, "reason");
    const disputeRows = db
      .prepare(`SELECT user_id, event_type FROM user_notifications WHERE event_type = 'dispute_opened'`)
      .all() as { user_id: string }[];
    expect(disputeRows).toHaveLength(1);
    expect(disputeRows[0].user_id).toBe(seller);
  });
});
