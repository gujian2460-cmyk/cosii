import { DatabaseSync } from "node:sqlite";
export declare function openTestDb(): DatabaseSync;
export declare function seedUsers(db: DatabaseSync): {
    buyer: string;
    seller: string;
    artist: string;
};
export declare function seedTradeItem(db: DatabaseSync, sellerId: string): string;
export declare function seedSlot(db: DatabaseSync, artistId: string): string;
//# sourceMappingURL=helpers.d.ts.map