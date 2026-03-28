import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../shared/api-envelope/index.js";
import { AUTH_REQUIRED_MESSAGE } from "../../shared/auth/auth-messages.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { POST_CAPTION_MAX_LEN, POST_IMAGE_URL_MAX_LEN } from "../../shared/constants.js";
import { addConversionCard, createPost, getPostWithCards } from "./service.js";

const createPostBody = z.object({
  image_url: z.string().min(1).max(POST_IMAGE_URL_MAX_LEN),
  caption: z.string().max(POST_CAPTION_MAX_LEN).optional().nullable(),
});

const addCardBody = z.object({
  card_type: z.literal("trade_item"),
  target_id: z.string().min(1),
});

export async function registerContentRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/posts", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
    }
    const parsed = createPostBody.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Invalid body", parsed.error.flatten());
    }
    const out = createPost(app.db, {
      authorId: request.userId,
      imageUrl: parsed.data.image_url,
      caption: parsed.data.caption,
    });
    return reply.send(ok(request.traceId, out));
  });

  app.post("/v1/posts/:postId/cards", async (request, reply) => {
    if (!request.userId) {
      throw new HttpError(401, ErrorCode.AUTH_UNAUTHORIZED, AUTH_REQUIRED_MESSAGE);
    }
    const { postId } = request.params as { postId: string };
    if (!postId) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Missing post id");
    }
    const parsed = addCardBody.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Invalid body", parsed.error.flatten());
    }
    const out = addConversionCard(app.db, {
      authorId: request.userId,
      postId,
      cardType: parsed.data.card_type,
      targetId: parsed.data.target_id,
    });
    return reply.send(ok(request.traceId, out));
  });

  app.get("/v1/posts/:postId", async (request, reply) => {
    const { postId } = request.params as { postId: string };
    if (!postId) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Missing post id");
    }
    const out = getPostWithCards(app.db, postId);
    return reply.send(ok(request.traceId, out));
  });
}
