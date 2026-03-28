const { request, showErrorToast } = require("../../utils/api");
const { mapEnvelopeToError } = require("../../utils/errors");
const routes = require("../../config/routes");

function formatTime(ts) {
  if (!ts) {
    return "";
  }
  var d = new Date(Number(ts));
  var pad = function (n) {
    return n < 10 ? "0" + n : "" + n;
  };
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

Page({
  data: {
    loading: true,
    error: null,
    notifications: [],
  },

  onLoad() {
    this.refresh();
  },

  async refresh() {
    this.setData({ loading: true, error: null });
    var res = await request({
      path: "/v1/me/notifications?limit=20",
      method: "GET",
    });
    if (!res.ok) {
      showErrorToast(res.envelope);
      this.setData({
        loading: false,
        error: mapEnvelopeToError(res.envelope),
        notifications: [],
      });
      return;
    }
    var items = (res.data && res.data.items) || [];
    var notifications = items.map(function (it) {
      return {
        notification_id: it.notification_id,
        title: it.title || "通知",
        subtitle: it.subtitle || "",
        time: formatTime(it.created_at),
        unified_order_id: it.unified_order_id,
        order_type: it.order_type,
        domain_order_id: it.domain_order_id,
      };
    });
    this.setData({ loading: false, error: null, notifications: notifications });
  },

  goOrdersTab() {
    wx.switchTab({ url: "/pages/orders/orders" });
  },

  onNotifyTap(e) {
    var u = e.currentTarget.dataset.unifiedId;
    var ot = e.currentTarget.dataset.orderType;
    var d = e.currentTarget.dataset.domainId;
    if (u && ot && d) {
      wx.navigateTo({
        url: routes.orderDetailQuery({
          unifiedOrderId: u,
          orderType: ot,
          domainOrderId: d,
          from: "inbox",
        }),
      });
      return;
    }
    this.goOrdersTab();
  },
});
