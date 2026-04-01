/**
 * 首页：漫展轮播 / 分类 / 热门角色 / 精选返图（紫色主题壳）
 */
const { request, showErrorToast } = require("../../utils/api");
const { setTabBarSelected } = require("../../utils/tabBar");

const HEALTH_TTL_MS = 30000;

function setBuySearchPreset(p) {
  try {
    getApp().globalData.buySearchPreset = p;
  } catch (_) {
    /* ignore */
  }
}

var MOCK_EXPO_BANNERS = [
  { id: "expo-1" },
  { id: "expo-2" },
  { id: "expo-3" },
  { id: "expo-4" },
  { id: "expo-5" },
  { id: "expo-6" },
  { id: "expo-7" },
  { id: "expo-8" },
];

var MOCK_CHARACTERS = [
  { id: "c01", name: "林尼", workTitle: "原神" },
  { id: "c02", name: "W", workTitle: "明日方舟" },
  { id: "c03", name: "初音", workTitle: "VOCALOID" },
  { id: "c04", name: "芙莉莲", workTitle: "葬送" },
  { id: "c05", name: "甘雨", workTitle: "原神" },
  { id: "c06", name: "银灰", workTitle: "明日方舟" },
  { id: "c07", name: "镜音铃", workTitle: "VOCALOID" },
  { id: "c08", name: "菲伦", workTitle: "葬送" },
  { id: "c09", name: "胡桃", workTitle: "原神" },
  { id: "c10", name: "能天使", workTitle: "明日方舟" },
  { id: "c11", name: "重音テト", workTitle: "VOCALOID" },
  { id: "c12", name: "辛美尔", workTitle: "葬送" },
  { id: "c13", name: "雷电将军", workTitle: "原神" },
  { id: "c14", name: "塞雷娅", workTitle: "明日方舟" },
  { id: "c15", name: "巡音流歌", workTitle: "VOCALOID" },
  { id: "c16", name: "阿乌拉", workTitle: "葬送" },
  { id: "c17", name: "纳西妲", workTitle: "原神" },
  { id: "c18", name: "艾雅法拉", workTitle: "明日方舟" },
  { id: "c19", name: "洛天依", workTitle: "VOCALOID" },
  { id: "c20", name: "休塔尔克", workTitle: "葬送" },
];

function toFeaturedView(p) {
  var author = p.author || "?";
  return {
    id: p.id,
    title: p.title,
    characterName: p.characterName,
    author: p.author,
    likeCount: p.likeCount,
    coverColor: p.coverColor,
    authorInitial: author.charAt(0),
    tall: Boolean(p.tall),
  };
}

/** 精选返图模板池（下拉刷新会打乱顺序并重算点赞） */
var FEATURED_TEMPLATES = [
  { title: "展台灯光", characterName: "甘雨", author: "Alice", likeBase: 120 },
  { title: "场照速报", characterName: "W", author: "阿紫", likeBase: 90 },
  { title: "假发修剪", characterName: "初音", author: "次元工房", likeBase: 200 },
  { title: "妆面记录", characterName: "芙莉莲", author: "白茶", likeBase: 50 },
  { title: "夜景街拍", characterName: "林尼", author: "小野", likeBase: 88 },
  { title: "棚拍正片", characterName: "银灰", author: "北境", likeBase: 142 },
  { title: "场照花絮", characterName: "菲伦", author: "灰羽", likeBase: 76 },
  { title: "道具展示", characterName: "塞雷娅", author: "莱茵", likeBase: 65 },
  { title: "试妆记录", characterName: "纳西妲", author: "草神", likeBase: 201 },
  { title: "速报九图", characterName: "洛天依", author: "调校师", likeBase: 310 },
  { title: "外景合集", characterName: "雷电将军", author: "鸣神", likeBase: 178 },
  { title: "漫展集邮", characterName: "艾雅法拉", author: "火山", likeBase: 95 },
];

