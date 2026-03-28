# Cos 微信小程序 — UI 壳实现规格

**文档类型：** 实现蓝图（工程可照着搭脚手架与首屏）  
**视觉与交互真源：** 根目录 [DESIGN.md](../../DESIGN.md) — 本文不重复定义语义色用途与 Day3–8 长表；支付、占位、争议、内容、核销等页面行为 **一律引用 DESIGN 对应章节**。  
**关联评审与计划：** [autoplan-review-ui.md](./autoplan-review-ui.md)、[autoplan-ui-test-plan-20260326.md](./autoplan-ui-test-plan-20260326.md)、工程计划 [eng-implementation-plan-cos-miniapp.md](./eng-implementation-plan-cos-miniapp.md)（Tab 与 IA）、[TODOS.md](../../TODOS.md) P「微信小程序工程（UI 壳）」。

---

## 1. 前言

### 1.1 读者与用途

- **前端实现：** 目录结构、`app.json`、全局 WXSS token、请求封装与错误展示约定。
- **设计走查：** 对照 DESIGN.md 与本文「线框」验收首屏与 Tab 壳，不通过则视为偏离真源。

### 1.2 与后端契约

- API 前缀：`/v1`（见 [CLAUDE.md](../../CLAUDE.md)）。
- 响应信封：`code`、`message`、`data`、`trace_id`；错误时另有 `error.user_title`、`error.primary_action`、`error.retry_policy` 等（见 [src/shared/api-envelope/index.ts](../../src/shared/api-envelope/index.ts)）。

---

## 2. 技术选型

| 方案 | 结论 |
|------|------|
| **首期默认** | **微信原生小程序**（WXML + WXSS + TS）。支付、授权、审核路径耦合最低。 |
| **备选** | Taro / uni-app：仅当团队有强约束且接受构建链路与微信能力对齐成本（见 autoplan-review-ui CEO 0C-bis）。 |

**注：** 仓库若当前为 `app.js` 等 **JS** 入口，仍属「原生栈」；TS 为可选增强。目录与 token 约定不因 JS/TS 而变。

本文后续 API 与目录均以 **原生** 为例。

---

## 3. 设计 Token → 小程序落地

所有颜色以 DESIGN.md「Color」为准；实现时 **禁止** 在业务页随手写新 hex（语义例外须在设计决策中备案）。

### 3.1 建议 `app.wxss` CSS 变量

小程序基础库 2.9.0+ 支持页面级变量；可在 `app.wxss` 根选择器定义：

| 变量名 | 值（来自 DESIGN） | 用途 |
|--------|-------------------|------|
| `--color-bg` | `#0B0F14` | 页面背景 |
| `--color-surface` | `#111827` | 卡片、状态条底 |
| `--color-border` | `#1F2937` | 分割线、描边 |
| `--color-text` | `#F9FAFB` | 主文 |
| `--color-text-muted` | `#9CA3AF` | 辅助、说明 |
| `--color-primary` | `#E11D48` | 主 CTA、强调 |
| `--color-secondary` | `#0EA5E9` | 信息、文字链 |
| `--color-success` | `#22C55E` | 成功语义 |
| `--color-warning` | `#F59E0B` | 警告语义 |
| `--color-error-bg` | `#7F1D1D` | 错误条背景 |
| `--color-error-text` | `#FEE2E2` | 错误条文字 |
| `--color-info` | `#38BDF8` | 信息语义 |

TabBar、导航栏背景建议使用 `--color-surface` 或 `--color-bg`，与 DESIGN 深色舞台感一致。

### 3.2 rpx 与间距

- 设计基准：**750 宽** 与微信 rpx 一致；**comfortable** 密度下，可将 DESIGN 的 px 近似为 **`rpx = px × 2`**（以 375px 逻辑宽为参考），上线前在真机校验 1–2 台机型。
- **间距 Scale（DESIGN）：** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) — 单位 px，转 rpx 按上式。

### 3.3 圆角（DESIGN Layout）

