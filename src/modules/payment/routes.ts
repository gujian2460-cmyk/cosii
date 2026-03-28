import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../shared/api-envelope/index.js";
import { AUTH_REQUIRED_MESSAGE } from "../../shared/auth/auth-messages.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { createPayment, getPaymentStatusForUnified, processWechatWebhook } from "./service.js";

const createBody = z.object({
  unified_order_id: z.string().min(1),
});

const webhookBody = z.object({
  out_trade_no: z.string().min(1),
  transaction_id: z.string().min(1),
  amount_cents: z.number().int().positive(),
  trade_state: z.string().optional(),
});

export async function registerPaymentRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/payments/create", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
    }
    const parsed = createBody.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Invalid body", parsed.error.flatten());
    }

    const result = createPayment(app.db, {
      userId: request.userId,
      unifiedOrderId: parsed.data.unified_order_id,
    });
    return reply.send(ok(request.traceId, result));
  });

  app.post("/v1/payments/webhook/wechat", async (request, reply) => {
    const parsed = webhookBody.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Invalid webhook body", parsed.error.flatten());
    }

    const out = processWechatWebhook(app.db, parsed.data, request.traceId);
    return reply.send(
      ok(request.traceId, {
        processed: !out.duplicate,
        duplicate: out.duplicate,
        unified_order_id: out.unified_order_id,
      }),
    );
  });

  app.get("/v1/payments/unified/:unifiedOrderId/status", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
    }
    const unifiedOrderId = (request.params as { unifiedOrderId: string }).unifiedOrderId;
    const status = getPaymentStatusForUnified(app.db, request.userId, unifiedOrderId);
    return reply.send(ok(request.traceId, status));
  });
}
