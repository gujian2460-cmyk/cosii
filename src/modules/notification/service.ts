import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

export type UserNotificationRow = {
  notification_id: string;
  event_type: string;
  title: string;
  subtitle: string | null;
  unified_order_id: string | null;
  order_type: string | null;
  domain_order_id: string | null;
  created_at: number;
};

export type InsertNotificationInput = {
  userId: string;
  eventType: string;
  title: string;
  subtitle?: string | null;
  unifiedOrderId?: string | null;
  orderType?: "trade" | "service" | null;
  domainOrderId?: string | null;
};

/** Insert one inbox row (call inside same transaction as business write when possible). */
export function insertUserNotification(db: DatabaseSync, input: InsertNotificationInput): string {
  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO user_notifications (
       id, user_id, event_type, title, subtitle,
       unified_order_id, order_type, domain_order_id, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.userId,
    input.eventType,
    input.title,
    input.subtitle ?? null,
    input.unifiedOrderId ?? null,
    input.orderType ?? null,
    input.domainOrderId ?? null,
    now,
  );
  return id;
}

function parseCursor(cursor: string | undefined): { createdAt: number; id: string } | null {
  if (!cursor || typeof cursor !== "string") {
    return null;
  }
  const i = cursor.indexOf("|");
  if (i <= 0 || i === cursor.length - 1) {
    return null;
  }
  const createdAt = Number(cursor.slice(0, i));
  const id = cursor.slice(i + 1);
  if (!Number.isFinite(createdAt) || !id) {
    return null;
  }
  return { createdAt, id };
}

export function listNotificationsForUser(
  db: DatabaseSync,
  userId: string,
  limit: number,
  cursor: string | undefined,
): { items: UserNotificationRow[]; next_cursor: string | null } {
  const c = parseCursor(cursor);
  const rows = db
    .prepare(
      `SELECT
         id AS notification_id,
         event_type,
         title,
         subtitle,
         unified_order_id,
         order_type,
         domain_order_id,
         created_at
       FROM user_notifications
       WHERE user_id = ?
         AND (
           ? IS NULL
           OR created_at < ?
           OR (created_at = ? AND id < ?)
         )
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(
      userId,
      c ? 1 : null,
      c ? c.createdAt : null,
      c ? c.createdAt : null,
      c ? c.id : null,
      limit,
    ) as Array<{
    notification_id: string;
    event_type: string;
    title: string;
    subtitle: string | null;
    unified_order_id: string | null;
    order_type: string | null;
    domain_order_id: string | null;
    created_at: number;
  }>;

  const items: UserNotificationRow[] = rows.map((r) => ({
    notification_id: r.notification_id,
    event_type: r.event_type,
    title: r.title,
    subtitle: r.subtitle,
    unified_order_id: r.unified_order_id,
    order_type: r.order_type === "service" ? "service" : r.order_type === "trade" ? "trade" : null,
    domain_order_id: r.domain_order_id,
    created_at: r.created_at,
  }));

  const last = items[items.length - 1];
  const next_cursor =
    items.length === limit && last ? `${last.created_at}|${last.notification_id}` : null;

  return { items, next_cursor };
}
