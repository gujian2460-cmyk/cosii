/**
 * 分包与页面路径常量 — 与 app.json subPackages 一致
 */

var TRADE_LIST = "/packageTrade/pages/list/list";
var TRADE_PUBLISH_ITEM = "/packageTrade/pages/publish-item/publish-item";
var ORDER_DETAIL = "/packageTrade/pages/order-detail/order-detail";
var ITEM_DETAIL = "/packageTrade/pages/item-detail/item-detail";
var BOOKING_ENTRY = "/packageBooking/pages/entry/entry";
var RECENT_EXPO = "/pages/recent-expo/recent-expo";
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

function itemDetailQuery(params) {
  var q = ["itemId=" + encodeURIComponent(String(params.itemId))];
  if (params.from) {
    q.push("from=" + encodeURIComponent(params.from));
  }
  return ITEM_DETAIL + "?" + q.join("&");
}

module.exports = {
  TRADE_LIST: TRADE_LIST,
  TRADE_PUBLISH_ITEM: TRADE_PUBLISH_ITEM,
  ORDER_DETAIL: ORDER_DETAIL,
  ITEM_DETAIL: ITEM_DETAIL,
  BOOKING_ENTRY: BOOKING_ENTRY,
  RECENT_EXPO: RECENT_EXPO,
  CONTENT_ENTRY: CONTENT_ENTRY,
  orderDetailQuery: orderDetailQuery,
  itemDetailQuery: itemDetailQuery,
};
