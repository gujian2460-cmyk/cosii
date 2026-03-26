import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { runImmediateTransaction } from "../../db/transaction.js";
import { MAX_SETTLEMENT_RETRIES } from "../../shared/constants.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { ledgerEventLabels } from "../../shared/ledger-labels.js";

const SETTLEABLE = new Set(["PAID_ESCROW", "DEPOSIT_PAID", "SHIPPED"]);

export function listLedgerForOrder(
  db: DatabaseSync,
  userId: string,
  orderType: string,
  orderId: string,
  limit = 5,
): { entries: Array<Record<string, unknown>>; labels: Record<string, string> } {
  const u = db
    .prepare(
      `SELECT id, buyer_id, seller_id FROM unified_orders WHERE order_type = ? AND domain_order_id = ?`,
    )
    .get(orderType, orderId) as { id: string; buyer_id: string; seller_id: string } | undefined;

  if (!u) {
    throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Order not found");
  }
  if (u.buyer_id !== userId && u.seller_id !== userId) {
    throw new HttpError(403, ErrorCode.BUSINESS_RULE_VIOLATION, "Not allowed");
  }

  const rows = db
    .prepare(
      `SELECT id, event_type, amount, balance_after, trace_id, created_at
       FROM settlement_ledger WHERE order_type = ? AND order_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(orderType, orderId, limit) as Array<{
    id: string;
    event_type: string;
    amount: number;
    balance_after: number | null;
    trace_id: string | null;
    created_at: number;
  }>;

  const entries = rows.map((r) => ({
    ...r,
    label_zh: ledgerEventLabels[r.event_type] ?? r.event_type,
  }));

  return { entries, labels: ledgerEventLabels };
}

export function triggerSettlement(
  db: DatabaseSync,
  userId: string,
  orderType: string,
  orderId: string,
  traceId: string,
): { status: string; unified_order_id: string } {
  return runImmediateTransaction(db, () => {
    const u = db
      .prepare(`SELECT id, order_type, domain_order_id, buyer_id, seller_id, status FROM unified_orders WHERE order_type = ? AND domain_order_id = ?`)
      .get(orderType, orderId) as
      | {
          id: string;
          order_type: string;
          domain_order_id: string;
          buyer_id: string;
          seller_id: string;
          status: string;
        }
      | undefined;

    if (!u) {
      throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Order not found");
    }
    if (u.buyer_id !== userId && u.seller_id !== userId) {
      throw new HttpError(403, ErrorCode.BUSINESS_RULE_VIOLATION, "Not allowed");
    }

    if (u.status === "SETTLED") {
      return { status: "already_settled", unified_order_id: u.id };
    }

    if (!SETTLEABLE.has(u.status)) {
      throw new HttpError(400, ErrorCode.BUSINESS_RULE_VIOLATION, "Order not ready for settlement");
    }

    let job = db
      .prepare(`SELECT id, job_status, retry_count FROM settlement_jobs WHERE order_type = ? AND order_id = ?`)
      .get(orderType, orderId) as { id: string; job_status: string; retry_count: number } | undefined;

    const now = Date.now();

    if (!job) {
      const jid = randomUUID();
      db.prepare(
        `INSERT INTO settlement_jobs (id, unified_order_id, order_type, order_id, job_status, retry_count, next_retry_at, created_at)
         VALUES (?, ?, ?, ?, 'PENDING', 0, NULL, ?)`,
      ).run(jid, u.id, orderType, orderId, now);
      job = { id: jid, job_status: "PENDING", retry_count: 0 };
    }

    if (job.retry_count >= MAX_SETTLEMENT_RETRIES) {
      throw new HttpError(503, ErrorCode.SETTLEMENT_RETRY_EXHAUSTED, "Settlement retries exhausted");
    }

    const ledgerId = randomUUID();
    db.prepare(
      `INSERT INTO settlement_ledger (id, unified_order_id, order_type, order_id, event_type, amount, balance_after, trace_id, created_at)
       VALUES (?, ?, ?, ?, 'SETTLEMENT_COMPLETE', 0, 0, ?, ?)`,
    ).run(ledgerId, u.id, orderType, orderId, traceId, now);

    db.prepare(`UPDATE unified_orders SET status = 'SETTLED', updated_at = ? WHERE id = ?`).run(now, u.id);
    if (orderType === "trade") {
      db.prepare(`UPDATE trade_orders SET status = 'SETTLED', updated_at = ? WHERE id = ?`).run(now, orderId);
    } else {
      db.prepare(`UPDATE service_orders SET status = 'SETTLED', updated_at = ? WHERE id = ?`).run(now, orderId);
    }

    db.prepare(`UPDATE settlement_jobs SET job_status = 'COMPLETED', retry_count = ?, next_retry_at = NULL WHERE id = ?`).run(
      job.retry_count,
      job.id,
    );

    return { status: "settled", unified_order_id: u.id };
  });
}
