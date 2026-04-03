const routes = require("../../config/routes");
const { request } = require("../../utils/api");
const {
  mapEnvelopeToError,
  copyTraceId,
  normalizeUserFacingText,
} = require("../../utils/errors");
const session = require("../../utils/session");
const { setTabBarSelected } = require("../../utils/tabBar");

var QUICK_ENTRIES = [
  { id: "orders", label: "我的订单", sub: "查看买入/卖出进度" },
  { id: "inbox", label: "消息通知", sub: "交易与系统提醒" },
  { id: "publish", label: "发布售卖", sub: "闲置与接妆入口" },
];

/** 已登录：分组宫格（M2） */
var FEATURE_GROUPS = [
  {
    title: "交易与订单",
    cells: [
      { id: "buy", label: "买入订单" },
      { id: "sell", label: "卖出订单" },
    ],
  },
  {
    title: "发布与展出",
    cells: [
      { id: "publish", label: "发布闲置" },
      { id: "booking", label: "发布接妆" },
      { id: "expo", label: "最近漫展" },
    ],
  },
  {
    title: "帮助与反馈",
    cells: [{ id: "feedback", label: "问题反馈" }],
  },
];

var SERVICE_ENTRIES = [
  { id: "rates", label: "费率与结算说明" },
  { id: "address", label: "地址管理" },
  { id: "settings", label: "设置" },
];

function getApiBase() {
  try {
    return String(getApp().globalData.apiBase || "").replace(/\/$/, "");
  } catch (_) {
    return "http://127.0.0.1:3000";
  }
}

/** 避免接口偶发把字段打成对象，WXML / toast 出现 [object Object] */
function sanitizeProfileView(p) {
  if (!p || typeof p !== "object") {
    return null;
  }
  var nick = normalizeUserFacingText(p.nickname, "");
  if (!nick) {
    nick = "用户";
  }
  return {
    user_id: normalizeUserFacingText(p.user_id, ""),
    nickname: nick,
    role: normalizeUserFacingText(p.role, ""),
    status: normalizeUserFacingText(p.status, ""),
    avatar_url:
      typeof p.avatar_url === "string" && p.avatar_url.trim()
        ? p.avatar_url.trim()
        : null,
  };
}

Page({
  data: {
    loading: true,
    error: null,
    isLoggedIn: false,
    profile: null,
    avatarLetter: "用",
    useWeChatSession: false,
    quickEntries: QUICK_ENTRIES,
    featureGroups: FEATURE_GROUPS,
    serviceEntries: SERVICE_ENTRIES,
  },

  onLoad() {
    var app = getApp();
    this.setData({
      useWeChatSession: Boolean(app.globalData && app.globalData.useWeChatSession),
    });
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
      this.setData({
        loading: false,
        error: mapEnvelopeToError(res.envelope),
      });
      return;
    }
    var p = sanitizeProfileView((res.data && res.data.profile) || null);
    var letter = "用";
    if (p && p.nickname && p.nickname.length > 0) {
      letter = p.nickname.charAt(0);
    } else if (p && p.user_id && p.user_id.length > 0) {
      letter = p.user_id.charAt(0);
    }
    this.setData({
      loading: false,
      error: null,
      isLoggedIn: Boolean(res.data && res.data.is_logged_in),
      profile: p,
      avatarLetter: letter,
    });
  },

  /** M4：生产走微信 code 换 session；开发保留 ActionSheet */
  onLoginTap() {
    var app = getApp();
    if (app.globalData && app.globalData.useWeChatSession) {
      this.doWeChatSessionRefresh();
      return;
    }
    var that = this;
    wx.showActionSheet({
      itemList: [
        "买家账号 (usr_buyer_1)",
        "卖家账号 (usr_seller_1)",
        "妆娘账号 (usr_artist_1)",
        "清除本地切换（用 app 默认）",
      ],
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

  doWeChatSessionRefresh() {
    var self = this;
    var base = getApiBase();
    wx.showLoading({ title: "登录中", mask: true });
    wx.login({
      success: function (res) {
        if (!res.code) {
          wx.hideLoading();
          wx.showToast({ title: "无法获取微信登录凭证", icon: "none" });
          return;
        }
        wx.request({
          url: base + "/v1/auth/wechat-login",
          method: "POST",
          header: { "content-type": "application/json" },
          data: { code: res.code },
          success: function (r) {
            wx.hideLoading();
            var body = r.data;
            if (
              body &&
              body.code === "OK" &&
              body.data &&
              typeof body.data.access_token === "string"
            ) {
              session.setAccessToken(body.data.access_token);
              if (typeof body.data.user_id === "string" && body.data.user_id) {
                session.setStoredUserId(body.data.user_id);
              }
              wx.showToast({ title: "已同步登录", icon: "success" });
              self.refreshProfile();
              return;
            }
            var msg = normalizeUserFacingText(
              body && body.error && body.error.user_title,
              "",
            );
            if (!msg) {
              msg = normalizeUserFacingText(body && body.message, "");
            }
            if (!msg) {
              msg = "登录失败，请稍后重试";
            }
            if (msg.length > 20) {
              msg = msg.slice(0, 17) + "…";
            }
            wx.showToast({ title: msg, icon: "none" });
          },
          fail: function () {
            wx.hideLoading();
            wx.showToast({ title: "网络异常", icon: "none" });
          },
        });
      },
      fail: function () {
        wx.hideLoading();
        wx.showToast({ title: "微信登录失败", icon: "none" });
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
    wx.navigateTo({ url: "/pages/me-settings/me-settings" });
  },

  onFeedback() {
    wx.navigateTo({ url: "/pages/me-feedback/me-feedback" });
  },

  onAddress() {
    wx.navigateTo({ url: "/pages/me-address/me-address" });
  },

  onRetryProfile() {
    this.refreshProfile();
  },

  onCopyTraceTap() {
    copyTraceId(this.data.error && this.data.error.traceId);
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
    if (id === "feedback") {
      this.onFeedback();
      return;
    }
    if (id === "address") {
      this.onAddress();
      return;
    }
    this.onPlaceholder();
  },
});
