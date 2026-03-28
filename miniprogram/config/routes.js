/**
 * 分包与页面路径常量 — 与 app.json subPackages 一致
 */

var TRADE_LIST = "/packageTrade/pages/list/list";
var TRADE_PUBLISH_ITEM = "/packageTrade/pages/publish-item/publish-item";
var ORDER_DETAIL = "/packageTrade/pages/order-detail/order-detail";
var BOOKING_ENTRY = "/packageBooking/pages/entry/entry";
var CONTENT_ENTRY = "/packageContent/pages/entry/entry";

function orderDetailQuery(params) {
  var q = ["unifiedOrderId=" + encodeURIComponent(params.unifiedOrderId)];
  if (params.orderType) {
    q.push("orderType=" + encodeURIComponent(params.orderType));
  }
  if (params.domainOrderId) {
    q.push("domainOrderId=" + encodeURIComponent(params.domainOrderId));
  }
  if (params.from) {
    q.push("from=" + encodeURIComponent(params.from));
  }
  return ORDER_DETAIL + "?" + q.join("&");
}

module.exports = {
  TRADE_LIST: TRADE_LIST,
  TRADE_PUBLISH_ITEM: TRADE_PUBLISH_ITEM,
  ORDER_DETAIL: ORDER_DETAIL,
  BOOKING_ENTRY: BOOKING_ENTRY,
  CONTENT_ENTRY: CONTENT_ENTRY,
  orderDetailQuery: orderDetailQuery,
};
