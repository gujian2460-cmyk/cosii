# /autoplan — 五 Tab 页面内容与布局决策

**生成日期：** 2026-03-26  
**仓库：** cosii（微信小程序 `miniprogram/`）  
**真源对齐：** 根目录 [DESIGN.md](../../DESIGN.md)、[miniprogram-ui-shell-spec.md](./miniprogram-ui-shell-spec.md)（§6–7、§12）、[autoplan-review-ui.md](./autoplan-review-ui.md)  

本文在 autoplan **6 条自动决策原则**下，对「每 Tab 放什么、如何排版」给出**可实施拍板**；未再跑 Codex/子代理时记为 **`[single-model]`**。

> **§14 与代码对齐状态（2026-03-27）：** 下列 §14 中关于「订单列表无后端 API」「消息用订单列表映射」等表述曾为评审落盘时的真值，现已由实现覆盖：`GET /v1/me/unified-orders`（含 `order_type` / `status` / cursor）、`GET /v1/me/unified-orders/:id`、`GET /v1/trade/orders/:id`、`GET /v1/me/notifications`、小程序 `subPackages` 与 `config/routes.js`。**执行层以 [CLAUDE.md](../../CLAUDE.md) 与仓库路由为准**；§14 保留分阶段工程建议时，勿再当作「当前缺口」。

---

## 0. 全局前提（已采纳）

| # | 前提 | 说明 |
|---|------|------|
| 1 | **转化优先** | 首页服务「成交」，不是内容信息流优先（与 autoplan CEO 一致）。 |
| 2 | **订单详情 = 状态真源** | Tab「订单」内列表仅摘要；完整时间线、支付态、争议 SLA 在 **订单详情页**（未来分包）。 |
| 3 | **消息仅提醒 + 深链** | 不在消息里复制完整时间线；点击进订单详情或订单 Tab。 |
| 4 | **每屏单一主 CTA** | 遵守 DESIGN Anti-AI-Slop；禁止两个实心主按钮并列。 |
| 5 | **MVP Tab 顺序** | 固定 **Buyer 顺序**（与当前 `app.json` 一致）：首页 → 发布 → 订单 → 消息 → 我的。 |
| 6 | **视觉 token** | 颜色/圆角/字号以 DESIGN.md 为准；实现用 `app.wxss` 变量（见 shell spec §3）。 |

---

## 1. 关键产品决策（原 §12.8 未决项 — 本文拍板）

### 1.1 首页主 CTA：「逛在售」vs「约妆娘」

**决定：** **Primary =「逛在售」**；**「约妆娘」= secondary 文字链**（可附一行 Meta 说明）。

**理由（CEO / 完整性）：** 实物交易链路更标准化、更易与现有 E2E「交易链」对齐；约妆涉及档期占位与定金，实现波次靠后。secondary 仍保留入口，不牺牲供给侧心智。

**若日后数据证明约妆是主诉求：** 仅交换主按钮与文字链角色，**不得**并列双主按钮。

### 1.2 Tab 顺序

**决定：** MVP **固定 Buyer 顺序**；不在首版做 `tabBar` 动态重排。

**理由：** 微信对运行时改 `tabBar` 有限制，且增加测试面；卖家可把「发布」当作第二高频，通过首页与订单内 CTA 补偿。

---

## 2. 五 Tab 总览

| Tab | 路由 | 第一屏用户任务 | 唯一主 CTA（首屏） |
|-----|------|----------------|-------------------|
| 首页 | `pages/home/home` | 建立信任 → 进入交易或约妆 | **逛在售** |
| 发布 | `pages/publish/publish` | 选择发布类型 | **二选一卡片整卡可点**（见 §4 说明） |
| 订单 | `pages/orders/orders` | 查看进行中的交易/服务 | 有单时无全页主按钮；空态时 **去首页逛逛** |
| 消息 | `pages/inbox/inbox` | 扫一眼提醒 → 跳进订单 | 无全页主按钮；行点击即深链 |
| 我的 | `pages/me/me` | 账户/规则/设置 | 无全页主按钮；列表导航 |