| Token | px | 用途 |
|-------|-----|------|
| sm | 4 | 输入框 |
| md | 8 | 按钮 |
| lg | 12 | 卡片 |
| full | 9999 | 头像 |

### 3.4 字体策略（合规优先）

| 角色 | DESIGN 指定 | 小程序落地 |
|------|-------------|------------|
| Display/Hero | Clash Grotesk | 使用微信允许的自托管 woff2 / 官方字体包；**若不可用**：`SF Pro Display`（iOS）/`HarmonyOS Sans`（鸿蒙）/`Roboto`（Android 降级）— 保持字重对比，勿用系统默认无层次。 |
| Body / UI | Instrument Sans | 同上；降级：**PingFang SC** / **Noto Sans SC** |
| Data/Tables | Geist tabular-nums | 降级：**SF Mono** / **Droid Sans Mono** — **金额、订单号必须等宽或 `font-variant-numeric: tabular-nums`**（WXSS 支持有限时用固定宽度字体兜底）。 |
| Code / trace_id | JetBrains Mono | 降级：系统 monospace；**仅用于 trace、调试展示**（DESIGN Day3–4）。 |

**字号档位（DESIGN Scale）：** Display 22/26/32；Body 14/16；Meta 12；行高 1.35–1.5。小程序用 `rpx` 书写（如 32rpx≈16px 量级，需按机型微调）。

### 3.5 反 AI Slop（必须遵守）

直接执行 [DESIGN.md](../../DESIGN.md) **Anti-AI-Slop Guardrails** 与工程计划 **Reject pattern**：禁止首屏三列等权功能卡网格、紫色渐变主视觉、并列双主 CTA、纯装饰卡片墙。

---

## 4. 信息架构：五 Tab

与工程计划一致：

| Tab | 名称 | 核心职责 |
|-----|------|----------|
| 1 | 首页 | 转化优先：信任 + **单一主 CTA** |
| 2 | 发布 | 供给侧：商品 / 作品内容发布入口 |
| 3 | 订单 | 交易单 / 约妆单列表；**状态真源** |
| 4 | 消息 | 支付 / 改期 / 仲裁等提醒；**深链进订单，不复制完整时间线** |
| 5 | 我的 | 认证、信誉、设置；**费率/结算说明入口（不必上首页）** |

### 4.1 Persona 与 Tab 顺序

工程计划建议：

- **Buyer：** 首页 → 订单 → 消息 → 发布 → 我的  
- **Seller/Artist：** 首页 → 订单 → 发布 → 消息 → 我的  

**MVP 建议：** 首版 **固定一种顺序**（例如按 Buyer），减少登录前动态重排成本；**二期** 按 `role` 或本地配置切换 `tabBar` 顺序（需验证微信对 `tabBar` 动态限制）。

---

## 5. 导航壳（TabBar + 页面树）

### 5.1 `app.json` 要点

- **`tabBar`：**  
  - `backgroundColor`：`#111827`（surface）  
  - `borderStyle`：`black` 或与边界色协调  
  - `color`：`#9CA3AF`（辅助）  
  - `selectedColor`：`#E11D48`（primary，与主 CTA 一致）  
- **图标：** 线性、2px 量级笔画，选中态可用 **primary** 填色或加粗，保证在深色底上对比度足够（WCAG 图标对比尽量 AA）。

### 5.2 建议目录（与后端域对齐）

```
miniprogram/
  app.js / app.json / app.wxss
  config/routes.js
  utils/api.js …
  pages/
    home/           # Tab 首页
    publish/        # Tab 发布
    orders/         # Tab 订单列表
    inbox/          # Tab 消息
    me/             # Tab 我的
  packageTrade/     # 与 app.json subPackages.root 一致（非下文历史示例 packages/）
  packageBooking/
  packageContent/
```

**命名说明（2026-03-27）：** 仓库实际为 `packageTrade`、`packageBooking`、`packageContent`，在 `app.json` 的 `subPackages` 中声明。上文若写作 `packages/trade/` 仅为域对齐示意，**以实现目录 + `app.json` 为准**。

