import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { openTestDb, seedSlot, seedTradeItem, seedUsers } from "./helpers.js";

describe("DESIGN.md Day3–6 API surface", () => {
  it("trade: payment create → webhook → escrow ledger → settlement → ledger labels", async () => {
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
    expect(payRes.statusCode).toBe(200);
    const { payment_id, amount_cents } = (payRes.json() as { data: { payment_id: string; amount_cents: number } })
      .data;

    const hook = await app.inject({
      method: "POST",
      url: "/v1/payments/webhook/wechat",
      headers: { "content-type": "application/json" },
      payload: {
        out_trade_no: payment_id,
        transaction_id: "wx_txn_test_1",
        amount_cents,
        trade_state: "SUCCESS",
      },
    });
    expect(hook.statusCode).toBe(200);
    expect((hook.json() as { data: { processed: boolean } }).data.processed).toBe(true);

    const hookDup = await app.inject({
      method: "POST",
      url: "/v1/payments/webhook/wechat",
      headers: { "content-type": "application/json" },
      payload: {
        out_trade_no: payment_id,
        transaction_id: "wx_txn_test_1",
        amount_cents,
        trade_state: "SUCCESS",
      },
    });
    expect((hookDup.json() as { data: { duplicate: boolean } }).data.duplicate).toBe(true);

    const statusRes = await app.inject({
      method: "GET",
      url: `/v1/payments/unified/${unified_order_id}/status`,
      headers: { "x-user-id": buyer },
    });
    expect((statusRes.json() as { data: { payment_status: string; unified_status: string } }).data.payment_status).toBe(
      "PAID",
    );
    expect((statusRes.json() as { data: { unified_status: string } }).data.unified_status).toBe("PAID_ESCROW");

    const ledgerRes = await app.inject({
      method: "GET",
      url: `/v1/settlement/orders/trade/${trade_order_id}/ledger`,
      headers: { "x-user-id": buyer },
    });
    const ledger = ledgerRes.json() as { data: { entries: Array<{ event_type: string; label_zh: string }> } };
    expect(ledger.data.entries.length).toBeGreaterThanOrEqual(1);
    expect(ledger.data.entries[0].label_zh).toBe("托管冻结");

    const settleRes = await app.inject({
      method: "POST",
      url: `/v1/settlement/orders/trade/${trade_order_id}/trigger`,
      headers: { "x-user-id": seller },
    });
    expect(settleRes.statusCode).toBe(200);
    expect((settleRes.json() as { data: { status: string } }).data.status).toBe("settled");
  });

  it("booking: hold_expires_at on create + GET expires slot after hold passes", async () => {
    const db = openTestDb();
    const { buyer, artist } = seedUsers(db);
    const slotId = seedSlot(db, artist);
    const app = buildApp(db);

    const createRes = await app.inject({
      method: "POST",
      url: "/v1/booking/orders",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { slot_id: slotId, deposit_amount: 5000, final_amount: 15000 },
    });
    const { service_order_id, hold_expires_at } = (
      createRes.json() as { data: { service_order_id: string; hold_expires_at: number } }
    ).data;
    expect(hold_expires_at).toBeGreaterThan(Date.now());

    db.prepare(`UPDATE service_orders SET hold_expires_at = ? WHERE id = ?`).run(Date.now() - 1000, service_order_id);

    const getRes = await app.inject({
      method: "GET",
      url: `/v1/booking/orders/${service_order_id}`,
      headers: { "x-user-id": buyer },
    });
    expect(getRes.statusCode).toBe(200);
    const body = getRes.json() as { data: { status: string; slot_hold_expired: boolean } };
    expect(body.data.status).toBe("EXPIRED");
    expect(body.data.slot_hold_expired).toBe(true);

    const slot = db.prepare(`SELECT slot_status FROM artist_slots WHERE id = ?`).get(slotId) as { slot_status: string };
    expect(slot.slot_status).toBe("AVAILABLE");
  });

  it("dispute: open → evidence → timeline; invalid state rejected", async () => {
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

    const badDispute = await app.inject({
      method: "POST",
      url: "/v1/disputes",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { unified_order_id, reason: "test" },
    });
    expect(badDispute.statusCode).toBe(400);
    expect((badDispute.json() as { code: string }).code).toBe("DISPUTE_INVALID_STATE");

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
        transaction_id: "wx_dispute_1",
        amount_cents,
        trade_state: "SUCCESS",
      },
    });

    const dRes = await app.inject({
      method: "POST",
      url: "/v1/disputes",
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { unified_order_id, reason: "货不对板" },
    });
    expect(dRes.statusCode).toBe(200);
    const disputeId = (dRes.json() as { data: { dispute_id: string; sla_due_at: number } }).data.dispute_id;
    expect((dRes.json() as { data: { sla_due_at: number } }).data.sla_due_at).toBeGreaterThan(Date.now());

    await app.inject({
      method: "POST",
      url: `/v1/disputes/${disputeId}/evidences`,
      headers: { "x-user-id": buyer, "content-type": "application/json" },
      payload: { evidence_type: "photo", evidence_url: "https://cdn.example.com/a.jpg" },
    });

    const g = await app.inject({
      method: "GET",
      url: `/v1/disputes/${disputeId}`,
      headers: { "x-user-id": buyer },
    });
    const detail = g.json() as { data: { timeline: Array<{ kind: string }>; evidences: unknown[] } };
    expect(detail.data.evidences.length).toBe(1);
    expect(detail.data.timeline.some((t) => t.kind === "evidence")).toBe(true);
  });

  it("settlement returns SETTLEMENT_RETRY_EXHAUSTED when retry_count >= max", async () => {
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
        transaction_id: "wx_settle_ex_1",
        amount_cents,
        trade_state: "SUCCESS",
      },
    });

    const jid = "job_test_1";
    db.prepare(
      `INSERT INTO settlement_jobs (id, unified_order_id, order_type, order_id, job_status, retry_count, next_retry_at, created_at)
       VALUES (?, ?, 'trade', ?, 'PENDING', 3, NULL, ?)`,
    ).run(jid, unified_order_id, trade_order_id, Date.now());

    const fail = await app.inject({
      method: "POST",
      url: `/v1/settlement/orders/trade/${trade_order_id}/trigger`,
      headers: { "x-user-id": seller },
    });
    expect(fail.statusCode).toBe(503);
    expect((fail.json() as { code: string }).code).toBe("SETTLEMENT_RETRY_EXHAUSTED");
  });
});
