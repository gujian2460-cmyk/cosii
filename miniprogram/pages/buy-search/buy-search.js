const { request, showErrorToast } = require("../../utils/api");
const { mapEnvelopeToError } = require("../../utils/errors");
const routes = require("../../config/routes");

const MOCK_REGIONS = ["广东·深圳", "上海·静安", "浙江·杭州", "北京·朝阳"];
const MOCK_SHOPS = ["星野COS馆", "次元小铺", "假发专卖", "道具工坊"];

function hashStr(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function buildTradeListPath(opts) {
  var q = ["limit=40"];
  if (opts.cursor) {
    q.push("cursor=" + encodeURIComponent(opts.cursor));
  }
  if (opts.category && opts.category !== "all") {
    q.push("category=" + encodeURIComponent(opts.category));
  }
  return "/v1/trade/items?" + q.join("&");
}

function mapItem(row) {
  var h = hashStr(row.item_id || "");
  return {
    item_id: row.item_id,
    title: row.title,
    category: row.category,
    price_cents: Number(row.price_cents) || 0,
    priceYuan: (Number(row.price_cents) / 100).toFixed(2),
    region: MOCK_REGIONS[h % MOCK_REGIONS.length],
    shopName: MOCK_SHOPS[h % MOCK_SHOPS.length],
    pinned: h % 11 === 0,
  };
}

function splitCols(items) {
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

function applySort(items, sortMode) {
  var copy = items.slice();
  if (sortMode === "price_asc") {
    copy.sort(function (a, b) {
      return a.price_cents - b.price_cents;
    });
  } else if (sortMode === "price_desc") {
    copy.sort(function (a, b) {
      return b.price_cents - a.price_cents;
    });
  } else if (sortMode === "new") {
    copy.reverse();
  } else if (sortMode === "drop") {
    copy.sort(function (a, b) {
      return a.price_cents - b.price_cents;
    });
  }
  return copy;
}

function applyPriceFilter(items, seg) {
  if (!seg || seg === "any") {
    return items;
  }
  return items.filter(function (it) {
    var y = it.price_cents / 100;
    if (seg === "0-50") {
      return y < 50;
    }
    if (seg === "50-100") {
      return y >= 50 && y < 100;
    }
    if (seg === "100-300") {
      return y >= 100 && y < 300;
    }
    if (seg === "300+") {
      return y >= 300;
    }
    return true;
  });
}

function applyKeyword(items, kw) {
  if (!kw || !String(kw).trim()) {
    return items;
  }
  var k = String(kw).trim().toLowerCase();
  return items.filter(function (it) {
    return String(it.title).toLowerCase().indexOf(k) !== -1;
  });
}

Page({
  data: {
    loading: true,
    error: null,
    rawItems: [],
    keyword: "",
    displayLeft: [],
    displayRight: [],
    empty: false,
    nextCursor: null,
    loadingMore: false,
    creatingOrderId: "",
    activeCategory: "all",
    categories: [
      { id: "all", label: "全部", api: "all" },
      { id: "costume", label: "COS服装", api: "costume" },
      { id: "wig", label: "假发", api: "wig" },
      { id: "props", label: "周边", api: "props" },
      { id: "daily", label: "平时装造", api: "all" },
      { id: "booking", label: "漫展约妆", api: null },
    ],
    sortKey: "comp",
    sortDirAsc: false,
    showFilterModal: false,
    filterPriceSeg: "any",
    filterDraftSeg: "any",
    modalSortKey: "comp",
    modalPriceDirAsc: false,
    sortRowLabel: "综合",
  },

  onLoad() {
    var patch = this.takePresetPatch();
    if (Object.keys(patch).length) {
      this.setData(patch, function () {
        this.refresh();
      }.bind(this));
    } else {
      this.refresh();
    }
  },

  onShow() {
    var patch = this.takePresetPatch();
    if (!Object.keys(patch).length) {
      return;
    }
    var needRefresh = Object.prototype.hasOwnProperty.call(patch, "activeCategory");
    if (needRefresh) {
      this.setData(patch, function () {
        this.refresh();
      }.bind(this));
    } else {
      this.setData(patch, function () {
        this.rebuildDisplay();
      }.bind(this));
    }
  },

  /** @returns {Record<string, unknown>} */
  takePresetPatch() {
    /** @type {Record<string, unknown>} */
    var patch = {};
    try {
      var gd = getApp().globalData || {};
      var p = gd.buySearchPreset;
      if (!p || typeof p !== "object") {
        return patch;
      }
      gd.buySearchPreset = null;
      if (p.category && p.category !== this.data.activeCategory) {
        patch.activeCategory = p.category;
      }
      if (p.keyword != null && p.keyword !== this.data.keyword) {
        patch.keyword = p.keyword;
      }
    } catch (_) {
      /* ignore */
    }
    return patch;
  },

  getApiCategory() {
    var id = this.data.activeCategory;
    var cat = null;
    for (var i = 0; i < this.data.categories.length; i++) {
      if (this.data.categories[i].id === id) {
        cat = this.data.categories[i];
        break;
      }
    }
    if (!cat || cat.api == null) {
      return "all";
    }
    return cat.api;
  },

  async onPullDownRefresh() {
    await this.refresh();
    wx.stopPullDownRefresh();
  },

  async refresh() {
    this.setData({ loading: true, error: null, nextCursor: null });
    var apiCat = this.getApiCategory();
    var res = await request({
      path: buildTradeListPath({ category: apiCat }),
      method: "GET",
      userId: null,
    });
    if (!res.ok) {
      showErrorToast(res.envelope);
      this.setData({
        loading: false,
        error: mapEnvelopeToError(res.envelope),
        rawItems: [],
        displayLeft: [],
        displayRight: [],
        empty: true,
      });
      return;
    }
    var items = ((res.data && res.data.items) || []).map(mapItem);
    this.setData(
      {
        loading: false,
        error: null,
        rawItems: items,
        nextCursor: (res.data && res.data.next_cursor) || null,
      },
      function () {
        this.rebuildDisplay();
      }.bind(this),
    );
  },

  rebuildDisplay() {
    var list = applyKeyword(this.data.rawItems, this.data.keyword);
    list = applyPriceFilter(list, this.data.filterPriceSeg);
    var sortMode = this.resolveSortMode();
    list = applySort(list, sortMode);
    var cols = splitCols(list);
    this.setData({
      displayLeft: cols.left,
      displayRight: cols.right,
      empty: list.length === 0 && !this.data.loading,
    });
    this.updateSortRowLabel();
  },

  resolveSortMode() {
    var k = this.data.sortKey;
    if (k === "price") {
      return this.data.sortDirAsc ? "price_asc" : "price_desc";
    }
    if (k === "drop") {
      return "drop";
    }
    if (k === "new") {
      return "new";
    }
    return "default";
  },

  updateSortRowLabel() {
    var t = "综合";
    if (this.data.sortKey === "price") {
      t = this.data.sortDirAsc ? "价格↑" : "价格↓";
    } else if (this.data.sortKey === "drop") {
      t = "降价";
    } else if (this.data.sortKey === "new") {
      t = "新发";
    }
    this.setData({ sortRowLabel: t });
  },

  onKeywordInput(e) {
    this.setData({ keyword: (e.detail && e.detail.value) || "" });
  },

  onKeywordConfirm() {
    this.rebuildDisplay();
  },

  onSearchConfirmTap() {
    this.rebuildDisplay();
  },

  onCategoryTap(e) {
    var id = (e.currentTarget.dataset && e.currentTarget.dataset.id) || "all";
    var cat = this.data.categories.find(function (c) {
      return c.id === id;
    });
    if (cat && cat.api === null) {
      wx.navigateTo({ url: routes.BOOKING_ENTRY });
      return;
    }
    if (id === this.data.activeCategory) {
      return;
    }
    this.setData({ activeCategory: id }, function () {
      this.refresh();
    }.bind(this));
  },

  onSortTap(e) {
    var k = (e.currentTarget.dataset && e.currentTarget.dataset.k) || "comp";
    if (k === "region") {
      wx.showToast({ title: "区域筛选即将接入", icon: "none" });
      return;
    }
    if (k === "price") {
      if (this.data.sortKey === "price") {
        this.setData({ sortDirAsc: !this.data.sortDirAsc }, function () {
          this.rebuildDisplay();
        }.bind(this));
      } else {
        this.setData({ sortKey: "price", sortDirAsc: false }, function () {
          this.rebuildDisplay();
        }.bind(this));
      }
      return;
    }
    if (k === "comp") {
      this.setData({ sortKey: "comp", sortDirAsc: false }, function () {
        this.rebuildDisplay();
      }.bind(this));
      return;
    }
    if (k === "drop") {
      this.setData({ sortKey: "drop", sortDirAsc: false }, function () {
        this.rebuildDisplay();
      }.bind(this));
      return;
    }
    if (k === "new") {
      this.setData({ sortKey: "new", sortDirAsc: false }, function () {
        this.rebuildDisplay();
      }.bind(this));
      return;
    }
  },

  openFilter() {
    this.setData({
      showFilterModal: true,
      filterDraftSeg: this.data.filterPriceSeg,
      modalSortKey: this.data.sortKey,
      modalPriceDirAsc: this.data.sortDirAsc,
    });
  },

  closeFilter() {
    this.setData({ showFilterModal: false });
  },

  onModalPriceTap(e) {
    var seg = (e.currentTarget.dataset && e.currentTarget.dataset.seg) || "any";
    this.setData({ filterDraftSeg: seg });
  },

  onModalSortTap(e) {
    var k = (e.currentTarget.dataset && e.currentTarget.dataset.k) || "comp";
    if (k === "price") {
      var dir = (e.currentTarget.dataset && e.currentTarget.dataset.dir) || "desc";
      this.setData({
        modalSortKey: "price",
        modalPriceDirAsc: dir === "asc",
      });
      return;
    }
    this.setData({ modalSortKey: k });
  },

  applyFilterModal() {
    var k = this.data.modalSortKey;
    var sortDirAsc = false;
    if (k === "price") {
      sortDirAsc = this.data.modalPriceDirAsc;
    }
    this.setData(
      {
        filterPriceSeg: this.data.filterDraftSeg,
        sortKey: k,
        sortDirAsc: sortDirAsc,
        showFilterModal: false,
      },
      function () {
        this.rebuildDisplay();
      }.bind(this),
    );
  },

  resetFilterModal() {
    this.setData({
      filterDraftSeg: "any",
      modalSortKey: "comp",
      modalPriceDirAsc: false,
    });
  },

  async loadMore() {
    if (!this.data.nextCursor || this.data.loading || this.data.loadingMore) {
      return;
    }
    this.setData({ loadingMore: true });
    var apiCat = this.getApiCategory();
    var res = await request({
      path: buildTradeListPath({
        category: apiCat,
        cursor: this.data.nextCursor,
      }),
      method: "GET",
      userId: null,
    });
    this.setData({ loadingMore: false });
    if (!res.ok) {
      showErrorToast(res.envelope);
      return;
    }
    var rows = ((res.data && res.data.items) || []).map(mapItem);
    this.setData(
      {
        rawItems: this.data.rawItems.concat(rows),
        nextCursor: (res.data && res.data.next_cursor) || null,
      },
      function () {
        this.rebuildDisplay();
      }.bind(this),
    );
  },

  onReachBottom() {
    this.loadMore();
  },

  noop() {},

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
        from: "buy_search",
      }),
    });
  },
});