### 5.3 安全区

- 底部 Tab 区：使用 `env(safe-area-inset-bottom)` 垫高，避免与 Home Indicator 重叠。
- 顶部：自定义导航时预留 `statusBarHeight` + 导航栏高度。

---

## 6. 首页线框（转化优先）

以下为 **信息层级线框**（非视觉稿）；实现时必须满足 DESIGN「单主 CTA」与状态条语法。

```
┌─────────────────────────────────────┐
│ 顶区（左对齐或杂志式分栏，禁止通栏居中堆砌）   │
│  · 产品名 / 一句价值（Display 档）           │
├─────────────────────────────────────┤
│ 信任区（状态条语法）                         │
│  · surface 底 + 左边框 3px（info/secondary）│
│  · 一行：托管/担保/可信成交（Body/Meta）     │
├─────────────────────────────────────┤
│ 主转化区                                     │
│  · [唯一 Primary 按钮] 例：逛在售 / 约妆娘   │
│  · 次要入口仅为文字链 Secondary（同级按钮禁）│
├─────────────────────────────────────┤
│ 次级区（单列或横向滑动，禁止三列等权网格）     │
│  · 入口：分类 / 热门 / 妆娘（简化图标+文案）  │
├─────────────────────────────────────┤
│ 轻内容（可选，P2 加深）                       │
│  · 最多 1 条 feed 预览占位                   │
└─────────────────────────────────────┘
```

**首版主 CTA 二选一：** 产品需在「逛在售」与「约妆娘」中定一个默认 Primary；另一个降为 **secondary 文字链**，不得并列两个实心主按钮。

**加载 / 空态：**

- 列表区：`short` duration 骨架（DESIGN Motion）；参见工程计划交互矩阵「首页商品区」：skeleton → 空态「暂无可购」+ 去发布。
- 禁止无文案的全屏 loading 超过 2 秒（与 DESIGN 支付处理一致的精神）。

---

## 7. 各 Tab MVP 占位（首版）

| Tab | MVP 内容 |
|-----|----------|
| **发布** | 列表两项：「发布商品」「发布作品（内容）」→ 占位页或跳转空壳；说明后续接 API。 |
| **订单** | 空列表 + 插图/文案 + **单一主操作**「去首页逛逛」；强调订单详情为状态真源（autoplan 前提 3）。 |
| **消息** | 空态或静态示例一行：点击跳转 **订单详情**（带 `orderId` 参数）；**不**在消息内嵌完整时间线。 |
| **我的** | 头像昵称占位、「认证状态」「设置」；**费率/结算说明** 入口放此页二级（CEO：不必首屏）。 |

---

## 8. 统一请求层与 Envelope

### 8.1 响应解析

1. HTTP 2xx 后解析 JSON。
2. 若 `code === "OK"`（或项目约定的成功码）：取 **`data`** 为业务载荷。
3. 否则为业务错误：读取 `code`、`message`、`trace_id`、`error` 对象。

类型定义以 [src/shared/api-envelope/index.ts](../../src/shared/api-envelope/index.ts) 为准（`SuccessEnvelope` / `ErrorEnvelope`）。

### 8.2 错误展示与映射

- **禁止** 在页面写死与后端不一致的错误长文案。
- **优先** 使用服务端下发的 `error.user_title`、`error.primary_action`、`error.retry_policy`（由后端 [getErrorUx](../../src/shared/errors/ux-map.ts) 注入）。
- 前端可维护 **一份与 `errorUxMap` 同步的 JSON**（构建时从 TS 导出或 CI 校验），用于极端情况下服务端未带 `error` 字段时的兜底。

### 8.3 `trace_id`

- 展示场景：支付超时 / 可疑状态、结算重试耗尽等（见 DESIGN Day3–4、Day5–6）。
- **样式：** Code 字体 + Meta 字号、**可复制**（`selectable` 或长按复制）。
- **禁止** 向用户展示内部 stack 或密钥。

### 8.4 开发 / 生产鉴权