function shuffleInPlace(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

/**
 * 双列瀑布流：按索引 0..7 做「大-小-小-大」周期，形成左右交错视觉
 * @param {number} seed
 */
function buildFeaturedColumns(seed) {
  var templates = FEATURED_TEMPLATES.slice();
  shuffleInPlace(templates);
  var pick = templates.slice(0, 8);
  var list = pick.map(function (t, i) {
    var r = i % 4;
    var large = r === 0 || r === 3;
    return toFeaturedView({
      id: "pf_" + String(seed) + "_" + String(i),
      title: t.title,
      characterName: t.characterName,
      author: t.author,
      likeCount: t.likeBase + ((seed + i * 17) % 73),
      coverColor: "#e5e7eb",
      tall: large,
    });
  });
  return splitFeaturedColumns(list);
}

function splitFeaturedColumns(items) {
  var left = [];
  var right = [];
  for (var i = 0; i < items.length; i++) {
    if (i % 2 === 0) {
      left.push(items[i]);
    } else {
      right.push(items[i]);
    }
  }
  return { left: left, right: right };
}

Page({
  data: {
    statusBarHeight: 20,
    headerRowHeightPx: 44,
    headerRightSpacePx: 12,
    navBarHeightPx: 64,
    scrollHeightPx: 500,
    characters: [],
    featLeft: [],
    featRight: [],
    bannerSlides: [],
    bannerCurrent: 0,
    showDevProbe: false,
    healthLabel: "",
    healthTrace: "",
    featRefreshing: false,
    scrollIntoView: "",
  },

  _lastHealthOkAt: 0,
  _featSeed: 0,

  onLoad() {
    try {
      var gd = getApp().globalData || {};
      this.setData({ showDevProbe: gd.showDevProbe !== false });
    } catch (_) {
      /* ignore */
    }

    var sys = wx.getSystemInfoSync();
    var menu = wx.getMenuButtonBoundingClientRect();
    var statusBarHeight = sys.statusBarHeight || 20;
    var navBarHeightPx =
      statusBarHeight + menu.height + (menu.top - statusBarHeight) * 2;
    var headerRowHeightPx = navBarHeightPx - statusBarHeight;
    var headerRightSpacePx = Math.max(8, sys.windowWidth - menu.left + 8);
    var scrollHeightPx = sys.windowHeight - navBarHeightPx;

    this._featSeed = Date.now();
    var fc = buildFeaturedColumns(this._featSeed);

    this.setData({
      statusBarHeight: statusBarHeight,
      headerRowHeightPx: headerRowHeightPx,
      headerRightSpacePx: headerRightSpacePx,
      navBarHeightPx: navBarHeightPx,
      scrollHeightPx: scrollHeightPx,
      bannerSlides: MOCK_EXPO_BANNERS,
      characters: MOCK_CHARACTERS,
      featLeft: fc.left,
      featRight: fc.right,
    });

    this.refreshHealth();
  },

  onShow() {
    setTabBarSelected(0);
  },

  onBannerChange(e) {
    this.setData({ bannerCurrent: e.detail.current });
  },

  onSearchTap() {
    wx.switchTab({ url: "/pages/buy-search/buy-search" });
  },

  onRecentExpoTap() {
    wx.navigateTo({ url: "/pages/recent-expo/recent-expo" });
  },

  onKingTap(e) {
    var action = (e.currentTarget.dataset && e.currentTarget.dataset.action) || "";
    if (action === "yi") {
      setBuySearchPreset({ category: "costume" });
      wx.switchTab({ url: "/pages/buy-search/buy-search" });
      return;
    }
    if (action === "fa") {
      setBuySearchPreset({ category: "wig" });
      wx.switchTab({ url: "/pages/buy-search/buy-search" });
      return;
    }
    if (action === "zhuang") {
      setBuySearchPreset({ category: "all", keyword: "妆造" });
      wx.switchTab({ url: "/pages/buy-search/buy-search" });
      return;
    }
    if (action === "zhou") {
      setBuySearchPreset({ category: "props" });
      wx.switchTab({ url: "/pages/buy-search/buy-search" });
      return;
    }
    if (action === "zhan") {
      wx.navigateTo({ url: "/pages/recent-expo/recent-expo" });
      return;
    }
  },

  onCharacterTap(e) {
    var name = (e.currentTarget.dataset && e.currentTarget.dataset.name) || "";
    setBuySearchPreset({ keyword: name });
    wx.switchTab({ url: "/pages/buy-search/buy-search" });
  },

  onCharacterMoreTap() {
    wx.switchTab({ url: "/pages/buy-search/buy-search" });
  },

  onFeaturedMoreTap() {
    wx.switchTab({ url: "/pages/buy-search/buy-search" });
  },

  /**
   * 首页 scroll-view 下拉刷新：重载精选返图（原生 refresher 动画）
   */
  onHomePullRefresh() {
    this.setData({ featRefreshing: true });
    var self = this;
    self._featSeed = (self._featSeed || 0) + 1;
    var fc = buildFeaturedColumns(self._featSeed);
    var t0 = Date.now();
    var minMs = 450;
    var apply = function () {
      var elapsed = Date.now() - t0;
      var wait = elapsed < minMs ? minMs - elapsed : 0;
      setTimeout(function () {
        self.setData({
          featLeft: fc.left,
          featRight: fc.right,
          featRefreshing: false,
        });
      }, wait);
    };
    apply();
  },

  /**
   * 自定义 TabBar 再次点击「首页」时调用：平滑滚回顶部（搜索栏区域）
   */
  scrollHomeToTop() {
    var self = this;
    self.setData({ scrollIntoView: "" });
    setTimeout(function () {
      self.setData({ scrollIntoView: "home-scroll-top-anchor" });
      setTimeout(function () {
        self.setData({ scrollIntoView: "" });
      }, 520);
    }, 30);
  },

  onFeaturedTap(e) {
    var kw =
      (e.currentTarget.dataset && e.currentTarget.dataset.keyword) || "";
    setBuySearchPreset({ keyword: kw });
    wx.switchTab({ url: "/pages/buy-search/buy-search" });
  },

  async refreshHealth() {
    var now = Date.now();
    if (
      this._lastHealthOkAt &&
      now - this._lastHealthOkAt < HEALTH_TTL_MS &&
      this.data.healthLabel
    ) {
      return;
    }
    var res = await request({
      path: "/health",
      method: "GET",
      userId: null,
    });
    if (res.ok) {
      this._lastHealthOkAt = Date.now();
      this.setData({
        healthLabel: res.data.ok ? "API 探活：正常" : "API 探活：异常",
        healthTrace: res.traceId || "",
      });
    } else {
      showErrorToast(res.envelope);
      this.setData({
        healthLabel: "API 未连接（请启动后端并关闭域名校验）",
        healthTrace: (res.envelope && res.envelope.trace_id) || "",
      });
    }
  },
});
