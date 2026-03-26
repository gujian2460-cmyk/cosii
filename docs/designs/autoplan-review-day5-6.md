# /autoplan 评审结果（Day5-6）

**Playbook 摘录：** `docs/gstack-implementation-playbook.md` — Day5-6

- 争议流程 + 证据上传 + SLA  
- 结算账本 + 结算任务  

**评审方式：** 按 `/autoplan` 管线（CEO → Design → Eng）与 6 条自动决策原则执行；**主审为仓库内规划与代码对照**（本环境未跑 Codex CLI，双声道标为不可用）。

---

## 评审范围

| 能力域 | 规划要点 |
|--------|----------|
| **争议** | 发起仲裁、状态机、与 `unified_orders` 同步；**证据**上传与链式存储；**SLA**（`sla_due_at`）对用户可感知 |
| **结算** | **事件账本**（`settlement_ledger`：冻结/解冻/抽成/退款等）；**异步任务**（`settlement_jobs`：重试、死信、手动触发边界） |

**真源：** `docs/designs/eng-implementation-plan-cos-miniapp.md`（端点表、状态字典、错误 UX）；`DESIGN.md`（关键状态一眼读懂）；`TODOS.md`（上线前冻结规则、支付合规）。

## Design 基线（/design-consultation）

- **小程序 UI 真源：** 根目录 `DESIGN.md` 章节 **「Day5–6 界面与状态（争议 / 证据 / SLA / 结算）」** — 已按本节 Phase 2 硬要求（SLA 倒计时/逾期、证据列表态、订单内账本摘要、`SETTLEMENT_RETRY_EXHAUSTED` 与 `DISPUTE_INVALID_STATE` 布局）写成可落地规范，并与 Day3–4 状态条、语义色、反 slop 规则一致。
- **后端 / 错误码：** 与 `ErrorCode`、`errorUxMap` 中 `DISPUTE_INVALID_STATE`、`SETTLEMENT_RETRY_EXHAUSTED` 对齐；前端主副按钮与 `trace_id` 展示不得偏离 `DESIGN.md`。

---

## Phase 1 — CEO 评审（战略与范围）

### 前提与挑战

| 前提 | 评估 |
|------|------|
| 争议与结算是「可信成交」闭环的核心 | **成立** — 无此则 PMF 信任假设不闭环 |
| 产品规则（抽成、托管、争议裁量）可在实现中途再定 | **不成立** — `TODOS.md` P1「上线前冻结 3 项支付/履约规则」应 **先于** 大表状态机批量落地，否则返工成本高 |

### 已有代码可复用

- **错误码与文案：** `DISPUTE_INVALID_STATE`、`SETTLEMENT_RETRY_EXHAUSTED` 已在 `ErrorCode` / `errorUxMap`。
- **库表：** `order_disputes`、`dispute_evidences`、`settlement_ledger`、`settlement_jobs` 已在 `db/schema.sql` 定义（含索引、外键）。

### 不在本轮「必须写完」但应进 backlog

- 完整 **法务/仲裁** 流程（超出小程序 + API 的典型 MVP，可阶段化为「平台内争议工单 + 人工/半自动裁量」）。
- **微信支付分账/结算** 与商户资质强绑定的能力 — 与 `TODOS.md`「WeChat 支付/结算合规能力清单」联动，避免假实现。

### CEO 结论

- **范围：** Day5-6 应交付 **可审计的争议最小闭环 + 可重放的结算账本与任务**，不假装已完成微信侧全部资金清分。
- **选择性扩展（原则 1–2）：** 在「冻结规则」未书面确定前，实现 **显式占位 + `DEFERRED_CONFIG` 类 feature flag** 优于硬编码费率（若需二选一，选 **显式 TODO + 单测断言配置缺失时拒绝生产结算**）。

### CEO 双声道