- 开发期：后端可能使用 `X-User-Id`（见 [CLAUDE.md](../../CLAUDE.md)）；请求封装统一加 header。
- 生产：替换为微信登录态与后端 session / token 约定（不在本文展开）。

---

## 9. 全局组件基线（MVP 最小集）

下列组件需在组件库或 `components/` 中 **各实现一份可复用样式**，行为细节以 DESIGN 为准：

| 组件 | 引用 |
|------|------|
| **状态条** | DESIGN Day3–4：surface + 左边框 3px，语义色边 |
| **主按钮** | Primary `#E11D48`，md 圆角，单一主行动 |
| **转化卡** | DESIGN Day7–8：可用/不可用态、禁止假按钮 |
| **骨架屏** | Motion short，避免布局跳动 |
| **金额行** | Data 字体栈 + tabular-nums + 两位小数 |

---

## 10. 实现里程碑与验收

### 10.1 里程碑（对齐 autoplan-review-ui 0E）

| 阶段 | 目标 |
|------|------|
| Hour 1–8 | 小程序脚手架、全局 token（app.wxss）、TabBar 五页壳、首页线框静态可演示 |
| Day 2–5 | 商品/档期列表与详情、下单页雏形；对接 mock 或真实 `/v1` |
| Week 2+ | 支付结果页、订单时间线、消息深链、争议 SLA（按 DESIGN 分节实现） |

### 10.2 验收勾选项（交叉测试计划）

与 [autoplan-ui-test-plan-20260326.md](./autoplan-ui-test-plan-20260326.md) 对齐，包括但不限于：

- 首页首屏 **仅一个主 CTA**。
- 支付相关：**处理中 / 成功 / 超时** 视觉权重不混用（DESIGN Day3–4）。
- 约妆冲突：`BOOKING_SLOT_CONFLICT` 对用户展示为「时段已被占用」类映射，与 [ux-map](../../src/shared/errors/ux-map.ts) 一致。
- 订单详情为状态真源；消息仅深链。

工程初始化后，将实际上传命令、用例路径补入该测试计划文档「缺口」一节。

---

## 11. Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-26 | 新增本文档 `miniprogram-ui-shell-spec.md` | 落实 TODOS P1：五 Tab + 首页线框 + token + envelope；审美与规则从属 DESIGN.md 与 autoplan UI 评审 |
| 2026-03-26 | `/plan-design-review` 补全 IA / 状态 / 旅程 / a11y / 未决项 | 将 autoplan 中约 8.5/10 的弱项落到可实施规格，减少实现期拍脑袋 |

---

## 12. `/plan-design-review` 补全（实施前必读）

> **计划真源说明：** 本仓库无单独 Cursor plan 文件；UI 实施计划 = **本文** + [autoplan-review-ui.md](./autoplan-review-ui.md) + 根目录 [DESIGN.md](../../DESIGN.md)。本节把设计评审要求的缺口写回「计划」，实现时以本节与 DESIGN 为准。

### 12.1 Step 0 — 设计覆盖度（自评）

- **初评：** 约 **7.5/10**（token、IA、首页线框、信封层强；缺「逐 Tab 状态矩阵」、无障碍量化指标、导航流 ASCII、与 slop 清单的显式对齐说明）。
- **10/10 对本计划意味着：** 每个 Tab 的 loading/empty/error/success/partial 有文案与主操作；触摸与对比度可验收；主导航与用户关键路径有一屏一屏的层级说明；未决产品决策单独列表，不混在实现里。
- **评审范围：** 全文 7 个维度均已补齐到本节（未单独跑 Codex / 子代理 — 环境无 `codex` 时记为 `[single-model]`）。

### 12.2 Pass 1 — 信息架构（层级与导航）

**首屏自上而下（首页 Tab）：** ① 顶区（品牌/价值，Display）→ ② 信任状态条 → ③ **唯一** Primary CTA → ④ 次级入口（横向滑动或单列，禁止三列等权）→ ⑤ 可选轻内容一条。

