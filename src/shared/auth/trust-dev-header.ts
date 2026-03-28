/**
 * When true, `X-User-Id` may set request.userId (local dev, Vitest, E2E).
 * When false (typical production), only `Authorization: Bearer <token>` from
 * `POST /v1/auth/wechat-login` is trusted for identity.
 */
export function trustDevHeader(): boolean {
  if (process.env.COSII_TRUST_DEV_HEADER === "0") {
    return false;
  }
  if (process.env.COSII_TRUST_DEV_HEADER === "1") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}
