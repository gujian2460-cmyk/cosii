import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../shared/api-envelope/index.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { loginWithWeChatJsCode } from "./service.js";

const wechatLoginBody = z.object({
  code: z.string().min(1),
});

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/auth/wechat-login", async (request, reply) => {
    const parsed = wechatLoginBody.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Invalid body", parsed.error.flatten());
    }
    const out = await loginWithWeChatJsCode(app.db, parsed.data.code);
    return reply.send(ok(request.traceId, out));
  });
}
