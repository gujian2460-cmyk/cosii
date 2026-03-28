import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { runImmediateTransaction } from "../../db/transaction.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { insertUserNotification } from "../notification/service.js";

export type CreatePaymentInput = {
  userId: string;
  unifiedOrderId: string;
};

export type CreatePaymentResult = {
  payment_id: string;
  unified_order_id: string;
  amount_cents: number;
  order_type: "trade" | "service";
  prepay: {
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: string;
    paySign: string;
  };
};

function loadUnifiedForBuyer(
  db: DatabaseSync,
  unifiedOrderId: string,
  buyerId: string,
): {
  unified_id: string;
  order_type: string;
  domain_order_id: string;
  status: string;
  buyer_id: string;
} {
  const u = db
    .prepare(
      `SELECT id, order_type, domain_order_id, status, buyer_id FROM unified_orders WHERE id = ?`,
    )
    .get(unifiedOrderId) as
    | {
        id: string;
        order_type: string;
        domain_order_id: string;
        status: string;
        buyer_id: string;
      }
    | undefined;
  if (!u) {
    throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Order not found");
  }
  if (u.buyer_id !== buyerId) {
    throw new HttpError(403, ErrorCode.BUSINESS_RULE_VIOLATION, "Not your order");
  }
  return {
    unified_id: u.id,
    order_type: u.order_type,
    domain_order_id: u.domain_order_id,
    status: u.status,
    buyer_id: u.buyer_id,
  };
}

export function createPayment(db: DatabaseSync, input: CreatePaymentInput): CreatePaymentResult {
  return runImmediateTransaction(db, () => {
    const u = loadUnifiedForBuyer(db, input.unifiedOrderId, input.userId);

    const pending = db
      .prepare(
        `SELECT id FROM order_payments WHERE unified_order_id = ? AND payment_status = 'PENDING' LIMIT 1`,
      )
      .get(u.unified_id) as { id: string } | undefined;
    if (pending) {
      throw new HttpError(409, ErrorCode.BUSINESS_RULE_VIOLATION, "Payment already in progress for this order");
    }

    const now = Date.now();
    let amountCents = 0;
    let orderTypeCol: "trade" | "service";
    let domainOrderId = u.domain_order_id;

    if (u.order_type === "trade") {
      orderTypeCol = "trade";
      if (u.status !== "PENDING_PAYMENT") {
        throw new HttpError(400, ErrorCode.BUSINESS_RULE_VIOLATION, "Order not payable in current state");
      }
      const t = db
        .prepare(`SELECT id, total_amount FROM trade_orders WHERE id = ?`)
        .get(u.domain_order_id) as { id: string; total_amount: number } | undefined;
      if (!t) {
        throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Trade order missing");
      }
      amountCents = t.total_amount;
    } else if (u.order_type === "service") {
      orderTypeCol = "service";
      if (u.status !== "SLOT_HELD") {
        throw new HttpError(400, ErrorCode.BUSINESS_RULE_VIOLATION, "Deposit not available in current state");
      }
      const s = db
        .prepare(`SELECT id, deposit_amount FROM service_orders WHERE id = ?`)
        .get(u.domain_order_id) as { id: string; deposit_amount: number } | undefined;
      if (!s) {
        throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Service order missing");
      }
      amountCents = s.deposit_amount;
    } else {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Unsupported order type");
    }

    const paymentId = randomUUID();
    db.prepare(
      `INSERT INTO order_payments (id, unified_order_id, order_type, order_id, payment_status, amount, idempotency_key, created_at)
       VALUES (?, ?, ?, ?, 'PENDING', ?, NULL, ?)`,
    ).run(paymentId, u.unified_id, orderTypeCol, domainOrderId, amountCents, now);

    const nonceStr = randomUUID().replace(/-/g, "").slice(0, 32);
    return {
      payment_id: paymentId,
      unified_order_id: u.unified_id,
      amount_cents: amountCents,
      order_type: orderTypeCol,
      prepay: {
        timeStamp: String(Math.floor(now / 1000)),
        nonceStr,
        package: "prepay_id=stub_prepay",
        signType: "RSA",
        paySign: "stub_sign_for_dev",
      },
    };
  });
}

export type WechatWebhookPayload = {
  out_trade_no: string;
  transaction_id: string;
  amount_cents: number;
  trade_state?: string;
};

/**
 * 处理微信支付回调：transaction_id 幂等；成功则推进订单并入账 settlement_ledger。
 */
