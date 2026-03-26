Page({
  data: {
    empty: true,
  },
  goHome() {
    wx.switchTab({ url: "/pages/home/home" });
  },
});
