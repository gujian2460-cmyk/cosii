const { request } = require("../../utils/api");
const {
  mapEnvelopeToError,
  normalizeUserFacingText,
  copyTraceId,
} = require("../../utils/errors");
const routes = require("../../config/routes");
const { setTabBarSelected } = require("../../utils/tabBar");

var FILTERS = [
  { id: "all", label: "全部" },
  { id: "trade", label: "交易" },
  { id: "service", label: "接妆" },
  { id: "system", label: "系统" },
];

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

function resolveType(orderType) {
  if (orderType === "trade") {
    return { id: "trade", label: "交易" };
  }
  if (orderType === "service") {
    return { id: "service", label: "接妆" };
  }
  return { id: "system", label: "系统" };
}

function filterNotifications(list, activeFilter) {
  if (activeFilter === "all") {
    return list;
  }
  return list.filter(function (x) {
    return x.typeId === activeFilter;
  });
}

Page({
  data: {
    loading: true,
    error: null,
    notifications: [],
    visibleNotifications: [],
    /** none | list | filter — 与失败态文案分离（UX-017） */
    emptyReason: "none",
    filters: FILTERS,
    activeFilter: "all",
    totalCount: 0,
  },

  onLoad() {
    this.refresh();
  },

  onShow() {
    setTabBarSelected(3);
  },

  onPullDownRefresh() {
    this.refresh().finally(function () {
      wx.stopPullDownRefresh();
    });
  },

  rebuildVisible() {
    var nf = this.data.notifications;
    var vis = filterNotifications(nf, this.data.activeFilter);
    var emptyReason = "none";
    if (nf.length === 0) {
      emptyReason = "list";
    } else if (vis.length === 0) {
      emptyReason = "filter";
    }
    this.setData({
      visibleNotifications: vis,
      emptyReason: emptyReason,
    });
  },

  async refresh() {
    this.setData({ loading: true, error: null });
    var res = await request({
      path: "/v1/me/notifications?limit=20",
      method: "GET",
    });
    if (!res.ok) {
      this.setData({
        loading: false,
        error: mapEnvelopeToError(res.envelope),
        notifications: [],
        visibleNotifications: [],
        totalCount: 0,
        emptyReason: "none",
      });
      return;
    }
    var items = (res.data && res.data.items) || [];
    var notifications = items.map(function (it) {
      var t = resolveType(it.order_type);
      return {
        notification_id: it.notification_id,
        title: normalizeUserFacingText(it.title, "通知"),
        subtitle: normalizeUserFacingText(it.subtitle, "点击查看详情"),
        time: formatTime(it.created_at),
        unified_order_id: it.unified_order_id,
        order_type: it.order_type,
        domain_order_id: it.domain_order_id,
        typeId: t.id,
        typeLabel: t.label,
      };
    });
    this.setData(
      {
        loading: false,
        error: null,
        notifications: notifications,
        totalCount: notifications.length,
      },
      function () {
        this.rebuildVisible();
      }.bind(this),
    );
  },

  onFilterTap(e) {
    var next = (e.currentTarget.dataset && e.currentTarget.dataset.id) || "all";
    if (next === this.data.activeFilter) {
      return;
    }
    this.setData({ activeFilter: next }, function () {
      this.rebuildVisible();
    }.bind(this));
  },

  goOrdersTab() {
    wx.navigateTo({ url: "/pages/orders/orders" });
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
        fail: function () {
          wx.showToast({
            title: "暂时无法打开详情，请稍后在订单中查看",
            icon: "none",
            duration: 2800,
          });
        },
      });
      return;
    }
    this.goOrdersTab();
  },

  onCopyTraceTap() {
    copyTraceId(this.data.error && this.data.error.traceId);
  },
});
