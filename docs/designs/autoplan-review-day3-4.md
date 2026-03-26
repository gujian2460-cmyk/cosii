# /autoplan 评审结果（Day3-4）

## 评审范围

- 支付发起（`POST /v1/payments/create` → 微信预支付参数 / 调起 `requestPayment` 所需数据）
- 微信支付回调：`webhook` 验签 + **原子幂等**（insert-first / 唯一约束防重）
- 档期锁与占位过期（短 TTL 占位、过期释放、与并发约妆一致）

## 评审结论

- **当前状态：** 待实施（以 `docs/designs/eng-implementation-plan-cos-miniapp.md` 为真源；与 playbook Day3-4 对齐）。
- **目标结论：** 实现并通过联调 / 关键回归（T2、T11–T13、T15、T17 等与支付、回调、档期相关的条目）后，再执行 `/autoplan` 将 CEO / Design / Eng 结论写入本节。

## Design 基线（/design-consultation）

- **小程序 UI 真源：** 根目录 `DESIGN.md` 章节 **「Day3–4 界面与状态（支付 / 回调同步 / 档期占位）」** — 已根据本节通过标准（支付发起、轮询结果、占位倒计时与过期回流）写成可落地的界面与状态条规范，与现有色板 / 字体 / 反 slop 规则一致。
- **后端 / 错误码：** 仍与 `ErrorCode`、`errorUxMap` 中 `PAYMENT_TIMEOUT`、`PAYMENT_WEBHOOK_DUPLICATE`、`BOOKING_SLOT_CONFLICT` 等对齐；前端文案与语义色不得自行偏离 `DESIGN.md`。

## 通过标准（用于写入 /autoplan 结果）

### 1) 支付发起

- `POST /v1/payments/create` 接收 `unified_order_id`（或等价引用）、金额、业务幂等键；校验调用方身份与订单状态（仅允许 `PENDING_PAYMENT` / 约妆定金态等规划内前置态）。
- 返回小程序侧调起支付所需字段（与微信支付文档一致）；**不在日志中输出密钥或完整敏感载荷**。
- 错误码覆盖：金额不一致、订单不可支付、重复发起等；与 `ErrorCode` / `errorUxMap` 一致。

### 2) Webhook 验签 + 原子幂等

- **验签：** 按微信支付 v3 规范校验回调签名（含证书链 / 平台公钥策略按你方接入方式固定一种并文档化）。
- **原子幂等：** 回调处理路径上，对同一 `idempotency_key` 或微信侧唯一通知 ID 采用 **先插入唯一记录再处理**（或等价 `ON CONFLICT DO NOTHING` 语义），保证并发下仅一次业务推进。
- **重复通知：** 第二次及以后返回成功响应且 **无副作用**（或仅查询），对外码映射 `PAYMENT_WEBHOOK_DUPLICATE` / 用户侧「已同步」体验（见 Error UX 表）。
- **乱序 / 迟到回调：** 单调序或事件时间守卫，避免旧事件覆盖新状态（对齐 T11、T17）。
- **SLA：** 响应体在平台要求时间内返回（如 5 秒内）；超时重试由微信侧触发，服务端仍幂等安全。

### 3) 档期锁与占位过期

- **占位：** 用户选定档后进入 **短 TTL 占位**（规划示例约 2 分钟），`artist_slots` 或独立 hold 表状态与 `service_orders` 草稿/占位态一致。
- **过期：** TTL 到期自动释放占位（事务或可靠 job），客户端倒计时与「过期回流选档」UX 对齐设计计划。
- **并发：** 与 Day1-2 同一套 DB 唯一 + 事务锁；**重叠区间**拒绝第二单（T15）；占位过期后重新可选。
- **测试：** 至少覆盖「占位过期后再约」「并发双请求仅一单成功」的集成或契约测试。

## /autoplan 结果写入模板

实现并执行 `/autoplan` 后，将结果补充到本节：

- CEO 评审：`PASS | CONCERNS | BLOCKED` + 关键问题
- Design 评审：`PASS | CONCERNS | BLOCKED` + 关键问题（支付结果页 / 档期倒计时等）
- Eng 评审：`PASS | CONCERNS | BLOCKED` + 架构/测试/性能/安全结论
- Taste decisions（如有）：记录选项与最终决定
- Deferred items：同步到 `TODOS.md`

## 与工程计划 / 回归矩阵的索引

| 主题 | 规划中的测试 ID（摘录） |
|------|-------------------------|
| 回调幂等 / 乱序 | T2、T11、T13、T17 |
| 档期并发 / 重叠 | T12、T15 |
| 统一订单 FK | T14 |

---

## 附录：规划原文摘录（支付 → 结算 / 约妆并发）

见 `docs/designs/eng-implementation-plan-cos-miniapp.md` 中 **Processing Pipelines**、**Failure modes**、**Test Matrix T1–T17** 及 **order_payments / webhook** 相关约束。
