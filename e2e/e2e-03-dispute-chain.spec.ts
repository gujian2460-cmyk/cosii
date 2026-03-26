import { test, expect } from "@playwright/test";
import { E2E_IDS } from "../tests/e2e-seed.js";

/**
 * E2E chain #3 — 争议：支付后进 escrow → 发起争议 → 证据 → GET 时间线可感知
 * @see docs/designs/autoplan-review-day9-10.md
 */
test.describe("E2E #3 dispute audit path", () => {
  test("支付 escrow → 发起争议 → 证据 → timeline", async ({ request }) => {
    const orderRes = await request.post("/v1/trade/orders", {
      headers: {
        "x-user-id": E2E_IDS.buyer,
        "content-type": "application/json",
      },
      data: { item_id: E2E_IDS.itemDispute },
    });
    expect(orderRes.ok()).toBeTruthy();
    const { unified_order_id } = (
      (await orderRes.json()) as { data: { unified_order_id: string } }
    ).data;

    const payRes = await request.post("/v1/payments/create", {
      headers: {
        "x-user-id": E2E_IDS.buyer,
        "content-type": "application/json",
      },
      data: { unified_order_id },
    });
    expect(payRes.ok()).toBeTruthy();
    const { payment_id, amount_cents } = (
      (await payRes.json()) as { data: { payment_id: string; amount_cents: number } }
    ).data;

    await request.post("/v1/payments/webhook/wechat", {
      headers: { "content-type": "application/json" },
      data: {
        out_trade_no: payment_id,
        transaction_id: "wx_e2e_dispute_1",
        amount_cents,
        trade_state: "SUCCESS",
      },
    });

    const dRes = await request.post("/v1/disputes", {
      headers: {
        "x-user-id": E2E_IDS.buyer,
        "content-type": "application/json",
      },
      data: { unified_order_id, reason: "货不对板" },
    });
    expect(dRes.ok()).toBeTruthy();
    const disputeId = ((await dRes.json()) as { data: { dispute_id: string } }).data.dispute_id;

    await request.post(`/v1/disputes/${disputeId}/evidences`, {
      headers: {
        "x-user-id": E2E_IDS.buyer,
        "content-type": "application/json",
      },
      data: { evidence_type: "photo", evidence_url: "https://cdn.example.com/e2e.jpg" },
    });

    const g = await request.get(`/v1/disputes/${disputeId}`, {
      headers: { "x-user-id": E2E_IDS.buyer },
    });
    expect(g.ok()).toBeTruthy();
    const detail = (await g.json()) as {
      data: { timeline: Array<{ kind: string }>; evidences: unknown[] };
    };
    expect(detail.data.evidences.length).toBeGreaterThanOrEqual(1);
    expect(detail.data.timeline.some((t) => t.kind === "evidence")).toBe(true);
  });
});
