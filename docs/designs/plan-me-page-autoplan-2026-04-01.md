# 「我的」页面 — 设计计划与 /autoplan 评审包

**日期：** 2026-04-01  
**分支：** `main`（以仓库当前状态为基线）  
**关联代码：** `miniprogram/pages/me/*`  
**设计真源：** 根目录 `DESIGN.md`、`docs/designs/miniprogram-ui-shell-spec.md`、对标稿 [小程序UI对标设计稿-评审报告-2026-03-31.md](./小程序UI对标设计稿-评审报告-2026-03-31.md)  
**Backlog：** [小程序全页用户体验优化-backlog-单页汇总-2026-04-01.md](./小程序全页用户体验优化-backlog-单页汇总-2026-04-01.md)（UX-007 ✅、UX-020 ⬜）

**外脑状态：** Codex / Claude 独立子代理与 `gstack-review-log` 在本环境未执行 → **单评审员模式**；下列共识表为单一审查视角，非双模型对打。

---

## 计划正文（Rough plan in）

### A. 产品目标

1. **一眼身份**：用户进入 Tab「我的」时，0.5 秒内分辨「已登录 / 未登录」及当前角色（买家/卖家/妆娘在 V1 可为文案或标签）。
2. **任务出口清晰**：订单、消息、发布三条主路径不超过两次点击；费率/地址/设置有稳定落地页（已具备路由）。
3. **信任与合规**：生产态微信登录与开发态模拟登录**语义分离**；未登录时不呈现「像已拥有订单能力」的强引导错觉（对齐 UX-020）。
4. **状态完整**：`loading` / `error`（可重试 + 可选 trace 复制）/ 已登录内容 / 未登录内容 — 与 `DESIGN.md` 及 envelope 错误语义一致。

### B. 范围

| In（本迭代建议做完） | Out（显式推迟） |
|---------------------|----------------|
| 未登录态：弱化或收纳「常用功能」宫格；主 CTA 为登录/授权 | 卖家主页、数据统计、会员体系 |
| 已登录态：保持 quick 三卡 + 宫格 + 列表；可选展示角标占位（接口就绪再接） | 真实微信 `getUserProfile` 全链路（依赖 `useWeChatSession` 与后端） |
| 错误态：与 inbox/buy-search 对齐 — 页内为主，`retry_policy` + 复制 trace；减少与 toast 重复 | 深色主题整页切换（小程序壳当前为浅色粉紫） |
| 视觉：在**不推翻**现有渐变头的前提下，收紧对标稿差距（宫格 2×2 分组文案、列表区层次） | TDesign 全量组件化 |

### C. 实现任务清单（工程可排期）

| # | 任务 | 文件 | 验收 |
|---|------|------|------|
| M1 | 未登录：`wx:else` 分支隐藏或折叠 `me-quick` / `me-grid`，仅保留品牌区 + 主登录按钮 + 极简说明链（费率可保留弱入口或收入「登录后可见」） | `me.wxml`、`me.wxss`、`me.js` | 未登录时首屏主 CTA 唯一；无「我的订单」等强功能平铺 |
| M2 | 已登录：宫格按「买 / 卖 / 发 / 展」分组标题或 2×2 视觉分组（文案可对齐对标稿） | `me.wxml`、`me.wxss` | 扫视成本低于当前平铺 6 格 |
| M3 | `refreshProfile` 失败：去掉或与页内错误二选一 toast；错误块增加 `retryPolicy` + `copyTraceId`（复用 `utils/errors.js`） | `me.js`、`me.wxml` | 与 `inbox` 错误体验同级 |
| M4 | `onLoginTap`：开发态保留 ActionSheet；`globalData.useWeChatSession === true` 时走 `wx.login` → `/v1/auth/wechat-login`（若已有封装则复用 `app.js` 逻辑） | `me.js`、`app.js`（仅引用） | 生产构建路径不暴露假账号列表 |
| M5 | 无障碍与点击区域：列表 cell、`me-quick__card` min-height ≥ 88rpx 量纲自检 | `me.wxss` | 真机可点 |

### D. 依赖与前提（**Premise Gate — 需人确认**）

