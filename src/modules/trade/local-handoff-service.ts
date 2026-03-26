import type { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { runImmediateTransaction } from "../../db/transaction.js";
import {
  LOCAL_VERIFICATION_MAX_ATTEMPTS,
  LOCAL_VERIFICATION_TTL_MS,
} from "../../shared/constants.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";

function pepper(): string {
  return process.env.LOCAL_CODE_PEPPER?.trim() || "cosii-dev-pepper";
}

export function hashLocalCode(raw: string): string {
  const code = raw.trim().toUpperCase();
  return createHash("sha256").update(`${pepper()}:${code}`, "utf8").digest("hex");
}

function generateLocalCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

function ensureLocalFulfillment(db: DatabaseSync, tradeOrderId: string, now: number): string {
  const existing = db
    .prepare(`SELECT id FROM trade_fulfillments WHERE trade_order_id = ? AND ship_mode = 'LOCAL' LIMIT 1`)
    .get(tradeOrderId) as { id: string } | undefined;
  if (existing) {
    return existing.id;
  }
  const fid = randomUUID();
  db.prepare(
    `INSERT INTO trade_fulfillments (id, trade_order_id, ship_mode, tracking_no, proof_url, created_at)
     VALUES (?, ?, 'LOCAL', NULL, NULL, ?)`,
  ).run(fid, tradeOrderId, now);
  return fid;
}

type TradeRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
};

function loadTrade(db: DatabaseSync, tradeOrderId: string): TradeRow {
  const row = db
    .prepare(`SELECT id, buyer_id, seller_id, status FROM trade_orders WHERE id = ?`)
    .get(tradeOrderId) as TradeRow | undefined;
  if (!row) {
    throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Trade order not found");
  }
  return row;
}

export function issueLocalVerificationCode(
  db: DatabaseSync,
  input: { buyerId: string; tradeOrderId: string; traceId: string },
): { code: string; expires_at: number; trade_order_id: string } {
  return runImmediateTransaction(db, () => {
    const order = loadTrade(db, input.tradeOrderId);
    if (order.buyer_id !== input.buyerId) {
      throw new HttpError(403, ErrorCode.BUSINESS_RULE_VIOLATION, "Only buyer can issue handoff code");
    }
    if (order.status !== "PAID_ESCROW") {
      throw new HttpError(409, ErrorCode.BUSINESS_RULE_VIOLATION, "Order must be paid before handoff code");
    }

    const now = Date.now();
    const existing = db
      .prepare(`SELECT id, status, expires_at FROM trade_local_verifications WHERE trade_order_id = ?`)
      .get(order.id) as { id: string; status: string; expires_at: number } | undefined;

    if (existing?.status === "COMPLETED") {
      throw new HttpError(409, ErrorCode.BUSINESS_RULE_VIOLATION, "Handoff already completed");
    }
    if (existing?.status === "PENDING" && existing.expires_at > now) {
      throw new HttpError(409, ErrorCode.BUSINESS_RULE_VIOLATION, "Handoff code already issued");
    }

    const code = generateLocalCode();
    const codeHash = hashLocalCode(code);
    const expiresAt = now + LOCAL_VERIFICATION_TTL_MS;
    const fulfillmentId = ensureLocalFulfillment(db, order.id, now);

    if (existing) {
      db.prepare(
        `UPDATE trade_local_verifications
         SET code_hash = ?, status = 'PENDING', expires_at = ?, failed_attempts = 0,
             fulfillment_id = ?, trace_id_issue = ?, updated_at = ?, completed_at = NULL, trace_id_redeem = NULL
         WHERE id = ?`,
      ).run(codeHash, expiresAt, fulfillmentId, input.traceId, now, existing.id);
    } else {
      const vid = randomUUID();
      db.prepare(
        `INSERT INTO trade_local_verifications (
           id, trade_order_id, code_hash, status, expires_at, failed_attempts, max_attempts,
           fulfillment_id, trace_id_issue, completed_at, created_at, updated_at
         ) VALUES (?, ?, ?, 'PENDING', ?, 0, ?, ?, ?, NULL, ?, ?)`,
      ).run(
        vid,
        order.id,
        codeHash,
        expiresAt,
        LOCAL_VERIFICATION_MAX_ATTEMPTS,
        fulfillmentId,
        input.traceId,
        now,
        now,
      );
    }

    return { code, expires_at: expiresAt, trade_order_id: order.id };
  });
}

