const { request, showErrorToast } = require("../../utils/api");
const { mapEnvelopeToError, copyTraceId } = require("../../utils/errors");
const routes = require("../../config/routes");
const { setTabBarSelected } = require("../../utils/tabBar");
const REGION_TREE = require("../../data/china-regions.js");

/** 与区域轮盘数据一致，用于列表 mock 区域匹配筛选 */
const MOCK_REGION_PATHS = [
  "广东省·深圳市·南山区",
  "广东省·深圳市·福田区",
  "广东省·广州市·天河区",
  "上海市·市辖区·静安区",
  "上海市·市辖区·浦东新区",
  "浙江省·杭州市·西湖区",
  "江苏省·南京市·鼓楼区",
  "北京市·市辖区·朝阳区",
  "天津市·市辖区·和平区",
  "重庆市·市辖区·渝中区",
  "四川省·成都市·武侯区",
  "湖北省·武汉市·武昌区",
  "陕西省·西安市·雁塔区",
  "山东省·青岛市·市南区",
  "河南省·郑州市·金水区",
  "广东省·佛山市·南海区",
  "浙江省·宁波市·鄞州区",
  "江苏省·苏州市·姑苏区",
];
const MOCK_SHOPS = ["星野COS馆", "次元小铺", "假发专卖", "道具工坊"];
const SELLER_TAGS = ["认证商家", "妆娘工作室", "品牌好店", "次元小铺"];

var CHIP_DEFS = [
  { id: "costume", label: "COS服装", group: "trade" },
  { id: "wig", label: "假发", group: "trade" },
  { id: "props", label: "周边", group: "trade" },
  { id: "daily", label: "平时装造", group: "exclusive" },
  { id: "booking", label: "漫展约妆", group: "exclusive" },
];

function hashStr(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getFetchCategory(selectedTradeIds, exclusiveTab) {
  if (exclusiveTab === "daily") {
    return null;
  }
  if (selectedTradeIds.length === 1) {
    return selectedTradeIds[0];
  }
  return null;
}

function buildTradeListPath(opts) {
  var q = ["limit=40"];
  if (opts.cursor) {
    q.push("cursor=" + encodeURIComponent(opts.cursor));
  }
  var cat = opts.category;
  if (cat && cat !== "all") {
    q.push("category=" + encodeURIComponent(cat));
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
    region: MOCK_REGION_PATHS[h % MOCK_REGION_PATHS.length],
    shopName: MOCK_SHOPS[h % MOCK_SHOPS.length],
    pinned: h % 11 === 0,
    sellerTag: SELLER_TAGS[h % SELLER_TAGS.length],
  };
}

function splitColsSized(items) {
  var left = [];
  var right = [];
  for (var i = 0; i < items.length; i++) {
    var r = i % 4;
    var large = r === 0 || r === 3;
    var cell = Object.assign({}, items[i], { cardLarge: large });
    if (i % 2 === 0) {
      left.push(cell);
    } else {
      right.push(cell);
    }
  }
  return { left: left, right: right };
}

/** 多选 trade + 平时装造 文案过滤 */
function applyCategoryChips(items, selectedTradeIds, exclusiveTab) {
  var out = items.slice();
  if (exclusiveTab === "daily") {
    out = out.filter(function (it) {
      return /妆|造|娘|服化|造型/.test(String(it.title || ""));
    });
  }
  if (selectedTradeIds.length > 0) {
    var set = {};
    for (var i = 0; i < selectedTradeIds.length; i++) {
      set[selectedTradeIds[i]] = true;
    }
    out = out.filter(function (it) {
      return set[it.category];
    });
  }
  return out;
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
  } else if (sortMode === "comp_active") {
    copy.sort(function (a, b) {
      return hashStr(b.item_id) - hashStr(a.item_id);
    });
  } else if (sortMode === "comp_near") {
    copy.sort(function (a, b) {
      return String(a.region || "").localeCompare(String(b.region || ""));
    });
  } else if (sortMode === "comp_credit") {
    copy.sort(function (a, b) {
      return String(a.shopName || "").localeCompare(String(b.shopName || ""));
    });
  }
  return copy;
}

