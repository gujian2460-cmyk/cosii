const { request, showErrorToast } = require("../../utils/api");
const { mapEnvelopeToError } = require("../../utils/errors");
const routes = require("../../config/routes");

function useMockOrdersFlag() {
  try {
    return getApp().globalData.useMockOrders === true;
  } catch (_) {
    return false;
  }
}

function mapOrderRow(o) {
  return {
    unified_order_id: o.unified_order_id,
    order_type: o.order_type,
    domain_order_id: o.domain_order_id,
    status: o.status,
    title: o.title,
    amount_cents: o.amount_cents,
    updated_at: o.updated_at,
    amountYuan: (Number(o.amount_cents) / 100).toFixed(2),
  };
}

function buildOrdersPath(opts) {
  var filter = opts.filter || "all";
  var status = opts.status || "";
  var q = ["limit=20"];
  if (opts.cursor) {
    q.push("cursor=" + encodeURIComponent(opts.cursor));
  }
  if (filter === "trade" || filter === "service") {
    q.push("order_type=" + encodeURIComponent(filter));
  }
  if (status) {
    q.push("status=" + encodeURIComponent(status));
  }
  return "/v1/me/unified-orders?" + q.join("&");
}

Page({
  data: {
    loading: true,
    error: null,
    empty: true,
    orders: [],
    nextCursor: null,
    loadingMore: false,
    activeFilter: "all",
    activeStatus: "",
  },

  onLoad() {
    this.refresh();
  },

  onShow() {
    if (!this._didLoad) {
      this._didLoad = true;
      return;
    }
    this.refresh();
  },

  async refresh() {
    this.setData({ loading: true, error: null, nextCursor: null });
    var filter = this.data.activeFilter;
    var statusF = this.data.activeStatus;
    if (useMockOrdersFlag()) {
      var mockRows = [
        mapOrderRow({
          unified_order_id: "mock_u1",
          order_type: "trade",
          domain_order_id: "mock_trade",
          status: "PENDING_PAYMENT",
          title: "示例商品",
          amount_cents: 19900,
          updated_at: Date.now(),
        }),
      ];
      var mock = mockRows.filter(function (r) {
        if (filter !== "all" && r.order_type !== filter) {
          return false;
        }
        if (statusF && r.status !== statusF) {
          return false;
        }
        return true;
      });
      this.setData({
        loading: false,
        empty: mock.length === 0,
        orders: mock,
      });
      return;
    }
    var res = await request({
      path: buildOrdersPath({ filter: filter, status: statusF }),
      method: "GET",
    });
    if (!res.ok) {
      showErrorToast(res.envelope);
      this.setData({
        loading: false,
        error: mapEnvelopeToError(res.envelope),
        empty: true,
        orders: [],
      });
      return;
    }
    var items = (res.data && res.data.items) || [];
    var mapped = items.map(mapOrderRow);
    this.setData({
      loading: false,
      error: null,
      empty: mapped.length === 0,
      orders: mapped,
      nextCursor: (res.data && res.data.next_cursor) || null,
    });
  },

  async loadMore() {
    var cursor = this.data.nextCursor;
    var filter = this.data.activeFilter;
    var statusF = this.data.activeStatus;
    if (!cursor || this.data.loadingMore || this.data.loading) {
      return;
    }
    this.setData({ loadingMore: true });
    var res = await request({
      path: buildOrdersPath({ filter: filter, status: statusF, cursor: cursor }),
      method: "GET",
    });
    this.setData({ loadingMore: false });
    if (!res.ok) {
      showErrorToast(res.envelope);
      return;
    }
    var items = (res.data && res.data.items) || [];
    var mapped = items.map(mapOrderRow);
    this.setData({
      orders: this.data.orders.concat(mapped),
      nextCursor: (res.data && res.data.next_cursor) || null,
    });
  },

  onReachBottom() {
    this.loadMore();
  },

  goHome() {
    wx.switchTab({ url: "/pages/home/home" });
  },

  onOrderTap(e) {
    var u = e.currentTarget.dataset.unifiedId;
    var ot = e.currentTarget.dataset.orderType;
    var d = e.currentTarget.dataset.domainId;
    if (!u) {
      return;
    }
    wx.navigateTo({
      url: routes.orderDetailQuery({
        unifiedOrderId: u,
        orderType: ot,
        domainOrderId: d,
      }),
    });
  },

  onFilterTap(e) {
    var f = (e.currentTarget.dataset && e.currentTarget.dataset.filter) || "all";
    if (f === this.data.activeFilter) {
      return;
    }
    this.setData({ activeFilter: f });
    this.refresh();
  },

  onStatusTap(e) {
    var raw = (e.currentTarget.dataset && e.currentTarget.dataset.status) || "";
    var s = raw === "__all__" ? "" : raw;
    if (s === this.data.activeStatus) {
      return;
    }
    this.setData({ activeStatus: s });
    this.refresh();
  },
});
