Page({
  data: {
    scrollInto: "",
  },

  onAnchorTap(e) {
    var id = (e.currentTarget.dataset && e.currentTarget.dataset.id) || "";
    if (!id) {
      return;
    }
    var self = this;
    this.setData({ scrollInto: "" }, function () {
      self.setData({ scrollInto: id });
    });
  },
});
