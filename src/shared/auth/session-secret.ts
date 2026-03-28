import { trustDevHeader } from "./trust-dev-header.js";

const DEV_FALLBACK = "cosii-dev-session-secret-min-16ch";

/**
 * Required when issuing/verifying Bearer tokens. In relaxed dev mode, falls back
 * to a fixed test secret if unset. In strict mode (production auth), must be set
 * and long enough.
 */
export function getSessionSecret(): string {
  const s = process.env.COSII_SESSION_SECRET?.trim();
  if (s && s.length >= 16) {
    return s;
  }
  if (trustDevHeader()) {
    return s && s.length > 0 ? s : DEV_FALLBACK;
  }
  throw new Error("COSII_SESSION_SECRET must be set (min 16 chars) when dev header trust is off");
}

/** Call at startup when strict auth is enabled so misconfiguration fails fast. */
export function assertSessionSecretIfStrictAuth(): void {
  if (!trustDevHeader()) {
    getSessionSecret();
  }
}
