const routes = require("../../config/routes");
const { request, showErrorToast } = require("../../utils/api");
const { mapEnvelopeToError } = require("../../utils/errors");
const session = require("../../utils/session");
const { setTabBarSelected } = require("../../utils/tabBar");

var QUICK_ENTRIES = [
  { id: "orders", label: "我的订单", sub: "查看买入/卖出进度" },
  { id: "inbox", label: "消息通知", sub: "交易与系统提醒" },
  { id: "publish", label: "发布售卖", sub: "闲置与接妆入口" },
];

var FEATURE_ENTRIES = [
  { id: "buy", label: "买入订单" },
  { id: "sell", label: "卖出订单" },
  { id: "publish", label: "发布闲置" },
  { id: "booking", label: "发布接妆" },
  { id: "expo", label: "最近漫展" },
  { id: "feedback", label: "问题反馈" },
];

var SERVICE_ENTRIES = [
  { id: "rates", label: "费率与结算说明" },
  { id: "address", label: "地址管理" },
  { id: "settings", label: "设置" },
];

Page({
  data: {
    loading: true,
    error: null,
    isLoggedIn: false,
    profile: null,
    avatarLetter: "用",
    quickEntries: QUICK_ENTRIES,
    featureEntries: FEATURE_ENTRIES,
    serviceEntries: SERVICE_ENTRIES,
  },

  onLoad() {
    this.refreshProfile();
  },

  onShow() {
    setTabBarSelected(4);
    this.refreshProfile();
  },

  onPullDownRefresh() {
    this.refreshProfile().finally(function () {
      wx.stopPullDownRefresh();
    });
  },

  async refreshProfile() {
    this.setData({ loading: true, error: null });
    var res = await request({
      path: "/v1/me/profile",
      method: "GET",
    });
    if (!res.ok) {
      showErrorToast(res.envelope);
      this.setData({
        loading: false,
        error: mapEnvelopeToError(res.envelope),
      });
      return;
    }
    var p = (res.data && res.data.profile) || null;
    var letter = "用";
    if (p && p.nickname && String(p.nickname).length > 0) {
      letter = String(p.nickname).charAt(0);
    }
    this.setData({
      loading: false,
      error: null,
      isLoggedIn: Boolean(res.data && res.data.is_logged_in),
      profile: p,
      avatarLetter: letter,
    });
  },

  onLoginTap() {
    var that = this;
    wx.showActionSheet({
      itemList: ["买家账号 (usr_buyer_1)", "卖家账号 (usr_seller_1)", "妆娘账号 (usr_artist_1)", "清除本地切换（用 app 默认）"],
      success(res) {
        if (res.tapIndex === 0) {
          session.setStoredUserId("usr_buyer_1");
        } else if (res.tapIndex === 1) {
          session.setStoredUserId("usr_seller_1");
        } else if (res.tapIndex === 2) {
          session.setStoredUserId("usr_artist_1");
        } else if (res.tapIndex === 3) {
          session.clearStoredUserId();
        } else {
          return;
        }
        that.refreshProfile();
      },
    });
  },

  onOrders() {
    wx.navigateTo({ url: "/pages/orders/orders" });
  },

  onInbox() {
    wx.switchTab({ url: "/pages/inbox/inbox" });
  },

  onGoPublish() {
    wx.switchTab({ url: "/pages/publish/publish" });
  },

  onGoRecentExpo() {
    wx.navigateTo({ url: routes.RECENT_EXPO });
  },

  onPlaceholder() {
    wx.showToast({ title: "即将接入", icon: "none" });
  },

  onRates() {
    wx.navigateTo({ url: "/pages/rates-info/rates-info" });
  },

  onSettings() {
    wx.showToast({ title: "设置即将接入", icon: "none" });
  },

  onEntryTap(e) {
    var id = (e.currentTarget.dataset && e.currentTarget.dataset.id) || "";
    if (id === "orders" || id === "buy" || id === "sell") {
      this.onOrders();
      return;
    }
    if (id === "inbox") {
      this.onInbox();
      return;
    }
    if (id === "publish") {
      this.onGoPublish();
      return;
    }
    if (id === "booking") {
      this.onGoPublish();
      return;
    }
    if (id === "rates") {
      this.onRates();
      return;
    }
    if (id === "expo") {
      this.onGoRecentExpo();
      return;
    }
    if (id === "settings") {
      this.onSettings();
      return;
    }
    this.onPlaceholder();
  },
});
