import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { runImmediateTransaction } from "../../db/transaction.js";
import { SLOT_HOLD_TTL_MS } from "../../shared/constants.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { stableRequestHash } from "../../shared/idempotency.js";

export type CreateBookingOrderInput = {
  buyerId: string;
  slotId: string;
  depositAmount: number;
  finalAmount: number;
  idempotencyKey?: string;
  bodyForHash: Record<string, unknown>;
};

export type CreateBookingOrderResult = {
  service_order_id: string;
  unified_order_id: string;
  status: string;
  deposit_amount: number;
  final_amount: number;
  hold_expires_at: number;
};

export function createBookingOrder(
  db: DatabaseSync,
  input: CreateBookingOrderInput,
): CreateBookingOrderResult {
  const scope = "service_order_create";
  const reqHash = stableRequestHash(input.bodyForHash);

  if (input.depositAmount < 0 || input.finalAmount < 0) {
    throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Amounts must be non-negative integers");
  }

  if (input.idempotencyKey) {
    const existing = db
      .prepare(
        `SELECT ik.request_hash, ik.unified_order_id, u.domain_order_id
         FROM idempotency_keys ik
         JOIN unified_orders u ON u.id = ik.unified_order_id
         WHERE ik.user_id = ? AND ik.scope = ? AND ik.idempotency_key = ?`,
      )
      .get(input.buyerId, scope, input.idempotencyKey) as
      | { request_hash: string; unified_order_id: string; domain_order_id: string }
      | undefined;

    if (existing) {
      if (existing.request_hash !== reqHash) {
        throw new HttpError(409, ErrorCode.IDEMPOTENCY_CONFLICT, "Idempotency key reused with different payload");
      }
      const row = db
        .prepare(`SELECT id, status, deposit_amount, final_amount FROM service_orders WHERE id = ?`)
        .get(existing.domain_order_id) as {
        id: string;
        status: string;
        deposit_amount: number;
        final_amount: number;
      };
      const holdRow = db
        .prepare(`SELECT hold_expires_at FROM service_orders WHERE id = ?`)
        .get(existing.domain_order_id) as { hold_expires_at: number | null };
      return {
        service_order_id: row.id,
        unified_order_id: existing.unified_order_id,
        status: row.status,
        deposit_amount: row.deposit_amount,
        final_amount: row.final_amount,
        hold_expires_at: holdRow.hold_expires_at ?? 0,
      };
    }
  }

  return runImmediateTransaction(db, () => {
    const slot = db
      .prepare(
        `SELECT id, artist_id, slot_status, slot_start, slot_end FROM artist_slots WHERE id = ?`,
      )
      .get(input.slotId) as
      | { id: string; artist_id: string; slot_status: string; slot_start: number; slot_end: number }
      | undefined;

    if (!slot) {
      throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Slot not found");
    }

    if (slot.artist_id === input.buyerId) {
      throw new HttpError(400, ErrorCode.BUSINESS_RULE_VIOLATION, "Cannot book own slot");
    }

    const lock = db
      .prepare(
        `UPDATE artist_slots SET slot_status = 'HELD' WHERE id = ? AND slot_status = 'AVAILABLE'`,
      )
      .run(slot.id);

    if (Number(lock.changes) === 0) {
      throw new HttpError(409, ErrorCode.BOOKING_SLOT_CONFLICT, "Slot is no longer available");
    }

    const overlappingHeld = db
      .prepare(
        `SELECT id FROM artist_slots
         WHERE artist_id = ? AND id != ? AND slot_status = 'HELD'
           AND slot_start < ? AND slot_end > ?`,
      )
      .get(slot.artist_id, slot.id, slot.slot_end, slot.slot_start) as { id: string } | undefined;

    if (overlappingHeld) {
      throw new HttpError(
        409,
        ErrorCode.BOOKING_SLOT_CONFLICT,
        "Time range overlaps another held slot for this artist",
      );
    }

    const now = Date.now();
    const holdExpiresAt = now + SLOT_HOLD_TTL_MS;
    const serviceId = randomUUID();
    const unifiedId = randomUUID();

    db.prepare(
      `INSERT INTO service_orders (id, buyer_id, artist_id, slot_id, status, deposit_amount, final_amount, hold_expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'SLOT_HELD', ?, ?, ?, ?, ?)`,
    ).run(
      serviceId,
      input.buyerId,
      slot.artist_id,
      slot.id,
      input.depositAmount,
      input.finalAmount,
      holdExpiresAt,
      now,
      now,
    );

    db.prepare(
      `INSERT INTO unified_orders (id, order_type, domain_order_id, buyer_id, seller_id, status, created_at, updated_at)
       VALUES (?, 'service', ?, ?, ?, 'SLOT_HELD', ?, ?)`,
    ).run(unifiedId, serviceId, input.buyerId, slot.artist_id, now, now);

    if (input.idempotencyKey) {
      const ik = randomUUID();
      db.prepare(
        `INSERT INTO idempotency_keys (id, user_id, scope, idempotency_key, unified_order_id, request_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(ik, input.buyerId, scope, input.idempotencyKey, unifiedId, reqHash, now);
    }

    return {
      service_order_id: serviceId,
      unified_order_id: unifiedId,
      status: "SLOT_HELD",
      deposit_amount: input.depositAmount,
      final_amount: input.finalAmount,
      hold_expires_at: holdExpiresAt,
    };
  });
}
