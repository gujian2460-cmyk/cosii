import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../shared/api-envelope/index.js";
import { AUTH_REQUIRED_MESSAGE } from "../../shared/auth/auth-messages.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import {
  getLocalVerificationStatus,
  issueLocalVerificationCode,
  redeemLocalVerificationCode,
} from "./local-handoff-service.js";
import { getTradeOrderDetail } from "./detail.js";
import { createTradeItem, createTradeOrder, getTradeItemPublic, listTradeItems } from "./service.js";

const bodySchema = z.object({
  item_id: z.string().min(1),
});

const redeemHandoffBody = z.object({
  code: z.string().min(1).max(64),
});

const listItemsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(64).optional(),
  price_min: z.coerce.number().int().nonnegative().optional(),
  price_max: z.coerce.number().int().nonnegative().optional(),
});

const createItemBody = z.object({
  title: z.string().min(1).max(200),
  category: z.enum(["wig", "props", "costume"]),
  price_cents: z.coerce.number().int().min(1).max(50_000_000),
});

export async function registerTradeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/trade/items", async (request, reply) => {
    const parsed = listItemsQuery.safeParse(request.query);
    if (!parsed.success) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Invalid query", parsed.error.flatten());
    }
    const data = parsed.data;
    const out = listTradeItems(app.db, {
      limit: data.limit ?? 20,
      cursor: data.cursor,
      category: data.category,
      priceMin: data.price_min,
      priceMax: data.price_max,
    });
    return reply.send(ok(request.traceId, out));
  });

  app.get("/v1/trade/items/:itemId", async (request, reply) => {
    const itemId = (request.params as { itemId: string }).itemId;
    const detail = getTradeItemPublic(app.db, itemId);
    if (!detail) {
      throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Item not found");
    }
    return reply.send(ok(request.traceId, detail));
  });

  app.post("/v1/trade/items", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
    }
    const parsed = createItemBody.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Invalid body", parsed.error.flatten());
    }
    const result = createTradeItem(app.db, {
      sellerId: request.userId,
      title: parsed.data.title,
      category: parsed.data.category,
      priceCents: parsed.data.price_cents,
    });
    return reply.send(ok(request.traceId, result));
  });

  app.post("/v1/trade/orders", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
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

  app.get("/v1/trade/orders/:tradeOrderId", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
    }
    const tradeOrderId = (request.params as { tradeOrderId: string }).tradeOrderId;
    const detail = getTradeOrderDetail(app.db, request.userId, tradeOrderId);
    return reply.send(ok(request.traceId, detail));
  });

  app.post("/v1/trade/orders/:tradeOrderId/local-handoff/issue", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
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
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
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
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
    }
    const { tradeOrderId } = request.params as { tradeOrderId: string };
    if (!tradeOrderId) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Missing trade order id");
    }
    const out = getLocalVerificationStatus(app.db, request.userId, tradeOrderId);
    return reply.send(ok(request.traceId, out));
  });
}