export function redeemLocalVerificationCode(
  db: DatabaseSync,
  input: { sellerId: string; tradeOrderId: string; code: string; traceId: string },
): { duplicate: boolean; trade_order_id: string; unified_status: string } {
  const order = loadTrade(db, input.tradeOrderId);
  if (order.seller_id !== input.sellerId) {
    throw new HttpError(403, ErrorCode.BUSINESS_RULE_VIOLATION, "Only seller can redeem handoff code");
  }

  const tlv = db
    .prepare(
      `SELECT id, status, expires_at, failed_attempts, max_attempts, code_hash
       FROM trade_local_verifications WHERE trade_order_id = ?`,
    )
    .get(order.id) as
    | {
        id: string;
        status: string;
        expires_at: number;
        failed_attempts: number;
        max_attempts: number;
        code_hash: string;
      }
    | undefined;

  if (!tlv) {
    throw new HttpError(400, ErrorCode.LOCAL_VERIFICATION_INVALID, "No handoff code for this order");
  }

  if (tlv.status === "COMPLETED") {
    const u = db
      .prepare(`SELECT status FROM unified_orders WHERE order_type = 'trade' AND domain_order_id = ?`)
      .get(order.id) as { status: string } | undefined;
    return {
      duplicate: true,
      trade_order_id: order.id,
      unified_status: u?.status ?? order.status,
    };
  }

  if (tlv.status === "FAILED") {
    throw new HttpError(400, ErrorCode.LOCAL_VERIFICATION_LOCKED, "Handoff verification locked");
  }

  const now = Date.now();
  if (tlv.expires_at <= now || tlv.status === "EXPIRED") {
    if (tlv.status === "PENDING") {
      runImmediateTransaction(db, () => {
        db.prepare(
          `UPDATE trade_local_verifications SET status = 'EXPIRED', updated_at = ? WHERE id = ? AND status = 'PENDING'`,
        ).run(now, tlv.id);
      });
    }
    throw new HttpError(400, ErrorCode.LOCAL_VERIFICATION_EXPIRED, "Handoff code expired");
  }

  const expectedHash = hashLocalCode(input.code);
  if (expectedHash !== tlv.code_hash) {
    const outcome = runImmediateTransaction(db, () => {
      const row = db
        .prepare(
          `SELECT failed_attempts, max_attempts FROM trade_local_verifications WHERE id = ? AND status = 'PENDING'`,
        )
        .get(tlv.id) as { failed_attempts: number; max_attempts: number } | undefined;
      if (!row) {
        return "invalid" as const;
      }
      const failsSoFar = Number(row.failed_attempts) || 0;
      const maxFails = Number(row.max_attempts) || LOCAL_VERIFICATION_MAX_ATTEMPTS;
      const nextFails = failsSoFar + 1;
      const t = Date.now();
      if (nextFails >= maxFails) {
        db.prepare(
          `UPDATE trade_local_verifications SET failed_attempts = ?, status = 'FAILED', updated_at = ? WHERE id = ? AND status = 'PENDING'`,
        ).run(nextFails, t, tlv.id);
        return "locked" as const;
      }
      db.prepare(
        `UPDATE trade_local_verifications SET failed_attempts = ?, updated_at = ? WHERE id = ? AND status = 'PENDING'`,
      ).run(nextFails, t, tlv.id);
      return "invalid" as const;
    });
    if (outcome === "locked") {
      throw new HttpError(400, ErrorCode.LOCAL_VERIFICATION_LOCKED, "Too many invalid attempts");
    }
    throw new HttpError(400, ErrorCode.LOCAL_VERIFICATION_INVALID, "Invalid handoff code");
  }

  return runImmediateTransaction(db, () => {
    const u = db
      .prepare(`SELECT id, status FROM unified_orders WHERE order_type = 'trade' AND domain_order_id = ?`)
      .get(order.id) as { id: string; status: string } | undefined;
    if (!u) {
      throw new HttpError(500, ErrorCode.INTERNAL_ERROR, "Unified order missing");
    }

    const tNow = Date.now();
    const vUpd = db
      .prepare(
        `UPDATE trade_local_verifications
         SET status = 'COMPLETED', completed_at = ?, trace_id_redeem = ?, updated_at = ?
         WHERE id = ? AND status = 'PENDING'`,
      )
      .run(tNow, input.traceId, tNow, tlv.id);

    if (Number(vUpd.changes) === 0) {
      const again = db
        .prepare(`SELECT status FROM trade_local_verifications WHERE id = ?`)
        .get(tlv.id) as { status: string } | undefined;
      if (again?.status === "COMPLETED") {
        const u2 = db
          .prepare(`SELECT status FROM unified_orders WHERE order_type = 'trade' AND domain_order_id = ?`)
          .get(order.id) as { status: string } | undefined;
        return { duplicate: true, trade_order_id: order.id, unified_status: u2?.status ?? order.status };
      }
      throw new HttpError(409, ErrorCode.BUSINESS_RULE_VIOLATION, "Could not complete handoff");
    }

    const ord = db
      .prepare(`SELECT status FROM trade_orders WHERE id = ?`)
      .get(order.id) as { status: string };

    if (ord.status === "PAID_ESCROW") {
      const tr = db
        .prepare(`UPDATE trade_orders SET status = 'SHIPPED', updated_at = ? WHERE id = ? AND status = 'PAID_ESCROW'`)
        .run(tNow, order.id);
      if (Number(tr.changes) === 0) {
        throw new HttpError(409, ErrorCode.BUSINESS_RULE_VIOLATION, "Trade order state changed");
      }
      const ur = db
        .prepare(
          `UPDATE unified_orders SET status = 'SHIPPED', updated_at = ? WHERE id = ? AND status = 'PAID_ESCROW'`,
        )
        .run(tNow, u.id);
      if (Number(ur.changes) === 0) {
        throw new HttpError(409, ErrorCode.BUSINESS_RULE_VIOLATION, "Unified order state changed");
      }
    }

    const u3 = db.prepare(`SELECT status FROM unified_orders WHERE id = ?`).get(u.id) as { status: string };
    return { duplicate: false, trade_order_id: order.id, unified_status: u3.status };
  });
}

