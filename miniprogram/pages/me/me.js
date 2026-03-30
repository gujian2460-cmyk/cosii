const routes = require("../../config/routes");
const { request, showErrorToast } = require("../../utils/api");
const { mapEnvelopeToError } = require("../../utils/errors");
const session = require("../../utils/session");

Page({
  data: {
    loading: true,
    error: null,
    isLoggedIn: false,
    profile: null,
    avatarLetter: "用",
  },

  onLoad() {
    this.refreshProfile();
  },

  onShow() {
    this.refreshProfile();
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
    wx.navigateTo({ url: "/pages/inbox/inbox" });
  },

  onGoPublish() {
    wx.switchTab({ url: "/pages/publish/publish" });
  },

  onPlaceholder() {
    wx.showToast({ title: "即将接入", icon: "none" });
  },

  onRates() {
    wx.navigateTo({ url: routes.BOOKING_ENTRY });
  },

  onSettings() {
    wx.showToast({ title: "设置即将接入", icon: "none" });
  },
});
