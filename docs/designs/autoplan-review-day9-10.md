# /autoplan 评审结果（Day9-10）

**Playbook 摘录：** `docs/gstack-implementation-playbook.md` — Day9-10

- 全回归 + 4 条 E2E  
- 监控、告警、上线检查清单  

**评审方式：** 按 `/autoplan` 管线（CEO → Design → Eng）与 6 条自动决策原则，对 `eng-implementation-plan-cos-miniapp.md` 的 Day9-10 与 playbook「上线前门槛」对齐；**主审为规划 + 当前仓库测试现状**（本环境未跑 Codex CLI，双声道标为不可用）。

---

## 评审范围

| 能力域 | 规划要点 |
|--------|----------|
| **全回归** | 单元 / 集成 / 契约测试全集绿；**CRITICAL** 子集与工程计划 Test Matrix 对齐 |
| **4 条 E2E** | 四条主用户链路透跑（交易、约妆、争议、内容转化） |
| **监控与告警** | 可观测性最小集：健康检查、错误率、关键业务指标、结算/对账类告警入口 |
| **上线检查清单** | 发布前人工 + 自动勾选项（配置、密钥、回滚、DB、微信侧） |

**真源对齐：**

- `docs/designs/eng-implementation-plan-cos-miniapp.md` — Day 9-10、`Test Matrix T1–T17`、E2E chain #1–#4、`Financial Reconciliation Acceptance Criteria`  
- `docs/gstack-implementation-playbook.md` — 上线前门槛（T11–T17、4 E2E、对账、DESIGN 基线）  
- `docs/designs/eng-review-test-plan.md` — 关键交互与 Critical Paths  
- `TODOS.md` — 支付规则冻结、微信合规、DESIGN 基线等待办  

---

## Phase 1 — CEO 评审（战略与范围）

### 前提与挑战

| 前提 | 评估 |
|------|------|
| 无 E2E 也可先灰度上线 | **不成立** — playbook 明确要求 4 条 E2E 主链路；金融与并发类风险需端到端背书 |
| 监控可上线后补 | **部分不成立** — 至少 **健康检查 + 错误日志 + 结算/对账异常告警** 应进 MVP，否则「冻结自动结算」类规则无法触发 |

### 已有基础（仓库现状）

- **Vitest：** `tests/*.test.ts` 已覆盖部分 API 契约与 Day3–8 流程（如 `design-md-flow`、`day7-8-content-handoff`）。  
- **Playwright / 四条命名 E2E：** 工程计划已写，**仓库内尚未落地**（与 eng 计划中的 `[GAP]` 一致）。  
- **`/health`：** 已有，可作为探活与负载均衡健康检查入口。  

### 不在本轮「假装完成」

- 完整 **APM 厂商级** 调用链、多区域 SLO 看板（可进 TODOS / 后续迭代）。  
- **微信小程序端** 自动化 UI 全量巡检（若 E2E 仅覆盖 H5/API，需在清单中写明边界）。  

### CEO 结论

- **范围：** Day9-10 交付 **可重复的回归闸门 + 4 条可演示的 E2E + 最小可运维观测面 + 可勾选 go-live 清单**。  
- **选择性扩展（原则 1–2）：** 在 CI 资源有限时，**CRITICAL 回归（T11–T17 等与支付/占位/乱序相关）优先于** 非关键用例扩面。  

### CEO 双声道

| 维度 | Codex | Claude 子代理 | 共识 |
|------|-------|-----------------|------|
| 是否必须 4 E2E | — | — | **是 — 与 playbook / eng 计划一致** |
| 监控是否可后置 | — | — | **仅非关键可后置；对账/结算/错误面不可** |

---

## Phase 2 — Design 评审（UI/UX）

**UI 范围：** Day9-10 以 **运维可见性、发布清单文案、错误页/状态页** 为主；小程序侧沿用既有 `DESIGN.md` 状态条与语义色，**不新开视觉系统**。

### 各维度摘要（0–10）

| 维度 | 分 | 说明 |
|------|-----|------|
| 信息架构 | 7 | go-live 清单需分块：配置 / 数据 / 微信 / 回滚 / 验证 |
| 缺失状态 | 6 | 监控大屏可简化为文档 + 告警路由；**运行手册**需写清「谁响应、多久升级」 |
| 具体 vs 泛泛 | 8 | 每条 E2E 应对应可点击的验收段落（步骤 + 期望状态/码） |
| 无障碍 | 6 | 对内工具页若存在，至少保证对比度与焦点可见（非小程序主战场） |

### Design 硬要求（写入清单）

1. **四条 E2E** 在测试计划或 README 中有 **用户可读标题**（与 `eng-review-test-plan.md` 四条链路一致）。  
2. **告警** 触发时，运维侧能看到 **trace / order 标识** 的查询路径（与 `DESIGN.md` 对 `trace_id` 的要求一致）。  

### Design 双声道

| 维度 | Codex | Claude 子代理 | 共识 |
|------|-------|-----------------|------|
| 清单是否足够具体 | — | — | **N/A（未执行）** |

---

## Phase 3 — Eng 评审（架构与测试）

### 四条 E2E 链（与工程计划映射）

| 链 | 描述（摘要） | 计划锚点 |
|----|----------------|----------|
| **#1** | 交易：下单 → 支付 → 履约/确认 → 结算可达终态 | E2E chain #1；矩阵 **T7** |
| **#2** | 约妆：选档 → 占位/定金 → 服务态 → 尾款 | E2E chain #2；**T8** 等 |
| **#3** | 争议：发起 → 证据 → 可感知结束态 | E2E chain #3；**T9** |
| **#4** | 内容：发帖 → 挂卡 → 下单转化 | E2E chain #4；**T10** |

