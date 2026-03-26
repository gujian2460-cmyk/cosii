const { request, showErrorToast } = require("../../utils/api");

Page({
  data: {
    showFeedHint: true,
    healthLabel: "",
    healthTrace: "",
  },

  async onLoad() {
    const res = await request({
      path: "/health",
      method: "GET",
      userId: null,
    });
    if (res.ok) {
      this.setData({
        healthLabel: res.data.ok ? "API 探活：正常" : "API 探活：异常",
        healthTrace: res.traceId,
      });
    } else {
      showErrorToast(res.envelope);
      this.setData({
        healthLabel: "API 未连接（请启动后端并关闭域名校验）",
        healthTrace: res.envelope.trace_id || "",
      });
    }
  },

  onPrimaryCta() {
    wx.showToast({ title: "商品列表即将接入 /v1", icon: "none" });
  },

  onSecondaryLink() {
    wx.showToast({ title: "约妆流程即将接入", icon: "none" });
  },

  onRowTap(e) {
    const hint = (e.currentTarget.dataset && e.currentTarget.dataset.hint) || "";
    wx.showToast({ title: `${hint} 即将接入`, icon: "none" });
  },
});
