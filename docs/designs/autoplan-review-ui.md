<!-- /autoplan restore point: N/A (UI scope review artifact; full restore flow skipped — no single plan file mutation) -->
<!-- autoplan scope: 微信小程序 UI 界面层 -->

# /autoplan — UI 界面层评审（Cos 小程序）

**生成时间:** 2026-03-26  
**模式:** SELECTIVE_EXPANSION（与 CEO 规划一致；不削减 UI 完整性）  
**计划锚点:** `docs/designs/eng-implementation-plan-cos-miniapp.md`（Design Addendum）+ 根目录 `DESIGN.md`  
**外部双模型:** Codex / 独立子代理 **未运行** — 本文件为 `[single-model]` 主审（环境无 `codex exec` 保证）。

---

## Phase 0 — Intake

### UI scope 检测

在工程计划与 `DESIGN.md` 中出现：`首页`、`Tab`、`订单`、`支付`、`表单`、`按钮`、`布局`、`骨架屏`、`toast` 等 **>2 处** UI 语义 → **UI scope = 是**，Phase 2（Design）**必须完整执行**。

### 上下文摘要

- **产品:** 微信内 Cos 交易 + 约妆 + 轻内容；抽成商业化。
- **代码现状:** `src/` 仅为 **Fastify API** + 统一 envelope；**无小程序前端工程**。UI 评审以 **规划 + DESIGN.md** 为主，实现风险在 Eng 段显式标出。
- **设计基线:** `DESIGN.md` 已存在 — 工程计划中 *Pass 5「未找到 DESIGN.md」* 的缺口 **已关闭**（实现时以 `DESIGN.md` 为真源，临时 token 作历史参照即可）。

### 加载的技能逻辑（等价执行）

已按 gstack `plan-ceo-review`、`plan-design-review`、`plan-eng-review` 的**方法论**编排；跳过项：bash preamble、AskUserQuestion 交互、Codex/子代理并行、远端 `gstack-review-read`。

---

## Phase 1 — CEO Review（战略与范围）

### 0A — 前提挑战（具名）

| 前提 | 评估 | 处置（自动决策） |
|------|------|------------------|
| 交易闭环优先 | 成立 | 保持；UI 首屏与导航强调「可成交」而非内容流 |
| 抽成模式 | 成立 | UI 需预留「费率/结算说明」入口，不必首屏展示 |
| 五类扩展（认证妆娘、托管、漫展档期、转化卡、同城核销） | 成立 | UI 信息架构按 persona 分区（买家 vs 卖家/妆娘） |
| 微信生态 | 成立 | 优先原生组件（支付、授权）；少自定义支付皮肤 |

### 0B — 现有代码可复用映射（UI 子问题 → 仓库现状）

| 子问题 | 现状 |
|--------|------|
| 页面路由与状态展示 | **无** — 待建小程序工程 |
| API 契约 / 错误码 | **有** — `src/shared/api-envelope`、`errors/codes`、`ux-map` 可直接作为小程序错误与 toast 映射源 |
| 设计 token | **有** — `DESIGN.md` |
| 业务状态字典 | **有** — 工程计划 State Dictionary；UI 文案必须引用 |

### 0C — Dream state（UI）

```text
CURRENT（无小程序 UI）
  -> THIS PLAN（Tab + 关键转化页 + 全状态矩阵 + DESIGN.md）
  -> 12-MONTH（品牌化组件库 + 可选后台 Web + 设计回归基线）
```

### 0C-bis — 实现路径（UI）

| 方案 | 风险 | 优点 | 缺点 |
|------|------|------|------|
| **微信原生** + 自研样式 | 低耦合 | 性能与支付适配最好 | 多端复用差 |
| **Taro / uni-app** | 中 | React/Vue 工程化、可测性略好 | 构建链路与微信能力对齐成本 |
| **仅 H5 壳** | 高（支付/体验） | 快 | 不符合小程序主线 |

