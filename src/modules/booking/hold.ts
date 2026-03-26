import type { DatabaseSync } from "node:sqlite";
import { runImmediateTransaction } from "../../db/transaction.js";

/**
 * 档期占位过期：释放 slot、订单与 unified 状态置 EXPIRED（DESIGN.md 档期占位）。
 * 在事务内执行；若未过期则 no-op。
 */
export function expireSlotHoldIfNeeded(db: DatabaseSync, serviceOrderId: string): boolean {
  return runImmediateTransaction(db, () => {
    const row = db
      .prepare(
        `SELECT id, slot_id, status, hold_expires_at FROM service_orders WHERE id = ?`,
      )
      .get(serviceOrderId) as
      | { id: string; slot_id: string; status: string; hold_expires_at: number | null }
      | undefined;

    if (!row || row.status !== "SLOT_HELD") {
      return false;
    }
    if (!row.hold_expires_at || row.hold_expires_at > Date.now()) {
      return false;
    }

    const now = Date.now();
    db.prepare(`UPDATE artist_slots SET slot_status = 'AVAILABLE' WHERE id = ?`).run(row.slot_id);
    db.prepare(`UPDATE service_orders SET status = 'EXPIRED', updated_at = ? WHERE id = ?`).run(now, row.id);

    const u = db
      .prepare(`SELECT id FROM unified_orders WHERE order_type = 'service' AND domain_order_id = ?`)
      .get(serviceOrderId) as { id: string } | undefined;
    if (u) {
      db.prepare(`UPDATE unified_orders SET status = 'EXPIRED', updated_at = ? WHERE id = ?`).run(now, u.id);
    }

    return true;
  });
}
