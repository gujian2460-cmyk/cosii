# CEO Plan Review: 微信小程序（Cos 交易 + 约妆 + 轻社区）

Generated on 2026-03-25  
Mode: SELECTIVE_EXPANSION  
Base approach: 交易闭环优先（抽成模式）

## Scope Decisions

Accepted expansions:
1. 认证妆娘体系
2. 担保/托管 + 定金尾款
3. 漫展档期工具
4. 作品到成交转化卡片
5. 同城面交安全核销

Deferred to TODOS.md:
- 无（本轮均选择加入）

Skipped:
- 无

## NOT in scope

- 重推荐流算法（首页复杂推荐）——首期不做，避免冷启动复杂度爆炸。
- 泛二次元全品类电商——先聚焦高频 Coser，避免人群失焦。
- 跨平台内容分发工具——先保证站内交易与履约闭环。
- 直播/短视频带货——延后到 PMF 后。

## What already exists

- 现有替代链路：微信群/QQ 群 + 闲鱼/转转 + 熟人介绍（可对标并替代）。
- 微信生态天然具备分享与关系链传播能力（可复用，不需自建社交图谱）。
- 小程序支付/通知能力可支持交易与约妆流程基础闭环。

## Dream state delta

CURRENT STATE -> THIS PLAN -> 12-MONTH IDEAL

- 当前：交易、约妆、内容分散在多个平台，信任弱，履约无保障。
- 本计划：以高频 Coser 为切口，打通交易/约妆/轻内容与基础风控。
- 12 个月理想：形成二次元垂直“可信成交网络”，内容可稳定反哺 GMV，具备可复制到更多城市和人群的能力。

## System Architecture (ASCII)

```text
[Mini Program UI]
   |-- 商品流/订单流
   |-- 约妆预约流
   |-- 作品发布流
   v
[API Gateway + Auth]
   |--> [Trade Service] ----> [Escrow/Settlement]
   |--> [Booking Service] --> [Schedule + Attendance Proof]
   |--> [Content Service] --> [Post + Conversion Cards]
   |--> [Trust & Safety] --> [KYC, Risk Score, Report, Arbitration]
   v
[MySQL/Document DB + Object Storage + Message Queue]
```

## Data Flow (happy + shadow paths)

```text
INPUT(下单/预约) -> VALIDATE(身份/库存/档期) -> LOCK(订单状态) -> PAY(托管/定金)
   -> FULFILL(发货或到店服务) -> CONFIRM(双方确认) -> SETTLE(抽成结算) -> OUTPUT(评价/复购)

Shadow paths:
- nil input: 缺失地址/档期 -> 阻断提交 + 提示补全
- empty input: 空价格/空描述 -> 阻断提交 + 前端校验
- upstream error: 支付/通知失败 -> 状态回滚 + 重试队列 + 人工工单
```

## State Machine (order)

```text
DRAFT -> PENDING_PAYMENT -> PAID_ESCROW -> IN_FULFILLMENT -> COMPLETED -> SETTLED
   \-> CANCELLED
PAID_ESCROW -> DISPUTED -> (REFUND | RESUME_FULFILLMENT)
```

## Error Flow (ASCII)

```text
Create Order
   -> ValidationError? ----yes--> show field error
   -> PaymentTimeout? ----yes--> retry x2 + pending state
   -> RiskHit? -----------yes--> manual review queue
   -> else --------------------> success
```

## Deployment Sequence (ASCII)

```text
1. 发布风控与订单状态字段（向后兼容）
2. 上线担保支付流程（灰度）
3. 上线认证妆娘与档期模块
4. 开启内容转化卡片
5. 城市分批开启同城核销
```

## Rollback Flowchart (ASCII)

```text
异常告警触发
   -> 是否支付/结算故障?
      -> yes: 关闭结算开关 + 保留订单只读 + 手工补偿
      -> no: 关闭问题功能 flag（档期/卡片/核销）
   -> 回滚版本并跑数据一致性检查
```

## Error & Rescue Registry

