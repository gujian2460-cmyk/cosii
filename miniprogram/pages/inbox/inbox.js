Page({
  data: {
    showEmptyHint: false,
  },
  openOrders() {
    wx.switchTab({ url: "/pages/orders/orders" });
  },
});
