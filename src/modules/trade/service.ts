import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { runImmediateTransaction } from "../../db/transaction.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { stableRequestHash } from "../../shared/idempotency.js";

export type CreateTradeOrderInput = {
  buyerId: string;
  itemId: string;
  idempotencyKey?: string;
  bodyForHash: Record<string, unknown>;
};

export type CreateTradeOrderResult = {
  trade_order_id: string;
  unified_order_id: string;
  status: string;
  total_amount: number;
};

export function createTradeOrder(
  db: DatabaseSync,
  input: CreateTradeOrderInput,
): CreateTradeOrderResult {
  const scope = "trade_order_create";
  const reqHash = stableRequestHash(input.bodyForHash);

  if (input.idempotencyKey) {
    const existing = db
      .prepare(
        `SELECT ik.request_hash, ik.unified_order_id, u.order_type, u.domain_order_id
         FROM idempotency_keys ik
         JOIN unified_orders u ON u.id = ik.unified_order_id
         WHERE ik.user_id = ? AND ik.scope = ? AND ik.idempotency_key = ?`,
      )
      .get(input.buyerId, scope, input.idempotencyKey) as
      | {
          request_hash: string;
          unified_order_id: string;
          order_type: string;
          domain_order_id: string;
        }
      | undefined;

    if (existing) {
      if (existing.request_hash !== reqHash) {
        throw new HttpError(409, ErrorCode.IDEMPOTENCY_CONFLICT, "Idempotency key reused with different payload");
      }
      const row = db
        .prepare(`SELECT id, status, total_amount FROM trade_orders WHERE id = ?`)
        .get(existing.domain_order_id) as { id: string; status: string; total_amount: number };
      return {
        trade_order_id: row.id,
        unified_order_id: existing.unified_order_id,
        status: row.status,
        total_amount: row.total_amount,
      };
    }
  }

  return runImmediateTransaction(db, () => {
    const item = db
      .prepare(
        `SELECT id, seller_id, price, status FROM trade_items WHERE id = ?`,
      )
      .get(input.itemId) as
      | { id: string; seller_id: string; price: number; status: string }
      | undefined;

    if (!item) {
      throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Item not found");
    }

    if (item.seller_id === input.buyerId) {
      throw new HttpError(400, ErrorCode.BUSINESS_RULE_VIOLATION, "Buyer cannot purchase own listing");
    }

    if (item.status !== "LISTED") {
      throw new HttpError(409, ErrorCode.ITEM_UNAVAILABLE, "Item is not available for purchase");
    }

    const upd = db
      .prepare(`UPDATE trade_items SET status = 'RESERVED' WHERE id = ? AND status = 'LISTED'`)
      .run(item.id);

    if (Number(upd.changes) === 0) {
      throw new HttpError(409, ErrorCode.ITEM_UNAVAILABLE, "Item was reserved by another order");
    }

    const now = Date.now();
    const tradeId = randomUUID();
    const unifiedId = randomUUID();

    db.prepare(
      `INSERT INTO trade_orders (id, buyer_id, seller_id, item_id, status, total_amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'PENDING_PAYMENT', ?, ?, ?)`,
    ).run(tradeId, input.buyerId, item.seller_id, item.id, item.price, now, now);

    db.prepare(
      `INSERT INTO unified_orders (id, order_type, domain_order_id, buyer_id, seller_id, status, created_at, updated_at)
       VALUES (?, 'trade', ?, ?, ?, 'PENDING_PAYMENT', ?, ?)`,
    ).run(unifiedId, tradeId, input.buyerId, item.seller_id, now, now);

    if (input.idempotencyKey) {
      const ik = randomUUID();
      db.prepare(
        `INSERT INTO idempotency_keys (id, user_id, scope, idempotency_key, unified_order_id, request_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(ik, input.buyerId, scope, input.idempotencyKey, unifiedId, reqHash, now);
    }

    return {
      trade_order_id: tradeId,
      unified_order_id: unifiedId,
      status: "PENDING_PAYMENT",
      total_amount: item.price,
    };
  });
}