**主导航（TabBar）：** 五 Tab 平级；**订单详情、支付结果、争议页等** 不进 TabBar，走 `wx.navigateTo` 进分包页面，返回栈回 Tab。

**导航流（ASCII）：**

```text
[Tab: 首页] --主CTA--> [分包: 列表/详情/支付...]
[Tab: 订单] --------> [分包: 订单详情] <--深链-- [Tab: 消息]
[Tab: 发布] --------> [占位 | 分包: 发布表单]
[Tab: 我的] --------> [二级: 设置 | 费率说明]
```

### 12.3 Pass 2 — 交互状态覆盖（按 Tab / 场景）

以下为 **用户可见** 规约；后端行为见 CLAUDE.md 与各模块测试。

| 场景 | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL |
|------|---------|-------|-------|---------|---------|
| 首页主列表/预览 | 骨架屏（short），附一句「加载中」可选 | 单一说明 + **一个**主操作（如「去发布」/「刷新」） | 顶部或中部 **状态条** + `error.user_title` + 主按钮（对齐 ux-map） | 内容展示 | 仅部分模块有数据时：有数据区正常渲染，无数据区走 EMPTY 规约 |
| 订单列表 | 骨架或行内 loading | 插图/文案 + 主操作「去首页逛逛」 | 同上 | 列表渲染 | 分页加载更多失败：底部 toast + 「重试」 |
| 订单详情（真源） | 骨架 + 禁止空白超过 2s 无说明 | 极少见；展示「找不到订单」+ 返回列表 | 状态条 + trace 可复制（若适用） | 时间线/状态完整展示 | 轮询支付中：见 DESIGN Day3–4「处理中」条，禁止与失败态同权重 |
| 消息列表 | 骨架 | 空态文案 + 引导去订单或首页 | 同上 | 列表；点击行 **仅深链** 订单详情 | — |
| 发布入口页 | — | 两入口卡片清晰即可 | 子页请求失败时同 ERROR 规约 | — | — |
| 我的 | 头像/昵称可骨架 | 未登录：登录引导 + 单一主 CTA | 同上 | 展示认证/设置入口 | — |
| 全局 `wx.request` | 请求级 loading 仅在有阻塞操作时（避免每请求全屏） | — | **优先** 服务端 `error.*`；无则 code 映射表兜底 | — | 超时：文案区分「网络不稳」与「业务拒绝」 |

### 12.4 Pass 3 — 用户旅程与情绪（摘要故事板）

| Step | 用户做什么 | 目标情绪 | 计划如何支撑 |
|------|------------|----------|----------------|
| 1 | 打开小程序落在首页 | 「靠谱、不花哨」 | 信任条 + 单主 CTA，避免信息流抢转化 |
| 2 | 点主 CTA 进入交易/约妆 | 「下一步清晰」 | 每屏单一主行动；次级为文字链 |
| 3 | 支付等待 | 「知道在发生什么」 | DESIGN 处理中/成功/超时分层；trace 可复制 |
| 4 | 出争议或改期 | 「没被丢进黑盒」 | 订单详情时间线 + SLA；消息只提醒不深拷贝时间线 |
| 5 | 复访 | 「状态一致」 | 以服务端状态为准；禁乐观改支付/结算展示 |

### 12.5 Pass 4 — AI Slop 风险与显式例外

- 继续遵守 DESIGN **Anti-AI-Slop** 与本文 §3.5。
- **与外部「slop 黑名单」的边界：** 部分通用清单将「卡片左侧彩色竖条」列为模板特征；**本产品设计中的「状态条」（surface + 左边框 3px 语义色）是功能组件，用于信任/支付/争议可见性，不是装饰性三列功能卡。** 实现时须满足：全宽条、单一信息任务、**禁止**与「三列图标+标题+描述」网格组合出现。

### 12.6 Pass 5 — 设计系统对齐

