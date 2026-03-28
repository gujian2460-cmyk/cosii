const { request, showErrorToast } = require("../../../utils/api");
const routes = require("../../../config/routes");

Page({
  data: {
    slotId: "slot_1",
    depositYuan: "20",
    finalYuan: "50",
    submitting: false,
  },

  onSlotInput(e) {
    this.setData({ slotId: e.detail.value });
  },

  onDepositInput(e) {
    this.setData({ depositYuan: e.detail.value });
  },

  onFinalInput(e) {
    this.setData({ finalYuan: e.detail.value });
  },

  goBack() {
    wx.navigateBack({ fail: function () {
      wx.switchTab({ url: "/pages/home/home" });
    }});
  },

  async onSubmit() {
    if (this.data.submitting) {
      return;
    }
    var slotId = (this.data.slotId || "").trim();
    if (!slotId) {
      wx.showToast({ title: "请填写档期 ID", icon: "none" });
      return;
    }
    var dYuan = parseFloat(this.data.depositYuan);
    var fYuan = parseFloat(this.data.finalYuan);
    if (!Number.isFinite(dYuan) || dYuan < 0 || !Number.isFinite(fYuan) || fYuan < 0) {
      wx.showToast({ title: "金额无效", icon: "none" });
      return;
    }
    var deposit = Math.round(dYuan * 100);
    var finalAmt = Math.round(fYuan * 100);
    this.setData({ submitting: true });
    var res = await request({
      path: "/v1/booking/orders",
      method: "POST",
      data: {
        slot_id: slotId,
        deposit_amount: deposit,
        final_amount: finalAmt,
      },
    });
    this.setData({ submitting: false });
    if (!res.ok) {
      showErrorToast(res.envelope);
      return;
    }
    wx.showToast({ title: "已创建", icon: "success" });
    var u = (res.data && res.data.unified_order_id) || "";
    var sid = (res.data && res.data.service_order_id) || "";
    if (u && sid) {
      setTimeout(function () {
        wx.navigateTo({
          url: routes.orderDetailQuery({
            unifiedOrderId: u,
            orderType: "service",
            domainOrderId: sid,
            from: "booking-entry",
          }),
        });
      }, 400);
    }
  },
});
