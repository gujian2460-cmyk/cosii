/**
 * 统一订单状态 / 类型 — 用户可读文案（与 unified_orders.status 对齐）
 */
var STATUS_LABELS = {
  PENDING_PAYMENT: "待付款",
  PAID_ESCROW: "担保交易中",
  DEPOSIT_PAID: "已付定金",
  SLOT_HELD: "档期已占位",
  SHIPPED: "待确认收货",
  COMPLETED: "已完成",
  DISPUTED: "争议处理中",
  EXPIRED: "已过期",
  CANCELLED: "已取消",
  CANCELED: "已取消",
  REFUNDED: "已退款",
};

function unifiedStatusLabel(code) {
  if (!code) {
    return "";
  }
  return STATUS_LABELS[code] || code;
}

function orderTypeLabel(t) {
  if (t === "trade") {
    return "闲置";
  }
  if (t === "service") {
    return "约妆";
  }
  return t || "";
}

var TRADE_CATEGORY_LABELS = {
  wig: "假发",
  props: "道具",
  costume: "服装",
};

function tradeCategoryLabel(id) {
  if (!id) {
    return "";
  }
  return TRADE_CATEGORY_LABELS[id] || id;
}

module.exports = {
  unifiedStatusLabel: unifiedStatusLabel,
  orderTypeLabel: orderTypeLabel,
  tradeCategoryLabel: tradeCategoryLabel,
};