1. **P1：** 小程序壳在可见未来保持**浅色 + 品牌渐变头**，不与 `DESIGN.md` 默认深色舞台整页替换混为一谈；语义色（成功/警告/错误）仍用于订单/支付子流程页。
2. **P2：** 「我的」未登录用户**允许**查看费率说明（弱入口）或**必须登录后**才可见 — 影响 M1 信息架构。
3. **P3：** 买入/卖出订单在 V1 **共用** `orders` 页筛选即可，不在「我的」拆双独立列表（当前 `buy`/`sell` 均进 `orders` 已符合）。

---

## Phase 1 — CEO 评审（策略与范围）

### 0A 前提挑战

| 前提 | 评估 |
|------|------|
| 用户来「我的」首要是管订单与消息 | **成立** — 与 quick 三卡顺序一致 |
| 未登录与已登录应同一套宫格 | **不成立** — 造成「假可用」；应修正（UX-020） |
| 渐变头 = 对标稿唯一解 | **弱前提** — 可对齐但需 token 备案，避免与 DESIGN 语义红冲突到主按钮 |

### 0B 已有能力映射

- `GET /v1/me/profile`、`session`、`routes`、子页 `me-settings` / `me-feedback` / `me-address` / `rates-info` 已存在。
- TabBar `setTabBarSelected(4)` 已接。

### 0C 状态图（当前 → 本计划 → 理想）

`CURRENT`：双态头图 + 统一宫格 + 列表；错误 toast+页内。  
`THIS PLAN`：未登录收敛入口 + 错误体验对齐 + 生产登录分支。  
`12-MONTH`：统一订单中心角标、消息未读、钱包/结算、创作者中心（若产品定义）。

### 0D 模式

**SELECTIVE EXPANSION**：做 M1–M5，不扩卖家主页；对标稿大块 IA 记入 TODOS/对标报告。

### CEO 共识表（单评审员）

| 维度 | 结论 |
|------|------|
| 前提有效性 | 未登录宫格问题需修 |
| 问题是否值得现在做 | 是 — 上线前信任与合规 |
| 范围 | M1–M5 可 1 个 Sprint 内完成 |
| 替代方案 | 未登录仅 WebView 展示品牌 — **否决**（出口太弱） |

### NOT in scope

- 个人主页瀑布流、关注粉丝、等级体系。
- 深色模式全量换肤。

---

## Phase 2 — Design 评审（UI/UX）

**UI scope：** 是（整页布局、状态、层次）。

### 维度评分（0–10）与结论

| 维度 | 分 | 说明 |
|------|-----|------|
| 信息层次 | 6 | 已登录尚可；未登录时宫格抢戏 |
| 状态（loading/empty/error） | 7 | 缺 error 的 policy/trace 复制对齐 |
| 对标一致性 | 6 | 渐变头已有；多宫格分组与稿仍有差距 |
| 可访问性 | 6 | 需统一触摸目标与对比度抽检 |
| 与 DESIGN.md | 7 | 浅色壳例外已文档化；主 CTA 勿与争议/支付语义混用 |

### 必改项（自动采纳）

1. 未登录首屏 **单一主 CTA**（登录），次要链文字级。
2. 错误态文案与 **trace** 与全站列表页对齐。

### 味觉决项（合理分歧）

- **D1：** 未登录是否显示「费率与结算」— **建议保留** footer 级文字链，避免用户找规则无处可去；若合规要求隐藏则改 M1。

### Design litmus（单评审员）

| 检查项 | 结果 |
|--------|------|
| loading / error / 双登录态是否均有设计 | error 需增强；双态需分离宫格 |
| 是否指定空态 | 不适用（profile 无「空列表」） |

---

## Phase 3 — Eng 评审（工程）

### 架构

```
me.js ── request(/v1/me/profile) ── mapEnvelopeToError
     ├── session (dev)
     ├── routes (expo)
     └── navigate → orders | switchTab inbox/publish | subpages
```

无新分包需求；改动限于主包 `pages/me`。

### 测试计划（摘要）