function applyPriceFilter(items, seg, minStr, maxStr) {
  var ms = (minStr || "").trim();
  var xs = (maxStr || "").trim();
  if (ms !== "" || xs !== "") {
    var lo = ms === "" ? -Infinity : Number(ms);
    var hi = xs === "" ? Infinity : Number(xs);
    if (Number.isNaN(lo)) {
      lo = -Infinity;
    }
    if (Number.isNaN(hi)) {
      hi = Infinity;
    }
    return items.filter(function (it) {
      var y = it.price_cents / 100;
      if (lo !== -Infinity && y < lo) {
        return false;
      }
      if (hi !== Infinity && y > hi) {
        return false;
      }
      return true;
    });
  }
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
    if (seg === "300-500") {
      return y >= 300 && y < 500;
    }
    if (seg === "500+") {
      return y >= 500;
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

function regionMatchesItem(itemRegion, chipPath) {
  if (!itemRegion || !chipPath) {
    return false;
  }
  var compact = function (s) {
    return String(s).replace(/[\s·\-\u3000]/g, "");
  };
  var parts = String(chipPath).split(/[-·]/);
  var ir = compact(itemRegion);
  for (var i = 0; i < parts.length; i++) {
    var p = compact(parts[i]);
    if (!p) {
      continue;
    }
    if (ir.indexOf(p) === -1) {
      return false;
    }
  }
  return true;
}

function applyRegionFilter(items, regionChips) {
  if (!regionChips || regionChips.length === 0) {
    return items;
  }
  return items.filter(function (it) {
    for (var i = 0; i < regionChips.length; i++) {
      if (regionMatchesItem(it.region, regionChips[i].label)) {
        return true;
      }
    }
    return false;
  });
}

var PRICE_SEG_LABEL = {
  "0-50": "50以下",
  "50-100": "50-100",
  "100-300": "100-300",
  "300-500": "300-500",
  "500+": "500以上",
  "300+": "300以上",
};

function buildPriceSummaryLabel(d) {
  var parts = [];
  if (d.filterPriceSeg && d.filterPriceSeg !== "any") {
    parts.push(PRICE_SEG_LABEL[d.filterPriceSeg] || d.filterPriceSeg);
  }
  var mn = String(d.filterCustomMin || "").trim();
  var mx = String(d.filterCustomMax || "").trim();
  if (mn !== "" || mx !== "") {
    parts.push((mn || "—") + "~" + (mx || "—"));
  }
  if (d.sortKey === "price") {
    parts.push(d.sortDirAsc ? "从低到高" : "从高到低");
  }
  if (parts.length === 0) {
    return "价格";
  }
  return "价格：" + parts.join(" · ");
}

function buildFilterSummary(d) {
  var chips = [];
  if (d.sortKey === "comp" && d.compSortMode !== "default") {
    var cm = {
      active: "最近活跃",
      near: "离我最近",
      credit: "信用排序",
    };
    chips.push({
      id: "comp",
      label: "综合：" + (cm[d.compSortMode] || d.compSortMode),
    });
  }
  var hasPriceConstraint =
    (d.filterPriceSeg && d.filterPriceSeg !== "any") ||
    String(d.filterCustomMin || "").trim() !== "" ||
    String(d.filterCustomMax || "").trim() !== "";
  if (hasPriceConstraint || d.sortKey === "price") {
    chips.push({ id: "price", label: buildPriceSummaryLabel(d) });
  }
  var regs = d.regionChips || [];
  for (var i = 0; i < regs.length; i++) {
    chips.push({
      id: "region:" + regs[i].key,
      label: "区域：" + regs[i].label,
    });
  }
  return {
    filterSummaryVisible: chips.length > 0,
    filterSummaryChips: chips,
  };
}

function buildRegionPickerColumns(tree, p, c) {
  var provinces = tree.map(function (x) {
    return x.name;
  });
  if (p < 0 || p >= tree.length) {
    p = 0;
  }
  var cities = tree[p].cities.map(function (x) {
    return x.name;
  });
  if (c < 0 || c >= tree[p].cities.length) {
    c = 0;
  }
  var districts = tree[p].cities[c].districts.slice();
  return { provinces: provinces, cities: cities, districts: districts };
}

var REGION_PICKER_INIT = buildRegionPickerColumns(REGION_TREE, 0, 0);

function inferPriceDraftModeFromCommitted(d) {
  var hasCustom =
    String(d.filterCustomMin || "").trim() !== "" ||
    String(d.filterCustomMax || "").trim() !== "";
  return hasCustom ? "custom" : "preset";
}

/** 从已生效的 filter 同步价格弹窗草稿（预设 / 自定义互斥） */
function syncPriceModalDraftFromCommitted(d) {
  var mode = inferPriceDraftModeFromCommitted(d);
  if (mode === "custom") {
    return {
      priceDraftMode: "custom",
      filterDraftSeg: "any",
      filterDraftMin: d.filterCustomMin || "",
      filterDraftMax: d.filterCustomMax || "",
    };
  }
  return {
    priceDraftMode: "preset",
    filterDraftSeg: d.filterPriceSeg || "any",
    filterDraftMin: "",
    filterDraftMax: "",
  };
}

function buildChipsView(selectedTradeIds, exclusiveTab) {
  var ids = selectedTradeIds || [];
  var ex = exclusiveTab || "";
  return CHIP_DEFS.map(function (c) {
    var on = false;
    if (c.group === "trade") {
      on = ids.indexOf(c.id) >= 0;
    } else if (c.id === "booking") {
      on = false;
    } else {
      on = ex === c.id;
    }
    return { id: c.id, label: c.label, group: c.group, on: on };
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
    selectedTradeIds: [],
    exclusiveTab: "",
    chipsView: buildChipsView([], ""),
    sortKey: "comp",
    sortDirAsc: false,
    compSortMode: "default",
    compModalDraft: "default",
    showCompModal: false,
    showPriceModal: false,
    compModalDismissAnim: false,
    priceModalDismissAnim: false,
    filterPriceSeg: "any",
    filterDraftSeg: "any",
    filterCustomMin: "",
    filterCustomMax: "",
    filterDraftMin: "",
    filterDraftMax: "",
    priceDraftMode: "preset",
    priceModalDirAsc: true,
    sortRowLabel: "综合",
    regionChips: [],
    showRegionModal: false,
    regionPickerValue: [0, 0, 0],
    regionPickerProvinces: REGION_PICKER_INIT.provinces,
    regionPickerCities: REGION_PICKER_INIT.cities,
    regionPickerDistricts: REGION_PICKER_INIT.districts,
    filterSummaryVisible: false,
    filterSummaryChips: [],
  },

  onLoad() {
    var patch = this.takePresetPatch();
    if (Object.keys(patch).length) {
      this.setData(patch, function () {
        this.setData({ chipsView: buildChipsView(this.data.selectedTradeIds, this.data.exclusiveTab) });
        this.refresh();
      }.bind(this));
    } else {
      this.setData({ chipsView: buildChipsView([], "") });
      this.refresh();
    }
  },

  onShow() {
    setTabBarSelected(1);
    var patch = this.takePresetPatch();
    if (!Object.keys(patch).length) {
      return;
    }
    var needRefresh =
      Object.prototype.hasOwnProperty.call(patch, "selectedTradeIds") ||
      Object.prototype.hasOwnProperty.call(patch, "exclusiveTab");
    if (needRefresh) {
      this.setData(patch, function () {
        this.setData({ chipsView: buildChipsView(this.data.selectedTradeIds, this.data.exclusiveTab) });
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
      if (p.category != null) {
        var cat = p.category;
        if (cat === "all") {
          patch.selectedTradeIds = [];
          patch.exclusiveTab = "";
        } else if (["costume", "wig", "props"].indexOf(cat) >= 0) {
          patch.selectedTradeIds = [cat];
          patch.exclusiveTab = "";
        }
      }
      if (p.keyword != null && p.keyword !== this.data.keyword) {
        patch.keyword = p.keyword;
      }
    } catch (_) {
      /* ignore */
    }
    return patch;
  },

  async onPullDownRefresh() {
    await this.refresh();
    wx.stopPullDownRefresh();
  },

  async refresh() {
    this.setData({ loading: true, error: null, nextCursor: null });
    var cat = getFetchCategory(this.data.selectedTradeIds, this.data.exclusiveTab);
    var res = await request({
      path: buildTradeListPath({ category: cat || undefined }),
      method: "GET",
      userId: null,
    });
    if (!res.ok) {
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
    list = applyCategoryChips(list, this.data.selectedTradeIds, this.data.exclusiveTab);
    list = applyPriceFilter(
      list,
      this.data.filterPriceSeg,
      this.data.filterCustomMin,
      this.data.filterCustomMax,
    );
    list = applyRegionFilter(list, this.data.regionChips);
    var sortMode = this.resolveSortMode();
    list = applySort(list, sortMode);
    var cols = splitColsSized(list);
    var summary = buildFilterSummary(this.data);
    this.setData({
      displayLeft: cols.left,
      displayRight: cols.right,
      empty: list.length === 0 && !this.data.loading,
      filterSummaryVisible: summary.filterSummaryVisible,
      filterSummaryChips: summary.filterSummaryChips,
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
    if (k === "comp") {
      var m = this.data.compSortMode;
      if (m === "active") {
        return "comp_active";
      }
      if (m === "near") {
        return "comp_near";
      }
      if (m === "credit") {
        return "comp_credit";
      }
    }
    return "default";
  },

  updateSortRowLabel() {
    var t = "综合";
    if (this.data.sortKey === "comp") {
      var m = this.data.compSortMode;
      if (m === "active") {
        t = "活跃";
      } else if (m === "near") {
        t = "距离";
      } else if (m === "credit") {
        t = "信用";
      } else {
        t = "综合";
      }
    } else if (this.data.sortKey === "price") {
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

  onChipTap(e) {
    var id = (e.currentTarget.dataset && e.currentTarget.dataset.id) || "";
    if (id === "booking") {
      wx.navigateTo({ url: routes.RECENT_EXPO });
      return;
    }
    if (id === "daily") {
      if (this.data.exclusiveTab === "daily") {
        this.setData({ exclusiveTab: "" }, function () {
          this.setData({ chipsView: buildChipsView(this.data.selectedTradeIds, "") });
          this.refresh();
        }.bind(this));
      } else {
        this.setData({ exclusiveTab: "daily", selectedTradeIds: [] }, function () {
          this.setData({ chipsView: buildChipsView([], "daily") });
          this.refresh();
        }.bind(this));
      }
      return;
    }
    if (["costume", "wig", "props"].indexOf(id) < 0) {
      return;
    }
    var arr = this.data.selectedTradeIds.slice();
    var idx = arr.indexOf(id);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push(id);
    }
    this.setData({ selectedTradeIds: arr, exclusiveTab: "" }, function () {
      this.setData({ chipsView: buildChipsView(arr, "") });
      this.refresh();
    }.bind(this));
  },

  onSortTap(e) {
    var k = (e.currentTarget.dataset && e.currentTarget.dataset.k) || "comp";
    if (k === "region") {
      this.openRegionModal();
      return;
    }
    if (k === "comp") {
      this.setData({
        showPriceModal: false,
        priceModalDismissAnim: false,
        showCompModal: true,
        compModalDismissAnim: false,
        compModalDraft: this.data.compSortMode,
      });
      return;
    }
    if (k === "price") {
      var priceDraft = syncPriceModalDraftFromCommitted(this.data);
      this.setData(
        Object.assign(
          {
            showCompModal: false,
            compModalDismissAnim: false,
            showPriceModal: true,
            priceModalDismissAnim: false,
            priceModalDirAsc:
              this.data.sortKey === "price" ? this.data.sortDirAsc : true,
          },
          priceDraft,
        ),
      );
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

  openPriceModal() {
    var priceDraft = syncPriceModalDraftFromCommitted(this.data);
    this.setData(
      Object.assign(
        {
          showCompModal: false,
          compModalDismissAnim: false,
          showPriceModal: true,
          priceModalDismissAnim: false,
          priceModalDirAsc:
            this.data.sortKey === "price" ? this.data.sortDirAsc : true,
        },
        priceDraft,
      ),
    );
  },

  closeCompModal() {
    if (!this.data.showCompModal) {
      return;
    }
    if (this._compModalClosing) {
      return;
    }
    this._compModalClosing = true;
    var sortMode = this.data.compSortMode;
    this.setData({ compModalDismissAnim: true });
    var self = this;
    setTimeout(function () {
      self.setData({
        showCompModal: false,
        compModalDismissAnim: false,
        compModalDraft: sortMode,
      });
      self._compModalClosing = false;
    }, 220);
  },

  closePriceModal() {
    if (!this.data.showPriceModal) {
      return;
    }
    if (this._priceModalClosing) {
      return;
    }
    this._priceModalClosing = true;
    var dirAsc =
      this.data.sortKey === "price" ? this.data.sortDirAsc : true;
    this.setData({ priceModalDismissAnim: true });
    var self = this;
    setTimeout(function () {
      var draft = syncPriceModalDraftFromCommitted(self.data);
      self.setData(
        Object.assign(
          {
            showPriceModal: false,
            priceModalDismissAnim: false,
            priceModalDirAsc: dirAsc,
          },
          draft,
        ),
      );
      self._priceModalClosing = false;
    }, 220);
  },

  onCompDraftTap(e) {
    var v = (e.currentTarget.dataset && e.currentTarget.dataset.v) || "default";
    this.setData({ compModalDraft: v });
  },

  confirmCompModal() {
    this.setData(
      {
        showCompModal: false,
        compModalDismissAnim: false,
        sortKey: "comp",
        sortDirAsc: false,
        compSortMode: this.data.compModalDraft,
      },
      function () {
        this.rebuildDisplay();
      }.bind(this),
    );
  },

  onModalPriceTap(e) {
    var seg = (e.currentTarget.dataset && e.currentTarget.dataset.seg) || "any";
    this.setData({
      priceDraftMode: "preset",
      filterDraftSeg: seg,
      filterDraftMin: "",
      filterDraftMax: "",
    });
  },

  onPriceCustomRowTap() {
    if (this.data.priceDraftMode !== "preset") {
      return;
    }
    this.setData({
      priceDraftMode: "custom",
      filterDraftSeg: "any",
      filterDraftMin: "",
      filterDraftMax: "",
    });
  },

  onDraftMinInput(e) {
    var v = (e.detail && e.detail.value) || "";
    this.setData({
      priceDraftMode: "custom",
      filterDraftSeg: "any",
      filterDraftMin: v,
    });
  },

  onDraftMaxInput(e) {
    var v = (e.detail && e.detail.value) || "";
    this.setData({
      priceDraftMode: "custom",
      filterDraftSeg: "any",
      filterDraftMax: v,
    });
  },

  onPriceDirTap(e) {
    var asc = (e.currentTarget.dataset && e.currentTarget.dataset.asc) === "1";
    this.setData({ priceModalDirAsc: asc });
  },

  applyPriceModal() {
    var dmin = (this.data.filterDraftMin || "").trim();
    var dmax = (this.data.filterDraftMax || "").trim();
    if (this.data.priceDraftMode === "custom" && dmin !== "" && dmax !== "") {
      var lo = Number(dmin);
      var hi = Number(dmax);
      if (!Number.isNaN(lo) && !Number.isNaN(hi) && lo >= hi) {
        wx.showToast({
          title: "最低价不能大于等于最高价哦~",
          icon: "none",
        });
        return;
      }
    }
    var patch = {
      showPriceModal: false,
      priceModalDismissAnim: false,
      sortKey: "price",
      sortDirAsc: this.data.priceModalDirAsc,
    };
    if (this.data.priceDraftMode === "custom") {
      patch.filterPriceSeg = "any";
      patch.filterCustomMin = dmin;
      patch.filterCustomMax = dmax;
    } else {
      patch.filterPriceSeg = this.data.filterDraftSeg || "any";
      patch.filterCustomMin = "";
      patch.filterCustomMax = "";
    }
    this.setData(patch, function () {
      this.rebuildDisplay();
    }.bind(this));
  },

  async loadMore() {
    if (!this.data.nextCursor || this.data.loading || this.data.loadingMore) {
      return;
    }
    this.setData({ loadingMore: true });
    var cat = getFetchCategory(this.data.selectedTradeIds, this.data.exclusiveTab);
    var res = await request({
      path: buildTradeListPath({
        category: cat || undefined,
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

  openRegionModal() {
    var v = (this.data.regionPickerValue || [0, 0, 0]).slice();
    var p = v[0];
    if (p < 0 || p >= REGION_TREE.length) {
      p = 0;
    }
    var cities = REGION_TREE[p].cities;
    var c = v[1];
    if (c < 0 || c >= cities.length) {
      c = 0;
    }
    var dists = cities[c].districts;
    var d = v[2];
    if (d < 0 || d >= dists.length) {
      d = 0;
    }
    var cols = buildRegionPickerColumns(REGION_TREE, p, c);
    this.setData({
      showCompModal: false,
      showPriceModal: false,
      compModalDismissAnim: false,
      priceModalDismissAnim: false,
      showRegionModal: true,
      regionPickerValue: [p, c, d],
      regionPickerProvinces: cols.provinces,
      regionPickerCities: cols.cities,
      regionPickerDistricts: cols.districts,
    });
  },

  closeRegionModal() {
    this.setData({ showRegionModal: false });
  },

  onRegionPickerChange(e) {
    var raw = (e.detail && e.detail.value) || [0, 0, 0];
    var p = Number(raw[0]) || 0;
    var c = Number(raw[1]) || 0;
    var d = Number(raw[2]) || 0;
    if (p < 0 || p >= REGION_TREE.length) {
      p = 0;
    }
    var cities = REGION_TREE[p].cities;
    if (c < 0 || c >= cities.length) {
      c = 0;
    }
    var dists = cities[c].districts;
    if (d < 0 || d >= dists.length) {
      d = dists.length - 1;
    }
    var cols = buildRegionPickerColumns(REGION_TREE, p, c);
    this.setData({
      regionPickerValue: [p, c, d],
      regionPickerCities: cols.cities,
      regionPickerDistricts: cols.districts,
    });
  },

  confirmRegionModal() {
    var v = this.data.regionPickerValue;
    var p = v[0];
    var c = v[1];
    var d = v[2];
    var prov = REGION_TREE[p];
    var city = prov.cities[c];
    var distName = city.districts[d];
    var label = prov.name + "-" + city.name + "-" + distName;
    var chips = (this.data.regionChips || []).slice();
    var dup = chips.some(function (x) {
      return x.label === label;
    });
    if (!dup) {
      chips.push({ key: "r" + String(Date.now()), label: label });
    }
    this.setData({ showRegionModal: false, regionChips: chips }, function () {
      this.rebuildDisplay();
    }.bind(this));
  },

  onRemoveFilterChip(e) {
    var id = (e.currentTarget.dataset && e.currentTarget.dataset.id) || "";
    if (id === "comp") {
      this.setData({ compSortMode: "default" }, function () {
        this.rebuildDisplay();
      }.bind(this));
      return;
    }
    if (id === "price") {
      this.setData(
        {
          filterPriceSeg: "any",
          filterCustomMin: "",
          filterCustomMax: "",
          filterDraftSeg: "any",
          filterDraftMin: "",
          filterDraftMax: "",
          priceDraftMode: "preset",
          sortKey: "comp",
          sortDirAsc: false,
          priceModalDirAsc: true,
        },
        function () {
          this.rebuildDisplay();
        }.bind(this),
      );
      return;
    }
    if (id.indexOf("region:") === 0) {
      var key = id.slice("region:".length);
      var next = (this.data.regionChips || []).filter(function (x) {
        return x.key !== key;
      });
      this.setData({ regionChips: next }, function () {
        this.rebuildDisplay();
      }.bind(this));
    }
  },

  onCardTap(e) {
    var itemId = e.currentTarget.dataset.itemId;
    if (!itemId) {
      return;
    }
    wx.navigateTo({
      url: routes.itemDetailQuery({ itemId: itemId, from: "buy_search" }),
    });
  },

  /** 客户端筛选一键清空（UX-013） */
  clearAllClientFilters() {
    this.setData(
      {
        keyword: "",
        selectedTradeIds: [],
        exclusiveTab: "",
        chipsView: buildChipsView([], ""),
        sortKey: "comp",
        sortDirAsc: false,
        compSortMode: "default",
        filterPriceSeg: "any",
        filterCustomMin: "",
        filterCustomMax: "",
        filterDraftSeg: "any",
        filterDraftMin: "",
        filterDraftMax: "",
        priceDraftMode: "preset",
        priceModalDirAsc: true,
        regionChips: [],
      },
      function () {
        this.rebuildDisplay();
      }.bind(this),
    );
  },

  goTradeList() {
    wx.navigateTo({ url: routes.TRADE_LIST });
  },

  onCopyTraceTap() {
    copyTraceId(this.data.error && this.data.error.traceId);
  },
});
