import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:", { enableForeignKeyConstraints: true });
  const schemaPath = join(process.cwd(), "db", "schema.sql");
  db.exec(readFileSync(schemaPath, "utf8"));
  return db;
}

export function seedUsers(db: DatabaseSync): { buyer: string; seller: string; artist: string } {
  const now = Date.now();
  const buyer = "usr_buyer_1";
  const seller = "usr_seller_1";
  const artist = "usr_artist_1";
  db.prepare(
    `INSERT INTO users (id, wx_openid, role, status, created_at) VALUES (?, ?, 'buyer', 'active', ?)`,
  ).run(buyer, `wx_${buyer}`, now);
  db.prepare(
    `INSERT INTO users (id, wx_openid, role, status, created_at) VALUES (?, ?, 'seller', 'active', ?)`,
  ).run(seller, `wx_${seller}`, now);
  db.prepare(
    `INSERT INTO users (id, wx_openid, role, status, created_at) VALUES (?, ?, 'seller', 'active', ?)`,
  ).run(artist, `wx_${artist}`, now);
  return { buyer, seller, artist };
}

export function seedTradeItem(db: DatabaseSync, sellerId: string): string {
  const id = "item_1";
  db.prepare(
    `INSERT INTO trade_items (id, seller_id, title, category, price, status, created_at)
     VALUES (?, ?, 'Wig', 'wig', 19900, 'LISTED', ?)`,
  ).run(id, sellerId, Date.now());
  return id;
}

export function seedTradeItemWithId(db: DatabaseSync, sellerId: string, itemId: string): string {
  db.prepare(
    `INSERT INTO trade_items (id, seller_id, title, category, price, status, created_at)
     VALUES (?, ?, 'Wig', 'wig', 19900, 'LISTED', ?)`,
  ).run(itemId, sellerId, Date.now());
  return itemId;
}

export function seedSlot(db: DatabaseSync, artistId: string): string {
  const id = "slot_1";
  const start = Date.now();
  const end = start + 3600_000;
  db.prepare(
    `INSERT INTO artist_slots (id, artist_id, slot_start, slot_end, slot_status, created_at)
     VALUES (?, ?, ?, ?, 'AVAILABLE', ?)`,
  ).run(id, artistId, start, end, Date.now());
  return id;
}

/** Second buyer for concurrent / overlap booking scenarios (CRITICAL matrix T12 / T15). */
export function seedExtraBuyer(db: DatabaseSync, id = "usr_buyer_2"): string {
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (id, wx_openid, role, status, created_at) VALUES (?, ?, 'buyer', 'active', ?)`,
  ).run(id, `wx_${id}`, now);
  return id;
}

/** Two AVAILABLE slots for the same artist with overlapping time ranges. */
export function seedOverlappingSlots(
  db: DatabaseSync,
  artistId: string,
): { slotEarly: string; slotLate: string } {
  const slotEarly = "slot_overlap_early";
  const slotLate = "slot_overlap_late";
  const base = Date.now() + 8 * 24 * 3600_000;
  const now = Date.now();
  db.prepare(
    `INSERT INTO artist_slots (id, artist_id, slot_start, slot_end, slot_status, created_at)
     VALUES (?, ?, ?, ?, 'AVAILABLE', ?)`,
  ).run(slotEarly, artistId, base, base + 7200_000, now);
  db.prepare(
    `INSERT INTO artist_slots (id, artist_id, slot_start, slot_end, slot_status, created_at)
     VALUES (?, ?, ?, ?, 'AVAILABLE', ?)`,
  ).run(slotLate, artistId, base + 3600_000, base + 10800_000, now);
  return { slotEarly, slotLate };
}
