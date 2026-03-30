import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { openDatabase } from "./db/open.js";
import { assertProductionRuntimeConfig } from "./shared/config/production-checks.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

assertProductionRuntimeConfig();

const dataDir = process.env.DATA_DIR ?? `${process.cwd()}/data`;
const dbPath = process.env.DB_PATH ?? `${dataDir}/app.db`;

mkdirSync(dirname(dbPath), { recursive: true });

const db = openDatabase(dbPath);
const app = buildApp(db);

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen({ port, host });
// eslint-disable-next-line no-console
console.log(`listening on http://${host}:${port}`);
