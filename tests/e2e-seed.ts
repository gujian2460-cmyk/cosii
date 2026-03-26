import type { DatabaseSync } from "node:sqlite";
import { seedSlot, seedTradeItemWithId, seedUsers } from "./helpers.js";

/** Stable IDs shared by Playwright E2E and `scripts/e2e-server.ts`. Each chain uses its own trade item so one DB can run all four specs serially. */
export const E2E_IDS = {
  buyer: "usr_buyer_1",
  seller: "usr_seller_1",
  artist: "usr_artist_1",
  slot: "slot_1",
  itemTrade: "e2e_item_trade",
  itemDispute: "e2e_item_dispute",
  itemContent: "e2e_item_content",
} as const;

export function seedE2EDatabase(db: DatabaseSync): void {
  const { seller, artist } = seedUsers(db);
  seedTradeItemWithId(db, seller, E2E_IDS.itemTrade);
  seedTradeItemWithId(db, seller, E2E_IDS.itemDispute);
  seedTradeItemWithId(db, seller, E2E_IDS.itemContent);
  seedSlot(db, artist);
}
