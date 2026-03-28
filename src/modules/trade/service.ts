import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { runImmediateTransaction } from "../../db/transaction.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { stableRequestHash } from "../../shared/idempotency.js";
import { insertUserNotification } from "../notification/service.js";

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

export type TradeItemListItem = {
  item_id: string;
  title: string;
  category: string;
  price_cents: number;
  seller_id: string;
  created_at: number;
};

/** 与在售列表筛选、发布表单一致 */
export const TRADE_ITEM_CATEGORIES = ["wig", "props", "costume"] as const;
export type TradeItemCategory = (typeof TRADE_ITEM_CATEGORIES)[number];

export type CreateTradeItemResult = {
  item_id: string;
};

export function createTradeItem(
  db: DatabaseSync,
  input: { sellerId: string; title: string; category: TradeItemCategory; priceCents: number },
): CreateTradeItemResult {
  const title = input.title.trim();
  if (!title) {
    throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Title required");
  }
  if (!TRADE_ITEM_CATEGORIES.includes(input.category)) {
    throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Invalid category");
  }
  if (!Number.isInteger(input.priceCents) || input.priceCents < 1 || input.priceCents > 50_000_000) {
    throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Invalid price_cents");
  }

  const seller = db.prepare(`SELECT id FROM users WHERE id = ?`).get(input.sellerId) as { id: string } | undefined;
  if (!seller) {
    throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "User not found");
  }

  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO trade_items (id, seller_id, title, category, price, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'LISTED', ?)`,
  ).run(id, input.sellerId, title, input.category, input.priceCents, now);

  return { item_id: id };
}

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
        `SELECT id, seller_id, price, status, title FROM trade_items WHERE id = ?`,
      )
      .get(input.itemId) as
      | { id: string; seller_id: string; price: number; status: string; title: string }
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

    insertUserNotification(db, {
      userId: input.buyerId,
      eventType: "trade_order_created_buyer",
      title: "订单已创建",
      subtitle: `${item.title} · 请尽快完成支付`,
      unifiedOrderId: unifiedId,
      orderType: "trade",
      domainOrderId: tradeId,
    });
    insertUserNotification(db, {
      userId: item.seller_id,
      eventType: "trade_order_created_seller",
      title: "新订单",
      subtitle: `${item.title} · 等待买家支付`,
      unifiedOrderId: unifiedId,
      orderType: "trade",
      domainOrderId: tradeId,
    });

    return {
      trade_order_id: tradeId,
      unified_order_id: unifiedId,
      status: "PENDING_PAYMENT",
      total_amount: item.price,
    };
  });
}

function parseItemCursor(cursor: string | undefined): { createdAt: number; id: string } | null {
  if (!cursor) return null;
  const i = cursor.indexOf("|");
  if (i <= 0 || i >= cursor.length - 1) return null;
  const createdAt = Number(cursor.slice(0, i));
  const id = cursor.slice(i + 1);
  if (!Number.isFinite(createdAt) || !id) return null;
  return { createdAt, id };
}

export function listTradeItems(
  db: DatabaseSync,
  input: {
    limit: number;
    cursor?: string;
    category?: string;
    priceMin?: number;
    priceMax?: number;
  },
): { items: TradeItemListItem[]; next_cursor: string | null } {
  const c = parseItemCursor(input.cursor);
  const category = input.category?.trim() || null;
  const priceMin = typeof input.priceMin === "number" ? input.priceMin : null;
  const priceMax = typeof input.priceMax === "number" ? input.priceMax : null;

  const rows = db
    .prepare(
      `SELECT id, seller_id, title, category, price, created_at
       FROM trade_items
       WHERE status = 'LISTED'
         AND (? IS NULL OR category = ?)
         AND (? IS NULL OR price >= ?)
         AND (? IS NULL OR price <= ?)
         AND (
           ? IS NULL
           OR created_at < ?
           OR (created_at = ? AND id < ?)
         )
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(
      category,
      category,
      priceMin,
      priceMin,
      priceMax,
      priceMax,
      c ? 1 : null,
      c ? c.createdAt : null,
      c ? c.createdAt : null,
      c ? c.id : null,
      input.limit,
    ) as Array<{
    id: string;
    seller_id: string;
    title: string;
    category: string;
    price: number;
    created_at: number;
  }>;

  const items: TradeItemListItem[] = rows.map((r) => ({
    item_id: r.id,
    title: r.title,
    category: r.category,
    price_cents: r.price,
    seller_id: r.seller_id,
    created_at: r.created_at,
  }));

  const last = items[items.length - 1];
  const next_cursor =
    items.length === input.limit && last ? `${last.created_at}|${last.item_id}` : null;

  return { items, next_cursor };
}
