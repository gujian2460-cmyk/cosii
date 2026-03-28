/**
 * 复跑 Go-Live「自动化门禁」四门：全量 Vitest、CRITICAL 矩阵、Playwright 四条主链、小程序 smoke。
 * 用法：npm run verify:gates（GitHub Actions 与本脚本一致，见 .github/workflows/ci.yml）
 */
import { execSync } from "node:child_process";

function run(label, cmd) {
  console.log(`\n━━ ${label} ━━\n> ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd(), shell: true });
}

run("npm test", "npm test");
run("npm run test:critical", "npm run test:critical");
run("npm run test:e2e", "npm run test:e2e");
run("npm run smoke:miniprogram", "npm run smoke:miniprogram");
console.log("\n✓ verify-go-live-gates: 全部通过\n");