**说明：** 「发布」页两个卡片是**两个不同任务入口**，不是同一决策下的双主 CTA；视觉上用 **单列大卡片**（非三列等权网格），符合 DESIGN。

---

## 3. 首页（`pages/home/home`）

### 3.1 模块清单（自上而下）

1. **Hero 顶区** — 产品名（Display）+ 一句价值（Meta/Body）。
2. **信任状态条** — `surface` + 左边框 3px（`info` 或 `secondary`）；一句托管/档期/真源说明。
3. **主转化区** — 实心 Primary：**逛在售**；其下 **文字链**：约妆娘 + Meta hint。
4. **次级入口** — **单列** 或 **横向 scroll-view**（二选一实现）：「热门装扮」「认证妆娘」等，行高 ≥88rpx，右侧 chevron。
5. **轻内容（可选）** — 最多一行 Meta：「内容推荐占位（P2）」；有数据前可隐藏。
6. **开发探活条（可开关）** — Meta + 可选 `trace_id`（selectable）；上线前可 `wx:if` 关掉或仅开发版显示。

### 3.2 布局线框（ASCII）

```
┌──────────────────────────────────────┐
│ Cosii                    (Display)    │
│ 可信成交 · 约妆与闲置     (Meta)      │
├──────────────────────────────────────┤
│┃ 资金托管与档期占位…      (状态条)    │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │        逛在售  (Primary)        │  │
│  └────────────────────────────────┘  │
│  约妆娘  (Secondary 文字链)           │
│  （档期与定金…）         (Meta)       │
├──────────────────────────────────────┤
│ 热门装扮                        ›    │
│ 认证妆娘                        ›    │
├──────────────────────────────────────┤
│ 内容推荐占位（P2）       (Meta)      │
├──────────────────────────────────────┤
│ API 探活…  trace: xxx    (Dev)       │
└──────────────────────────────────────┘
```

### 3.3 状态

| 状态 | 表现 |
|------|------|
| LOADING | 骨架：Hero + 状态条 + 按钮区三行灰块；≤2s 须有文案 |
| 主列表区 EMPTY | 次级区可隐藏或显示「即将开放」；主 CTA 仍保留 |
| `/health` ERROR | toast + 探活条 copy（已实现逻辑可保留） |
| 有推荐数据（P2） | 单卡片预览，整卡可点进内容详情分包 |

### 3.4 后续跳转（分包，非本页）

- **逛在售** → `packages/trade` 商品列表（或 WebView 过渡）。
- **约妆娘** → `packages/booking` 妆娘列表/搜索。
- **热门/妆娘行** → 对应列表筛选态（query 参数）。

---

## 4. 发布（`pages/publish/publish`）

### 4.1 模块清单

1. **页头说明** — Body：「选择发布类型」。
2. **卡片 A** — 发布商品：标题 + Meta（闲置/装备）；**整卡可点**。
3. **卡片 B** — 发布作品：标题 + Meta（图文 + 转化卡）；**整卡可点**。

**禁止：** 两个并列 **实心** Primary 按钮；当前用 **surface 卡片** 区分于首页主按钮，符合「卡片承载可转化对象」。

### 4.2 布局线框

