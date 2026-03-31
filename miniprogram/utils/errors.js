/**
 * 将 envelope 转为页内状态条展示（与 api-envelope / ux-map 一致）
 */

/**
 * 接口偶发返回非 string 时，避免 WXML / showToast 出现 [object Object]
 */
function normalizeUserFacingText(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "string") {
    var s = value.trim();
    return s ? s : fallback;
  }
  if (typeof value === "number" && !Number.isNaN(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  return fallback;
}

function envelopeUserTitle(envelope) {
  if (!envelope || typeof envelope !== "object") {
    return "请求失败";
  }
  var fromUx = normalizeUserFacingText(
    envelope.error && envelope.error.user_title,
    "",
  );
  if (fromUx) {
    return fromUx;
  }
  var fromMsg = normalizeUserFacingText(envelope.message, "");
  if (fromMsg) {
    return fromMsg;
  }
  return "请求失败";
}

function mapEnvelopeToError(envelope) {
  if (!envelope || typeof envelope !== "object") {
    return { userTitle: "请求失败", traceId: "" };
  }
  return {
    userTitle: envelopeUserTitle(envelope),
    traceId: envelope.trace_id || "",
  };
}

module.exports = {
  mapEnvelopeToError,
  normalizeUserFacingText,
  envelopeUserTitle,
};
