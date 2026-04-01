const { request, showErrorToast } = require("../../utils/api");
const routes = require("../../config/routes");
const { setTabBarSelected } = require("../../utils/tabBar");
const REGION_TREE = require("../../data/china-regions.js");

var CATEGORIES = [
  { id: "costume", label: "服装" },
  { id: "wig", label: "假发" },
  { id: "props", label: "周边" },
];

var CONDITION_LABELS = ["全新", "几乎全新", "轻微使用", "明显痕迹"];
var TRADE_MODE_LABELS = ["线上邮寄", "同城面交", "均可"];

var DRAFT_KEY = "cosii_publish_sale_draft";

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

function defaultIdle() {
  return {
    images: [],
    title: "",
    desc: "",
    price: "",
    categoryIndex: 0,
    conditionIndex: 0,
    tradeModeIndex: 0,
    regionLabel: "",
    regionPick: [0, 0, 0],
  };
}

function defaultMakeup() {
  return {
    images: [],
    name: "",
    intro: "",
    price: "",
    timeText: "",
    location: "",
    regionLabel: "",
    notice: "",
    regionPick: [0, 0, 0],
  };
}

Page({
  data: {
    statusBarHeight: 20,
    navInnerPx: 44,
    activeTab: "idle",
    categoryLabels: CATEGORIES.map(function (c) {
      return c.label;
    }),
    conditionLabels: CONDITION_LABELS,
    tradeModeLabels: TRADE_MODE_LABELS,
    idle: defaultIdle(),
    makeup: defaultMakeup(),
    commitmentChecked: false,
    submitting: false,
    showRegionModal: false,
    regionTargetTab: "idle",
    regionPickerValue: [0, 0, 0],
    regionPickerProvinces: REGION_PICKER_INIT.provinces,
    regionPickerCities: REGION_PICKER_INIT.cities,
    regionPickerDistricts: REGION_PICKER_INIT.districts,
  },

  onLoad() {
    var sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: sys.statusBarHeight || 20,
      navInnerPx: 44,
    });
    this.loadDraft();
  },

  onShow() {
    setTabBarSelected(2);
  },

  loadDraft() {
    try {
      var raw = wx.getStorageSync(DRAFT_KEY);
      if (!raw || typeof raw !== "object") {
        return;
      }
      var patch = {};
      if (raw.activeTab === "idle" || raw.activeTab === "makeup") {
        patch.activeTab = raw.activeTab;
      }
      if (raw.idle && typeof raw.idle === "object") {
        patch.idle = Object.assign(defaultIdle(), raw.idle, {
          images: Array.isArray(raw.idle.images) ? raw.idle.images : [],
        });
      }
      if (raw.makeup && typeof raw.makeup === "object") {
        patch.makeup = Object.assign(defaultMakeup(), raw.makeup, {
          images: Array.isArray(raw.makeup.images) ? raw.makeup.images : [],
        });
      }
      if (typeof raw.commitmentChecked === "boolean") {
        patch.commitmentChecked = raw.commitmentChecked;
      }
      if (Object.keys(patch).length) {
        this.setData(patch);
      }
    } catch (_) {
      /* ignore */
    }
  },

  onNavBack() {
    wx.navigateBack({
      fail: function () {
        wx.switchTab({ url: "/pages/home/index" });
      },
    });
  },

  onTabTap(e) {
    var tab = (e.currentTarget.dataset && e.currentTarget.dataset.tab) || "idle";
    if (tab !== "idle" && tab !== "makeup") {
      return;
    }
    this.setData({ activeTab: tab });
  },

  onIdleField(e) {
    var f = (e.currentTarget.dataset && e.currentTarget.dataset.field) || "";
    if (!f) {
      return;
    }
    var v = (e.detail && e.detail.value) || "";
    var idle = Object.assign({}, this.data.idle, { [f]: v });
    this.setData({ idle: idle });
  },

  onIdleCategoryChange(e) {
    var idx = Number((e.detail && e.detail.value) || 0);
    this.setData({ idle: Object.assign({}, this.data.idle, { categoryIndex: idx }) });
  },

  onIdleConditionChange(e) {
    var idx = Number((e.detail && e.detail.value) || 0);
    this.setData({ idle: Object.assign({}, this.data.idle, { conditionIndex: idx }) });
  },

  onIdleTradeModeChange(e) {
    var idx = Number((e.detail && e.detail.value) || 0);
    this.setData({ idle: Object.assign({}, this.data.idle, { tradeModeIndex: idx }) });
  },

  onMakeupField(e) {
    var f = (e.currentTarget.dataset && e.currentTarget.dataset.field) || "";
    if (!f) {
      return;
    }
    var v = (e.detail && e.detail.value) || "";
    var makeup = Object.assign({}, this.data.makeup, { [f]: v });
    this.setData({ makeup: makeup });
  },

  onChooseIdleImages() {
    var self = this;
    var left = 9 - (this.data.idle.images || []).length;
    if (left <= 0) {
      return;
    }
    wx.chooseMedia({
      count: left,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: function (res) {
        var files = (res.tempFiles || []).map(function (f) {
          return f.tempFilePath;
        });
        var next = (self.data.idle.images || []).concat(files).slice(0, 9);
        self.setData({ idle: Object.assign({}, self.data.idle, { images: next }) });
      },
    });
  },

  onRemoveIdleImage(e) {
    var i = Number((e.currentTarget.dataset && e.currentTarget.dataset.index) || -1);
    if (i < 0) {
      return;
    }
    var arr = (this.data.idle.images || []).slice();
    arr.splice(i, 1);
    this.setData({ idle: Object.assign({}, this.data.idle, { images: arr }) });
  },

  onChooseMakeupImages() {
    var self = this;
    var left = 6 - (this.data.makeup.images || []).length;
    if (left <= 0) {
      return;
    }
    wx.chooseMedia({
      count: left,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: function (res) {
        var files = (res.tempFiles || []).map(function (f) {
          return f.tempFilePath;
        });
        var next = (self.data.makeup.images || []).concat(files).slice(0, 6);
        self.setData({ makeup: Object.assign({}, self.data.makeup, { images: next }) });
      },
    });
  },

  onRemoveMakeupImage(e) {
    var i = Number((e.currentTarget.dataset && e.currentTarget.dataset.index) || -1);
    if (i < 0) {
      return;
    }
    var arr = (this.data.makeup.images || []).slice();
    arr.splice(i, 1);
    this.setData({ makeup: Object.assign({}, this.data.makeup, { images: arr }) });
  },

  onCommitmentChange(e) {
    var v = (e.detail && e.detail.value) || [];
    this.setData({ commitmentChecked: v.indexOf("1") >= 0 });
  },

  openRegionModal(e) {
    var tab =
      (e.currentTarget.dataset && e.currentTarget.dataset.tab) || this.data.activeTab;
    var block = tab === "idle" ? this.data.idle : this.data.makeup;
    var v = (block.regionPick || [0, 0, 0]).slice();
    var p = v[0];
    var c = v[1];
    if (p < 0 || p >= REGION_TREE.length) {
      p = 0;
    }
    var cities = REGION_TREE[p].cities;
    var ci = v[1];
    if (ci < 0 || ci >= cities.length) {
      ci = 0;
    }
    var dists = cities[ci].districts;
    var di = v[2];
    if (di < 0 || di >= dists.length) {
      di = 0;
    }
    var cols = buildRegionPickerColumns(REGION_TREE, p, ci);
    this.setData({
      showRegionModal: true,
      regionTargetTab: tab,
      regionPickerValue: [p, ci, di],
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
    var prov = REGION_TREE[v[0]];
    var city = prov.cities[v[1]];
    var distName = city.districts[v[2]];
    var label = prov.name + "-" + city.name + "-" + distName;
    var tab = this.data.regionTargetTab;
    var key = tab === "idle" ? "idle" : "makeup";
    var cur = tab === "idle" ? this.data.idle : this.data.makeup;
    var next = Object.assign({}, cur, {
      regionLabel: label,
      regionPick: v.slice(),
    });
    var patch = { showRegionModal: false };
    patch[key] = next;
    this.setData(patch);
  },

  noop() {},

  onSaveDraft() {
    try {
      wx.setStorageSync(DRAFT_KEY, {
        activeTab: this.data.activeTab,
        idle: this.data.idle,
        makeup: this.data.makeup,
        commitmentChecked: this.data.commitmentChecked,
      });
      wx.showToast({ title: "草稿已保存", icon: "success" });
    } catch (_) {
      wx.showToast({ title: "保存失败", icon: "none" });
    }
  },

  async onPublish() {
    if (!this.data.commitmentChecked || this.data.submitting) {
      return;
    }
    if (this.data.activeTab === "idle") {
      await this.publishIdle();
    } else {
      await this.publishMakeup();
    }
  },

  async publishIdle() {
    var idle = this.data.idle;
    var title = (idle.title || "").trim();
    if (!title) {
      wx.showToast({ title: "请填写标题", icon: "none" });
      return;
    }
    var yuan = parseFloat(idle.price);
    if (!Number.isFinite(yuan) || yuan <= 0) {
      wx.showToast({ title: "请输入有效价格", icon: "none" });
      return;
    }
    var cents = Math.round(yuan * 100);
    if (cents < 1) {
      wx.showToast({ title: "价格过低", icon: "none" });
      return;
    }
    var cat = CATEGORIES[idle.categoryIndex] || CATEGORIES[0];
    this.setData({ submitting: true });
    var res = await request({
      path: "/v1/trade/items",
      method: "POST",
      data: {
        title: title,
        category: cat.id,
        price_cents: cents,
      },
    });
    this.setData({ submitting: false });
    if (!res.ok) {
      showErrorToast(res.envelope);
      return;
    }
    try {
      wx.removeStorageSync(DRAFT_KEY);
    } catch (_) {
      /* ignore */
    }
    wx.showToast({ title: "发布成功", icon: "success" });
    setTimeout(function () {
      wx.redirectTo({ url: routes.TRADE_LIST });
    }, 450);
  },

  async publishMakeup() {
    var m = this.data.makeup;
    var name = (m.name || "").trim();
    if (!name) {
      wx.showToast({ title: "请填写妆面名称", icon: "none" });
      return;
    }
    var yuan = parseFloat(m.price);
    if (!Number.isFinite(yuan) || yuan <= 0) {
      wx.showToast({ title: "请输入有效价格", icon: "none" });
      return;
    }
    // V1: 接妆发布接口尚未开放 — 明确占位，避免「假成功」。
    this.setData({ submitting: true });
    await new Promise(function (r) {
      setTimeout(r, 400);
    });
    this.setData({ submitting: false });
    wx.showModal({
      title: "接妆发布暂未开放",
      content: "当前为内测占位，正式提交与档期展示将后续上线。表单内容仍保留在本地，可随时继续编辑。",
      showCancel: false,
      confirmText: "我知道了",
    });
  },
});
