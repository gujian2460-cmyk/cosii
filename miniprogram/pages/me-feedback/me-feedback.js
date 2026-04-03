var DRAFT_KEY = "cosii_me_feedback_draft_v1";

function saveDraft(contact, body) {
  try {
    wx.setStorageSync(DRAFT_KEY, {
      contact: contact || "",
      body: body || "",
      savedAt: Date.now(),
    });
  } catch (_) {
    /* ignore */
  }
}

function loadDraft() {
  try {
    var raw = wx.getStorageSync(DRAFT_KEY);
    if (raw && typeof raw === "object") {
      return {
        contact: typeof raw.contact === "string" ? raw.contact : "",
        body: typeof raw.body === "string" ? raw.body : "",
      };
    }
  } catch (_) {
    /* ignore */
  }
  return { contact: "", body: "" };
}

function clearDraft() {
  try {
    wx.removeStorageSync(DRAFT_KEY);
  } catch (_) {
    /* ignore */
  }
}

Page({
  data: {
    contact: "",
    body: "",
    draftRestored: false,
  },

  onLoad() {
    var d = loadDraft();
    if ((d.contact && d.contact.trim()) || (d.body && d.body.trim())) {
      this.setData({
        contact: d.contact,
        body: d.body,
        draftRestored: true,
      });
    }
  },

  onContactInput(e) {
    var v = (e.detail && e.detail.value) || "";
    this.setData({ contact: v });
    saveDraft(v, this.data.body);
  },

  onBodyInput(e) {
    var v = (e.detail && e.detail.value) || "";
    this.setData({ body: v });
    saveDraft(this.data.contact, v);
  },

  onSubmit() {
    var b = (this.data.body || "").trim();
    if (!b) {
      wx.showToast({ title: "请填写反馈内容", icon: "none" });
      return;
    }
    clearDraft();
    this.setData({ draftRestored: false });
    wx.showModal({
      title: "反馈已记录（本地）",
      content: "正式版将对接工单或客服系统。你可先截图保存本页内容联系运营。",
      showCancel: false,
    });
  },
});
