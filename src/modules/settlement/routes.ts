import type { FastifyInstance } from "fastify";
import { ok } from "../../shared/api-envelope/index.js";
import { AUTH_REQUIRED_MESSAGE } from "../../shared/auth/auth-messages.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { listLedgerForOrder, triggerSettlement } from "./service.js";

export async function registerSettlementRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/settlement/orders/:orderType/:orderId/ledger", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
    }
    const { orderType, orderId } = request.params as { orderType: string; orderId: string };
    if (orderType !== "trade" && orderType !== "service") {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "orderType must be trade or service");
    }
    const out = listLedgerForOrder(app.db, request.userId, orderType, orderId);
    return reply.send(ok(request.traceId, out));
  });

  app.post("/v1/settlement/orders/:orderType/:orderId/trigger", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
    }
    const { orderType, orderId } = request.params as { orderType: string; orderId: string };
    if (orderType !== "trade" && orderType !== "service") {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "orderType must be trade or service");
    }
    const out = triggerSettlement(app.db, request.userId, orderType, orderId, request.traceId);
    return reply.send(ok(request.traceId, out));
  });
}
