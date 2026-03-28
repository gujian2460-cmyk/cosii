import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { signSessionToken } from "../../shared/auth/session-token.js";
import { getSessionSecret } from "../../shared/auth/session-secret.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { wechatCode2Session } from "./wechat-code2session.js";

export function ensureUserForWxOpenId(db: DatabaseSync, openid: string): string {
  const row = db.prepare(`SELECT id FROM users WHERE wx_openid = ?`).get(openid) as
    | { id: string }
    | undefined;
  if (row) {
    return row.id;
  }
  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (id, wx_openid, role, status, created_at) VALUES (?, ?, 'buyer', 'active', ?)`,
  ).run(id, openid, now);
  return id;
}

export type WeChatLoginResult = {
  access_token: string;
  expires_in: number;
  user_id: string;
};

const TTL_SEC = 7 * 24 * 60 * 60;

export async function loginWithWeChatJsCode(db: DatabaseSync, jsCode: string): Promise<WeChatLoginResult> {
  const appId = process.env.WECHAT_APPID?.trim();
  const secret = process.env.WECHAT_SECRET?.trim();
  if (!appId || !secret) {
    throw new HttpError(
      503,
      ErrorCode.WECHAT_NOT_CONFIGURED,
      "WeChat mini-program login is not configured (WECHAT_APPID / WECHAT_SECRET)",
    );
  }
  const { openid } = await wechatCode2Session(appId, secret, jsCode);
  const userId = ensureUserForWxOpenId(db, openid);
  const sessionSecret = getSessionSecret();
  const access_token = signSessionToken(userId, sessionSecret, TTL_SEC);
  return { access_token, expires_in: TTL_SEC, user_id: userId };
}
