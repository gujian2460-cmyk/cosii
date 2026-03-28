/**
 * 探活：GET /health 与 GET /v1/ready，校验 HTTP 200 与 envelope 含 trace_id。
 * 需本机 API 已监听（默认 http://127.0.0.1:3000）。
 * 用法：npm run verify:ready
 *      API_BASE=https://staging.example.com npm run verify:ready
 */
const base = (process.env.API_BASE || "http://127.0.0.1:3000").replace(/\/$/, "");

async function check(path) {
  const url = `${base}${path}`;
  const res = await fetch(url);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${path}: 非 JSON 响应 (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`${path}: HTTP ${res.status} — ${text.slice(0, 300)}`);
  }
  if (body.code !== "OK") {
    throw new Error(`${path}: envelope code 非 OK: ${JSON.stringify(body)}`);
  }
  if (typeof body.trace_id !== "string" || body.trace_id.length < 8) {
    throw new Error(`${path}: 缺少有效 trace_id: ${JSON.stringify(body)}`);
  }
  console.log(`OK ${path} trace_id=${body.trace_id}`);
  return body;
}

try {
  await check("/health");
  const ready = await check("/v1/ready");
  if (ready.data && ready.data.ready !== true) {
    console.warn("警告: /v1/ready data.ready 非 true:", ready.data);
    process.exit(1);
  }
  console.log("\n✓ check-ready: 探活通过\n");
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  console.error("\n提示: 先启动 API（如 npm run dev），或设置 API_BASE 指向已部署实例。\n");
  process.exit(1);
}
