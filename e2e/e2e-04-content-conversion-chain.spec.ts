import { test, expect } from "@playwright/test";
import { E2E_IDS } from "../tests/e2e-seed.js";

/**
 * E2E chain #4 — 内容转化：发帖 → 挂 trade 卡 → GET 帖子 → 买家下单
 * @see docs/designs/autoplan-review-day9-10.md
 */
test.describe("E2E #4 content to order", () => {
  test("发帖 → 卡片 → GET → trade order", async ({ request }) => {
    const postRes = await request.post("/v1/posts", {
      headers: {
        "x-user-id": E2E_IDS.seller,
        "content-type": "application/json",
      },
      data: { image_url: "https://cdn.example.com/e2e-post.jpg", caption: "E2E conversion" },
    });
    expect(postRes.ok()).toBeTruthy();
    const postId = ((await postRes.json()) as { data: { post_id: string } }).data.post_id;

    const cardRes = await request.post(`/v1/posts/${postId}/cards`, {
      headers: {
        "x-user-id": E2E_IDS.seller,
        "content-type": "application/json",
      },
      data: { card_type: "trade_item", target_id: E2E_IDS.itemContent },
    });
    expect(cardRes.ok()).toBeTruthy();

    const getPost = await request.get(`/v1/posts/${postId}`);
    expect(getPost.ok()).toBeTruthy();
    const postDetail = (await getPost.json()) as {
      data: { cards: Array<{ target_id: string }> };
    };
    expect(postDetail.data.cards.some((c) => c.target_id === E2E_IDS.itemContent)).toBe(true);

    const orderRes = await request.post("/v1/trade/orders", {
      headers: {
        "x-user-id": E2E_IDS.buyer,
        "content-type": "application/json",
      },
      data: { item_id: E2E_IDS.itemContent },
    });
    expect(orderRes.ok()).toBeTruthy();
    const ord = (await orderRes.json()) as { data: { status: string } };
    expect(ord.data.status).toBe("PENDING_PAYMENT");
  });
});