**自动决策（P5 显式优先）:** 首期 **微信原生小程序**（或团队已熟练的单一框架），除非已有强约束 — **不引入** 仅为「熟悉技术栈」的多端抽象。

### 0D — 模式：SELECTIVE EXPANSION（UI）

- 不砍：五 Tab、转化优先首页、全交互状态表、无障碍与触摸目标。
- 延后（记入 TODOS，不在 UI 首期阻塞）：复杂推荐首屏、品牌动效系统、多主题换肤（与工程计划 Design NOT in scope 一致）。

### 0E — 时间线（UI）

| 时段 | 目标 |
|------|------|
| Hour 1–8 | 工程脚手架、全局样式 token（自 `DESIGN.md`）、Tab 壳、首页线框 |
| Day 2–5 | 商品/档期列表 + 详情 + 下单页；对接 mock API |
| Week 2+ | 支付结果页、订单时间线、消息深链、争议 SLA 展示 |

### 0F — CEO 共识表（双模型不可用）

```
CEO DUAL VOICES — CONSENSUS TABLE:
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Premises valid?                   是      N/A    待产品确认*
  2. Right problem to solve?           是      N/A    CONFIRMED
  3. Scope calibration correct?        是      N/A    CONFIRMED
  4. Alternatives sufficiently explored? 原生优先 N/A  CONFIRMED
  5. Competitive/market risks covered?  部分    N/A    需持续竞品观测
  6. 6-month trajectory sound?         是      N/A    CONFIRMED
═══════════════════════════════════════════════════════════════
*Premise gate：见文末「须你确认的前提」——与技能一致，仅此一处保留人工确认。
```

### CEO — NOT in scope（UI）

- 直播/短视频带货界面（已战略延后）。
- 复杂算法推荐流首屏。
- 全功能 Web 管理端（可后续单独 autoplan）。

### CEO — What already exists（UI）

- `DESIGN.md`、工程计划 Design Addendum、API 错误 UX 映射、CEO/Office-hours 文档。

### CEO — Error & Rescue（与 UI 相关摘录）

| 场景 | UI 行为 |
|------|---------|
| 支付超时 | 轮询 + 客服入口 + `trace_id`（计划已定义） |
| 档期冲突 | 立即回到选档 + 解释 copy |
| 争议 | 时间线 + SLA，禁止黑盒 |

### CEO — Failure modes（UI）

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| 状态展示与后端不一致 | 高 | 以服务端状态为准；前端禁止乐观覆盖支付/结算 |
| 首屏信息过载 | 中 | 遵守「单主 CTA」与三级层级 |
| 小程序审核（虚拟支付表述） | 中 | 上线前按微信类目与文案规范复核 |

### Phase 1 小结

**Phase 1 complete.** Codex: N/A。Claude subagent: N/A。共识：战略与 IA 与现有文档一致；**前提确认见文末 Gate。**

---

## Phase 2 — Design Review（7 维度，UI scope 必跑）

### Step 0 — 设计覆盖度

- **相对工程计划 addendum:** 原评约 **6/10** 已补到文档；配合 `DESIGN.md` 后，**规格完整度约 8.5/10**。
- **仍弱项:** 组件级规范（按钮/输入/状态条）在 `DESIGN.md` 可再扩一页 — **不阻塞** MVP，建议在 UI freeze 前补。

### DESIGN.md 对齐结论

- **偏离即高优:** 任何使用 Inter/Roboto 作主字体、紫色渐变主视觉、首屏三列等权卡片。
- **已锁定:** 色板、间距基线、圆角层级、反 slop 规则 — 实现必须引用 token，不得页面内随手写 hex（除语义例外）。

### 7 Pass 评分（0–10）