```
┌──────────────────────────────────────┐
│ 选择发布类型（MVP 占位）   (Body)     │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ 发布商品                          │ │
│ │ 闲置 / 装备上架        (Meta)    │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ 发布作品                          │ │
│ │ 图文内容 + 转化卡    (Meta)      │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### 4.3 状态

| 状态 | 表现 |
|------|------|
| LOADING | 整页骨架两块卡片 |
| 子流程 ERROR | toast + `error.user_title`；不栈内丢失返回路径 |

### 4.4 后续跳转

- **发布商品** → 分包 `trade` 表单页（类目、价格、图、物流方式）。
- **发布作品** → 分包 `content` 发帖 + 挂卡。

---

## 5. 订单（`pages/orders/orders`）

### 5.1 模块清单（MVP → 完整）

**MVP（当前）：**

1. **空态** — 标题 + Meta 说明（状态真源）+ Primary **去首页逛逛**。

**有数据后：**

1. **顶栏筛选（可选 P1）** — Segmented：全部 / 交易中 / 约妆；或下拉筛选。
2. **列表** — 每行：**类型标签**（交易/约妆）+ **短标题** + **状态 pill**（语义色）+ **金额**（tabular-nums）+ **更新时间**（Meta）。
3. **行点击** → **订单详情**（分包，带 `orderType` + `orderId` / `unifiedOrderId`）。

**禁止：** 在列表行内放「确认收货」等强动作（避免误触）；强动作放在详情页 + DESIGN 单主 CTA。

### 5.2 布局线框（有数据）

```
┌──────────────────────────────────────┐
│ [ 全部 | 交易中 | 约妆 ]   (可选)    │
├──────────────────────────────────────┤
│ 交易  某某假发  待发货    ¥199       │
│       更新于 12:30       (Meta)      │
├──────────────────────────────────────┤
│ 约妆  妆娘A 周六下午    定金已付     │
│       更新于昨天         (Meta)      │
└──────────────────────────────────────┘
```

### 5.3 状态（与 shell spec §12.3 一致）

| 状态 | 表现 |
|------|------|
| LOADING | 列表骨架 3–5 行 |
| EMPTY | 当前实现保留 |
| ERROR | 状态条 + 重试 |
| PARTIAL | 分页失败：底部「加载失败 — 重试」 |

---

## 6. 消息（`pages/inbox/inbox`）

### 6.1 模块清单

1. **顶栏说明** — Meta 一行：提醒用途 + 非时间线真源。
2. **消息列表** — 每行：标题（如「支付结果已更新」）+ 副文案（订单号后四位 / 类型）+ 时间（Meta）+ chevron。
3. **行点击** → `navigateTo` **订单详情**（推荐）或 `switchTab` 订单 Tab 并带全局事件（次优）。

**MVP 占位：** 保留一行示例卡片 + 「暂无更多消息」。

### 6.2 布局线框

```
┌──────────────────────────────────────┐
│ 仅作提醒与深链，不复制完整时间线 (Meta)│
├──────────────────────────────────────┤
│ 支付结果已更新              ›        │
│ 订单 …7821 · 刚刚           (Meta)   │
├──────────────────────────────────────┤
│ 暂无更多消息              (空态)     │
└──────────────────────────────────────┘
```

### 6.3 状态

| 状态 | 表现 |
|------|------|
| LOADING | 列表骨架 |
| EMPTY | 插图 + 「暂无消息」+ 文字链「去订单看看」 |
| 点击 | 必须可达订单详情或订单 Tab |

---

## 7. 我的（`pages/me/me`）

### 7.1 模块清单

1. **头部卡片** — 头像 + 昵称（未登录则「点击登录」为 **唯一主行动** 于该卡片内）+ Meta（认证/信誉摘要）。
2. **列表区** — 费率与结算说明；设置；后续可加「我的发布」「我的妆娘主页」。
3. **底部安全区** — `safe-area-inset-bottom`。

**费率说明：** 二级页展示即可，不上首页（CEO 已共识）。

### 7.2 布局线框

```
┌──────────────────────────────────────┐
│ ┌──────────────────────────────────┐ │
│ │ [头像]  昵称 / 未登录               │ │
│ │ 认证妆娘 · 信誉（即将接入）(Meta) │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ 费率与结算说明                    ›  │
│ 设置                              ›  │
│ （P2：我的发布 / 我的订单快捷）       │
└──────────────────────────────────────┘
```

### 7.3 状态

| 状态 | 表现 |
|------|------|
| 未登录 | 头部主按钮「微信登录」或占位 + 设置仍可达（若允许） |
| 已登录 | 展示角色标签（买家/卖家/妆娘）|
| LOADING | 头部骨架 |

---

## 8. 工程与分包映射（Eng 摘要）

```text
Tab 页（主包 pages/*）
  ├── 首页 ──► packages/trade/list, packages/booking/entry
  ├── 发布 ──► packages/trade/publish-form, packages/content/post-edit
  ├── 订单 ──► packages/*/order-detail（统一详情壳 + orderType）
  ├── 消息 ──► 同上 order-detail（query: from=inbox）
  └── 我的 ──► 二级页 rates / settings / login
