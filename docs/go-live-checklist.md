# Go-live checklist（Cosii MVP）

与 `docs/gstack-implementation-playbook.md` Day9–10、`TODOS.md` P1 对齐。发布前逐项勾选并保留证据（截图、CI 链接、配置导出）。

**《全项目自动评审报告》第二节 C（上线治理未闭环）** 的详细勾选与证据要求以**本文档为唯一真源**（密钥、日志留样、告警、`X-User-Id` 边界等）；自动评审报告仅作摘要指向本文。

**新手逐步教程（环境变量 + 真机 `wx.login`）：** [docs/tutorials/生产环境变量与真机联调（小白版）.md](tutorials/生产环境变量与真机联调（小白版）.md)  
**轨道 0 连续步骤（0.2 HTTPS～0.7 支付，含你要做的与仓库模板）：** [docs/tutorials/轨道0-合规步骤02-07小白教程.md](tutorials/轨道0-合规步骤02-07小白教程.md) · 模板目录 [`deploy/`](../deploy/README.md)

**快捷复跑门禁：** `npm run verify:gates`（= `npm test` + `test:critical` + `test:e2e`）。  
**发布窗口操作：** `docs/发布前30分钟检查单.md`。

## 配置与密钥

- [ ] `DB_PATH` / `DATA_DIR` 在生产环境已设定，SQLite 文件权限与备份策略已确认。
- [ ] 微信支付商户号、API v3 密钥、证书与回调 URL 已在微信侧配置且与部署域名一致。
- [ ] `LOCAL_CODE_PEPPER`（同城核销）在生产已设置强随机值，与开发/预发隔离。
- [ ] 不再使用弱 dev 约定：生产禁用仅凭 `X-User-Id` 的信任边界（微信会话接入后）。
- [ ] **微信登录与会话（生产）：** `WECHAT_APPID`、`WECHAT_SECRET`、`COSII_SESSION_SECRET` 已配置且与小程序 AppID 一致；`NODE_ENV=production`、`COSII_TRUST_DEV_HEADER=0`（仅 Bearer，不信任开发头）。
- [ ] **真机联调一次：** 在真机（体验版或正式版）完成 `wx.login` → `POST /v1/auth/wechat-login` 换 token → 随后业务请求带 `Authorization: Bearer`、不依赖 `X-User-Id`；留证据（时间、版本号、脱敏请求/响应样例或截图）。

## 数据与迁移

- [ ] `db/schema.sql` 已应用到目标库；若有迁移脚本，版本号与回滚步骤已记录。
- [ ] 关键表空跑/抽样校验：`unified_orders`、`order_payments`、`wechat_webhook_events`、`settlement_ledger`。

## 自动化门禁

- [x] `npm test`（全量 Vitest）绿。（可复跑：`npm run verify:gates`；样例证据：`docs/designs/自动评审-工程卫生与上线质量.md` §3）
- [x] `npm run test:critical`（T11–T17 CRITICAL 矩阵）绿。
- [x] `npm run test:e2e`（Playwright 四条主链）绿。

## 可观测性与告警

- [x] 负载均衡 / 平台健康检查指向 `GET /health`（或等价）。（实现：`src/app.ts` `GET /health`）
- [x] 可选深度：`GET /v1/ready`（SQLite `SELECT 1`）纳入内网探活。（实现：`src/app.ts`；探针脚本：`npm run verify:ready`）
- [x] 代码支持结构化访问日志：`STRUCTURED_ACCESS_LOG=1`（字段含 `trace_id`、`path`、`status_code`；不含密钥；见 `src/app.ts`）。
- [ ] 生产开启结构化访问日志并 **留样**（平台日志中能检索到上述字段）。
- [ ] 告警路由已登记：**对账超容差**、**结算 job 死信/重试耗尽**、**webhook 连续失败**；值班与升级路径见运行手册（谁响应、何时升级）。
- [x] 排障时可用 `trace_id`（响应体 `trace_id` 或访问日志）关联请求。（成功/错误信封均含 `trace_id`；抽样见 `docs/designs/错误响应抽样清单.md`）

## 微信与合规

- [x] 回调幂等与乱序策略已在代码层验证（CRITICAL T11/T13/T17）。（`tests/critical-matrix.t11-t17.test.ts`；生产重放演练记录仍建议保留书面证据）
- [ ] `TODOS.md` 中支付规则冻结、微信合规项已处理或书面豁免。
- [ ] 小程序合法域名、HTTPS、与后端 `WECHAT_*` 一致；未登录时受保护接口返回 `AUTH_UNAUTHORIZED`，API `message` 为「未认证」语义（`Authentication required`），客户端以 `errorUxMap` 展示为主。

## 回滚

- [ ] 回滚步骤：停流量 → 回退镜像/版本 → 数据库是否回滚已决策（SQLite 通常前进-only，需备份恢复流程）。（操作细则：`docs/runbooks/发布回滚步骤.md`）
- [ ] 冻结自动结算类开关（若有）在回滚时的期望状态已写明。

## 发布后验证

- [ ] 探活 200；抽样走通一条交易链与一条约妆定金链（可与 E2E 步骤对照）。
- [ ] Financial Reconciliation 验收记录已存档（内网 wiki 或发布说明）。