export function processWechatWebhook(db: DatabaseSync, payload: WechatWebhookPayload, traceId: string): {
  duplicate: boolean;
  unified_order_id?: string;
} {
  if (payload.trade_state && payload.trade_state !== "SUCCESS") {
    throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Unsupported trade_state");
  }

  return runImmediateTransaction(db, () => {
    const pay = db
      .prepare(`SELECT id, unified_order_id, order_type, order_id, payment_status, amount FROM order_payments WHERE id = ?`)
      .get(payload.out_trade_no) as
      | {
          id: string;
          unified_order_id: string;
          order_type: string;
          order_id: string;
          payment_status: string;
          amount: number;
        }
      | undefined;

    if (!pay) {
      throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Payment not found");
    }

    if (pay.amount !== payload.amount_cents) {
      throw new HttpError(400, ErrorCode.BUSINESS_RULE_VIOLATION, "Amount mismatch");
    }

    const dedup = db.prepare(`INSERT INTO wechat_webhook_events (transaction_id, payment_id, created_at) VALUES (?, ?, ?)`);
    try {
      dedup.run(payload.transaction_id, pay.id, Date.now());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("UNIQUE") && !msg.includes("constraint")) {
        throw e;
      }
      return { duplicate: true, unified_order_id: pay.unified_order_id };
    }

    if (pay.payment_status === "PAID") {
      return { duplicate: true, unified_order_id: pay.unified_order_id };
    }

    const u = db
      .prepare(`SELECT id, order_type, domain_order_id, buyer_id, seller_id, status FROM unified_orders WHERE id = ?`)
      .get(pay.unified_order_id) as {
      id: string;
      order_type: string;
      domain_order_id: string;
      buyer_id: string;
      seller_id: string;
      status: string;
    };

    if (u.order_type === "trade" && u.status !== "PENDING_PAYMENT") {
      throw new HttpError(409, ErrorCode.BUSINESS_RULE_VIOLATION, "Order state no longer matches payment");
    }
    if (u.order_type === "service" && u.status !== "SLOT_HELD") {
      throw new HttpError(409, ErrorCode.BUSINESS_RULE_VIOLATION, "Order state no longer matches payment");
    }

    const now = Date.now();

    if (u.order_type === "trade") {
      const tr = db
        .prepare(`UPDATE trade_orders SET status = 'PAID_ESCROW', updated_at = ? WHERE id = ? AND status = 'PENDING_PAYMENT'`)
        .run(now, u.domain_order_id);
      if (Number(tr.changes) === 0) {
        throw new HttpError(409, ErrorCode.BUSINESS_RULE_VIOLATION, "Trade order transition failed");
      }
      const ur = db
        .prepare(`UPDATE unified_orders SET status = 'PAID_ESCROW', updated_at = ? WHERE id = ? AND status = 'PENDING_PAYMENT'`)
        .run(now, u.id);
      if (Number(ur.changes) === 0) {
        throw new HttpError(409, ErrorCode.BUSINESS_RULE_VIOLATION, "Unified order transition failed");
      }
    } else {
      const sr = db
        .prepare(`UPDATE service_orders SET status = 'DEPOSIT_PAID', updated_at = ? WHERE id = ? AND status = 'SLOT_HELD'`)
        .run(now, u.domain_order_id);
      if (Number(sr.changes) === 0) {
        throw new HttpError(409, ErrorCode.BUSINESS_RULE_VIOLATION, "Service order transition failed");
      }
      const ur = db
        .prepare(`UPDATE unified_orders SET status = 'DEPOSIT_PAID', updated_at = ? WHERE id = ? AND status = 'SLOT_HELD'`)
        .run(now, u.id);
      if (Number(ur.changes) === 0) {
        throw new HttpError(409, ErrorCode.BUSINESS_RULE_VIOLATION, "Unified order transition failed");
      }
    }

    const payUpd = db
      .prepare(`UPDATE order_payments SET payment_status = 'PAID', wx_txn_id = ? WHERE id = ? AND payment_status = 'PENDING'`)
      .run(payload.transaction_id, pay.id);
    if (Number(payUpd.changes) === 0) {
      throw new HttpError(409, ErrorCode.BUSINESS_RULE_VIOLATION, "Payment row was modified concurrently");
    }

    const ledgerId = randomUUID();
    db.prepare(
      `INSERT INTO settlement_ledger (id, unified_order_id, order_type, order_id, event_type, amount, balance_after, trace_id, created_at)
       VALUES (?, ?, ?, ?, 'ESCROW_HOLD', ?, ?, ?, ?)`,
    ).run(
      ledgerId,
      u.id,
      pay.order_type,
      pay.order_id,
      pay.amount,
      pay.amount,
      traceId,
      now,
    );

    const ot: "trade" | "service" = u.order_type === "service" ? "service" : "trade";
    const paySubtitle =
      ot === "trade" ? "交易订单 · 款项已进入担保" : "约妆订单 · 定金已支付";
    insertUserNotification(db, {
      userId: u.buyer_id,
      eventType: "payment_success_buyer",
      title: "支付成功",
      subtitle: paySubtitle,
      unifiedOrderId: u.id,
      orderType: ot,
      domainOrderId: u.domain_order_id,
    });
    insertUserNotification(db, {
      userId: u.seller_id,
      eventType: "payment_success_seller",
      title: "买家已付款",
      subtitle: paySubtitle,
      unifiedOrderId: u.id,
      orderType: ot,
      domainOrderId: u.domain_order_id,
    });

    return { duplicate: false, unified_order_id: u.id };
  });
}

/** 供轮询：对齐 DESIGN.md「支付结果同步」展示所需字段 */
export function getPaymentStatusForUnified(
  db: DatabaseSync,
  userId: string,
  unifiedOrderId: string,
): {
  unified_status: string;
  payment_id: string | null;
  payment_status: string | null;
  amount_cents: number | null;
} {
  const u = loadUnifiedForBuyer(db, unifiedOrderId, userId);
  const fresh = db
    .prepare(`SELECT status FROM unified_orders WHERE id = ?`)
    .get(u.unified_id) as { status: string } | undefined;
  const row = db
    .prepare(
      `SELECT id, payment_status, amount FROM order_payments WHERE unified_order_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(u.unified_id) as { id: string; payment_status: string; amount: number } | undefined;
  return {
    unified_status: fresh?.status ?? u.status,
    payment_id: row?.id ?? null,
    payment_status: row?.payment_status ?? null,
    amount_cents: row?.amount ?? null,
  };
}
