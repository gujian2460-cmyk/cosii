import type { DatabaseSync } from "node:sqlite";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";

export type TradeOrderDetail = {
  trade_order_id: string;
  unified_order_id: string;
  status: string;
  total_amount: number;
  item_title: string;
  /** 当前登录用户是否为买家（用于小程序主 CTA：支付 / 提货码） */
  is_buyer: boolean;
};

export function getTradeOrderDetail(db: DatabaseSync, userId: string, tradeOrderId: string): TradeOrderDetail {
  const row = db
    .prepare(
      `SELECT t.id AS trade_order_id, t.buyer_id, t.seller_id, t.status, t.total_amount, i.title AS item_title
       FROM trade_orders t
       JOIN trade_items i ON i.id = t.item_id
       WHERE t.id = ?`,
    )
    .get(tradeOrderId) as
    | {
        trade_order_id: string;
        buyer_id: string;
        seller_id: string;
        status: string;
        total_amount: number;
        item_title: string;
      }
    | undefined;

  if (!row) {
    throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Trade order not found");
  }
  if (row.buyer_id !== userId && row.seller_id !== userId) {
    throw new HttpError(403, ErrorCode.BUSINESS_RULE_VIOLATION, "Not allowed");
  }

  const u = db
    .prepare(`SELECT id FROM unified_orders WHERE order_type = 'trade' AND domain_order_id = ?`)
    .get(tradeOrderId) as { id: string } | undefined;

  return {
    trade_order_id: row.trade_order_id,
    unified_order_id: u?.id ?? "",
    status: row.status,
    total_amount: row.total_amount,
    item_title: row.item_title,
    is_buyer: row.buyer_id === userId,
  };
}
