const REQUIRED_IN_PROD = [
  "DB_PATH",
  "WECHAT_APPID",
  "WECHAT_SECRET",
  "COSII_SESSION_SECRET",
] as const;

/**
 * Fail fast for production misconfiguration.
 * Keeping checks centralized avoids "works in dev, fails after release" incidents.
 */
export function assertProductionRuntimeConfig(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const missing = REQUIRED_IN_PROD.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required production env vars: ${missing.join(", ")}`);
  }

  if (process.env.COSII_TRUST_DEV_HEADER !== "0") {
    throw new Error("COSII_TRUST_DEV_HEADER must be 0 in production");
  }
}