| 路径 | 覆盖方式 |
|------|----------|
| profile 成功 / 失败 | 手测 + 可选 E2E（若已有 me 路径则补断言） |
| 未登录 UI | 手测 `is_logged_in: false` |
| 生产 `useWeChatSession` | 构建配置切换手测 |

**工件：** 本文件即计划；详细用例可抄入 `tests/` 或 `e2e` 若后续加 me 路由。

### 风险

- `showErrorToast` 与页内 error 重复 — **M3 修掉**。
- `onEntryTap` 默认 `onPlaceholder` — 新增 id 时勿漏分支。

### Eng 共识表（单评审员）

| 维度 | 结论 |
|------|------|
| 架构 | 合理，局部增量 |
| 测试 | 以手测 + smoke 为主；关键路径可后续 E2E |
| 安全 | 生产隐藏 dev ActionSheet（M4） |

---

## Decision Audit Trail

| # | Phase | Decision | Principle | Rationale |
|---|-------|----------|-----------|-----------|
| 1 | CEO | 未登录收敛宫格 | P1 完整性 | 消除假可用 |
| 2 | CEO | 不做人主页 | P2 范围 | 非本计划湖泊 |
| 3 | Design | 单主 CTA | 显式优于聪明 | 对标+DESIGN 单 CTA 规则 |
| 4 | Eng | 去重 toast | DRY | 与 inbox 一致 |
| 5 | Design | 费率未登录弱保留 | 务实 | 降低「黑盒平台」感；可被 P2 推翻 |

---

## Phase 4 — Final Approval Gate（给用户）

### 计划摘要

在现有渐变头 + 三快入口 + 宫格 + 列表骨架上，**优先修正未登录信息架构与错误体验**，并预留生产微信登录路径；小步对齐对标稿分组，不扩个人主页等大功能。

### 需要你拍板的前提（Premise Gate）

- **是否同意 P2：** 未登录用户能否看到「费率与结算」入口？（建议：**能**，为弱文字链）
- **是否同意 P1：** 继续接受浅色壳与 `DESIGN.md` 深色「双轨」说明？

### 味觉决项

- **D1：** 费率未登录可见 vs 登录后可见 — 见上。

### 自动决策汇总

见 **Decision Audit Trail**（5 条）。

### 下一步

1. 你确认 **P1 / P2 / D1** 后，可按 **M1→M3→M2→M4→M5** 顺序开发。  
2. 合并后更新 [小程序全页用户体验优化-backlog-单页汇总-2026-04-01.md](./小程序全页用户体验优化-backlog-单页汇总-2026-04-01.md)：**UX-020 → ✅**，并勾选 §五 相关项（若适用）。

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | /autoplan | 范围与前提 | 1 | 单评审员 | 未登录宫格必须收敛 |
| Design Review | /autoplan | 我的页为纯 UI 面 | 1 | 单评审员 | 错误态对齐全站；单主 CTA |
| Eng Review | /autoplan | 实现路径与测试 | 1 | 单评审员 | 主包增量；M4 生产分支 |
| Codex / Subagent | — | 环境未执行 | 0 | N/A | 无 |

**VERDICT：** 计划可执行 — 完成 **Premise Gate** 后即可进入开发。

---

## 实施记录（选项 A，2026-04-01）

已落地 M1–M5：`miniprogram/pages/me/me.js|wxml|wxss`、`me.json`（`enablePullDownRefresh`）。

- **M1 / UX-020：** 未登录仅头图 + 主登录按钮 +「平台说明」列表（费率、反馈）；已登录才显示 quick 三卡、分组宫格、账号与服务。
- **M2：** `FEATURE_GROUPS` — 交易与订单 / 发布与展出 / 帮助与反馈；`me-grid__cell--half` / `--full` 适配列数。
- **M3：** profile 失败不再 `showToast`；页内 `retryPolicy`、追踪 ID 与复制。
- **M4：** `globalData.useWeChatSession === true` 时 `onLoginTap` 走 `wx.login` → `/v1/auth/wechat-login` 并刷新 profile；已登录按钮文案「同步登录态」；否则保留原 ActionSheet。
- **M5：** quick 卡、宫格 cell、列表 cell 设 `min-height: 88rpx` 及 flex 对齐。
