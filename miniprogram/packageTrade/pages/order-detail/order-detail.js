const { request, showErrorToast } = require("../../../utils/api");
const { mapEnvelopeToError } = require("../../../utils/errors");
const { unifiedStatusLabel } = require("../../../utils/orderLabels");

function centsToYuan(c) {
  return (Number(c) / 100).toFixed(2);
}

function computeTradeCta(t) {
  var st = t.status;
  if (st === "PENDING_PAYMENT") {
    if (t.is_buyer) {
      return { kind: "pay_trade", label: "去支付", hint: "将调起微信支付（开发环境为模拟参数）", showRedeem: false };
    }
    return { kind: "none", label: "", hint: "等待买家完成支付", showRedeem: false };
  }
  if (st === "PAID_ESCROW") {
    if (t.is_buyer) {
      return {
        kind: "issue_handoff",
        label: "获取同城提货码",
        hint: "与卖家当面交割时请出示提货码",
        showRedeem: false,
      };
    }
    return {
      kind: "redeem_handoff",
      label: "确认核销",
      hint: "请向买家索取提货码，输入后完成交割",
      showRedeem: true,
    };
  }
  if (st === "SHIPPED") {
    return { kind: "none", label: "", hint: "履约进行中，请留意消息通知", showRedeem: false };
  }
  if (st === "COMPLETED") {
    return { kind: "none", label: "", hint: "订单已完成", showRedeem: false };
  }
  if (st === "DISPUTED") {
    return { kind: "none", label: "", hint: "争议处理中，请在消息中心查看进展", showRedeem: false };
  }
  return { kind: "none", label: "", hint: "", showRedeem: false };
}

function computeServiceCta(s) {
  if (s.status === "SLOT_HELD" && !s.slot_hold_expired && s.is_buyer) {
    return { kind: "pay_deposit", label: "支付定金", hint: "支付后档期将按规则锁定", showRedeem: false };
  }
  if (s.status === "SLOT_HELD" && !s.is_buyer) {
    return { kind: "none", label: "", hint: "等待买家支付定金", showRedeem: false };
  }
  if (s.status === "SLOT_HELD" && s.slot_hold_expired) {
    return { kind: "none", label: "", hint: "档期占位已过期，请重新选择档期下单", showRedeem: false };
  }
  if (s.status === "DEPOSIT_PAID") {
    return { kind: "none", label: "", hint: "定金已付，请按约定完成妆造服务", showRedeem: false };
  }
  if (s.status === "EXPIRED") {
    return { kind: "none", label: "", hint: "订单已过期", showRedeem: false };
  }
  return { kind: "none", label: "", hint: "当前状态：" + (s.status_label || unifiedStatusLabel(s.status)), showRedeem: false };
}

