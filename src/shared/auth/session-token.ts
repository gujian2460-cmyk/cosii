import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionPayload = { sub: string; exp: number };

const DEFAULT_TTL_SEC = 7 * 24 * 60 * 60;

export function signSessionToken(
  userId: string,
  secret: string,
  ttlSec: number = DEFAULT_TTL_SEC,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp } satisfies SessionPayload), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string, secret: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) {
    return null;
  }
  const expectedSig = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  let parsed: SessionPayload;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
  if (typeof parsed.sub !== "string" || parsed.sub.length === 0 || typeof parsed.exp !== "number") {
    return null;
  }
  if (parsed.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }
  return parsed.sub;
}
