const { request, showErrorToast } = require("../../../utils/api");
const { mapEnvelopeToError } = require("../../../utils/errors");

function centsToYuan(c) {
  return (Number(c) / 100).toFixed(2);
}

Page({
  data: {
    loading: true,
    error: null,
    kind: "",
    service: null,
    trade: null,
  },

  onLoad(query) {
    this._resolveAndLoad(query || {});
  },

  async _resolveAndLoad(q) {
    var unifiedOrderId = q.unifiedOrderId || "";
    var orderType = q.orderType || "";
    var domainOrderId = q.domainOrderId || "";

    if (!orderType || !domainOrderId) {
      if (!unifiedOrderId) {
        this.setData({
          loading: false,
          error: { userTitle: "缺少订单参数", traceId: "" },
        });
        return;
      }
      var meta = await request({
        path: "/v1/me/unified-orders/" + encodeURIComponent(unifiedOrderId),
        method: "GET",
      });
      if (!meta.ok) {
        showErrorToast(meta.envelope);
        this.setData({
          loading: false,
          error: mapEnvelopeToError(meta.envelope),
        });
        return;
      }
      orderType = meta.data.order_type;
      domainOrderId = meta.data.domain_order_id;
    }

    this._orderType = orderType;
    this._domainOrderId = domainOrderId;
    await this.loadDetail(orderType, domainOrderId);
  },

  async loadDetail(orderType, domainOrderId) {
    this.setData({ loading: true, error: null, kind: orderType });
    var path =
      orderType === "service"
        ? "/v1/booking/orders/" + encodeURIComponent(domainOrderId)
        : "/v1/trade/orders/" + encodeURIComponent(domainOrderId);
    var res = await request({ path: path, method: "GET" });
    if (!res.ok) {
      showErrorToast(res.envelope);
      this.setData({
        loading: false,
        error: mapEnvelopeToError(res.envelope),
        service: null,
        trade: null,
      });
      return;
    }
    if (orderType === "service") {
      var d = res.data;
      this.setData({
        loading: false,
        error: null,
        service: {
          service_order_id: d.service_order_id,
          unified_order_id: d.unified_order_id,
          status: d.status,
          depositYuan: centsToYuan(d.deposit_amount),
          finalYuan: centsToYuan(d.final_amount),
          holdNote: d.slot_hold_expired ? "档期占位已过期" : "",
        },
        trade: null,
      });
    } else {
      var t = res.data;
      this.setData({
        loading: false,
        error: null,
        trade: {
          trade_order_id: t.trade_order_id,
          unified_order_id: t.unified_order_id,
          status: t.status,
          item_title: t.item_title,
          totalYuan: centsToYuan(t.total_amount),
        },
        service: null,
      });
    }
  },

  refresh() {
    if (this._orderType && this._domainOrderId) {
      this.loadDetail(this._orderType, this._domainOrderId);
    }
  },
});
