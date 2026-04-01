var PAGE_SIZE = 6;

var MOCK_EXPO_NAMES = [
  "CP31 · 上海",
  "萤火虫动漫游戏嘉年华",
  "BW 2026 广州",
  "IDO 动漫游戏嘉年华",
  "梦乡动漫展 · 成都",
  "ComicUp 同人展",
  "ACC 动漫展 · 杭州",
  "CICF 中国国际漫画节",
  "核聚变游戏嘉年华",
  "YACA 春季动漫展",
  "萌卡动漫展 · 武汉",
  "CE 动漫嘉年华 · 深圳",
  "次元之门 · 西安",
  "动漫夏日祭 · 南京",
  "幻梦动漫游戏嘉年华",
  "星梦祭 · 重庆",
  "极客动漫展 · 北京",
  "二次元博览会 · 苏州",
  "ACG 文化节 · 天津",
  "漫域嘉年华 · 长沙",
  "次元突破 · 郑州",
  "动漫派对 · 厦门",
  "幻想物语 · 青岛",
  "创梦动漫周 · 合肥",
];

function buildAllExpos() {
  return MOCK_EXPO_NAMES.map(function (title, i) {
    var parts = title.split("·");
    return {
      id: "expo_" + String(i + 1),
      title: title,
      city: parts[1] ? parts[1].trim() : "全国",
    };
  });
}

function filterByKeyword(items, kw) {
  var k = (kw || "").trim().toLowerCase();
  if (!k) {
    return items.slice();
  }
  return items.filter(function (it) {
    var t = (it.title || "").toLowerCase();
    var c = (it.city || "").toLowerCase();
    return t.indexOf(k) >= 0 || c.indexOf(k) >= 0;
  });
}

Page({
  data: {
    keyword: "",
    displayList: [],
    hasMore: true,
    loadingMore: false,
  },

  _allExpos: [],
  _filtered: [],
  _shown: 0,

  onLoad() {
    this._allExpos = buildAllExpos();
    this._filtered = this._allExpos.slice();
    this._shown = 0;
    this._fetchPage({ reset: true });
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) {
      return;
    }
    this._fetchPage({ reset: false });
  },

  /**
   * @param {{ reset: boolean }} opts reset=true 时覆盖列表（首屏 / 搜索）
   */
  _fetchPage(opts) {
    var self = this;
    var reset = Boolean(opts && opts.reset);
    if (!reset) {
      this.setData({ loadingMore: true });
    }
    var delay = reset ? 0 : 300;
    setTimeout(function () {
      var batch = self._filtered.slice(self._shown, self._shown + PAGE_SIZE);
      self._shown += batch.length;
      var next = reset ? batch : (self.data.displayList || []).concat(batch);
      var hasMore = self._shown < self._filtered.length;
      self.setData({
        displayList: next,
        hasMore: hasMore,
        loadingMore: false,
      });
    }, delay);
  },

  onSearchInput(e) {
    var kw = (e.detail && e.detail.value) || "";
    this.setData({ keyword: kw });
    this._filtered = filterByKeyword(this._allExpos, kw);
    this._shown = 0;
    this.setData({ loadingMore: true });
    this._fetchPage({ reset: true });
  },

  onExpoTap(e) {
    var id = (e.currentTarget.dataset && e.currentTarget.dataset.id) || "";
    if (!id) {
      return;
    }
    wx.navigateTo({
      url: "/pages/expo/expo?id=" + encodeURIComponent(id),
    });
  },
});
