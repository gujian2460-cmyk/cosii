# Go-live checklist（Cosii MVP）

与 `docs/gstack-implementation-playbook.md` Day9–10、`TODOS.md` P1 对齐。发布前逐项勾选并保留证据（截图、CI 链接、配置导出）。

## 配置与密钥

- [ ] `DB_PATH` / `DATA_DIR` 在生产环境已设定，SQLite 文件权限与备份策略已确认。
- [ ] 微信支付商户号、API v3 密钥、证书与回调 URL 已在微信侧配置且与部署域名一致。
- [ ] `LOCAL_CODE_PEPPER`（同城核销）在生产已设置强随机值，与开发/预发隔离。
- [ ] 不再使用弱 dev 约定：生产禁用仅凭 `X-User-Id` 的信任边界（微信会话接入后）。

## 数据与迁移

- [ ] `db/schema.sql` 已应用到目标库；若有迁移脚本，版本号与回滚步骤已记录。
- [ ] 关键表空跑/抽样校验：`unified_orders`、`order_payments`、`wechat_webhook_events`、`settlement_ledger`。

## 自动化门禁

- [ ] `npm test`（全量 Vitest）绿。
- [ ] `npm run test:critical`（T11–T17 CRITICAL 矩阵）绿。
- [ ] `npm run test:e2e`（Playwright 四条主链）绿。

## 可观测性与告警

- [ ] 负载均衡 / 平台健康检查指向 `GET /health`（或等价）。
- [ ] 可选深度：`GET /v1/ready`（SQLite `SELECT 1`）纳入内网探活。
- [ ] 生产开启结构化访问日志：`STRUCTURED_ACCESS_LOG=1`（字段含 `trace_id`、路径、状态码；不含密钥）。
- [ ] 告警路由已登记：**对账超容差**、**结算 job 死信/重试耗尽**、**webhook 连续失败**；值班与升级路径见运行手册（谁响应、何时升级）。
- [ ] 排障时可用 `trace_id`（响应体 `trace_id` 或日志）关联订单与账本（见 `DESIGN.md` 对 trace 的约定）。

## 微信与合规

- [ ] 回调幂等与乱序策略已在代码层验证（CRITICAL T11/T13/T17）。
- [ ] `TODOS.md` 中支付规则冻结、微信合规项已处理或书面豁免。

## 回滚

- [ ] 回滚步骤：停流量 → 回退镜像/版本 → 数据库是否回滚已决策（SQLite 通常前进-only，需备份恢复流程）。
- [ ] 冻结自动结算类开关（若有）在回滚时的期望状态已写明。

## 发布后验证

- [ ] 探活 200；抽样走通一条交易链与一条约妆定金链（可与 E2E 步骤对照）。
- [ ] Financial Reconciliation 验收记录已存档（内网 wiki 或发布说明）。