```

- **统一订单详情**建议接收 `unifiedOrderId` 或与后端一致的复合键，避免两套 UI。
- **请求**一律走 `utils/api.js`（见 [miniprogram-ui-shell-spec §13](./miniprogram-ui-shell-spec.md)）。

---

## 9. 交互状态矩阵（五 Tab 速查）

| Tab | LOADING | EMPTY | ERROR | 主成功态 |
|-----|---------|-------|-------|----------|
| 首页 | 骨架 | 次级区可缩 | 探活/请求失败 toast | 展示 Hero + CTA |
| 发布 | 骨架 | — | toast | 两卡片可点 |
| 订单 | 骨架 | 去首页 | 条+重试 | 列表 |
| 消息 | 骨架 | 文案+链 | toast | 列表 |
| 我的 | 头部骨架 | — | toast | 头部+列表 |

细则与 **slop 边界** 见 [miniprogram-ui-shell-spec §12](./miniprogram-ui-shell-spec.md)。

---

## 10. NOT in scope（本决策文档）

- 具体 API 字段与分页参数（随对接文档补）。
- 浅色/Playful 视觉改版（若做须先改 DESIGN.md）。
- TabBar 动态排序、完整推荐流首屏。

---

## 11. Decision Audit Trail（autoplan 自动决策摘要）

| # | 决策 | 原则 | 摘要 |
|---|------|------|------|
| 1 | 首页 Primary = 逛在售 | P1 完整性 / 交易闭环 | 与 E2E 主链一致；约妆 secondary |
| 2 | Tab 顺序固定 Buyer | P5 显式 / P3 务实 | 与当前 `app.json` 一致 |
| 3 | 发布页用双卡片非双主按钮 | P4 DRY + DESIGN | 不同任务入口，单列卡片 |
| 4 | 订单列表不放强动作 | P1 状态真源 | 动作进详情页 |
| 5 | 消息深链订单详情 | CEO 前提 | 不复制时间线 |
| 6 | 费率进「我的」二级 | CEO 共识 | 不上首页 |

---

## 12. 实现对照（当前仓库）

与 [miniprogram/pages/](../miniprogram/pages/) 现状对比：**首页、发布、订单列表（含类型/状态筛选与分页）、消息（独立通知 API）、我的、分包路由** 已与本文 **大体一致**；后续以体验打磨为主（图片上传、真机登录、档期列表 API 等），不再以「缺列表/通知 HTTP 接口」为阻塞项。

---

**文档路径：** `docs/designs/autoplan-five-tabs-pages-layout.md`  

若你采纳本文，可在 [miniprogram-ui-shell-spec.md](./miniprogram-ui-shell-spec.md) 的 Decisions Log 增加一行引用本文件（可选）。

---

## 14. `/plan-eng-review` — 评审结论与**代码怎么写**

**评审对象：** 本文 §0–§12（五 Tab 内容与布局）。  
**分支假设：** `main`。  
**设计输入：** 仓库内 [cos-miniapp-office-hours-design.md](./cos-miniapp-office-hours-design.md)；`~/.gstack/projects/cosii/*-design-*.md` 可为空。  
**双模型：** 未跑 Codex/子代理 — **`[single-model]`**。

### 14.1 Step 0 — 范围与现有代码

| 检查项 | 结论 |
|--------|------|
| 子问题与已有能力 | 后端已有单订单查询、支付、争议等；**已具备**「当前用户统一订单列表」`GET /v1/me/unified-orders`、单条摘要 `GET /v1/me/unified-orders/:id`、交易详情 `GET /v1/trade/orders/:id`、站内通知 `GET /v1/me/notifications`（历史缺口见 14.6 附录）。 |
| 最小交付 | 主包五 Tab + **分包**（`app.json` `subPackages`）+ 上述 API 已贯通；后续为增量能力而非「首通 API」。 |
| 复杂度 | 单波若同时加 4 个分包 + 列表 API + 详情壳，易超 8 文件 — **按 14.9 分阶段**。 |
| DRY | 所有 `wx.request` **禁止**；统一 [miniprogram/utils/api.js](../../miniprogram/utils/api.js)。 |
| 分发 | 小程序上传/审核不在本文展开；CI 可对 `miniprogram` 做语法检查（可选）。 |

**MODE:** `FULL_REVIEW`（不缩减 Tab 数，只缩减**实现波次**）。

### 14.2 架构 — 导航与目录

**主包只放 Tab 页**；任何「详情 / 表单 / 支付结果」进分包，控制主包体积与审核边界。

```text
miniprogram/
  app.js app.json app.wxss
  utils/api.js
  config/routes.js          ← 建议新增：路径常量，避免字符串散落
  pages/{home,publish,orders,inbox,me}/
  packageTrade/             ← subPackage root（名称示例，与 app.json 一致即可）
    pages/list/list
    pages/order-detail/order-detail
    ...
  packageBooking/
  packageContent/
```

**`app.json` 要点：**

- `pages` 数组 **仅** 保留现有 5 个 Tab 路径（顺序与 TabBar 一致）。
- 增加 `subPackages`，每项 `root` + `pages`；详情页 URL 示例：`/packageTrade/pages/order-detail/order-detail?unifiedOrderId=xxx&from=inbox`。

**路由跳转约定（代码里写死结构，用常量拼接 query）：**

| 场景 | API | 路径 |
|------|-----|------|
| Tab 切换 | `wx.switchTab` | 仅 `pages/*` |
| 进分包详情 | `wx.navigateTo` | `/packageTrade/pages/order-detail/...` |
| 从消息进同一详情 | 同上 | `query` 加 `from=inbox` 便于埋点/返回栈 |

### 14.3 代码组织 — 每页怎么写（模式）

**通用 Page 结构（推荐）：**

```js
// 伪代码结构 — 每个 Tab 对齐
Page({
  data: {
    loading: true,
    error: null,       // { userTitle, traceId } 或 null
    // ...页面专有字段
  },
  async onLoad() { await this.refresh(); },
  async onShow() { /* 若需每次可见刷新，再调 refresh，注意与 loading 闪烁平衡 */ },
  async refresh() {
    this.setData({ loading: true, error: null });
    const res = await request({ path: "...", method: "GET" });
    if (!res.ok) {
      this.setData({ loading: false, error: mapEnvelopeToError(res.envelope) });
      showErrorToast(res.envelope);
      return;
    }
    this.setData({ loading: false, /* items from res.data */ });
  },
});
```

**`mapEnvelopeToError`**：可放在 `utils/errors.js`，从 `envelope` 抽出 `user_title`、`trace_id`，供 WXML 状态条展示（与 DESIGN 一致）。

**WXML 分层（与布局文档一一对应）：**

1. `wx:if="{{loading}}"` → 骨架块（占位 `view` + 灰背景 class）。
2. `wx:elif="{{error}}"` → 状态条 + 单一「重试」按钮 `bindtap="refresh"`。
3. `wx:else` → 正文。

**禁止：** 在 WXML 里写死长错误文案；展示 `error.userTitle` 或服务端 `error.user_title`。

### 14.4 按 Tab 的落地清单（对照 §3–§7）

#### 首页 `pages/home/home`

| 模块 | 怎么写 |
|------|--------|
| Hero / 信任条 / CTA | 已是静态 + class；保持 **一个** `button` primary，约妆用 `view` + `tap` 或 `text` 可点击区域（≥88rpx 高）。 |
| 探活 | 保留 `request({ path: "/health", userId: null })`；生产用 **编译宏或 `globalData.showDevProbe`** 隐藏底部 trace 条。 |
| 逛在售 | `onPrimaryCta`: 分包就绪后 `wx.navigateTo({ url: ROUTES.tradeList })`；未就绪前可保留 toast。 |
| 约妆 | `onSecondaryLink`: `navigateTo` booking 入口分包。 |
| 次级行 | `wx:for="{{secondaryRows}}"`，`data-*` 传 hint 或 `filter` key；`bindtap` 统一 `onSecondaryTap`。 |
| LOADING | `onLoad` 首帧设 `loading: true`，health 返回后 `false`；骨架用独立 `view` 块。 |

#### 发布 `pages/publish/publish`

| 模块 | 怎么写 |
|------|--------|
| 两卡片 | 保持 `view.cos-card` + `bindtap`；**不要**改成两个 `button type="primary"`。 |
| 跳转 | `onPublishTrade` → `navigateTo` 分包表单页；`onPublishPost` → content 分包。 |

#### 订单 `pages/orders/orders`

| 模块 | 怎么写 |
|------|--------|
| 空态 | 已有 `empty` + `goHome` + `switchTab` — **符合** §5。 |
| 有数据 | `scroll-view` 或页面滚动 + `wx:for="{{orders}}"`；每行 **一个** `bindtap` → `navigateTo` 详情，参数带 `unifiedOrderId`（或 `orderType`+`domainOrderId`，与后端一致）。 |
| 筛选 P1 | 顶部 `view` 模拟 segmented，`data-filter` + `setData({ activeFilter })`；`refresh` 里把 filter 传给列表 API。 |
| 金额 | class `cos-tabular`（WXSS 里 `font-family` 等宽 + `font-variant-numeric: tabular-nums`）。 |
| **禁止** | 行内 `确认收货` 等 — 仅详情页 + DESIGN 单主 CTA。 |

#### 消息 `pages/inbox/inbox`

| 模块 | 怎么写 |
|------|--------|
| 列表 | `wx:for="{{notifications}}"`；字段建议：`title`, `subtitle`, `time`, `unifiedOrderId`。 |
| 点击 | **优先** `wx.navigateTo` 订单详情（与 §6 一致）；若详情页未上线，可临时 `switchTab` 订单 Tab（次优）。 |
| 空态 | `wx:if` 无数据时展示 §6.2 文案 + `navigator` 样式文字链「去订单看看」`switchTab`。 |

#### 我的 `pages/me/me`

| 模块 | 怎么写 |
|------|--------|
| 头部 | 未登录：`button open-type="getPhoneNumber"` 或微信登录流程（产品定）；登录后 `setData({ nickname, avatarUrl })`。 |
| 列表 | 继续 `cell` + `bindtap`；`onRates` / `onSettings` → `navigateTo` 分包或主包二级页（费率内容静态可先本地页）。 |

### 14.5 代码质量 — DRY 与显式

1. **新建 `miniprogram/config/routes.js`**（或 `.ts` 若未来迁 TS）：
   - 导出 `TRADE_LIST`, `ORDER_DETAIL`, `BOOKING_ENTRY` 等字符串常量。
2. **错误处理：** 封装 `showErrorToast` 已够用；列表页额外要 **页内 error 条** 时，用同一 `envelope` 解析函数。
3. **2xx 非 envelope：** `api.js` 在 `ok: false` 时若 `body` 非对象，建议在 `showErrorToast` 前统一成合成对象（与 HTTP_ERROR 同级），避免页面判型分支爆炸。

### 14.6 订单列表与通知 API — **已实现**（原「关键缺口」归档）

**当前实现（与代码一致）：**

- `GET /v1/me/unified-orders?limit=&cursor=&order_type=&status=` — 买家/卖家可见统一订单摘要列表；小程序订单 Tab 已联调（含 `order_type` / `status` 筛选与触底分页）。
- `GET /v1/me/unified-orders/:unifiedOrderId` — 单条摘要。
- `GET /v1/trade/orders/:tradeOrderId` — 闲置订单详情（买卖家校验）。
- `GET /v1/me/notifications` — 站内通知列表（非订单列表映射）；消息 Tab 已切换数据源。

**历史（截至 2026-03-26 评审落盘）：** 曾阻塞 §5「有数据态」的仅为「缺统一订单列表 HTTP 接口」— **已关闭**。

**Mock：** `globalData.useMockOrders` 仍可用于本地演示；生产构建须禁用（见 go-live 与工程卫生评审）。

### 14.7 测试 — 覆盖图（与本文相关部分）

```
CODE PATH
  utils/api.request
    ├── 2xx + OK     [★★] 首页 /health 手测
    ├── 2xx + !OK    [GAP] 需后续对列表 API 错误态手测 / 抽 parse 单测
    ├── 4xx/5xx      [★★★] 已在 api.js 处理 — 建议加 Vitest 测 parse（若抽离纯函数）
    └── fail         [★★] 手测飞行模式

