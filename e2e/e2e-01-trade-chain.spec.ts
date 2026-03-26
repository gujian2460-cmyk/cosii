import { test, expect } from "@playwright/test";
import { E2E_IDS } from "../tests/e2e-seed.js";

/**
 * E2E chain #1 — 交易：下单 → 支付回调 → 托管账本 → 卖家触发结算终态
 * @see docs/designs/autoplan-review-day9-10.md
 */
test.describe("E2E #1 trade money path", () => {
  test("下单 → 支付 → 结算 settled", async ({ request }) => {
    const orderRes = await request.post("/v1/trade/orders", {
      headers: {
        "x-user-id": E2E_IDS.buyer,
        "content-type": "application/json",
      },
      data: { item_id: E2E_IDS.itemTrade },
    });
    expect(orderRes.ok()).toBeTruthy();
    const orderJson = (await orderRes.json()) as {
      data: { unified_order_id: string; trade_order_id: string };
    };
    const { unified_order_id, trade_order_id } = orderJson.data;

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
    const { payment_id, amount_cents } = payJson.data;

    const hook = await request.post("/v1/payments/webhook/wechat", {
      headers: { "content-type": "application/json" },
      data: {
        out_trade_no: payment_id,
        transaction_id: "wx_e2e_trade_1",
        amount_cents,
        trade_state: "SUCCESS",
      },
    });
    expect(hook.ok()).toBeTruthy();
    const hookBody = (await hook.json()) as { data: { processed?: boolean } };
    expect(hookBody.data.processed).toBe(true);

    const statusRes = await request.get(`/v1/payments/unified/${unified_order_id}/status`, {
      headers: { "x-user-id": E2E_IDS.buyer },
    });
    expect(statusRes.ok()).toBeTruthy();
    const st = (await statusRes.json()) as { data: { unified_status: string; payment_status: string } };
    expect(st.data.unified_status).toBe("PAID_ESCROW");
    expect(st.data.payment_status).toBe("PAID");

    const settleRes = await request.post(`/v1/settlement/orders/trade/${trade_order_id}/trigger`, {
      headers: { "x-user-id": E2E_IDS.seller },
    });
    expect(settleRes.ok()).toBeTruthy();
    const settled = (await settleRes.json()) as { data: { status: string } };
    expect(settled.data.status).toBe("settled");
  });
});
