const routes = require("../../config/routes");

Page({
  data: {
    loading: false,
    error: null,
  },

  onLoad() {
    this.setData({ loading: false });
  },

  onPublishTrade() {
    wx.navigateTo({ url: routes.TRADE_PUBLISH_ITEM });
  },

  onPublishPost() {
    wx.navigateTo({ url: routes.CONTENT_ENTRY });
  },
});
