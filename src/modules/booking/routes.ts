import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../shared/api-envelope/index.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { getServiceOrderDetail } from "./detail.js";
import { createBookingOrder } from "./service.js";

const bodySchema = z.object({
  slot_id: z.string().min(1),
  deposit_amount: z.number().int().nonnegative(),
  final_amount: z.number().int().nonnegative(),
});

export async function registerBookingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/booking/orders/:id", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, "Missing X-User-Id");
    }
    const id = (request.params as { id: string }).id;
    const detail = getServiceOrderDetail(app.db, request.userId, id);
    return reply.send(ok(request.traceId, detail));
  });

  app.post("/v1/booking/orders", async (request, reply) => {
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
      slot_id: parsed.data.slot_id,
      deposit_amount: parsed.data.deposit_amount,
      final_amount: parsed.data.final_amount,
    };

    const result = createBookingOrder(app.db, {
      buyerId: request.userId,
      slotId: parsed.data.slot_id,
      depositAmount: parsed.data.deposit_amount,
      finalAmount: parsed.data.final_amount,
      idempotencyKey,
      bodyForHash,
    });

    return reply.send(ok(request.traceId, result));
  });
}