USER FLOW
  订单列表 → 详情     [★★] API 已具备；小程序运行时 E2E 仍以 `smoke:miniprogram` + 手测为主，Playwright 覆盖 HTTP 主链
  消息 → 详情         [★★] 通知 API + 深链参数已具备；全路径小程序自动化可后补 miniprogram-automator
```

**工件：** 手测清单延续 [eng-review-test-plan-miniprogram.md](./eng-review-test-plan-miniprogram.md)；列表/详情联调通过后补具体路径。

### 14.8 性能

- 列表：`setData` 一次传 **整页** `orders` 数组；超长再切片或后端分页。
- 图片：商品缩略图 `lazy-load`；`mode="aspectFill"` 固定宽高防 CLS。
- 首页：避免 `onShow` 每次打 `/health`；可缓存上次结果 + TTL（如 30s）。

### 14.9 推荐实现顺序（减少并行爆炸）

| 阶段 | 做什么 | 涉及文件量级 |
|------|--------|----------------|
| **A** | `config/routes.js` + 首页/订单/消息 **骨架 loading + error 模板** 统一 | **完成** |
| **B** | 后端 `GET` 列表 + 订单 `wx:for` + 触底分页 | **完成** |
| **C** | 分包 `order-detail`：拉 trade/统一订单详情 | **完成**（路径见 `config/routes.js`） |
| **D** | 发布表单分包、在售列表、`POST /v1/trade/items`；消息走 `user_notifications` | **完成**（持续迭代字段与上传） |

### 14.10 NOT in scope（工程评审）

- 微信支付 UI 皮肤自定义（跟微信组件走）。
- 小程序 CI 真机矩阵。

### 14.11 What already exists

- [miniprogram/utils/api.js](../../miniprogram/utils/api.js)、[config/routes.js](../../miniprogram/config/routes.js)、[utils/session.js](../../miniprogram/utils/session.js)（开发期身份覆盖）。
- 五 Tab + `subPackages` 与 [app.json](../../miniprogram/app.json)。
- 后端 envelope；`GET /v1/me/unified-orders`、`GET /v1/me/notifications`、trade/booking/content 相关路由（[CLAUDE.md](../../CLAUDE.md)）。

### 14.12 Failure modes（摘）

| 风险 | 缓解 |
|------|------|
| 列表 API 未上就写死假数据 | 用 `empty` + feature flag，禁止合并到生产构建 |
| 详情参数不统一 | 全栈只用 `unifiedOrderId` 或文档化双键映射层 |
| `switchTab` 无法带 query | 消息进详情 **必须** `navigateTo` 分包 |

### 14.13 Completion summary

| 项 | 值 |
|----|-----|
| Step 0 | 接受分阶段；列表依赖新 API |
| Architecture | 1 个结构性建议（分包 + routes 常量） |
| Code quality | 2（DRY 常量文件；envelope 非对象收紧） |
| Test | 列表/详情为 GAP；api 可抽测 |
| Performance | 3 条建议，非阻塞 |
| Critical gap | ~~订单列表无后端接口~~ **已解决**（2026-03-27）；剩余为生产身份与运维治理（见 `docs/go-live-checklist.md`） |
| Outside voice | skipped |

### 14.14 建议写入 TODOS.md 的一条（可选）

- ~~**P1 — `GET /v1/me/unified-orders`**~~ **已完成。** 后续可选：档期列表 `GET`、真机微信登录、图片上传 CDN、小程序自动化加深。

---

**评审落盘：** 本节即 `/plan-eng-review` 对 `autoplan-five-tabs-pages-layout.md` 的执行层输出；与 [miniprogram-ui-shell-spec.md §13](./miniprogram-ui-shell-spec.md) 互补（§13 偏客户端 HTTP 语义，§14 偏页面实现与后端缺口）。