| METHOD/CODEPATH | WHAT CAN GO WRONG | EXCEPTION CLASS | RESCUED? | RESCUE ACTION | USER SEES |
|---|---|---|---|---|---|
| CreateTradeOrder | 库存冲突 | InventoryConflictError | Y | 返回最新库存并建议重试 | “库存已变化，请重试” |
| CreateTradeOrder | 支付超时 | PaymentTimeoutError | Y | 重试2次，失败入待支付 | “支付处理中” |
| ConfirmFulfillment | 双方状态不一致 | FulfillmentStateMismatchError | Y | 冻结订单并转人工仲裁 | “订单需人工核验” |
| SettleCommission | 结算失败 | SettlementGatewayError | Y | 延迟重试 + 告警 | “结算处理中” |
| BookMakeupService | 档期冲突 | SlotUnavailableError | Y | 返回可选时段 | “该时段已被预约” |
| PublishPostWithCard | 关联商品失效 | LinkedItemInvalidError | Y | 自动移除失效卡片 | “部分卡片已失效” |

## Failure Modes Registry

| CODEPATH | FAILURE MODE | RESCUED? | TEST? | USER SEES? | LOGGED? |
|---|---|---|---|---|---|
| 支付托管 | 第三方回调丢失 | Y | Y | 支付处理中 | Y |
| 约妆履约 | 到场争议 | Y | Y | 仲裁处理中 | Y |
| 内容转化卡 | 卡片商品下架 | Y | Y | 自动隐藏卡片 | Y |
| 同城核销 | 伪造核销码 | Y | Y | 核销失败 | Y |
| 认证妆娘 | 资料造假 | Y | Y | 审核未通过 | Y |

CRITICAL GAPS: 0（当前规划层面）

## Security & Threat Model

- Threat: 冒充妆娘接单；Likelihood: Med; Impact: High; Mitigation: 实名 + 作品审查 + 黑名单。
- Threat: 交易诈骗（先款后货/货不对板）；Likelihood: High; Impact: High; Mitigation: 托管结算 + 争议冻结。
- Threat: 越权访问订单；Likelihood: Med; Impact: High; Mitigation: 订单级鉴权 + 审计日志。
- Threat: UGC 内容违规；Likelihood: Med; Impact: Med; Mitigation: 举报流程 + 风险词审核 + 人工复审。

## Test Plan Snapshot

- Unit: 订单状态机、抽成计算、风控规则。
- Integration: 支付托管回调、争议流程、改期流程。
- E2E: 下单 -> 托管 -> 履约 -> 结算；发布作品 -> 点击卡片 -> 下单。
- Chaos: 支付回调延迟、消息重复投递、仲裁高峰。

## Observability

- Metrics: 成单率、履约完成率、争议率、退款率、抽成收入、复购率。
- Logs: 订单状态变化全链路日志（含 request_id/user_id/order_id）。
- Alerts: 支付成功率下降、争议激增、结算失败重试超阈值。
- Dashboard: 交易漏斗、约妆漏斗、内容转化漏斗、城市维度核销通过率。

## Deployment & Rollout

- Feature flag: 托管结算、认证妆娘、内容转化卡、同城核销均需独立开关。
- Rollout: 先单城灰度 -> 多城扩展 -> 全量。
- Post-deploy checks: 支付回调、订单状态流转、仲裁工单、消息到达率。

## Long-term Trajectory

- Reversibility: 4/5（功能开关可回退，结算逻辑需谨慎迁移）。
- Debt risks: 人工仲裁成本、风控模型冷启动、同城运营负担。
- Platform potential: 认证体系 + 信用分可复用到周边商家与更多服务类目。

## Completion Summary

- Mode selected: SELECTIVE_EXPANSION
- Scope proposed: 5
- Scope accepted: 5
- Scope deferred: 0
- Critical gaps: 0
- Unresolved decisions: 0
- CEO plan file: written

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 5 proposals, 5 accepted, 0 deferred |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES_FOUND | 19 issues/decisions reviewed, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

- **UNRESOLVED:** 0
- **VERDICT:** CEO reviewed; Eng plan completed with outside-voice concerns documented.
