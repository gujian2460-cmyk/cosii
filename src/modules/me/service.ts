import type { DatabaseSync } from "node:sqlite";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";

export type UnifiedOrderListItem = {
  unified_order_id: string;
  order_type: "trade" | "service";
  domain_order_id: string;
  status: string;
  title: string;
  amount_cents: number;
  updated_at: number;
};

export type MeProfile = {
  is_logged_in: boolean;
  profile: null | {
    user_id: string;
    nickname: string;
    role: string;
    status: string;
    avatar_url: string | null;
  };
};

function parseCursor(cursor: string | undefined): { updatedAt: number; id: string } | null {
  if (!cursor || typeof cursor !== "string") {
    return null;
  }
  const i = cursor.indexOf("|");
  if (i <= 0 || i === cursor.length - 1) {
    return null;
  }
  const updatedAt = Number(cursor.slice(0, i));
  const id = cursor.slice(i + 1);
  if (!Number.isFinite(updatedAt) || !id) {
    return null;
  }
  return { updatedAt, id };
}

/** Cursor pagination: sort by updated_at DESC, id DESC (stable tie-break). */
export function listUnifiedOrdersForUser(
  db: DatabaseSync,
  userId: string,
  limit: number,
  cursor: string | undefined,
  filter?: { orderType?: "trade" | "service"; status?: string },
): { items: UnifiedOrderListItem[]; next_cursor: string | null } {
  const c = parseCursor(cursor);
  const orderType = filter?.orderType ?? null;
  const status = filter?.status?.trim() || null;
  const rows = db
    .prepare(
      `SELECT
         u.id AS unified_order_id,
         u.order_type AS order_type,
         u.domain_order_id AS domain_order_id,
         u.status AS status,
         u.updated_at AS updated_at,
         COALESCE(
           (SELECT i.title FROM trade_orders t
            JOIN trade_items i ON i.id = t.item_id
            WHERE t.id = u.domain_order_id AND u.order_type = 'trade'),
           '约妆订单'
         ) AS title,
         COALESCE(
           (SELECT op.amount FROM order_payments op
            WHERE op.unified_order_id = u.id
            ORDER BY op.created_at DESC LIMIT 1),
           CASE u.order_type
             WHEN 'trade' THEN (SELECT t.total_amount FROM trade_orders t WHERE t.id = u.domain_order_id)
             ELSE (SELECT so.deposit_amount + so.final_amount FROM service_orders so WHERE so.id = u.domain_order_id)
           END,
           0
         ) AS amount_cents
       FROM unified_orders u
       WHERE (u.buyer_id = ? OR u.seller_id = ?)
         AND (? IS NULL OR u.order_type = ?)
         AND (? IS NULL OR u.status = ?)
         AND (
           ? IS NULL
           OR u.updated_at < ?
           OR (u.updated_at = ? AND u.id < ?)
         )
       ORDER BY u.updated_at DESC, u.id DESC
       LIMIT ?`,
    )
    .all(
      userId,
      userId,
      orderType,
      orderType,
      status,
      status,
      c ? 1 : null,
      c ? c.updatedAt : null,
      c ? c.updatedAt : null,
      c ? c.id : null,
      limit,
    ) as Array<{
      unified_order_id: string;
      order_type: string;
      domain_order_id: string;
      status: string;
      updated_at: number;
      title: string;
      amount_cents: number | null;
    }>;

  const items: UnifiedOrderListItem[] = rows.map((r) => ({
    unified_order_id: r.unified_order_id,
    order_type: r.order_type === "service" ? "service" : "trade",
    domain_order_id: r.domain_order_id,
    status: r.status,
    title: r.title,
    amount_cents: Number(r.amount_cents ?? 0),
    updated_at: r.updated_at,
  }));

  const last = items[items.length - 1];
  const next_cursor =
    items.length === limit && last ? `${last.updated_at}|${last.unified_order_id}` : null;

  return { items, next_cursor };
}

export function getMeProfile(db: DatabaseSync, userId: string | null): MeProfile {
  if (!userId) {
    return { is_logged_in: false, profile: null };
  }

  const u = db
    .prepare(`SELECT id, role, status FROM users WHERE id = ?`)
    .get(userId) as { id: string; role: string; status: string } | undefined;

  if (!u) {
    return { is_logged_in: false, profile: null };
  }

  return {
    is_logged_in: true,
    profile: {
      user_id: u.id,
      nickname: `用户${u.id.slice(-4)}`,
      role: u.role,
      status: u.status,
      avatar_url: null,
    },
  };
}

export function getUnifiedOrderListItemForUser(
  db: DatabaseSync,
  userId: string,
  unifiedOrderId: string,
): UnifiedOrderListItem {
  const row = db
    .prepare(
      `SELECT
         u.id AS unified_order_id,
         u.order_type AS order_type,
         u.domain_order_id AS domain_order_id,
         u.status AS status,
         u.updated_at AS updated_at,
         COALESCE(
           (SELECT i.title FROM trade_orders t
            JOIN trade_items i ON i.id = t.item_id
            WHERE t.id = u.domain_order_id AND u.order_type = 'trade'),
           '约妆订单'
         ) AS title,
         COALESCE(
           (SELECT op.amount FROM order_payments op
            WHERE op.unified_order_id = u.id
            ORDER BY op.created_at DESC LIMIT 1),
           CASE u.order_type
             WHEN 'trade' THEN (SELECT t.total_amount FROM trade_orders t WHERE t.id = u.domain_order_id)
             ELSE (SELECT so.deposit_amount + so.final_amount FROM service_orders so WHERE so.id = u.domain_order_id)
           END,
           0
         ) AS amount_cents
       FROM unified_orders u
       WHERE u.id = ?
         AND (u.buyer_id = ? OR u.seller_id = ?)`,
    )
    .get(unifiedOrderId, userId, userId) as
    | {
        unified_order_id: string;
        order_type: string;
        domain_order_id: string;
        status: string;
        updated_at: number;
        title: string;
        amount_cents: number | null;
      }
    | undefined;

  if (!row) {
    throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Order not found");
  }

  return {
    unified_order_id: row.unified_order_id,
    order_type: row.order_type === "service" ? "service" : "trade",
    domain_order_id: row.domain_order_id,
    status: row.status,
    title: row.title,
    amount_cents: Number(row.amount_cents ?? 0),
    updated_at: row.updated_at,
  };
}