| 维度 | Codex | Claude 子代理 | 共识 |
|------|-------|----------------|------|
| 前提是否成立 | — | — | **N/A（未执行）** |
| 是否值得现在做 | — | — | **是 — 与 playbook 一致** |

---

## Phase 2 — Design 评审（UI/UX）

**UI 范围：** 争议与结算在小程序侧均有 **强 UI**（时间线、SLA、证据列表、结算明细），本阶段 **必须** 跑 Design 维度。

### 各维度摘要（0–10）

| 维度 | 分 | 说明 |
|------|-----|------|
| 信息架构 | 7 | `eng-implementation-plan` 已给「争议中心 / 订单详情时间线」；需与 Tab「订单」「消息」深链一致 |
| 缺失状态 | 6 | 须补齐：**证据审核中、SLA 将到期、结算重试中、结算失败可申诉**（与 `SETTLEMENT_RETRY_EXHAUSTED` 对齐） |
| 用户情绪弧 | 7 | 争议路径压力大 — **禁止黑盒**（与 `autoplan-review-ui`「争议时间线 + SLA」一致） |
| 具体 vs 泛泛 | 8 | 规划已要求 trace、账本事件类型；实现时每个节点需 **用户可读标签**（对齐状态字典） |
| 无障碍 | 7 | 状态变化需 **文案 + 色** 双编码（`DESIGN.md` Day3-4 已立例） |

### Design 硬要求（写入实现验收）

1. **争议页：** 展示 `sla_due_at` 倒计时或「已逾期」语义（warning/error），与 `DESIGN.md` semantic 一致。  
2. **证据上传：** 上传中 / 失败可重试 / 成功列表；类型与 `dispute_evidences.evidence_type` 对齐，避免仅「成功 toast」。  
3. **结算：** 订单详情内 **账本摘要**（最近 N 条事件或「查看全部」），重试耗尽时主按钮对齐 `errorUxMap`「打开订单结算明细」。  

### Design 双声道

| 维度 | Codex | Claude 子代理 | 共识 |
|------|-------|----------------|------|
| 层级是否服务用户 | — | — | **N/A（未执行）** |

---

## Phase 3 — Eng 评审（架构与测试）

### 现状对照（2026-03-26）

| 项 | 状态 |
|----|------|
| `db/schema.sql` 争议/结算表 | **已有** |
| `src/` 下 `dispute` / `settlement` 模块或路由 | **无**（`app.ts` 仅注册 `trade`、`booking`） |
| 契约测试覆盖 Day5-6 | **无** |

### 架构要点

- **单一真相：** 任意争议/结算推进须 **同事务** 更新 `unified_orders.status` + 领域表（与规划「State authority rule」一致）。  
- **账本：** `settlement_ledger` 追加写；**禁止** 无事件直接改余额；`trace_id` 与支付/回调 trace 可对账。  
- **任务：** `settlement_jobs` 由后台 worker 或定时扫描驱动；`retry_count` / `next_retry_at` 与 `SETTLEMENT_RETRY_EXHAUSTED` 阈值一致并 **单测固定**。  
- **安全：** 证据 URL 若为直链，需 **鉴权与防盗链策略**（签名 URL 或经 API 代理）；上传接口防刷、大小与类型校验。

### 测试图（必须覆盖的缺口）

| 代码路径 | 测试类型 | 说明 |
|----------|----------|------|
| 非法状态发起争议 | 集成 / 契约 | 返回 `DISPUTE_INVALID_STATE` |
| 支付成功 → 账本冻结事件 | 集成 | ledger 行数 +1，`event_type` 符合字典 |
| 结算 job 重试耗尽 | 单元 / 集成 | 对外映射与 UX 一致 |
| 争议中并发结算 | 集成 | 不得双花；与 `DISPUTED` 状态互斥规则一致 |

（与 `eng-implementation-plan` 中 T3、T4 及 E2E #3 方向一致。）

### Eng 双声道