**实现决策（原则 4–5）：** E2E 建议 **Playwright + 对本地或 staging API**（与 eng 计划一致）；与现有 Vitest **共用 seed/fixture 辅助函数**，避免两套造数逻辑漂移。

### CRITICAL 回归与 playbook 对齐

| 来源 | 要求 |
|------|------|
| **Playbook** | T11–T17 全部通过（CRITICAL 回归） |
| **Eng 计划 CI 描述** | 曾写 `T11–T14` 为 release gate — **以 playbook 为准** 时，将 **T15–T17** 一并纳入 CRITICAL 或在清单中显式说明「扩展 gate」 |

建议在 `CLAUDE.md` 或 `TESTING.md`（若存在）中 **单列一行**：上线前必须通过的测试范围，避免文档打架。

### 监控 / 告警 / 清单（最小可行）

| 项 | 建议 |
|----|------|
| **探活** | `GET /health` + 部署平台健康检查 |
| **日志** | 结构化日志字段：`trace_id`、路径、状态码、关键业务 id（不含密钥） |
| **告警** | 对账超容差、结算 job 死信、webhook 连续失败 — 与 `Financial Reconciliation`、settlement 设计对齐 |
| **Go-live 清单** | 环境变量（`LOCAL_CODE_PEPPER`、DB、微信密钥）、迁移、回滚步骤、**冻结规则**（见 `TODOS.md` P1） |

### 测试图（P0 缺口 — 相对当前仓库）

| 路径 | 类型 | 说明 |
|------|------|------|
| 四条 E2E 整链 | E2E | **当前缺失**，Day9-10 核心交付 |
| T11 / T17 乱序回调 | 集成/回归 | 部分逻辑在单测/契约中有覆盖，**需矩阵级命名用例与 CI 勾选** |
| 对账失败冻结下一批结算 | 集成 | 与 `Financial Reconciliation Acceptance Criteria` 对齐 |

### Eng 双声道

| 维度 | Codex | Claude 子代理 | 共识 |
|------|-------|-----------------|------|
| 架构是否成立 | — | — | **Vitest 基础好；缺 Playwright 与 CI 门禁定义** |

---

## 决策审计摘要（/autoplan 原则）

| # | 原则 | 决策 |
|---|------|------|
| 1 | 完整性优先 | 交付 **4 E2E + CRITICAL 回归进 CI**，不单做「文档清单」 |
| 2 | 煮沸湖面 | 测试夹具、seed、错误码断言与现有 `tests/helpers` 模式统一 |
| 3 | 务实 | 监控先做 **日志 + 告警钩子 + 清单**；大盘可迭代 |
| 4 | DRY | E2E 与 Vitest 共用订单/支付造数 |
| 5 | 显式优于聪明 | `package.json` 中 `test:e2e`、`test:critical` 脚本名清晰 |
| 6 | 偏向行动 | 先接通 **一条 E2E** 再复制为四条，降低一次性失败面 |

---

## 通过标准（写入 playbook / 日终验收）

1. **全回归：** `npm test`（及后续划分的 `test:critical` 若拆分）在 CI 中必须通过；**T11–T17** 对应场景均有自动化覆盖且与 playbook 一致。  
2. **4 E2E：** Playwright（或等价）四条链全绿，步骤与期望状态写入 `docs/designs/eng-review-test-plan.md` 或专页并版本化。  
3. **监控：** 生产可查日志与 `/health`；关键告警有接收人与升级路径（文档即可，不要求完整 Grafana）。  
4. **上线清单：** `docs/` 或根目录 **go-live-checklist.md**（或 playbook 附录）可勾选完成；`TODOS.md` P1 冻结项已处理或显式豁免。  
5. **对账：** `Financial Reconciliation Acceptance Criteria` 验证记录可附在发布说明或内网 wiki。  

---

## 当前结论（摘要）

| 项 | 结论 |
|----|------|
| **是否可开工** | **可** — 范围清晰；当前缺口主要在 **Playwright + CI 门禁 + 运维文档** |
| **最大风险** | E2E 与 Vitest 重复造数导致漂移；T11–T14 vs T11–T17 文档不一致导致漏测 |
| **下一动作** | 加 Playwright 配置、实现 E2E #1 为模板、扩展为四条；固化 CRITICAL 子集与 CI；补 go-live 清单文件 |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/autoplan` | 范围与门禁 | 1 | **本文件 §Phase 1** | 4 E2E + 关键监控不可砍；大盘可迭代 |
| Codex Review | `/codex review` | 第二意见 | 0 | — | 未执行 |
| Eng Review | `/plan-eng-review` | 测试与 CI | 1 | **本文件 §Phase 3** | Playwright 与 CRITICAL 矩阵待落地 |
| Design Review | `/plan-design-review` | 清单与运维可读性 | 1 | **本文件 §Phase 2** | go-live / E2E 验收需可执行描述 |

**VERDICT：** Day9-10 **规划评审通过（带交付项）** — 实现后更新本文件「当前结论」为已验收，并附 CI 链接 / 报告归档路径。

---

## 附录：相关文件索引

- `docs/gstack-implementation-playbook.md` — Day9-10、上线前门槛  
- `docs/designs/eng-implementation-plan-cos-miniapp.md` — E2E chains、T1–T17、对账标准  
- `docs/designs/eng-review-test-plan.md` — 关键交互与 Critical Paths  
- `TODOS.md` — 冻结规则、微信合规、DESIGN 基线  
- `CLAUDE.md` — 测试命令与模块说明（建议补充 E2E / CRITICAL 说明）  
