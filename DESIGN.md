# Design System — Cos 小程序（交易 / 约妆 / 内容）

## Product Context

- **What this is:** 面向 Coser 的微信内交易与约妆服务，强调可信成交、档期确定性与轻内容转化。
- **Who it's for:** 高频出片/参展 Coser（买家侧）与可信卖家、认证妆娘（供给侧）。
- **Space/industry:** 二次元周边与本地服务撮合；竞品多为泛闲置或纯内容社区。
- **Project type:** 微信小程序（移动优先）+ 后端 API 支撑。

## Aesthetic Direction

- **Direction:** Retro-Futuristic + Editorial（舞台感 + 杂志排版，避免“通用 SaaS 模板”）
- **Decoration level:** intentional（少量颗粒/噪点纹理，不做大面积渐变装饰）
- **Mood:** 像在“剧场后台”一样：紧张、可靠、可预期；关键状态（支付/争议/档期）必须一眼读懂。
- **Reference sites:** 不适用直接照搬；以“漫展物料 + 独立杂志站点”气质为参照。

## Typography

- **Display/Hero:** Clash Grotesk — 标题需要舞台感与力量，但保持可读。
- **Body:** Instrument Sans — 清晰、现代、比 Inter 更少“模板感”。
- **UI/Labels:** 与 Body 同源，字重区分层级。
- **Data/Tables:** Geist（tabular-nums）— 金额、订单号、状态码对齐。
- **Code:** JetBrains Mono（仅管理/调试信息）。
- **Loading:** Google Fonts CDN（小程序内嵌字体需替换为合规来源，此处为设计与 Web 预览基线）。
- **Scale:** Display 22/26/32；Body 14/16；Meta 12；行高 1.35–1.5。

## Color

- **Approach:** balanced（主色克制，语义色承担状态沟通）
- **Primary:** `#E11D48` — 主行动（下单/支付/确认），与“舞台红”关联但不刺眼。
- **Secondary:** `#0EA5E9` — 信息/链接（档期说明、规则）。
- **Neutrals:** 背景 `#0B0F14` / 表面 `#111827` / 边界 `#1F2937` / 主文 `#F9FAFB` / 辅助 `#9CA3AF`
- **Semantic:** success `#22C55E`；warning `#F59E0B`；error `#FEE2E2` on `#7F1D1D`（文本对比满足 AA）；info `#38BDF8`
- **Dark mode:** 默认深色主题；浅色模式为后续扩展（当前单主题冻结）。

## Spacing

- **Base unit:** 4px
- **Density:** comfortable（列表与表单可读优先）
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48)

## Layout

- **Approach:** hybrid（首页转化优先，内容区可更编辑化）
- **Grid:** 移动 4 列基线；内容区最大宽度 720px（Web 预览/后台）
- **Max content width:** 720px（非全宽阅读）
- **Border radius:** sm 4px（输入）、md 8px（按钮）、lg 12px（卡片）、full 9999px（头像）

## Motion

- **Approach:** minimal-functional（状态变化可感知，不抢交易注意力）
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms)

## Anti-AI-Slop Guardrails

- 禁止首屏三列等权“功能卡片网格”。
- 禁止紫色渐变 + 大圆角 + 居中一切。
- 禁止并列主 CTA；每屏仅一个主行动。
- 卡片仅承载可转化对象，不做装饰容器。

## Day3–4 界面与状态（支付 / 回调同步 / 档期占位）

> 对齐 `docs/designs/autoplan-review-day3-4.md` 与工程计划中「支付可见性」「档期占位」UX 契约；实现小程序页时以本节为真源。

### 支付发起 → 调起微信收银台

- **层级：** 页内顶部一条 **状态条**（surface 背景 + 左边框 3px 用 `semantic-info` 或 `primary`，不要用整块渐变底）。
- **金额行：** 使用 **Data/Tables** 字体栈 + `tabular-nums`；货币符号与金额同一行，主文色；小数位固定两位。
- **主 CTA：** 单一按钮文案「确认支付」或「去支付」，**Primary** `#E11D48`；禁用态降低透明度 + `cursor`/小程序 `hover-class` 不抢戏。
- **副信息：** 托管/定金说明用 **Meta 12** + `辅助` 色；不与主 CTA 并列同级按钮。

### 支付结果页（轮询 / 同步中）

状态顺序必须可感知，**禁止**把「失败」与「处理中」混用同一视觉权重。

