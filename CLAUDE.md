# Cosii — Agent Notes

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match `DESIGN.md`.

## Runtime

- Node.js **>= 22.5**（`node:sqlite` / `DatabaseSync`）
- Local DB: SQLite file under `data/app.db` unless `DB_PATH` / `DATA_DIR` is set

## Backend

- API base path: `/v1`
- Response envelope: see `src/shared/api-envelope/index.ts`
- Error codes: see `src/shared/errors/codes.ts` and UX mapping in `src/shared/errors/ux-map.ts`
- Dev auth header: `X-User-Id` (until WeChat session is wired)

### Modules (DESIGN.md Day3–6 对齐)

- **Payment:** `POST /v1/payments/create`，`POST /v1/payments/webhook/wechat`（幂等 `wechat_webhook_events`），`GET /v1/payments/unified/:unifiedOrderId/status`
- **Booking:** `GET /v1/booking/orders/:id`（含档期占位过期释放）；创建约妆仍 `POST /v1/booking/orders`（`hold_expires_at`）
- **Dispute:** `POST /v1/disputes`，`POST /v1/disputes/:id/evidences`，`GET /v1/disputes/:id`（时间线 + SLA）
- **Settlement:** `GET /v1/settlement/orders/:orderType/:orderId/ledger`，`POST /v1/settlement/orders/:orderType/:orderId/trigger`
- **Content（Day7–8）：** `POST /v1/posts`，`POST /v1/posts/:postId/cards`，`GET /v1/posts/:postId`（转化卡 `CONTENT_CARD_TARGET_INVALID`；下架后 `available: false`）
- **同城核销（Day7–8）：** `POST /v1/trade/orders/:id/local-handoff/issue`（买家，`PAID_ESCROW`），`POST .../redeem`（卖家，幂等完成），`GET .../local-handoff`（买卖家状态）；错误码 `LOCAL_VERIFICATION_*`；环境变量 `LOCAL_CODE_PEPPER`（可选，生产必设）
- 中文事件标签：`src/shared/ledger-labels.ts`；占位 TTL / SLA / 重试上限：`src/shared/constants.ts`

## 测试与上线门禁

- **全量：** `npm test`（Vitest，`tests/**/*.test.ts`）。
- **CRITICAL（playbook T11–T17）：** `npm run test:critical` → `tests/critical-matrix.t11-t17.test.ts`。
- **E2E（四条主链，Playwright + 本地 API）：** `npm run test:e2e`；种子与 ID 见 `tests/e2e-seed.ts`，验收标题见 `e2e/e2e-*.spec.ts` 注释。
- **就绪 / 日志：** `GET /v1/ready`（DB 探活）；`STRUCTURED_ACCESS_LOG=1` 时输出单行 JSON 访问日志（`trace_id`、路径、状态码）。
- **发布清单：** `docs/go-live-checklist.md`。

## 微信小程序（UI 壳）

- 工程目录：`miniprogram/`（用微信开发者工具打开该目录）；说明见 `miniprogram/README.md`。
- 设计真源：`DESIGN.md` + `docs/designs/miniprogram-ui-shell-spec.md`。
- 开发期请求头：`globalData.devUserId` → `X-User-Id`；`globalData.apiBase` 默认 `http://127.0.0.1:3000`（需关闭工具域名校验）。
