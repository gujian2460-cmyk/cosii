const { request, showErrorToast } = require("../../../utils/api");
const routes = require("../../../config/routes");

var CATEGORIES = [
  { id: "wig", label: "假发" },
  { id: "props", label: "道具" },
  { id: "costume", label: "服装" },
];

Page({
  data: {
    title: "",
    categoryIndex: 0,
    categoryLabels: CATEGORIES.map(function (c) {
      return c.label;
    }),
    priceYuan: "",
    submitting: false,
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onPriceInput(e) {
    this.setData({ priceYuan: e.detail.value });
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) });
  },

  async onSubmit() {
    if (this.data.submitting) {
      return;
    }
    var title = (this.data.title || "").trim();
    if (!title) {
      wx.showToast({ title: "请填写标题", icon: "none" });
      return;
    }
    var yuan = parseFloat(this.data.priceYuan);
    if (!Number.isFinite(yuan) || yuan <= 0) {
      wx.showToast({ title: "请输入有效价格", icon: "none" });
      return;
    }
    var cents = Math.round(yuan * 100);
    if (cents < 1) {
      wx.showToast({ title: "价格过低", icon: "none" });
      return;
    }
    var cat = CATEGORIES[this.data.categoryIndex].id;
    this.setData({ submitting: true });
    var res = await request({
      path: "/v1/trade/items",
      method: "POST",
      data: {
        title: title,
        category: cat,
        price_cents: cents,
      },
    });
    this.setData({ submitting: false });
    if (!res.ok) {
      showErrorToast(res.envelope);
      return;
    }
    wx.showToast({ title: "已上架", icon: "success" });
    setTimeout(function () {
      wx.redirectTo({ url: routes.TRADE_LIST });
    }, 400);
  },
});
