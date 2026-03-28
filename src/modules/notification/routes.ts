import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../shared/api-envelope/index.js";
import { AUTH_REQUIRED_MESSAGE } from "../../shared/auth/auth-messages.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { listNotificationsForUser } from "./service.js";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).max(200).optional(),
});

export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/me/notifications", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
    }
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Invalid query", parsed.error.flatten());
    }
    const limit = parsed.data.limit ?? 20;
    const out = listNotificationsForUser(app.db, request.userId, limit, parsed.data.cursor);
    return reply.send(ok(request.traceId, out));
  });
}
