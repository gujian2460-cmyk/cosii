import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../shared/api-envelope/index.js";
import { AUTH_REQUIRED_MESSAGE } from "../../shared/auth/auth-messages.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { getMeProfile, getUnifiedOrderListItemForUser, listUnifiedOrdersForUser } from "./service.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).max(200).optional(),
  order_type: z.enum(["trade", "service"]).optional(),
  status: z.string().min(1).max(64).optional(),
});

export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/me/profile", async (request, reply) => {
    const out = getMeProfile(app.db, request.userId);
    return reply.send(ok(request.traceId, out));
  });

  app.get("/v1/me/unified-orders", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
    }
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Invalid query", parsed.error.flatten());
    }
    const limit = parsed.data.limit ?? 20;
    const out = listUnifiedOrdersForUser(app.db, request.userId, limit, parsed.data.cursor, {
      orderType: parsed.data.order_type,
      status: parsed.data.status,
    });
    return reply.send(ok(request.traceId, out));
  });

  app.get("/v1/me/unified-orders/:unifiedOrderId", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
    }
    const unifiedOrderId = (request.params as { unifiedOrderId: string }).unifiedOrderId;
    const item = getUnifiedOrderListItemForUser(app.db, request.userId, unifiedOrderId);
    return reply.send(ok(request.traceId, item));
  });
}
