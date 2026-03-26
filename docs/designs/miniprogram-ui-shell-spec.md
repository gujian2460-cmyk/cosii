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
  app.ts
  app.json
  app.wxss
  pages/
    home/           # Tab 首页
    publish/        # Tab 发布
    orders/         # Tab 订单列表
    inbox/          # Tab 消息
    me/             # Tab 我的
  packages/         # 可选分包
    trade/          # 商品详情、下单、支付结果
    booking/        # 档期、占位、定金
    dispute/        # 争议、证据
    content/        # 作品、转化卡
```

路径名可按团队习惯微调；**原则**是 feature 与 `src/modules/*` 域一致，便于联调。

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

---

## 后续可选

- 在 [TODOS.md](../../TODOS.md) P1 **Ref** 中增加本文路径，便于从待办一键跳到实现规格。
- UI freeze 前：在 DESIGN.md 或单独 `components.md` 扩写按钮/输入/列表细则（autoplan Design 已标为不阻塞 MVP）。
