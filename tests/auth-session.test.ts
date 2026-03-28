import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { signSessionToken } from "../src/shared/auth/session-token.js";
import { openTestDb, seedUsers } from "./helpers.js";

describe("auth — strict production mode (Bearer only)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COSII_TRUST_DEV_HEADER", "0");
    vi.stubEnv("COSII_SESSION_SECRET", "unit-test-session-secret-32chars!");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects X-User-Id without Bearer", async () => {
    const db = openTestDb();
    const { buyer } = seedUsers(db);
    const app = buildApp(db);
    const res = await app.inject({
      method: "GET",
      url: "/v1/me/unified-orders",
      headers: { "x-user-id": buyer },
    });
    expect(res.statusCode).toBe(401);
  });

  it("accepts valid Bearer token", async () => {
    const db = openTestDb();
    const { buyer } = seedUsers(db);
    const app = buildApp(db);
    const secret = process.env.COSII_SESSION_SECRET!;
    const token = signSessionToken(buyer, secret);
    const res = await app.inject({
      method: "GET",
      url: "/v1/me/unified-orders",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("Bearer wins over X-User-Id when both present", async () => {
    const db = openTestDb();
    const { buyer, seller } = seedUsers(db);
    const app = buildApp(db);
    const secret = process.env.COSII_SESSION_SECRET!;
    const token = signSessionToken(buyer, secret);
    const res = await app.inject({
      method: "GET",
      url: "/v1/me/unified-orders",
      headers: {
        authorization: `Bearer ${token}`,
        "x-user-id": seller,
      },
    });
    expect(res.statusCode).toBe(200);
    const j = res.json() as { data: { items: unknown[] } };
    expect(j.data.items).toEqual([]);
  });
});

describe("auth — WeChat code exchange", () => {
  beforeEach(() => {
    vi.stubEnv("WECHAT_APPID", "wx_test_appid");
    vi.stubEnv("WECHAT_SECRET", "wx_test_secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 503 when WeChat env is missing", async () => {
    vi.unstubAllEnvs();
    const db = openTestDb();
    const app = buildApp(db);
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/wechat-login",
      headers: { "content-type": "application/json" },
      payload: { code: "abc" },
    });
    expect(res.statusCode).toBe(503);
    const j = res.json() as { code: string };
    expect(j.code).toBe("WECHAT_NOT_CONFIGURED");
  });

  it("creates user and returns access_token on successful code2session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ openid: "o_auth_session_test_openid" }),
      }),
    );

    const db = openTestDb();
    const app = buildApp(db);
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/wechat-login",
      headers: { "content-type": "application/json" },
      payload: { code: "081mockcode" },
    });
    expect(res.statusCode).toBe(200);
    const j = res.json() as {
      data: { access_token: string; user_id: string; expires_in: number };
    };
    expect(j.data.access_token.length).toBeGreaterThan(20);
    expect(j.data.expires_in).toBeGreaterThan(0);

    const list = await app.inject({
      method: "GET",
      url: "/v1/me/unified-orders",
      headers: { authorization: `Bearer ${j.data.access_token}` },
    });
    expect(list.statusCode).toBe(200);
  });
});
