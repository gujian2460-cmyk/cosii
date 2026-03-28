import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../shared/api-envelope/index.js";
import { AUTH_REQUIRED_MESSAGE } from "../../shared/auth/auth-messages.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { addDisputeEvidence, createDispute, getDisputeDetail } from "./service.js";

const createBody = z.object({
  unified_order_id: z.string().min(1),
  reason: z.string().optional(),
});

const evidenceBody = z.object({
  evidence_type: z.string().min(1),
  evidence_url: z.string().min(1),
});

export async function registerDisputeRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/disputes", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
    }
    const parsed = createBody.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Invalid body", parsed.error.flatten());
    }

    const out = createDispute(app.db, request.userId, parsed.data.unified_order_id, parsed.data.reason);
    return reply.send(ok(request.traceId, out));
  });

  app.post("/v1/disputes/:id/evidences", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
    }
    const id = (request.params as { id: string }).id;
    const parsed = evidenceBody.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Invalid body", parsed.error.flatten());
    }

    const out = addDisputeEvidence(
      app.db,
      request.userId,
      id,
      parsed.data.evidence_type,
      parsed.data.evidence_url,
    );
    return reply.send(ok(request.traceId, out));
  });

  app.get("/v1/disputes/:id", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
    }
    const id = (request.params as { id: string }).id;
    const detail = getDisputeDetail(app.db, request.userId, id);
    return reply.send(ok(request.traceId, detail));
  });
}
