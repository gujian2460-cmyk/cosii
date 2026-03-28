const session = require("./utils/session.js");

App({
  globalData: {
    apiBase: "http://127.0.0.1:3000",
    devUserId: "usr_buyer_1",
    /** 为 false 时首页不展示 API trace 条（类生产） */
    showDevProbe: true,
    /** 为 true 时订单 Tab 使用本地假数据（勿用于生产构建） */
    useMockOrders: false,
    /**
     * 为 true 时 onLaunch 调用 wx.login → POST /v1/auth/wechat-login，写入 Bearer。
     * 生产构建应设为 true，且服务端 NODE_ENV=production、配置 WECHAT_* 与 COSII_SESSION_SECRET。
     */
    useWeChatSession: false,
  },
  onLaunch() {
    if (this.globalData.useWeChatSession) {
      this.silentWeChatLogin();
    }
  },
  silentWeChatLogin() {
    var base = this.globalData.apiBase;
    wx.login({
      success: function (res) {
        if (!res.code) {
          return;
        }
        wx.request({
          url: base.replace(/\/$/, "") + "/v1/auth/wechat-login",
          method: "POST",
          header: { "content-type": "application/json" },
          data: { code: res.code },
          success: function (r) {
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
            }
          },
        });
      },
    });
  },
});
