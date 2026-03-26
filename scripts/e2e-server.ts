/**
 * Ephemeral SQLite + seed, then listen. Playwright webServer sets DB_PATH / PORT / HOST.
 */
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { buildApp } from "../src/app.js";
import { openDatabase } from "../src/db/open.js";
import { seedE2EDatabase } from "../tests/e2e-seed.js";

const dbPath = process.env.DB_PATH;
if (!dbPath || dbPath.trim() === "") {
  throw new Error("DB_PATH is required for e2e-server");
}

mkdirSync(dirname(dbPath), { recursive: true });
if (existsSync(dbPath)) {
  unlinkSync(dbPath);
}

const db = openDatabase(dbPath);
seedE2EDatabase(db);

const app = buildApp(db);
const port = Number(process.env.PORT ?? 3456);
const host = process.env.HOST ?? "127.0.0.1";

await app.listen({ port, host });
// eslint-disable-next-line no-console
console.log(`e2e server http://${host}:${port}`);
