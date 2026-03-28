/**
 * 登录态：Bearer（生产）与 X-User-Id（开发）由 utils/api.js 选择。
 * - access_token：POST /v1/auth/wechat-login 返回，存 STORAGE；有 token 时优先 Authorization。
 * - OVERRIDE_KEY：开发期本地覆盖 user_id（展示/调试）；请求身份以 token 为准。
 */
var OVERRIDE_KEY = "cosii_user_id_override";
var TOKEN_KEY = "cosii_access_token";

function getAccessToken() {
  try {
    var t = wx.getStorageSync(TOKEN_KEY);
    return typeof t === "string" && t.trim() ? t.trim() : "";
  } catch (_) {
    return "";
  }
}

function setAccessToken(token) {
  if (typeof token === "string" && token.trim()) {
    wx.setStorageSync(TOKEN_KEY, token.trim());
  }
}

function clearAccessToken() {
  try {
    wx.removeStorageSync(TOKEN_KEY);
  } catch (_) {}
}

function getEffectiveUserId() {
  try {
    var v = wx.getStorageSync(OVERRIDE_KEY);
    if (typeof v === "string" && v.trim()) {
      return v.trim();
    }
  } catch (_) {}
  try {
    return getApp().globalData.devUserId || "";
  } catch (_) {
    return "";
  }
}

function setStoredUserId(userId) {
  wx.setStorageSync(OVERRIDE_KEY, userId);
}

function clearStoredUserId() {
  try {
    wx.removeStorageSync(OVERRIDE_KEY);
  } catch (_) {}
}

module.exports = {
  OVERRIDE_KEY: OVERRIDE_KEY,
  TOKEN_KEY: TOKEN_KEY,
  getAccessToken: getAccessToken,
  setAccessToken: setAccessToken,
  clearAccessToken: clearAccessToken,
  getEffectiveUserId: getEffectiveUserId,
  setStoredUserId: setStoredUserId,
  clearStoredUserId: clearStoredUserId,
};