| Pass | 主题 | 分 | 说明 |
|------|------|-----|------|
| 1 | 信息架构 | 8.5 | Tab 与首屏三级层级清晰；需开发时防「功能堆砌」 |
| 2 | 交互状态 | 8.5 | 矩阵已列全；需组件库落地 |
| 3 | 情感旅程 | 8 | 与信任、支付可见性绑定 |
| 4 | AI Slop 防护 | 9 | 文档级规则强 |
| 5 | 设计系统 | 8 | `DESIGN.md` 已补齐；组件细则待扩 |
| 6 | 响应式/a11y | 7.5 | 小程序以移动为主；需 focus/读屏抽测 |
| 7 | 已定决策 | 9 | 订单 vs 消息、支付三层态明确 |

### Design litmus（七问，自检）

1. 首屏品牌/产品一眼可辨？→ **是（规划+DESIGN 方向）**  
2. 单一视觉锚点？→ **是（主 CTA + 主色）**  
3. 仅扫标题可懂？→ **需实现时验证文案**  
4. 每区一事？→ **规划符合**  
5. 卡片是否必要？→ **仅转化卡；禁止装饰卡网格**  
6. 动效服务层级？→ **minimal-functional**  
7. 去掉装饰阴影仍显质感？→ **依赖排版与色面 — 目标如此**

### Design — 双模型

**CODEX SAYS:** *不可用*  
**CLAUDE SUBAGENT:** *未单独派发*  

### Phase 2 小结

**Phase 2 complete.** 设计维度已评分；**与 `DESIGN.md` 冲突的实现视为缺陷。**

---

## Phase 3 — Eng Review（UI 工程）

### Step 0 — 范围挑战 + 代码对照

- ** examined:** `src/app.ts`、`modules/*`、`shared/api-envelope`、`errors/*`  
- **结论:** 后端已为小程序提供 **稳定 envelope + code + user_title**；小程序应 **薄适配层**（请求封装 + 统一错误处理），避免每页重复解析。

### 架构 ASCII（客户端 ↔ 服务端）

```text
[pages/] — WXML/WXSS/TS
    |  request (HTTPS + auth token / wx.login 链)
    v
[/v1/*] Fastify API  ←  envelope { code, message, data, trace_id }
    |
[SQLite/DB...]
```

### Section 2 — 代码质量（UI 侧预期）

- 建议 **按 feature 分包**（`pages/trade`、`pages/booking`、`pages/order`），与 API 模块域对齐。
- **禁止** 在页面硬编码错误文案 — 用 `code` → 映射表（可由 `ux-map` 导出 JSON 或同步生成）。

### Section 3 — 测试（不可压缩）

- 详见 `docs/designs/autoplan-ui-test-plan-20260326.md`。
- **缺口:** 小程序仓库不存在 — **CRITICAL path** 为「工程初始化 + 一条 E2E 冒烟」。

### Section 4 — 性能（UI）

- 首屏：控制 setData 频率；图片懒加载与 CDN；列表虚拟化（长列表时）。
- 避免首屏同步阻塞 `wx.request` 瀑布过多 — 合并请求或使用 GraphQL 仅在有明确收益时。

### Eng — NOT in scope（UI）

- 小程序外平台（App、纯 H5）双端同构 — 不强制。

### Eng — What already exists

- API、DB schema、状态与错误字典（文档 + 部分代码）。

### Eng — Failure modes（UI）

| 模式 | 严重度 | 备注 |
|------|--------|------|
| 展示状态与 API 不一致 | 高 | 以轮询/刷新策略 + 服务端为准 |
| 未处理 `partial` 态 | 中 | 计划矩阵已要求 |
| 敏感信息进日志 | 高 | 前端 console 禁打openid/金额 |

### Eng 共识表（双模型不可用）

```
ENG DUAL VOICES — CONSENSUS TABLE: [single-model — N/A 填表]
```

### Phase 3 小结

**Phase 3 complete。** 测试计划 artifact 已写入 `docs/designs/autoplan-ui-test-plan-20260326.md`。

---

## Cross-phase themes

