import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { insertUserNotification, listNotificationsForUser } from "../src/modules/notification/service.js";
import { openTestDb, seedUsers } from "./helpers.js";

describe("GET /v1/me/notifications", () => {
  it("returns 401 without X-User-Id", async () => {
    const db = openTestDb();
    seedUsers(db);
    const app = buildApp(db);
    const res = await app.inject({ method: "GET", url: "/v1/me/notifications" });
    expect(res.statusCode).toBe(401);
  });

  it("lists newest first with deep-link fields", async () => {
    const db = openTestDb();
    const { buyer } = seedUsers(db);
    const t1 = Date.now() - 10_000;
    const t2 = Date.now() - 5000;
    db.prepare(
      `INSERT INTO user_notifications (id, user_id, event_type, title, subtitle, unified_order_id, order_type, domain_order_id, created_at)
       VALUES ('n1', ?, 'a', 'T1', 'S1', NULL, NULL, NULL, ?)`,
    ).run(buyer, t1);
    db.prepare(
      `INSERT INTO user_notifications (id, user_id, event_type, title, subtitle, unified_order_id, order_type, domain_order_id, created_at)
       VALUES ('n2', ?, 'b', 'T2', 'S2', NULL, NULL, NULL, ?)`,
    ).run(buyer, t2);
    const app = buildApp(db);
    const res = await app.inject({
      method: "GET",
      url: "/v1/me/notifications?limit=10",
      headers: { "x-user-id": buyer },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.items).toHaveLength(2);
    expect(body.data.items[0].notification_id).toBe("n2");
    expect(body.data.items[0].title).toBe("T2");
    expect(body.data.items[0].event_type).toBe("b");
    expect(body.data.items[1].notification_id).toBe("n1");
  });

  it("isolates users", async () => {
    const db = openTestDb();
    const { buyer, seller } = seedUsers(db);
    insertUserNotification(db, { userId: buyer, eventType: "x", title: "buyer only" });
    const app = buildApp(db);
    const r = await app.inject({
      method: "GET",
      url: "/v1/me/notifications",
      headers: { "x-user-id": seller },
    });
    expect(r.json().data.items).toHaveLength(0);
  });

  it("cursor pagination", () => {
    const db = openTestDb();
    const { buyer } = seedUsers(db);
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      db.prepare(
        `INSERT INTO user_notifications (id, user_id, event_type, title, subtitle, unified_order_id, order_type, domain_order_id, created_at)
         VALUES (?, ?, 'e', ?, NULL, NULL, NULL, NULL, ?)`,
      ).run(`nid${i}`, buyer, `title${i}`, base - i * 1000);
    }
    const p1 = listNotificationsForUser(db, buyer, 2, undefined);
    expect(p1.items).toHaveLength(2);
    expect(p1.next_cursor).toBeTruthy();
    const p2 = listNotificationsForUser(db, buyer, 2, p1.next_cursor ?? undefined);
    expect(p2.items).toHaveLength(2);
    expect(p2.items[0].title).not.toBe(p1.items[0].title);
  });
});