| 状态 | 文案示例 | 视觉 |
|------|----------|------|
| 处理中 | 支付结果同步中… | 状态条用 **info**；可配 **短** `linear` 进度条（高度 2–3px，duration 中等），禁止全屏 loading 遮罩超过 2 秒无说明 |
| 成功 | 支付成功 | **success** semantic + 一句下一步（进入履约/查看订单） |
| 超时/可疑 | 支付结果确认超时 | **warning** + 主操作「查看订单」+ 次要「联系客服」；展示 `trace_id` 用 **Code** 字体 Meta 级、可复制 |
| 重复已同步 | 支付结果已同步 | **info**，低打扰；单按钮「返回订单详情」 |

### 档期占位（短 TTL，约 2 分钟）

- **倒计时：** 数字用 **Display** 档级之一（22–26），**tabular-nums**；剩余 &lt;30s 时数字与边框用 **warning**，避免静音灰（用户必须感到紧迫）。
- **过期：** 全宽提示条（warning 或 error 语义）+ 单一主行动「重新选择时段」；**禁止**仅 toast 无回流路径。
- **布局：** 占位与选档同页时，倒计时贴在时段卡片下方 **md** 间距；不另做三列功能网格。

### 动效与无障碍

- 状态切换用 **short** duration；支付处理中避免 **expressive** 循环动画。
- 关键状态变化（成功/失败/超时）需有 **文案 + 颜色** 双编码，不单靠颜色。

## Day5–6 界面与状态（争议 / 证据 / SLA / 结算）

> 对齐 `docs/designs/autoplan-review-day5-6.md` 与工程计划中「争议可见性」「账本可审计」UX 契约；实现小程序页时以本节为真源。

### 争议中心与时间线

- **结构：** 纵向时间线，节点含 **时间 + 用户可读状态标签**（与 `unified_orders` / 状态字典对外文案一致）；最新节点视觉权重最高。
- **禁止黑盒：** 不得仅展示「处理中」而无下一预期节点或说明；待平台/对方动作时须写明「等待××处理」类副本。
- **当前争议摘要：** 页顶可用 **状态条**（surface + 左边框 3px，**primary** / **warning** / **info** 择一，与 Day3–4 状态条语法一致），避免整屏渐变底。

### SLA（`sla_due_at`）

- **未到期：** 倒计时用 **Display**（22–26）+ **tabular-nums**；剩余时间进入「紧迫区间」（如 &lt;24h，具体阈值产品配置）时数字与左边框用 **warning**。
- **已逾期：** **error** 或 **warning**（全站统一一种）；文案含「已超过处理时限」或等价表述；主行动「补充证据 / 联系客服」二选一为 **Primary**，另一路为次要文字按钮。
- **一致性：** 展示时间与后端 `sla_due_at` 一致，禁止前端杜撰倒计时。

### 发起争议与非法状态（`DISPUTE_INVALID_STATE`）

- **入口：** 仅当订单状态允许时，主 CTA「发起争议」可用；否则按钮 **禁用** 且附 **一行** Meta 级说明（非 toast）。
- **错误态：** 全宽 **error/info** 说明条 + 单一主行动「查看争议流程说明」或返回订单详情；与 `errorUxMap` 主按钮语义一致。

### 证据上传

- **列表：** 每条展示：类型（`evidence_type` → 固定中文标签）、提交时间、缩略图或文件图标；长 ID / hash 用 **Code** + Meta 字号。
- **过程态：** 上传中 — 行内进度或骨架；失败 — **error** 条 + 「重试」主按钮；成功 — 进入列表，避免仅「成功」toast 无列表刷新。
- **约束预告：** 体积上限、允许类型在按钮上方 **Meta 12** 一次说清。

### 结算账本（订单内摘要）

- **摘要区：** 展示最近 **3–5** 条 `settlement_ledger` 事件；金额用 **Data/Tables** + `tabular-nums`；正负用语义色区分（入账/冲正/扣款按字典定义，至少保证「进/出」不仅靠符号）。
- **事件名：** `event_type` 必须映射为 **短中文标签**，禁止直接把枚举字符串给用户。
- **`balance_after`：** 若展示，与金额列对齐；无数据时显示「—」，禁止用 `0` 冒充未计算。

### 结算任务与重试耗尽（`SETTLEMENT_RETRY_EXHAUSTED`）

- **处理中：** **info** 条「结算处理中…」+ 可选 2–3px 线性进度；禁止 &gt;2s 全屏 loading 无说明。
- **重试耗尽：** **warning** 主条 + 主按钮「打开订单结算明细」（对齐 `errorUxMap`）；次要「联系客服」；`trace_id` 用 **Code**、可复制 — 与 Day3–4 支付超时路径同一套「可追踪」交互。

### 动效与无障碍

