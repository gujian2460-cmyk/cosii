const { request, showErrorToast } = require("../../utils/api");
const { mapEnvelopeToError } = require("../../utils/errors");
const routes = require("../../config/routes");

function buildTradeListPath(opts) {
  var q = ["limit=20"];
  if (opts.cursor) {
    q.push("cursor=" + encodeURIComponent(opts.cursor));
  }
  if (opts.category && opts.category !== "all") {
    q.push("category=" + encodeURIComponent(opts.category));
  }
  return "/v1/trade/items?" + q.join("&");
}

function mapItem(row) {
  return {
    item_id: row.item_id,
    title: row.title,
    category: row.category,
    price_cents: row.price_cents,
    priceYuan: (Number(row.price_cents) / 100).toFixed(2),
  };
}

Page({
  data: {
    loading: true,
    error: null,
    items: [],
    empty: false,
    nextCursor: null,
    loadingMore: false,
    creatingOrderId: "",
    activeCategory: "all",
    categories: [
      { id: "all", label: "全部" },
      { id: "wig", label: "假发" },
      { id: "props", label: "道具" },
      { id: "costume", label: "服装" },
    ],
  },

  onLoad() {
    this.refresh();
  },

  async onPullDownRefresh() {
    await this.refresh();
    wx.stopPullDownRefresh();
  },

  async refresh() {
    this.setData({ loading: true, error: null, nextCursor: null });
    var res = await request({
      path: buildTradeListPath({ category: this.data.activeCategory }),
      method: "GET",
      userId: null,
    });
    if (!res.ok) {
      showErrorToast(res.envelope);
      this.setData({
        loading: false,
        error: mapEnvelopeToError(res.envelope),
        items: [],
        empty: true,
      });
      return;
    }
    var items = ((res.data && res.data.items) || []).map(mapItem);
    this.setData({
      loading: false,
      error: null,
      items: items,
      empty: items.length === 0,
      nextCursor: (res.data && res.data.next_cursor) || null,
    });
  },

  async loadMore() {
    if (!this.data.nextCursor || this.data.loading || this.data.loadingMore) {
      return;
    }
    this.setData({ loadingMore: true });
    var res = await request({
      path: buildTradeListPath({
        category: this.data.activeCategory,
        cursor: this.data.nextCursor,
      }),
      method: "GET",
      userId: null,
    });
    this.setData({ loadingMore: false });
    if (!res.ok) {
      showErrorToast(res.envelope);
      return;
    }
    var rows = ((res.data && res.data.items) || []).map(mapItem);
    this.setData({
      items: this.data.items.concat(rows),
      nextCursor: (res.data && res.data.next_cursor) || null,
    });
  },

  onReachBottom() {
    this.loadMore();
  },

  onCategoryTap(e) {
    var c = (e.currentTarget.dataset && e.currentTarget.dataset.category) || "all";
    if (c === this.data.activeCategory) {
      return;
    }
    this.setData({ activeCategory: c });
    this.refresh();
  },

  async onBuyTap(e) {
    var itemId = e.currentTarget.dataset.itemId;
    if (!itemId || this.data.creatingOrderId) {
      return;
    }
    this.setData({ creatingOrderId: itemId });
    var res = await request({
      path: "/v1/trade/orders",
      method: "POST",
      data: { item_id: itemId },
    });
    this.setData({ creatingOrderId: "" });
    if (!res.ok) {
      showErrorToast(res.envelope);
      return;
    }
    wx.navigateTo({
      url: routes.orderDetailQuery({
        unifiedOrderId: res.data.unified_order_id,
        orderType: "trade",
        domainOrderId: res.data.trade_order_id,
        from: "trade_list",
      }),
    });
  },

  onGoHome() {
    wx.switchTab({ url: "/pages/home/index" });
  },
});