| 维度 | Codex | Claude 子代理 | 共识 |
|------|-------|----------------|------|
| 架构是否成立 | — | — | **表设计可支撑；缺实现与测试** |

---

## 决策审计摘要（/autoplan 原则）

| # | 原则 | 决策 |
|---|------|------|
| 1 | 完整性优先 | Day5-6 同时包含 **争议 API + 证据 + SLA 字段消费** 与 **账本写入 + job**，不只做空表 |
| 2 | 煮沸湖面 | 修改范围应覆盖 `modules/dispute`、`modules/settlement`、必要时 `unified_orders` 迁移与 `tests/*.contract.test.ts` |
| 3 | 务实 | 微信清分未定时，账本先记 **业务事件**；对接微信分账作为后续迭代 |
| 4 | DRY | 状态迁移复用现有 `HttpError` + envelope，不新造响应格式 |
| 5 | 显式优于聪明 | 重试策略用表字段 + 常量，不用隐式魔法数散落 |
| 6 | 偏向行动 | 先打通 **最小 API + 测试** 再扩展运营后台 |

---

## 通过标准（写入 playbook / 日终验收）

1. **争议：** `POST /v1/disputes`、`POST /v1/disputes/{id}/evidences`（或规划等价路径）可用；非法状态稳定返回 `DISPUTE_INVALID_STATE`；`sla_due_at` 写入且可被订单/争议查询接口返回。  
2. **证据：** 元数据入库，`evidence_url` 策略文档化（内网直链 vs OSS 签名）。  
3. **账本：** 关键业务动作产生 `settlement_ledger` 行；余额语义（`balance_after`）定义清晰。  
4. **任务：** 至少一种 **job 推进方式**（同步占位 worker 或可调度的 `next_retry_at` 扫描）；耗尽路径覆盖 `SETTLEMENT_RETRY_EXHAUSTED`。  
5. **测试：** 新增契约/集成测试覆盖上表「测试图」P0 行；`npm run build` + `npm test` 全绿。  
6. **产品门槛：** 与 `TODOS.md` 冻结规则冲突时 **停止扩 scope**，先更新 TODOS / 规划再编码。

---

## 当前结论（摘要）

| 项 | 结论 |
|----|------|
| **是否可开工** | **可** — schema 与错误码已铺垫；需补路由、服务层、worker 策略与测试 |
| **最大风险** | 业务规则未冻结 + 微信侧结算能力与表内事件语义不一致 |
| **下一动作** | 实现 Day5-6 模块并补测试 → 将本节「当前结论」替换为「已验收」并附 PR/提交说明 |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` / `/autoplan` | 范围与前提 | 1 | **本文件 §Phase 1** | 冻结规则应先于大状态机；MVP 争议+账本可审计 |
| Codex Review | `/codex review` | 第二意见 | 0 | — | 未执行 |
| Eng Review | `/plan-eng-review` | 架构与测试 | 1 | **本文件 §Phase 3** | 表已有、代码未实现；测试缺口已列 |
| Design Review | `/plan-design-review` | UI/UX | 1 | **本文件 §Phase 2** | SLA/证据/结算可见性必验收 |

**VERDICT：** Day5-6 **规划评审通过（带前提）** — 落地前确认 `TODOS` 冻结项与微信合规清单；实现后建议再跑一轮 `/autoplan` 或单项 `/plan-eng-review` 更新本文件「当前结论」。

---

## 附录：相关文件索引

- `docs/gstack-implementation-playbook.md` — Day5-6 条目  
- `docs/designs/eng-implementation-plan-cos-miniapp.md` — 端点与状态字典  
- `docs/designs/eng-review-test-plan.md` — 争议/结算相关用例方向  
- `db/schema.sql` — `order_disputes`、`dispute_evidences`、`settlement_ledger`、`settlement_jobs`  
- `DESIGN.md` — 全局语义色与关键状态可读性  
- `TODOS.md` — P1 冻结规则、支付合规  