Page({
  data: {
    loading: true,
    error: null,
    kind: "",
    service: null,
    trade: null,
    ctaKind: "none",
    ctaLabel: "",
    ctaHint: "",
    showRedeem: false,
    redeemInput: "",
    payBusy: false,
    actionBusy: false,
  },

  onLoad(query) {
    this._resolveAndLoad(query || {});
  },

  async _resolveAndLoad(q) {
    var unifiedOrderId = q.unifiedOrderId || "";
    var orderType = q.orderType || "";
    var domainOrderId = q.domainOrderId || "";

    if (!orderType || !domainOrderId) {
      if (!unifiedOrderId) {
        this.setData({
          loading: false,
          error: { userTitle: "缺少订单参数", traceId: "" },
        });
        return;
      }
      var meta = await request({
        path: "/v1/me/unified-orders/" + encodeURIComponent(unifiedOrderId),
        method: "GET",
      });
      if (!meta.ok) {
        showErrorToast(meta.envelope);
        this.setData({
          loading: false,
          error: mapEnvelopeToError(meta.envelope),
        });
        return;
      }
      orderType = meta.data.order_type;
      domainOrderId = meta.data.domain_order_id;
    }

    this._orderType = orderType;
    this._domainOrderId = domainOrderId;
    await this.loadDetail(orderType, domainOrderId);
  },

  async loadDetail(orderType, domainOrderId) {
    this.setData({
      loading: true,
      error: null,
      kind: orderType,
      ctaKind: "none",
      ctaLabel: "",
      ctaHint: "",
      showRedeem: false,
      redeemInput: "",
    });
    var path =
      orderType === "service"
        ? "/v1/booking/orders/" + encodeURIComponent(domainOrderId)
        : "/v1/trade/orders/" + encodeURIComponent(domainOrderId);
    var res = await request({ path: path, method: "GET" });
    if (!res.ok) {
      showErrorToast(res.envelope);
      this.setData({
        loading: false,
        error: mapEnvelopeToError(res.envelope),
        service: null,
        trade: null,
      });
      return;
    }
    if (orderType === "service") {
      var d = res.data;
      var svc = {
        service_order_id: d.service_order_id,
        unified_order_id: d.unified_order_id,
        status: d.status,
        status_label: unifiedStatusLabel(d.status),
        depositYuan: centsToYuan(d.deposit_amount),
        finalYuan: centsToYuan(d.final_amount),
        holdNote: d.slot_hold_expired ? "档期占位已过期" : "",
        is_buyer: Boolean(d.is_buyer),
      };
      var ctaS = computeServiceCta(svc);
      this._unifiedId = d.unified_order_id;
      this.setData({
        loading: false,
        error: null,
        service: svc,
        trade: null,
        ctaKind: ctaS.kind,
        ctaLabel: ctaS.label,
        ctaHint: ctaS.hint,
        showRedeem: ctaS.showRedeem,
      });
    } else {
      var t = res.data;
      var tr = {
        trade_order_id: t.trade_order_id,
        unified_order_id: t.unified_order_id,
        status: t.status,
        status_label: unifiedStatusLabel(t.status),
        item_title: t.item_title,
        totalYuan: centsToYuan(t.total_amount),
        is_buyer: Boolean(t.is_buyer),
      };
      var ctaT = computeTradeCta(tr);
      this._unifiedId = t.unified_order_id;
      this._tradeOrderId = t.trade_order_id;
      this.setData({
        loading: false,
        error: null,
        trade: tr,
        service: null,
        ctaKind: ctaT.kind,
        ctaLabel: ctaT.label,
        ctaHint: ctaT.hint,
        showRedeem: ctaT.showRedeem,
      });
    }
  },

  refresh() {
    if (this._orderType && this._domainOrderId) {
      this.loadDetail(this._orderType, this._domainOrderId);
    }
  },

  onPrimaryCtaTap() {
    var k = this.data.ctaKind;
    if (k === "pay_trade" || k === "pay_deposit") {
      this._payUnified();
    } else if (k === "issue_handoff") {
      this._issueHandoff();
    } else if (k === "redeem_handoff") {
      this._redeemHandoff();
    }
  },

  onRedeemInput(e) {
    this.setData({ redeemInput: (e.detail && e.detail.value) || "" });
  },

  async _payUnified() {
    var uid = this._unifiedId;
    if (!uid || this.data.payBusy) {
      return;
    }
    this.setData({ payBusy: true });
    var res = await request({
      path: "/v1/payments/create",
      method: "POST",
      data: { unified_order_id: uid },
    });
    this.setData({ payBusy: false });
    if (!res.ok) {
      showErrorToast(res.envelope);
      return;
    }
    var prep = (res.data && res.data.prepay) || {};
    var that = this;
    wx.requestPayment({
      timeStamp: prep.timeStamp || "",
      nonceStr: prep.nonceStr || "",
      package: prep.package || "",
      signType: prep.signType || "RSA",
      paySign: prep.paySign || "",
      success: function () {
        wx.showToast({ title: "支付已提交", icon: "success" });
      },
      fail: function (err) {
        if (err && err.errMsg && String(err.errMsg).indexOf("cancel") !== -1) {
          wx.showToast({ title: "已取消支付", icon: "none" });
        } else {
          wx.showToast({ title: "支付未完成", icon: "none" });
        }
      },
      complete: function () {
        that.refresh();
      },
    });
  },

  async _issueHandoff() {
    var tid = this._tradeOrderId;
    if (!tid || this.data.actionBusy) {
      return;
    }
    this.setData({ actionBusy: true });
    var res = await request({
      path: "/v1/trade/orders/" + encodeURIComponent(tid) + "/local-handoff/issue",
      method: "POST",
      data: {},
    });
    this.setData({ actionBusy: false });
    if (!res.ok) {
      showErrorToast(res.envelope);
      return;
    }
    var code = (res.data && res.data.code) || "";
    wx.showModal({
      title: "提货码",
      content: code ? "请向卖家出示：\n" + code : "已生成提货码",
      confirmText: "复制",
      success: function (r) {
        if (r.confirm && code) {
          wx.setClipboardData({ data: code });
        }
      },
    });
    this.refresh();
  },

  async _redeemHandoff() {
    var tid = this._tradeOrderId;
    var raw = (this.data.redeemInput || "").trim().toUpperCase();
    if (!tid || !raw || this.data.actionBusy) {
      wx.showToast({ title: "请输入提货码", icon: "none" });
      return;
    }
    this.setData({ actionBusy: true });
    var res = await request({
      path: "/v1/trade/orders/" + encodeURIComponent(tid) + "/local-handoff/redeem",
      method: "POST",
      data: { code: raw },
    });
    this.setData({ actionBusy: false });
    if (!res.ok) {
      showErrorToast(res.envelope);
      return;
    }
    wx.showToast({ title: "核销成功", icon: "success" });
    this.setData({ redeemInput: "" });
    this.refresh();
  },
});
