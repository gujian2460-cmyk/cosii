const { request, showErrorToast } = require("../../utils/api");
const { mapEnvelopeToError } = require("../../utils/errors");
const routes = require("../../config/routes");

var HEALTH_TTL_MS = 30000;

Page({
  data: {
    loading: true,
    error: null,
    showFeedHint: true,
    healthLabel: "",
    healthTrace: "",
    showDevProbe: true,
    secondaryRows: [
      { hint: "热门装扮", filter: "hot_cos" },
      { hint: "认证妆娘", filter: "verified" },
    ],
  },

  onLoad() {
    try {
      var gd = getApp().globalData || {};
      this.setData({ showDevProbe: gd.showDevProbe !== false });
    } catch (_) {
      /* ignore */
    }
    this.refreshHealth();
  },

  async refreshHealth() {
    var now = Date.now();
    if (this._lastHealthOkAt && now - this._lastHealthOkAt < HEALTH_TTL_MS && this.data.healthLabel) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true, error: null });
    var res = await request({
      path: "/health",
      method: "GET",
      userId: null,
    });
    if (res.ok) {
      this._lastHealthOkAt = Date.now();
      this.setData({
        loading: false,
        error: null,
        healthLabel: res.data.ok ? "API 探活：正常" : "API 探活：异常",
        healthTrace: res.traceId || "",
      });
    } else {
      showErrorToast(res.envelope);
      this.setData({
        loading: false,
        error: mapEnvelopeToError(res.envelope),
        healthLabel: "API 未连接（请启动后端并关闭域名校验）",
        healthTrace: (res.envelope && res.envelope.trace_id) || "",
      });
    }
  },

  onSearchTap() {
    wx.switchTab({ url: "/pages/search/search" });
  },

  onKingTap(e) {
    var action = (e.currentTarget.dataset && e.currentTarget.dataset.action) || "";
    if (action === "buy") {
      wx.switchTab({ url: "/pages/buy/buy" });
    } else if (action === "booking") {
      wx.navigateTo({ url: routes.BOOKING_ENTRY });
    } else if (action === "publish") {
      wx.switchTab({ url: "/pages/publish/publish" });
    } else if (action === "orders") {
      wx.navigateTo({ url: "/pages/orders/orders" });
    } else if (action === "search") {
      wx.switchTab({ url: "/pages/search/search" });
    }
  },

  onEventTap() {
    wx.showToast({ title: "活动列表即将接入", icon: "none" });
  },

  onPrimaryCta() {
    wx.switchTab({ url: "/pages/buy/buy" });
  },

  onSecondaryLink() {
    wx.navigateTo({ url: routes.BOOKING_ENTRY });
  },

  onSecondaryTap(e) {
    var hint =
      (e.currentTarget.dataset && e.currentTarget.dataset.hint) || "";
    wx.showToast({ title: hint + " 即将接入", icon: "none" });
  },
});