export function getLocalVerificationStatus(
  db: DatabaseSync,
  userId: string,
  tradeOrderId: string,
): {
  trade_order_id: string;
  status: string;
  expires_at: number | null;
  failed_attempts: number | null;
  max_attempts: number | null;
} {
  const order = loadTrade(db, tradeOrderId);
  if (order.buyer_id !== userId && order.seller_id !== userId) {
    throw new HttpError(403, ErrorCode.BUSINESS_RULE_VIOLATION, "Not a party on this order");
  }

  const tlv = db
    .prepare(
      `SELECT status, expires_at, failed_attempts, max_attempts FROM trade_local_verifications WHERE trade_order_id = ?`,
    )
    .get(order.id) as
    | { status: string; expires_at: number; failed_attempts: number; max_attempts: number }
    | undefined;

  if (!tlv) {
    return {
      trade_order_id: order.id,
      status: "none",
      expires_at: null,
      failed_attempts: null,
      max_attempts: null,
    };
  }

  const now = Date.now();
  let status = tlv.status;
  if (status === "PENDING" && tlv.expires_at <= now) {
    status = "EXPIRED";
  }

  return {
    trade_order_id: order.id,
    status,
    expires_at: tlv.expires_at,
    failed_attempts: tlv.failed_attempts,
    max_attempts: tlv.max_attempts,
  };
}
