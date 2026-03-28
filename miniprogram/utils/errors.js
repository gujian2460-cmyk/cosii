/**
 * 将 envelope 转为页内状态条展示（与 api-envelope / ux-map 一致）
 */

function mapEnvelopeToError(envelope) {
  if (!envelope || typeof envelope !== "object") {
    return { userTitle: "请求失败", traceId: "" };
  }
  var title =
    (envelope.error && envelope.error.user_title) ||
    envelope.message ||
    "请求失败";
  return {
    userTitle: title,
    traceId: envelope.trace_id || "",
  };
}

module.exports = { mapEnvelopeToError };
