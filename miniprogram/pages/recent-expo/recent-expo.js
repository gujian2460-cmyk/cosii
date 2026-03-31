Page({
  data: {
    loading: true,
  },

  onLoad() {
    var that = this;
    setTimeout(function () {
      that.setData({ loading: false });
    }, 600);
  },

  onRetry() {
    this.setData({ loading: true });
    var that = this;
    setTimeout(function () {
      that.setData({ loading: false });
    }, 400);
  },
});
