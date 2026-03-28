import Fastify from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  assertSessionSecretIfStrictAuth,
  getSessionSecret,
} from "./shared/auth/session-secret.js";
import { trustDevHeader } from "./shared/auth/trust-dev-header.js";
import { verifySessionToken } from "./shared/auth/session-token.js";
import { fail, ok } from "./shared/api-envelope/index.js";
import { ErrorCode } from "./shared/errors/codes.js";
import { HttpError, isHttpError, toPublicMessage } from "./shared/errors/http-error.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerContentRoutes } from "./modules/content/routes.js";
import { registerMeRoutes } from "./modules/me/routes.js";
import { registerBookingRoutes } from "./modules/booking/routes.js";
import { registerDisputeRoutes } from "./modules/dispute/routes.js";
import { registerPaymentRoutes } from "./modules/payment/routes.js";
import { registerSettlementRoutes } from "./modules/settlement/routes.js";
import { registerTradeRoutes } from "./modules/trade/routes.js";
import { registerNotificationRoutes } from "./modules/notification/routes.js";

export function buildApp(db: DatabaseSync) {
  assertSessionSecretIfStrictAuth();

  const app = Fastify({ logger: false });

  app.decorate("db", db);

  app.addHook("onRequest", async (request) => {
    request.traceId = (request.headers["x-trace-id"] as string | undefined)?.trim() || randomUUID();
    let userId: string | null = null;
    const authz = (request.headers.authorization as string | undefined)?.trim();
    if (authz?.toLowerCase().startsWith("bearer ")) {
      const raw = authz.slice(7).trim();
      if (raw.length > 0) {
        try {
          const secret = getSessionSecret();
          userId = verifySessionToken(raw, secret);
        } catch {
          userId = null;
        }
      }
    }
    if (!userId && trustDevHeader()) {
      const uid = (request.headers["x-user-id"] as string | undefined)?.trim();
      userId = uid && uid.length > 0 ? uid : null;
    }
    request.userId = userId;
  });

  if (process.env.STRUCTURED_ACCESS_LOG === "1") {
    app.addHook("onResponse", async (request, reply) => {
      process.stdout.write(
        `${JSON.stringify({
          msg: "access",
          trace_id: request.traceId,
          method: request.method,
          path: request.url,
          status_code: reply.statusCode,
          at: Date.now(),
        })}\n`,
      );
    });
  }

  app.get("/health", async (request, reply) => {
    return reply.send(ok(request.traceId, { ok: true }));
  });

  app.get("/v1/ready", async (request, reply) => {
    try {
      db.prepare("SELECT 1 AS ok").get();
      return reply.send(ok(request.traceId, { ready: true }));
    } catch {
      return reply
        .status(503)
        .send(fail(request.traceId, ErrorCode.INTERNAL_ERROR, "Database not ready"));
    }
  });

  app.register(registerAuthRoutes);
  app.register(registerTradeRoutes);
  app.register(registerContentRoutes);
  app.register(registerMeRoutes);
  app.register(registerNotificationRoutes);
  app.register(registerBookingRoutes);
  app.register(registerPaymentRoutes);
  app.register(registerDisputeRoutes);
  app.register(registerSettlementRoutes);

  app.setErrorHandler((err, request, reply) => {
    const trace = request.traceId;
    if (isHttpError(err)) {
      return reply.status(err.status).send(
        fail(trace, err.code, err.message, err.details),
      );
    }
    const message = toPublicMessage(ErrorCode.INTERNAL_ERROR, "Internal error");
    return reply.status(500).send(fail(trace, ErrorCode.INTERNAL_ERROR, message));
  });

  return app;
}
