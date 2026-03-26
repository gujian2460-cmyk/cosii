import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { runImmediateTransaction } from "../../db/transaction.js";
import { DISPUTE_SLA_MS } from "../../shared/constants.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";

const ALLOWED_DISPUTE_UNIFIED = new Set(["PAID_ESCROW", "DEPOSIT_PAID", "SHIPPED"]);

export function createDispute(
  db: DatabaseSync,
  userId: string,
  unifiedOrderId: string,
  reason: string | undefined,
): { dispute_id: string; sla_due_at: number } {
  return runImmediateTransaction(db, () => {
    const u = db
      .prepare(`SELECT id, order_type, domain_order_id, buyer_id, seller_id, status FROM unified_orders WHERE id = ?`)
      .get(unifiedOrderId) as
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
      throw new HttpError(403, ErrorCode.BUSINESS_RULE_VIOLATION, "Not a party on this order");
    }
    if (!ALLOWED_DISPUTE_UNIFIED.has(u.status)) {
      throw new HttpError(400, ErrorCode.DISPUTE_INVALID_STATE, "Cannot open dispute in current state");
    }

    const existing = db
      .prepare(
        `SELECT id FROM order_disputes WHERE unified_order_id = ? AND dispute_status NOT IN ('CLOSED', 'DECIDED')`,
      )
      .get(u.id) as { id: string } | undefined;
    if (existing) {
      throw new HttpError(409, ErrorCode.BUSINESS_RULE_VIOLATION, "Dispute already open");
    }

    const now = Date.now();
    const slaDue = now + DISPUTE_SLA_MS;
    const disputeId = randomUUID();

    db.prepare(
      `INSERT INTO order_disputes (id, unified_order_id, order_type, order_id, dispute_status, reason, sla_due_at, created_at)
       VALUES (?, ?, ?, ?, 'OPEN', ?, ?, ?)`,
    ).run(disputeId, u.id, u.order_type, u.domain_order_id, reason ?? null, slaDue, now);

    db.prepare(`UPDATE unified_orders SET status = 'DISPUTED', updated_at = ? WHERE id = ?`).run(now, u.id);

    if (u.order_type === "trade") {
      db.prepare(`UPDATE trade_orders SET status = 'DISPUTED', updated_at = ? WHERE id = ?`).run(now, u.domain_order_id);
    } else {
      db.prepare(`UPDATE service_orders SET status = 'DISPUTED', updated_at = ? WHERE id = ?`).run(now, u.domain_order_id);
    }

    return { dispute_id: disputeId, sla_due_at: slaDue };
  });
}

export function addDisputeEvidence(
  db: DatabaseSync,
  userId: string,
  disputeId: string,
  evidenceType: string,
  evidenceUrl: string,
): { evidence_id: string } {
  return runImmediateTransaction(db, () => {
    const d = db
      .prepare(
        `SELECT d.id, d.unified_order_id, u.buyer_id, u.seller_id, d.dispute_status
         FROM order_disputes d
         JOIN unified_orders u ON u.id = d.unified_order_id
         WHERE d.id = ?`,
      )
      .get(disputeId) as
      | {
          id: string;
          unified_order_id: string;
          buyer_id: string;
          seller_id: string;
          dispute_status: string;
        }
      | undefined;

    if (!d) {
      throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Dispute not found");
    }
    if (d.buyer_id !== userId && d.seller_id !== userId) {
      throw new HttpError(403, ErrorCode.BUSINESS_RULE_VIOLATION, "Not a party on this dispute");
    }
    if (d.dispute_status === "CLOSED" || d.dispute_status === "DECIDED") {
      throw new HttpError(400, ErrorCode.DISPUTE_INVALID_STATE, "Dispute is closed");
    }

    const evidenceId = randomUUID();
    const now = Date.now();
    db.prepare(
      `INSERT INTO dispute_evidences (id, dispute_id, uploader_id, evidence_type, evidence_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(evidenceId, disputeId, userId, evidenceType, evidenceUrl, now);

    return { evidence_id: evidenceId };
  });
}

export function getDisputeDetail(db: DatabaseSync, userId: string, disputeId: string) {
  const d = db
    .prepare(
      `SELECT d.id, d.unified_order_id, d.order_type, d.order_id, d.dispute_status, d.reason, d.sla_due_at, d.created_at,
              u.buyer_id, u.seller_id, u.status AS unified_status
       FROM order_disputes d
       JOIN unified_orders u ON u.id = d.unified_order_id
       WHERE d.id = ?`,
    )
    .get(disputeId) as
    | {
        id: string;
        unified_order_id: string;
        order_type: string;
        order_id: string;
        dispute_status: string;
        reason: string | null;
        sla_due_at: number | null;
        created_at: number;
        buyer_id: string;
        seller_id: string;
        unified_status: string;
      }
    | undefined;

  if (!d) {
    throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Dispute not found");
  }
  if (d.buyer_id !== userId && d.seller_id !== userId) {
    throw new HttpError(403, ErrorCode.BUSINESS_RULE_VIOLATION, "Not allowed");
  }

  const evidences = db
    .prepare(
      `SELECT id, evidence_type, evidence_url, created_at, uploader_id FROM dispute_evidences WHERE dispute_id = ? ORDER BY created_at ASC`,
    )
    .all(disputeId) as Array<{
    id: string;
    evidence_type: string;
    evidence_url: string;
    created_at: number;
    uploader_id: string;
  }>;

  const timeline = [
    {
      kind: "dispute_opened" as const,
      at: d.created_at,
      label: "争议已发起",
    },
    ...evidences.map((e) => ({
      kind: "evidence" as const,
      at: e.created_at,
      label: "证据已提交",
      evidence_type: e.evidence_type,
      evidence_id: e.id,
    })),
  ].sort((a, b) => a.at - b.at);

  return {
    dispute_id: d.id,
    unified_order_id: d.unified_order_id,
    dispute_status: d.dispute_status,
    reason: d.reason,
    sla_due_at: d.sla_due_at,
    unified_status: d.unified_status,
    timeline,
    evidences,
  };
}
