import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { defineConfig } from "@playwright/test";

const dbPath = join(tmpdir(), `cosii-e2e-${process.pid}.db`);
if (existsSync(dbPath)) {
  try {
    unlinkSync(dbPath);
  } catch {
    /* ignore */
  }
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:3456",
  },
  webServer: {
    command: "npx tsx scripts/e2e-server.ts",
    url: "http://127.0.0.1:3456/health",
    // Always start a fresh server so webServer.env DB_PATH matches this run (reuse breaks when tmp db path changes per launch).
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    env: {
      ...process.env,
      PORT: "3456",
      HOST: "127.0.0.1",
      DB_PATH: dbPath,
    },
  },
});
