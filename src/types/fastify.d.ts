import type { DatabaseSync } from "node:sqlite";

declare module "fastify" {
  interface FastifyRequest {
    traceId: string;
    userId: string | null;
  }

  interface FastifyInstance {
    db: DatabaseSync;
  }
}
