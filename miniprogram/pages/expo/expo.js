Page({
  data: {
    segment: "poster",
  },

  onSegmentTap(e) {
    var s = (e.currentTarget.dataset && e.currentTarget.dataset.s) || "poster";
    this.setData({ segment: s });
  },
});