- 所有颜色、圆角、字号、动效 **以 [DESIGN.md](../../DESIGN.md) 为唯一真源**；本文 §3 变量表随 DESIGN 变更而更新。
- **主题变更纪律：** 若产品改为浅色/Playful 等新方向，须 **先改 DESIGN.md**（含 Day3–8 中「主文色/表面色」引用），再同步本文 §3 与 `app.json` tabBar 色；禁止仅在小程序页局部改 hex 造成与 DESIGN 双真源。

### 12.7 Pass 6 — 响应式与无障碍（小程序可验收项）

| 项 | 规约 |
|----|------|
| 触摸目标 | 主按钮与 Tab 图标点击区域 **≥ 88rpx** 高（约 44px 物理像素量级，以真机为准）；列表行主操作同理。 |
| 对比度 | 主文与背景对比遵循 WCAG AA；**错误条** 沿用 DESIGN error 组合（已按 AA 描述）。 |
| 读屏 / 语义 | 关键按钮 `aria-role` 可用则用；图片设 `alt` 文案；**订单状态** 不只靠颜色，须配合图标或文案（与 DESIGN「双编码」一致）。 |
| 动态字体 | 用户系统字号放大时，允许折行；**金额行** 仍保持 tabular-nums / 等宽字体优先。 |

### 12.8 Pass 7 — 未决设计决策（实现前需产品拍板）

| 决策 | 若搁置的后果 |
|------|----------------|
| 首页默认 Primary：「逛在售」vs「约妆娘」二选一 | 实现可能并列双主按钮 → **违反** DESIGN |
| MVP Tab 顺序固定 Buyer 还是 Seller | 影响默认路径与验收用例 |
| 浅色/活泼向视觉是否替换当前深色 DESIGN | 双真源漂移；需一次 DESIGN.md 改版 |

### 12.9 NOT in scope（UI 壳阶段）

- 复杂推荐首页、完整动效系统、多主题换肤（与 autoplan-review-ui 一致）。
- 小程序外 H5/App 同构。

### 12.10 What already exists（复用）

- [DESIGN.md](../../DESIGN.md)（含 Day3–8 状态与组件语法）
- [src/shared/api-envelope/index.ts](../../src/shared/api-envelope/index.ts)、[src/shared/errors/ux-map.ts](../../src/shared/errors/ux-map.ts)
- [autoplan-ui-test-plan-20260326.md](./autoplan-ui-test-plan-20260326.md)

---

## 13. `/plan-eng-review` 工程评审（微信客户端）

> **设计输入：** `~/.gstack/projects/cosii/*-design-*.md` 当前为空时，以仓库内 [cos-miniapp-office-hours-design.md](./cos-miniapp-office-hours-design.md) + 本文 + [eng-implementation-plan-cos-miniapp.md](./eng-implementation-plan-cos-miniapp.md) 为准。

### 13.1 Step 0 — 范围与挑战

| 问题 | 结论 |
|------|------|
| 已有后端是否覆盖计划子问题？ | 是 — `src/modules/*` + envelope + E2E 四条链已存在；小程序为 **薄客户端**。 |
| 达成「可演示壳 + 首屏探活」的最小变更？ | 维持五 Tab + `utils/api` + 首页 `/health`；分包与业务页按里程碑增量加入。 |
| 复杂度 | 首阶段 &lt;8 文件；完整交易 UI 才会触达 eng 计划中的多页 — 接受分阶段。 |
| 分发 | 小程序走微信审核与上传；CI 中增加「构建检查」可选，**非**本迭代阻塞项。 |

**MODE:** `FULL_REVIEW`（对「客户端层」做完整评审；不重复评审已锁定的后端表结构）。

### 13.2 架构（客户端 ↔ `/v1`）

```text
[miniprogram/pages/*]  wx.request
        |  HTTPS + JSON
        v
[Fastify /v1/*]  ->  envelope { code, message, data, trace_id, error? }
```

- **单一请求出口：** 业务页 **必须** 经 [miniprogram/utils/api.js](../../miniprogram/utils/api.js)（或后续抽成的 `services/*`），禁止页面内散落 `wx.request`（DRY、与 [CLAUDE.md](../../CLAUDE.md) 一致）。
- **鉴权：** 开发期 `X-User-Id`；生产期在 `api.js` 统一换为 session/token（计划项，未实现前禁止在页面硬编码 header 逻辑）。

