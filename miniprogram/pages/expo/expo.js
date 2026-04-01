const routes = require("../../config/routes");

function hashStr(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function buildArtistRows(seed, count) {
  var h = hashStr(String(seed || "expo"));
  var cities = [
    "上海·静安",
    "广州·琶洲",
    "杭州·滨江",
    "成都·高新",
    "深圳·南山",
    "北京·朝阳",
    "南京·鼓楼",
    "武汉·光谷",
  ];
  var names = [
    "妆娘阿紫",
    "次元造型",
    "白茶工作室",
    "星野妆造",
    "小满美妆",
    "夜莺妆娘",
    "薄荷妆造",
    "樱桃工作室",
  ];
  var services = [
    "漫展全日妆",
    "角色精妆+假睫毛",
    "场照速妆",
    "汉服妆造",
    "特效伤效妆",
    "假发修剪造型",
    "JK/Lolita淡妆",
    "古风盘发+妆面",
  ];
  var out = [];
  var n = count || 8;
  for (var i = 0; i < n; i++) {
    var hi = (h + i * 17) % 1000;
    var nm = names[(h + i * 5) % names.length];
    out.push({
      id: "art_" + String(i + 1) + "_" + String(h % 997),
      serviceName: services[(h + i) % services.length],
      priceYuan: String(168 + (hi % 220)),
      city: cities[(h + i * 3) % cities.length],
      artistName: nm,
      avaLetter: nm.charAt(0),
    });
  }
  return out;
}

/** 双列 + 大/小交错（与首页精选周期一致） */
function splitArtistMasonry(items) {
  var left = [];
  var right = [];
  for (var i = 0; i < items.length; i++) {
    var r = i % 4;
    var large = r === 0 || r === 3;
    var cell = Object.assign({}, items[i], { large: large });
    if (i % 2 === 0) {
      left.push(cell);
    } else {
      right.push(cell);
    }
  }
  return { left: left, right: right };
}

function applyArtistColumns(page) {
  var id = page.data.expoId || "";
  var seed = id + "_" + String(page._artistSeed || 0);
  var rows = buildArtistRows(seed, 8);
  var cols = splitArtistMasonry(rows);
  page.setData({
    artistLeft: cols.left,
    artistRight: cols.right,
  });
}

Page({
  data: {
    segment: "poster",
    scrollHeightPx: 600,
    expoId: "",
    artistLeft: [],
    artistRight: [],
    artistRefreshing: false,
  },

  _artistSeed: 0,

  onLoad(query) {
    var sys = wx.getSystemInfoSync();
    var id = (query && query.id) || "";
    this.setData({
      expoId: id,
      scrollHeightPx: sys.windowHeight || 600,
    });
    this._artistSeed = Date.now() % 100000;
    applyArtistColumns(this);
  },

  onSegmentTap(e) {
    var s = (e.currentTarget.dataset && e.currentTarget.dataset.s) || "poster";
    this.setData({ segment: s });
  },

  onArtistPullRefresh() {
    this.setData({ artistRefreshing: true });
    this._artistSeed = (this._artistSeed || 0) + 1;
    var self = this;
    applyArtistColumns(self);
    var t0 = Date.now();
    var minMs = 420;
    var done = function () {
      var w = Math.max(0, minMs - (Date.now() - t0));
      setTimeout(function () {
        self.setData({ artistRefreshing: false });
      }, w);
    };
    done();
  },

  onArtistTap() {
    wx.navigateTo({ url: routes.BOOKING_ENTRY });
  },
});
