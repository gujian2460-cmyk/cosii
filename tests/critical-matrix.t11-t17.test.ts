import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import {
  openTestDb,
  seedExtraBuyer,
  seedOverlappingSlots,
  seedSlot,
  seedTradeItem,
  seedUsers,
} from "./helpers.js";

/**
 * Playbook CRITICAL 矩阵 T11–T17（支付回调、占位、重叠档期、FK、一致性、乱序）
 * @see docs/designs/eng-implementation-plan-cos-miniapp.md
 * @see docs/gstack-implementation-playbook.md
 */
describe("CRITICAL matrix T11–T17", () => {
  it("T11: webhook replay returns duplicate without double state transition", async () => {
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
    const { unified_order_id } = (orderRes.json() as { data: { unified_order_id: string } }).data;

    const payRes = await app.inject({
      method: "POST",
      url: "/v1/payments/create",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { unified_order_id },
    });
    const { payment_id, amount_cents } = (payRes.json() as { data: { payment_id: string; amount_cents: number } })
      .data;

    const payload = {
      out_trade_no: payment_id,
      transaction_id: "wx_t11_matrix",
      amount_cents,
      trade_state: "SUCCESS" as const,
    };

    const first = await app.inject({
      method: "POST",
      url: "/v1/payments/webhook/wechat",
      headers: { "content-type": "application/json" },
      payload,
    });
    expect(first.statusCode).toBe(200);
    expect((first.json() as { data: { duplicate: boolean } }).data.duplicate).toBe(false);

    const second = await app.inject({
      method: "POST",
      url: "/v1/payments/webhook/wechat",
      headers: { "content-type": "application/json" },
      payload,
    });
    expect(second.statusCode).toBe(200);
    expect((second.json() as { data: { duplicate: boolean } }).data.duplicate).toBe(true);

    const u = db.prepare(`SELECT status FROM unified_orders WHERE id = ?`).get(unified_order_id) as { status: string };
    expect(u.status).toBe("PAID_ESCROW");
  });

  it("T12: second buyer cannot book the same slot while held", async () => {
    const db = openTestDb();
    const { buyer, artist } = seedUsers(db);
    const slotId = seedSlot(db, artist);
    const otherBuyer = seedExtraBuyer(db);
    const app = buildApp(db);

    await app.inject({
      method: "POST",
      url: "/v1/booking/orders",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { slot_id: slotId, deposit_amount: 5000, final_amount: 15000 },
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/booking/orders",
      headers: { "x-user-id": otherBuyer, "content-type": "application/json" },
      payload: { slot_id: slotId, deposit_amount: 5000, final_amount: 15000 },
    });
    expect(res.statusCode).toBe(409);
    expect((res.json() as { code: string }).code).toBe("BOOKING_SLOT_CONFLICT");
  });

  it("T13: duplicate webhook does not create a second ESCROW_HOLD ledger row", async () => {
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
    const { unified_order_id } = (orderRes.json() as { data: { unified_order_id: string } }).data;

    const payRes = await app.inject({
      method: "POST",
      url: "/v1/payments/create",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { unified_order_id },
    });
    const { payment_id, amount_cents } = (payRes.json() as { data: { payment_id: string; amount_cents: number } })
      .data;

    const payload = {
      out_trade_no: payment_id,
      transaction_id: "wx_t13_ledger",
      amount_cents,
      trade_state: "SUCCESS" as const,
    };

    await app.inject({
      method: "POST",
      url: "/v1/payments/webhook/wechat",
      headers: { "content-type": "application/json" },
      payload,
    });
    await app.inject({
      method: "POST",
      url: "/v1/payments/webhook/wechat",
      headers: { "content-type": "application/json" },
      payload,
    });

    const rows = db
      .prepare(
        `SELECT COUNT(*) AS c FROM settlement_ledger WHERE unified_order_id = ? AND event_type = 'ESCROW_HOLD'`,
      )
      .get(unified_order_id) as { c: number };
    expect(rows.c).toBe(1);
  });

  it("T14: payment create rejects unknown unified_order_id (no orphan payment path)", async () => {
    const db = openTestDb();
    seedUsers(db);
    const app = buildApp(db);

    const res = await app.inject({
      method: "POST",
      url: "/v1/payments/create",
      headers: { "x-user-id": "usr_buyer_1", "content-type": "application/json" },
      payload: { unified_order_id: randomUUID() },
    });
    expect(res.statusCode).toBe(404);
    expect((res.json() as { code: string }).code).toBe("RESOURCE_NOT_FOUND");
  });

  it("T15: overlapping held slot for same artist is rejected", async () => {
    const db = openTestDb();
    const { buyer, artist } = seedUsers(db);
    const { slotEarly, slotLate } = seedOverlappingSlots(db, artist);
    const otherBuyer = seedExtraBuyer(db);
    const app = buildApp(db);

    const first = await app.inject({
      method: "POST",
      url: "/v1/booking/orders",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { slot_id: slotEarly, deposit_amount: 3000, final_amount: 9000 },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: "/v1/booking/orders",
      headers: { "x-user-id": otherBuyer, "content-type": "application/json" },
      payload: { slot_id: slotLate, deposit_amount: 3000, final_amount: 9000 },
    });
    expect(second.statusCode).toBe(409);
    expect((second.json() as { code: string }).code).toBe("BOOKING_SLOT_CONFLICT");

    const late = db.prepare(`SELECT slot_status FROM artist_slots WHERE id = ?`).get(slotLate) as {
      slot_status: string;
    };
    expect(late.slot_status).toBe("AVAILABLE");
  });

  it("T16: after successful trade webhook unified + domain orders stay aligned", async () => {
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

    const payRes = await app.inject({
      method: "POST",
      url: "/v1/payments/create",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { unified_order_id },
    });
    const { payment_id, amount_cents } = (payRes.json() as { data: { payment_id: string; amount_cents: number } })
      .data;

    await app.inject({
      method: "POST",
      url: "/v1/payments/webhook/wechat",
      headers: { "content-type": "application/json" },
      payload: {
        out_trade_no: payment_id,
        transaction_id: "wx_t16_align",
        amount_cents,
        trade_state: "SUCCESS",
      },
    });

    const u = db.prepare(`SELECT status FROM unified_orders WHERE id = ?`).get(unified_order_id) as { status: string };
    const t = db.prepare(`SELECT status FROM trade_orders WHERE id = ?`).get(trade_order_id) as { status: string };
    expect(u.status).toBe("PAID_ESCROW");
    expect(t.status).toBe("PAID_ESCROW");
  });

  it("T17: late success webhook with new transaction_id after PAID is duplicate-only (monotonic guard)", async () => {
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
    const { unified_order_id } = (orderRes.json() as { data: { unified_order_id: string } }).data;

    const payRes = await app.inject({
      method: "POST",
      url: "/v1/payments/create",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { unified_order_id },
    });
    const { payment_id, amount_cents } = (payRes.json() as { data: { payment_id: string; amount_cents: number } })
      .data;

    await app.inject({
      method: "POST",
      url: "/v1/payments/webhook/wechat",
      headers: { "content-type": "application/json" },
      payload: {
        out_trade_no: payment_id,
        transaction_id: "wx_t17_first",
        amount_cents,
        trade_state: "SUCCESS",
      },
    });

    const late = await app.inject({
      method: "POST",
      url: "/v1/payments/webhook/wechat",
      headers: { "content-type": "application/json" },
      payload: {
        out_trade_no: payment_id,
        transaction_id: "wx_t17_late",
        amount_cents,
        trade_state: "SUCCESS",
      },
    });
    expect(late.statusCode).toBe(200);
    const body = late.json() as { data: { duplicate: boolean; processed: boolean } };
    expect(body.data.duplicate).toBe(true);
    expect(body.data.processed).toBe(false);

    const u = db.prepare(`SELECT status FROM unified_orders WHERE id = ?`).get(unified_order_id) as { status: string };
    expect(u.status).toBe("PAID_ESCROW");
  });
});
