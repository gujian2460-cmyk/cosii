Component({
  data: {
    selected: 0,
    safeBottom: 0,
  },

  lifetimes: {
    attached() {
      try {
        var sys = wx.getSystemInfoSync();
        var b = (sys.safeAreaInsets && sys.safeAreaInsets.bottom) || 0;
        this.setData({ safeBottom: b });
      } catch (_) {
        this.setData({ safeBottom: 0 });
      }
    },
  },

  methods: {
    switchTab(e) {
      var idx = parseInt(e.currentTarget.dataset.index, 10);
      if (Number.isNaN(idx)) {
        return;
      }
      var paths = [
        "/pages/home/index",
        "/pages/buy-search/buy-search",
        "/pages/publish/publish",
        "/pages/inbox/inbox",
        "/pages/me/me",
      ];
      // 已在首页时再次点「首页」：回顶（与微信 Tab 二次点击体验一致）
      if (idx === 0 && this.data.selected === 0) {
        try {
          var pages = getCurrentPages();
          var cur = pages[pages.length - 1];
          if (
            cur &&
            cur.route === "pages/home/index" &&
            typeof cur.scrollHomeToTop === "function"
          ) {
            cur.scrollHomeToTop();
            return;
          }
        } catch (_) {
          /* ignore */
        }
      }
      if (paths[idx]) {
        wx.switchTab({ url: paths[idx] });
      }
    },
  },
});
