import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(filePath: string): DatabaseSync {
  const db = new DatabaseSync(filePath, { enableForeignKeyConstraints: true });
  db.exec("PRAGMA journal_mode = WAL;");
  const schemaPath = join(process.cwd(), "db", "schema.sql");
  db.exec(readFileSync(schemaPath, "utf8"));
  return db;
}
