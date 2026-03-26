import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../shared/api-envelope/index.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import {
  getLocalVerificationStatus,
  issueLocalVerificationCode,
  redeemLocalVerificationCode,
} from "./local-handoff-service.js";
import { createTradeOrder } from "./service.js";

const bodySchema = z.object({
  item_id: z.string().min(1),
});

const redeemHandoffBody = z.object({
  code: z.string().min(1).max(64),
});

export async function registerTradeRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/trade/orders", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, "Missing X-User-Id");
    }

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Invalid body", parsed.error.flatten());
    }

    const idempotencyKey =
      (request.headers["idempotency-key"] as string | undefined)?.trim() || undefined;

    const bodyForHash = {
      item_id: parsed.data.item_id,
    };

    const result = createTradeOrder(app.db, {
      buyerId: request.userId,
      itemId: parsed.data.item_id,
      idempotencyKey,
      bodyForHash,
    });

    return reply.send(ok(request.traceId, result));
  });

  app.post("/v1/trade/orders/:tradeOrderId/local-handoff/issue", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, "Missing X-User-Id");
    }
    const { tradeOrderId } = request.params as { tradeOrderId: string };
    if (!tradeOrderId) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Missing trade order id");
    }
    const out = issueLocalVerificationCode(app.db, {
      buyerId: request.userId,
      tradeOrderId,
      traceId: request.traceId,
    });
    return reply.send(ok(request.traceId, out));
  });

  app.post("/v1/trade/orders/:tradeOrderId/local-handoff/redeem", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, "Missing X-User-Id");
    }
    const { tradeOrderId } = request.params as { tradeOrderId: string };
    if (!tradeOrderId) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Missing trade order id");
    }
    const parsed = redeemHandoffBody.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Invalid body", parsed.error.flatten());
    }
    const out = redeemLocalVerificationCode(app.db, {
      sellerId: request.userId,
      tradeOrderId,
      code: parsed.data.code,
      traceId: request.traceId,
    });
    return reply.send(ok(request.traceId, out));
  });

  app.get("/v1/trade/orders/:tradeOrderId/local-handoff", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, "Missing X-User-Id");
    }
    const { tradeOrderId } = request.params as { tradeOrderId: string };
    if (!tradeOrderId) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Missing trade order id");
    }
    const out = getLocalVerificationStatus(app.db, request.userId, tradeOrderId);
    return reply.send(ok(request.traceId, out));
  });
}
