import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";

export type WeChatCode2SessionOk = { openid: string; unionid?: string };

type WeChatErrorJson = { errcode?: number; errmsg?: string; openid?: string; unionid?: string };

export async function wechatCode2Session(
  appId: string,
  secret: string,
  jsCode: string,
): Promise<WeChatCode2SessionOk> {
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", secret);
  url.searchParams.set("js_code", jsCode);
  url.searchParams.set("grant_type", "authorization_code");

  const res = await fetch(url);
  if (!res.ok) {
    throw new HttpError(502, ErrorCode.WECHAT_AUTH_FAILED, "WeChat code2session HTTP error");
  }
  const data = (await res.json()) as WeChatErrorJson;
  if (data.errcode && data.errcode !== 0) {
    const msg = data.errmsg ?? `errcode ${data.errcode}`;
    const status = data.errcode === 40029 || data.errcode === 40163 ? 400 : 502;
    throw new HttpError(status, ErrorCode.WECHAT_AUTH_FAILED, msg, { errcode: data.errcode });
  }
  if (!data.openid || typeof data.openid !== "string") {
    throw new HttpError(502, ErrorCode.WECHAT_AUTH_FAILED, "WeChat response missing openid");
  }
  return { openid: data.openid, unionid: typeof data.unionid === "string" ? data.unionid : undefined };
}