- 争议与结算节点切换使用 **short** duration；禁用喜庆/娱乐化动效。
- 所有争议/结算结果态：**文案 + 颜色** 双编码；色觉辅助：不单独用红绿区分进/出，配 **↑↓** 或「收入/支出」文字。

## Day7–8 界面与状态（内容详情 / 转化卡 / 同城核销）

> 对齐 `docs/designs/autoplan-review-day7-8.md` 与 `errorUxMap` 中 `CONTENT_CARD_TARGET_INVALID`、`LOCAL_VERIFICATION_*`；小程序实现时以本节为真源。

### 内容详情页（作品 / 图文）

- **首屏主行动：** 有可用转化卡时，**仅一个主 CTA**（如「去购买」/「查看商品」），**Primary**；配文与次要信息用 **Body / Meta**，不与主 CTA 抢同级按钮。
- **无可用转化卡：** 主 CTA 降级为「浏览更多内容」或返回 feed（**secondary** 文字链或单一 **info** 条说明），**禁止**展示灰掉但仍像可点的假按钮。
- **图片区：** 最大宽度遵循 **720px** 内容区；加载用 **short** skeleton，避免空白跳变。

### 转化卡（列表 / 单卡）

- **可用：** 卡片为 **lg** 圆角表面，左侧或顶部可放缩略图；价格用 **Data/Tables** + `tabular-nums`；整卡可点，hover/active 用 **short** 反馈。
- **不可用**（接口 `available: false`，如 `item_not_listed` / `item_removed`）：卡片 **置灰 + 降低对比**，附 **一行 Meta** 说明（如「商品已下架」）；**禁止**整卡仍可跳转下单；可提供次要链「看看作者其他作品」。
- **`CONTENT_CARD_TARGET_INVALID`：** 全宽 **info** 或 **warning** 条（对齐 `errorUxMap`「关联内容已失效」）+ 主按钮「浏览其他可购内容」；`trace_id` 若出现沿用 Day3–4 **Code** + 可复制规则。

### 同城核销（买家出示码 / 卖家输入码）

- **状态条语法：** 与 Day3–4 一致（surface + 左边框 3px），按语义色区分：
  - **待核销（`PENDING` / 已发码未兑）：** **info** + 文案「请将核销码出示给卖家」；码展示用 **Display** 档 + **tabular-nums** 或等宽分区（易读、易念）。
  - **已过期（`EXPIRED`）：** **warning**；主操作「重新生成核销码」（若业务允许）或「联系对方」；对齐 `LOCAL_VERIFICATION_EXPIRED`。
  - **核销成功（`COMPLETED`）：** **success** + 一句下一步「订单已更新为已发货」或等价。
  - **次数锁死（`FAILED` / `LOCAL_VERIFICATION_LOCKED`）：** **error** 或 **warning**（全站二选一，与 SLA 逾期一致）；主按钮「返回订单详情」，次要「联系客服」。
- **卖家输入码：** 输入框 **Body 16px+**；错误时 **行内或紧邻** 说明，不用单独 toast 糊弄；`LOCAL_VERIFICATION_INVALID` 用 **warning** 条 +「核对后重试」主操作。
- **重复提交（幂等已兑）：** **info** 低打扰，单按钮「返回订单详情」— 与支付「已同步」同权重。
- **无障碍：** 成功/失败/过期须 **文案 + 颜色** 双编码；不单独用红绿表示成败。

### 动效与无障碍

- 核销状态切换 **short** duration；禁止庆祝式动效。
- 与 Day3–6 相同：**禁止**首屏三列功能卡网格承载核销说明；核销说明用 **状态条 + 单一主行动**。

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-26 | Initial DESIGN.md baseline | Cos 交易/约妆场景；深色舞台感 + 可信语义色；与 `/plan-design-review` 临时 token 对齐并升级 |
| 2026-03-26 | Day3–4 支付/占位界面与状态条（/design-consultation × autoplan-review-day3-4） | 把 `autoplan-review-day3-4` 通过标准落到可实现的 UI 规范，避免支付页模板化与状态混淆 |
| 2026-03-26 | Day5–6 争议/证据/SLA/结算界面（/design-consultation × autoplan-review-day5-6） | 落实 autoplan Design 硬要求：时间线 + SLA 可感知、证据与账本可读、重试耗尽与错误码 UX 一致 |
| 2026-03-26 | Day7–8 内容/转化卡/同城核销界面（/design-review × autoplan-review-day7-8） | 补齐全局 DESIGN 真源：转化卡降级、核销状态与 `LOCAL_VERIFICATION_*` / `CONTENT_CARD_TARGET_INVALID` 一致 |
