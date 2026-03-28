/**
 * 统一请求层 — 对接后端 envelope（src/shared/api-envelope）
 * 错误展示优先使用服务端 error.user_title / primary_action（与 ux-map 一致）
 */

function getApiBase() {
  try {
    return getApp().globalData.apiBase;
  } catch {
    return "http://127.0.0.1:3000";
  }
}

var session = require("./session.js");

function request(options) {
  const base = getApiBase();
  const header = {
    "content-type": "application/json",
  };
  const bearer = session.getAccessToken();
  if (bearer) {
    header.Authorization = "Bearer " + bearer;
  } else {
    const uid =
      options.userId === null ? undefined : options.userId ?? session.getEffectiveUserId();
    if (uid) {
      header["X-User-Id"] = uid;
    }
  }

  return new Promise((resolve) => {
    wx.request({
      url: `${base}${options.path}`,
      method: options.method ?? "GET",
      data: options.data,
      header,
      success(res) {
        const body = res.data;
        const status = res.statusCode ?? 0;
        // wx.request 的 success 含 4xx/5xx；须看 statusCode，不能只看 JSON body
        if (status < 200 || status >= 300) {
          if (body && typeof body === "object" && "code" in body) {
            resolve({ ok: false, envelope: body });
            return;
          }
          resolve({
            ok: false,
            envelope: {
              code: "HTTP_ERROR",
              message: `HTTP ${status}`,
              data: null,
              trace_id: "",
              error: {
                user_title: "服务暂时不可用",
                primary_action: "稍后重试",
                retry_policy: "若持续出现请联系客服",
              },
            },
          });
          return;
        }
        if (
          body &&
          typeof body === "object" &&
          "code" in body &&
          body.code === "OK"
        ) {
          resolve({ ok: true, data: body.data, traceId: body.trace_id });
          return;
        }
        if (!body || typeof body !== "object" || !("code" in body)) {
          resolve({
            ok: false,
            envelope: {
              code: "INVALID_RESPONSE",
              message: typeof body === "string" ? body : "Invalid JSON envelope",
              data: null,
              trace_id: "",
              error: {
                user_title: "服务响应异常",
                primary_action: "稍后重试",
                retry_policy: "若持续出现请联系客服",
              },
            },
          });
          return;
        }
        resolve({ ok: false, envelope: body });
      },
      fail() {
        resolve({
          ok: false,
          envelope: {
            code: "NETWORK_ERROR",
            message: "网络请求失败",
            data: null,
            trace_id: "",
            error: {
              user_title: "网络不可用",
              primary_action: "重试",
              retry_policy: "检查网络或开发工具域名校验设置",
            },
          },
        });
      },
    });
  });
}

function showErrorToast(envelope) {
  if (!envelope || typeof envelope !== "object") {
    wx.showToast({ title: "请求失败", icon: "none", duration: 2500 });
    return;
  }
  const title =
    (envelope.error && envelope.error.user_title) ||
    envelope.message ||
    "请求失败";
  wx.showToast({ title, icon: "none", duration: 2500 });
}

module.exports = { request, showErrorToast };
