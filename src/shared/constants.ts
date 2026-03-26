/** 档期占位 TTL（毫秒），对齐 DESIGN.md Day3–4 */
export const SLOT_HOLD_TTL_MS = 120_000;

/** 争议 SLA：从发起日起算（毫秒） */
export const DISPUTE_SLA_MS = 7 * 24 * 60 * 60 * 1000;

/** 结算任务最大重试次数（之后返回 SETTLEMENT_RETRY_EXHAUSTED） */
export const MAX_SETTLEMENT_RETRIES = 3;

/** 同城核销码 TTL（毫秒），对齐 autoplan-review-day7-8 */
export const LOCAL_VERIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 同城核销连续输错上限（防撞库） */
export const LOCAL_VERIFICATION_MAX_ATTEMPTS = 8;

/** 作品配文最大长度 */
export const POST_CAPTION_MAX_LEN = 2000;

/** 图片 URL 最大长度 */
export const POST_IMAGE_URL_MAX_LEN = 2048;
