import type { ErrorCodeValue } from "./codes.js";
import { ErrorCode } from "./codes.js";

export type ErrorUx = {
  userTitle: string;
  primaryAction: string;
  retryPolicy: string;
};

/**
 * Maps error codes to user-facing copy (mini-program / API clients).
 */
export const errorUxMap: Partial<Record<ErrorCodeValue, ErrorUx>> = {
  [ErrorCode.AUTH_UNAUTHORIZED]: {
    userTitle: "需要登录后继续",
    primaryAction: "前往登录",
    retryPolicy: "登录后重试",
  },
  [ErrorCode.VALIDATION_ERROR]: {
    userTitle: "信息填写不完整",
    primaryAction: "返回修改",
    retryPolicy: "修正后重试",
  },
  [ErrorCode.RESOURCE_NOT_FOUND]: {
    userTitle: "内容不存在或已下架",
    primaryAction: "返回上一页",
    retryPolicy: "刷新或更换条目",
  },
  [ErrorCode.BOOKING_SLOT_CONFLICT]: {
    userTitle: "该时段已被占用",
    primaryAction: "重新选择时段",
    retryPolicy: "立即重新选择",
  },
  [ErrorCode.ITEM_UNAVAILABLE]: {
    userTitle: "商品暂不可下单",
    primaryAction: "浏览其他商品",
    retryPolicy: "刷新列表",
  },
  [ErrorCode.BUSINESS_RULE_VIOLATION]: {
    userTitle: "当前操作不被允许",
    primaryAction: "查看说明",
    retryPolicy: "按提示调整后重试",
  },
  [ErrorCode.IDEMPOTENCY_CONFLICT]: {
    userTitle: "重复请求内容不一致",
    primaryAction: "刷新订单状态",
    retryPolicy: "不要修改参数后复用同一幂等键",
  },
  [ErrorCode.PAYMENT_TIMEOUT]: {
    userTitle: "支付结果确认超时",
    primaryAction: "查看订单状态",
    retryPolicy: "自动同步最多 3 次",
  },
  [ErrorCode.PAYMENT_WEBHOOK_DUPLICATE]: {
    userTitle: "支付结果已同步",
    primaryAction: "返回订单详情",
    retryPolicy: "无需重试",
  },
  [ErrorCode.DISPUTE_INVALID_STATE]: {
    userTitle: "当前状态无法发起该操作",
    primaryAction: "查看争议流程说明",
    retryPolicy: "不重试，按引导操作",
  },
  [ErrorCode.SETTLEMENT_RETRY_EXHAUSTED]: {
    userTitle: "结算处理中，请稍后查看",
    primaryAction: "打开订单结算明细",
    retryPolicy: "后台重试 + 客服兜底",
  },
  [ErrorCode.CONTENT_CARD_TARGET_INVALID]: {
    userTitle: "关联内容已失效",
    primaryAction: "浏览其他可购内容",
    retryPolicy: "无需重试",
  },
  [ErrorCode.LOCAL_VERIFICATION_EXPIRED]: {
    userTitle: "核销码已过期",
    primaryAction: "联系买家重新生成",
    retryPolicy: "买家重新发起核销码后重试",
  },
  [ErrorCode.LOCAL_VERIFICATION_INVALID]: {
    userTitle: "核销码不正确",
    primaryAction: "核对后重试",
    retryPolicy: "确认码与订单匹配",
  },
  [ErrorCode.LOCAL_VERIFICATION_LOCKED]: {
    userTitle: "尝试次数过多，核销已锁定",
    primaryAction: "返回订单详情",
    retryPolicy: "联系客服或买家重新发起",
  },
  [ErrorCode.INTERNAL_ERROR]: {
    userTitle: "服务暂时不可用",
    primaryAction: "稍后重试",
    retryPolicy: "指数退避重试",
  },
};

export function getErrorUx(code: ErrorCodeValue): ErrorUx | undefined {
  return errorUxMap[code];
}
