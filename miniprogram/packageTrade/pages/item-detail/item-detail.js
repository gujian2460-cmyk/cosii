const { request, showErrorToast } = require("../../../utils/api");
const { mapEnvelopeToError } = require("../../../utils/errors");
const routes = require("../../../config/routes");
const { tradeCategoryLabel } = require("../../../utils/orderLabels");

Page({
  data: {
    loading: true,
    error: null,
    title: "",
    categoryLabel: "",
    priceYuan: "",
    available: false,
    unavailableHint: "",
    creatingOrder: false,
  },

  onLoad(query) {
    var q = query || {};
    this._itemId = (q.itemId || "").trim();
    if (!this._itemId) {
      this.setData({
        loading: false,
        error: { userTitle: "缺少商品信息", traceId: "" },
      });
      return;
    }
    this.load();
  },

  async load() {
    var id = this._itemId;
    if (!id) {
      return;
    }
    this.setData({ loading: true, error: null });
    var res = await request({
      path: "/v1/trade/items/" + encodeURIComponent(id),
      method: "GET",
      userId: null,
    });
    if (!res.ok) {
      showErrorToast(res.envelope);
      this.setData({
        loading: false,
        error: mapEnvelopeToError(res.envelope),
      });
      return;
    }
    var d = res.data || {};
    var available = Boolean(d.available);
    this.setData({
      loading: false,
      error: null,
      title: d.title || "",
      categoryLabel: tradeCategoryLabel(d.category),
      priceYuan: (Number(d.price_cents) / 100).toFixed(2),
      available: available,
      unavailableHint: available ? "" : "该商品暂不可购买（已下架或交易中）",
    });
  },

  refresh() {
    if (this._itemId) {
      this.load();
    }
  },

  async onBuyTap() {
    var id = this._itemId;
    if (!id || !this.data.available || this.data.creatingOrder) {
      return;
    }
    this.setData({ creatingOrder: true });
    var res = await request({
      path: "/v1/trade/orders",
      method: "POST",
      data: { item_id: id },
    });
    this.setData({ creatingOrder: false });
    if (!res.ok) {
      showErrorToast(res.envelope);
      return;
    }
    wx.navigateTo({
      url: routes.orderDetailQuery({
        unifiedOrderId: res.data.unified_order_id,
        orderType: "trade",
        domainOrderId: res.data.trade_order_id,
        from: "item_detail",
      }),
    });
  },

  goBrowseList() {
    wx.navigateTo({ url: routes.TRADE_LIST });
  },
});
