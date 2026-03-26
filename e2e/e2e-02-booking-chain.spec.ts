import { test, expect } from "@playwright/test";
import { E2E_IDS } from "../tests/e2e-seed.js";

/**
 * E2E chain #2 — 约妆：选档 → 占位 → 定金支付（尾款 API 未接时以 DEPOSIT_PAID 为链末验收点）
 * @see docs/designs/autoplan-review-day9-10.md
 */
test.describe("E2E #2 booking deposit path", () => {
  test("选档 → SLOT_HELD → 定金 webhook → DEPOSIT_PAID", async ({ request }) => {
    const createRes = await request.post("/v1/booking/orders", {
      headers: {
        "x-user-id": E2E_IDS.buyer,
        "content-type": "application/json",
      },
      data: {
        slot_id: E2E_IDS.slot,
        deposit_amount: 5000,
        final_amount: 15000,
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = (await createRes.json()) as {
      data: { service_order_id: string; unified_order_id: string; status: string };
    };
    expect(created.data.status).toBe("SLOT_HELD");
    const { unified_order_id, service_order_id } = created.data;

    const payRes = await request.post("/v1/payments/create", {
      headers: {
        "x-user-id": E2E_IDS.buyer,
        "content-type": "application/json",
      },
      data: { unified_order_id },
    });
    expect(payRes.ok()).toBeTruthy();
    const payJson = (await payRes.json()) as {
      data: { payment_id: string; amount_cents: number };
    };

    const hook = await request.post("/v1/payments/webhook/wechat", {
      headers: { "content-type": "application/json" },
      data: {
        out_trade_no: payJson.data.payment_id,
        transaction_id: "wx_e2e_booking_1",
        amount_cents: payJson.data.amount_cents,
        trade_state: "SUCCESS",
      },
    });
    expect(hook.ok()).toBeTruthy();

    const detail = await request.get(`/v1/booking/orders/${service_order_id}`, {
      headers: { "x-user-id": E2E_IDS.buyer },
    });
    expect(detail.ok()).toBeTruthy();
    const body = (await detail.json()) as { data: { status: string } };
    expect(body.data.status).toBe("DEPOSIT_PAID");
  });
});