### 13.3 代码质量 — 已记录问题与处置

| # | 问题 | 处置 |
|---|------|------|
| 1 | `wx.request` 的 `success` 在 **HTTP 4xx/5xx** 时仍回调，若仅按 `body.code === "OK"` 会误判 | **已修：** `statusCode` 非 2xx 时走 `ok: false`；无 JSON 信封时合成 `HTTP_ERROR` 展示 copy |
| 2 | `showErrorToast` 在非对象 `envelope` 时可能异常 | **已修：** 入口校验类型 |
| 3 | 分包目录与 **§5.2** | **已落地（2026-03-27）** — `app.json` 已声明 `subPackages`（`packageTrade` / `packageBooking` / `packageContent`），含列表、订单详情、发布表单等页；与 [CLAUDE.md](../../CLAUDE.md) 小程序节一致。 |

### 13.4 测试 — 覆盖图与缺口

**自动化：** 仓库现有 **Vitest + Playwright** 覆盖 **HTTP API**（见 [eng-review-test-plan.md](./eng-review-test-plan.md)），**不覆盖** 小程序 WXML 运行时。

**小程序专项测试计划：** [eng-review-test-plan-miniprogram.md](./eng-review-test-plan-miniprogram.md)（供 `/qa`、发版前手测与后续 miniprogram 自动化接入）。

**CODE PATH（客户端）**

```text
utils/api.request
  ├── success + 2xx + code OK     -> [★★ 需集成测] 首页 onLoad /health 手测已覆盖主路径
  ├── success + 2xx + code !OK    -> [GAP] 需单测或自动化：错误 toast 与 trace 展示
  ├── success + 4xx/5xx + JSON    -> [★★★ 已修] 须回归：mock 503 见 error 条
  ├── success + 4xx/5xx + 非 JSON -> [GAP] 合成 HTTP_ERROR 文案
  └── fail（网络）                -> [★★] 合成 NETWORK_ERROR
```

**建议下一迭代（可选）：** 抽 `parseEnvelope(res)` 纯函数到 `utils/envelope.js`，用 **Node + Vitest** 测表格分支（无需跑微信运行时）。

### 13.5 性能（小程序）

- 列表页：**长列表** 再考虑递归组件 / 虚拟列表；MVP 订单量少时可 `setData` 整页。
- 图片：`lazy-load` + 合理 `mode`；首屏避免多张大图同步解码。
- 请求：同一 `onShow` 避免重复瀑布 — 合并或可取消进行中的 request（后续订单列表需要）。

### 13.6 NOT in scope（本轮 eng 评审）

- 自建网关、替换微信原生支付链路、多端同构框架迁移。
- 小程序 CI 真机矩阵（可后续加）。

### 13.7 What already exists（复用）

- 后端 envelope、`ux-map`、四条 Playwright 主链、`verify:gates` / `verify:ready`。
- [miniprogram/utils/api.js](../../miniprogram/utils/api.js)（本轮已加固 HTTP 语义）。

### 13.8 失败模式速查

| 场景 | 测试？ | 处理？ | 用户可见？ |
|------|--------|--------|------------|
| 503 + JSON fail envelope | E2E API 有；小程序需手测/单测 parse | `ok: false` + toast | 是 |
| 502 HTML | [GAP] | 合成 HTTP_ERROR | 是 |
| 断网 | 手测 | NETWORK_ERROR | 是 |
| 2xx 但 body 非 envelope | [GAP] | `envelope: body` 可能怪异 | 可能含糊 — 后续收紧校验 |

---

## 后续可选

- 在 [TODOS.md](../../TODOS.md) P1 **Ref** 中增加本文路径，便于从待办一键跳到实现规格。
- UI freeze 前：在 DESIGN.md 或单独 `components.md` 扩写按钮/输入/列表细则（autoplan Design 已标为不阻塞 MVP）。
