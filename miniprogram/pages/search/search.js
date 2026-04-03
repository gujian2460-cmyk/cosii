const { request, showErrorToast } = require("../../utils/api");
const { mapEnvelopeToError, copyTraceId } = require("../../utils/errors");
const routes = require("../../config/routes");

var HISTORY_KEY = "cosii_search_history_v1";
var HISTORY_MAX = 12;

function loadHistory() {
  try {
    var raw = wx.getStorageSync(HISTORY_KEY);
    if (raw && Array.isArray(raw)) {
      return raw;
    }
  } catch (_) {
    /* ignore */
  }
  return [];
}

function saveHistory(list) {
  try {
    wx.setStorageSync(HISTORY_KEY, list.slice(0, HISTORY_MAX));
  } catch (_) {
    /* ignore */
  }
}

function splitWaterfall(items) {
  var left = [];
  var right = [];
  var i;
  for (i = 0; i < items.length; i++) {
    if (i % 2 === 0) {
      left.push(items[i]);
    } else {
      right.push(items[i]);
    }
  }
  return { left, right };
}

function mapItem(row) {
  return {
    item_id: row.item_id,
    title: row.title,
    category: row.category,
    priceYuan: (Number(row.price_cents) / 100).toFixed(2),
  };
}

Page({
  data: {
    keyword: "",
    history: [],
    hotTags: ["假发", "道具", "服装", "妆娘", "二手", "漫展"],
    loading: false,
    searched: false,
    empty: false,
    requestError: null,
    leftCol: [],
    rightCol: [],
    creatingOrderId: "",
  },

  onLoad() {
    this.setData({ history: loadHistory() });
  },

  onShow() {
    this.setData({ history: loadHistory() });
  },

  onInput(e) {
    this.setData({ keyword: (e.detail && e.detail.value) || "" });
  },

  onClearInput() {
    this.setData({
      keyword: "",
      searched: false,
      empty: false,
      requestError: null,
      leftCol: [],
      rightCol: [],
    });
  },

  onClearHistory() {
    saveHistory([]);
    this.setData({ history: [] });
    wx.showToast({ title: "已清空", icon: "none" });
  },

  onHistoryTap(e) {
    var k = (e.currentTarget.dataset && e.currentTarget.dataset.k) || "";
    if (!k) {
      return;
    }
    this.setData({ keyword: k });
    this.runSearch(k);
  },

  onHotTap(e) {
    var k = (e.currentTarget.dataset && e.currentTarget.dataset.k) || "";
    if (!k) {
      return;
    }
    this.setData({ keyword: k });
    this.runSearch(k);
  },

  onSearchConfirm() {
    var k = (this.data.keyword || "").trim();
    if (!k) {
      wx.showToast({ title: "请输入关键词", icon: "none" });
      return;
    }
    this.runSearch(k);
  },

  async runSearch(keyword) {
    var k = (keyword || "").trim();
    if (!k) {
      return;
    }
    var hist = loadHistory().filter(function (x) {
      return x !== k;
    });
    hist.unshift(k);
    saveHistory(hist);
    this.setData({
      history: hist,
      loading: true,
      searched: true,
      empty: false,
      requestError: null,
    });

    var res = await request({
      path: "/v1/trade/items?limit=60",
      method: "GET",
      userId: null,
    });
    this.setData({ loading: false });
    if (!res.ok) {
      this.setData({
        requestError: mapEnvelopeToError(res.envelope),
        empty: false,
        leftCol: [],
        rightCol: [],
      });
      return;
    }
    var items = ((res.data && res.data.items) || []).map(mapItem);
    var lower = k.toLowerCase();
    var filtered = items.filter(function (it) {
      var t = (it.title || "").toLowerCase();
      var c = (it.category || "").toLowerCase();
      return t.indexOf(lower) !== -1 || c.indexOf(lower) !== -1;
    });
    var cols = splitWaterfall(filtered);
    this.setData({
      requestError: null,
      empty: filtered.length === 0,
      leftCol: cols.left,
      rightCol: cols.right,
    });
  },

  onCardTap(e) {
    var itemId = e.currentTarget.dataset.itemId;
    if (!itemId) {
      return;
    }
    wx.navigateTo({
      url: routes.itemDetailQuery({ itemId: itemId, from: "search" }),
    });
  },

  async onBuyTap(e) {
    var itemId = e.currentTarget.dataset.itemId;
    if (!itemId || this.data.creatingOrderId) {
      return;
    }
    this.setData({ creatingOrderId: itemId });
    var res = await request({
      path: "/v1/trade/orders",
      method: "POST",
      data: { item_id: itemId },
    });
    this.setData({ creatingOrderId: "" });
    if (!res.ok) {
      showErrorToast(res.envelope);
      return;
    }
    wx.navigateTo({
      url: routes.orderDetailQuery({
        unifiedOrderId: res.data.unified_order_id,
        orderType: "trade",
        domainOrderId: res.data.trade_order_id,
        from: "search",
      }),
    });
  },

  onCopyTraceTap() {
    copyTraceId(this.data.requestError && this.data.requestError.traceId);
  },
});
