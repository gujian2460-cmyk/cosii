import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { POST_CAPTION_MAX_LEN, POST_IMAGE_URL_MAX_LEN } from "../../shared/constants.js";
import { ErrorCode } from "../../shared/errors/codes.js";
import { HttpError } from "../../shared/errors/http-error.js";

export type CreatePostInput = {
  authorId: string;
  imageUrl: string;
  caption?: string | null;
};

export type CreatePostResult = { post_id: string; created_at: number };

export function createPost(db: DatabaseSync, input: CreatePostInput): CreatePostResult {
  const imageUrl = input.imageUrl.trim();
  if (!imageUrl) {
    throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "image_url is required");
  }
  if (imageUrl.length > POST_IMAGE_URL_MAX_LEN) {
    throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "image_url too long");
  }
  const caption = input.caption?.trim() ?? "";
  if (caption.length > POST_CAPTION_MAX_LEN) {
    throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "caption too long");
  }

  const now = Date.now();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO posts (id, author_id, image_url, caption, status, created_at)
     VALUES (?, ?, ?, ?, 'published', ?)`,
  ).run(id, input.authorId, imageUrl, caption || null, now);

  return { post_id: id, created_at: now };
}

export type AddCardInput = {
  authorId: string;
  postId: string;
  cardType: "trade_item";
  targetId: string;
};

export type AddCardResult = { card_id: string; target_status: string };

export function addConversionCard(db: DatabaseSync, input: AddCardInput): AddCardResult {
  const post = db.prepare(`SELECT id, author_id FROM posts WHERE id = ?`).get(input.postId) as
    | { id: string; author_id: string }
    | undefined;
  if (!post) {
    throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Post not found");
  }
  if (post.author_id !== input.authorId) {
    throw new HttpError(403, ErrorCode.BUSINESS_RULE_VIOLATION, "Not the post author");
  }

  if (input.cardType !== "trade_item") {
    throw new HttpError(400, ErrorCode.VALIDATION_ERROR, "Unsupported card_type");
  }

  const item = db
    .prepare(`SELECT id, seller_id, status FROM trade_items WHERE id = ?`)
    .get(input.targetId) as { id: string; seller_id: string; status: string } | undefined;

  if (!item || item.seller_id !== input.authorId) {
    throw new HttpError(400, ErrorCode.CONTENT_CARD_TARGET_INVALID, "Target item not found or not yours");
  }
  if (item.status !== "LISTED") {
    throw new HttpError(400, ErrorCode.CONTENT_CARD_TARGET_INVALID, "Target item is not listed");
  }

  const cardId = randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO post_conversion_cards (id, post_id, card_type, target_id, target_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(cardId, input.postId, input.cardType, item.id, item.status, now);

  return { card_id: cardId, target_status: item.status };
}

export type PostCardView = {
  id: string;
  card_type: string;
  target_id: string;
  target_status_at_create: string;
  available: boolean;
  unavailable_reason: string | null;
};

export type GetPostResult = {
  post_id: string;
  author_id: string;
  image_url: string;
  caption: string | null;
  status: string;
  created_at: number;
  cards: PostCardView[];
};

export function getPostWithCards(db: DatabaseSync, postId: string): GetPostResult {
  const post = db
    .prepare(`SELECT id, author_id, image_url, caption, status, created_at FROM posts WHERE id = ?`)
    .get(postId) as
    | { id: string; author_id: string; image_url: string; caption: string | null; status: string; created_at: number }
    | undefined;

  if (!post || post.status !== "published") {
    throw new HttpError(404, ErrorCode.RESOURCE_NOT_FOUND, "Post not found");
  }

  const cards = db
    .prepare(
      `SELECT id, card_type, target_id, target_status FROM post_conversion_cards WHERE post_id = ? ORDER BY created_at ASC`,
    )
    .all(post.id) as Array<{ id: string; card_type: string; target_id: string; target_status: string }>;

  const views: PostCardView[] = cards.map((c) => {
    if (c.card_type === "trade_item") {
      const item = db
        .prepare(`SELECT status FROM trade_items WHERE id = ?`)
        .get(c.target_id) as { status: string } | undefined;
      if (!item) {
        return {
          id: c.id,
          card_type: c.card_type,
          target_id: c.target_id,
          target_status_at_create: c.target_status,
          available: false,
          unavailable_reason: "item_removed",
        };
      }
      const available = item.status === "LISTED";
      return {
        id: c.id,
        card_type: c.card_type,
        target_id: c.target_id,
        target_status_at_create: c.target_status,
        available,
        unavailable_reason: available ? null : "item_not_listed",
      };
    }
    return {
      id: c.id,
      card_type: c.card_type,
      target_id: c.target_id,
      target_status_at_create: c.target_status,
      available: false,
      unavailable_reason: "unsupported_card",
    };
  });

  return {
    post_id: post.id,
    author_id: post.author_id,
    image_url: post.image_url,
    caption: post.caption,
    status: post.status,
    created_at: post.created_at,
    cards: views,
  };
}
