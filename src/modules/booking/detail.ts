import type { DatabaseSync } from "node:sqlite";
import { expireSlotHoldIfNeeded } from "./hold.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";

export type ServiceOrderDetail = {
  service_order_id: string;
  unified_order_id: string;
  status: string;
  deposit_amount: number;
  final_amount: number;
  hold_expires_at: number | null;
  slot_hold_expired: boolean;
  /** 当前登录用户是否为买家（支付定金等 CTA） */
  is_buyer: boolean;
};

export function getServiceOrderDetail(
  db: DatabaseSync,
  userId: string,
  serviceOrderId: string,
): ServiceOrderDetail {
  expireSlotHoldIfNeeded(db, serviceOrderId);

  const s = db
    .prepare(
      `SELECT id, buyer_id, artist_id, status, deposit_amount, final_amount, hold_expires_at FROM service_orders WHERE id = ?`,
    )
    .get(serviceOrderId) as
    | {
        id: string;
        buyer_id: string;
        artist_id: string;
        status: string;
        deposit_amount: number;
        final_amount: number;
        hold_expires_at: number | null;
      }
    | undefined;

  if (!s) {
    throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Service order not found");
  }
  if (s.buyer_id !== userId && s.artist_id !== userId) {
    throw new HttpError(403, ErrorCode.BUSINESS_RULE_VIOLATION, "Not allowed");
  }

  const u = db
    .prepare(`SELECT id FROM unified_orders WHERE order_type = 'service' AND domain_order_id = ?`)
    .get(serviceOrderId) as { id: string } | undefined;

  const expired =
    s.status === "EXPIRED" ||
    (s.status === "SLOT_HELD" && s.hold_expires_at !== null && s.hold_expires_at <= Date.now());

  return {
    service_order_id: s.id,
    unified_order_id: u?.id ?? "",
    status: s.status,
    deposit_amount: s.deposit_amount,
    final_amount: s.final_amount,
    hold_expires_at: s.hold_expires_at,
    slot_hold_expired: expired,
    is_buyer: s.buyer_id === userId,
  };
}