1. **信任靠「状态真源 + 可见 trace」** — CEO/Design/Eng 均强调；UI 不可伪造「已支付」。
2. **转化优先 vs 内容** — 三线一致：首页不是信息流优先。
3. **实现缺口集中在前端仓库缺失** — 下一可执行步是 **初始化小程序工程**，而非再改 API。

---

## <!-- AUTONOMOUS DECISION LOG --> Decision Audit Trail

| # | Phase | Decision | Principle | Rationale | Rejected |
|---|-------|----------|-----------|-----------|----------|
| 1 | CEO | 首期微信原生优先 | P5 显式 | 支付与生态适配成本最低 | 纯 H5 为主 |
| 2 | CEO | 不砍 Tab 与全状态矩阵 | P1 完整 | 计划已验证 | 极简 MVP 仅单页 |
| 3 | Design | 以 `DESIGN.md` 为唯一视觉真源 | P4 DRY | 避免页面级漂移 | 每页随意调色 |
| 4 | Eng | 错误展示走 code 映射 | P4 DRY | 与后端字典一致 | 复制中文硬编码 |
| 5 | Eng | 测试 artifact 落盘 | P1 完整 | 可执行清单 | 仅口头列用例 |

---

## Taste decisions（若你关心备选）

**Choice 1 — 跨端框架:** 推荐 **原生优先**（P5）。备选 Taro — 若团队仅熟悉 React 且接受构建复杂度（下游：CI 与微信能力对齐更重）。

**Choice 2 — 设计细则扩写:** 推荐 **MVP 后再扩组件规范页**（P3 务实）。备选 freeze 前扩写 — 更稳但延后首屏交付约 **0.5–1 人日**。

---

## Premise gate（须你确认 — /autoplan 唯一人工闸）

请确认以下前提为真；**若否**，回复哪条不成立以便修订计划：

1. 小程序 **首期以微信原生（或你已选定的单一框架）** 为主，不强制多端同构。  
2. **视觉与间距** 以根目录 `DESIGN.md` 为准；微信内置字体若无法使用 CDN 字体，接受替换为合规字体并保持层级。  
3. **订单详情** 为状态真源；消息中心仅作提醒 + 深链，不复制完整时间线。

---

## Final Approval Gate（请选择一项回复）

- **A)** 批准 — 按本文与 `DESIGN.md` 实施 UI；前提三条全部接受  
- **B)** 批准但覆盖 — 说明对「Taste decisions」或前提的修改  
- **C)** 追问 — 指定章节编号  
- **D)** 修订 — 需要改 `eng-implementation-plan` 或 `DESIGN.md` 结构  
- **E)** 否决 — 推翻 UI 方向，重新 office-hours / CEO review  

（技能要求交互；此处用字母回复等效。）

---

## Deferred → `TODOS.md`

建议在 `TODOS.md` 增加或合并一条：**「小程序工程脚手架 + 首页线框 + 第一条 API 联通」**（若尚未存在）。*本次不自动改 TODOS，避免与你本地编辑冲突；需要我可单独补一行。*

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/autoplan` UI | 范围与战略 | 1 | clean | 见 Phase 1；双模型 N/A |
| Codex Review | — | 独立第二意见 | 0 | — | 未执行 |
| Eng Review | `/autoplan` UI | 架构与测试 | 1 | clean | 见 Phase 3；测试 artifact 已落盘 |
| Design Review | `/autoplan` UI | UI/UX 与 DESIGN.md | 1 | clean | 见 Phase 2 |

**VERDICT:** UI 层 **文档级 /autoplan 已完成**；**实现级**需小程序仓库 + 真机验证后补一轮 `/design-review` 或 `/plan-design-review` 对照。

---

## Completion status

**DONE_WITH_CONCERNS**

- **Concerns:** (1) 无 Codex/子代理双审；(2) 无 git restore 与 `gstack-review-log`；(3) 小程序代码未存在，Eng 测试为计划态。
