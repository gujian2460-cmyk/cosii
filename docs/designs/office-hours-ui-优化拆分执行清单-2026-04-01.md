# 《Cosii 小程序 UI 优化拆分执行清单（Office Hours）》

> 来源文档：`docs/designs/office-hours-ui-optimization-report-2026-04-01.md`  
> 目标：把“建议”拆成可直接排期与执行的 backlog。  
> 范围：全小程序页面（主包 + 分包）。

## 一、执行原则

1. 先闭环，再美化：优先修“点击无落地、状态不可读、错误不可恢复”。
2. 一次只改一条主路径：每个任务必须有可验证用户收益。
3. 每项任务都要有验收标准：避免“看起来改了，用户无感”。

---

## 二、任务总表（按优先级）

| ID | 优先级 | 任务 | 影响页面 | 负责人建议 | 预估工时 |
|---|---|---|---|---|---|
| UX-001 | P0 | 商品详情页真实落地（替换 itemId toast） | `buy-search`、`packageTrade/list`、新增详情页 | FE + BE | 1.5-2.5 天 |
| UX-002 | P0 | 修正“费率与结算说明”错误跳转 | `pages/me/me` | FE | 0.5 天 |
| UX-003 | P0 | 发布接妆“假成功”改为明确占位语义（V1） | `pages/publish/publish` | FE + 产品 | 0.5 天 |
| UX-004 | P1 | 搜索页区分“请求失败”和“无结果” | `pages/search/search` | FE | 0.5 天 |
| UX-005 | P1 | 订单状态文案用户化映射 | `pages/orders/orders`、`packageTrade/order-detail` | FE | 0.5-1 天 |
| UX-006 | P1 | 订单详情补“下一步行动”主 CTA | `packageTrade/order-detail` | FE + 产品 | 1 天 |
| UX-007 | P1 | 我的页错误态补“重试”与服务入口真实落地 | `pages/me/me` | FE | 0.5-1 天 |
| UX-008 | P2 | 统一“立即购买/立即下单”文案 | `buy`、`search`、`packageTrade/list` | FE + 产品 | 0.5 天 |
| UX-009 | P2 | 首页/漫展 mock 标识与入口可点化 | `home`、`recent-expo`、`expo` | FE + 运营 | 1 天 |
| UX-010 | P2 | 买入口收敛策略评审与灰度方案 | 信息架构层面 | 产品 + FE | 1 天（方案） |

---

## 三、按迭代拆分（建议）

## Sprint A（闭环必做，优先上线）

### A1. 商品详情落地（UX-001）
- 目标：用户点任意商品卡片都进入真实详情，不再弹“即将接入”。
- 涉及：
  - `miniprogram/pages/buy-search/buy-search.js`
  - `miniprogram/packageTrade/pages/list/list.js`
  - 新增详情页（建议在 `packageTrade/pages/item-detail/`）
- 验收：
  - 买&搜、在售列表点击卡片均可进入详情页。
  - 详情页至少包含：标题、价格、分类、主按钮、返回列表。

### A2. 修正费率入口（UX-002）
- 目标：`我的 -> 费率与结算说明` 不再跳到 booking 下单入口。
- 涉及：
  - `miniprogram/pages/me/me.js`
  - 新增说明页（或 webview 路由）
- 验收：
  - 点击后进入“费率说明”内容页，语义一致。

### A3. 发布接妆占位语义修正（UX-003）
- 目标：在接妆发布 API 未就绪前，不制造“已成功发布”的误解。
- 涉及：
  - `miniprogram/pages/publish/publish.js`
  - `miniprogram/pages/publish/publish.wxml`
- 验收：
  - 接妆发布点击后显示明确文案：“功能开发中/内测占位”。
  - 不再 toast “发布成功”。

### A4. 搜索错误态修复（UX-004）
- 目标：网络错误不再显示成“暂无结果”。
- 涉及：
  - `miniprogram/pages/search/search.js`
  - `miniprogram/pages/search/search.wxml`
- 验收：
  - 断网或接口失败时显示错误态 + 重试。
  - 仅有真实无结果时显示“暂无结果”文案。

---

## Sprint B（体验提升）

### B1. 订单状态用户化（UX-005）
- 目标：用户 3 秒内读懂订单状态。
- 涉及：
  - `miniprogram/pages/orders/orders.js`
  - `miniprogram/packageTrade/pages/order-detail/order-detail.js`
- 验收：
  - 列表与详情均显示中文状态标签（如待支付/处理中/已完成/已取消）。
  - 不直接暴露机器枚举值。

### B2. 订单详情主 CTA（UX-006）
- 目标：详情页给出明确下一步动作。
- 涉及：
  - `miniprogram/packageTrade/pages/order-detail/order-detail.wxml`
  - `miniprogram/packageTrade/pages/order-detail/order-detail.js`
- 验收：
  - 不同状态至少有一个可执行主按钮。
  - 主按钮行为可落地（即便是暂时跳转，也要语义正确）。

### B3. 我的页服务能力补齐（UX-007）
- 目标：“设置/反馈/地址管理”不再纯 toast 占位。
- 涉及：
  - `miniprogram/pages/me/me.js`
  - 新增对应页面骨架
- 验收：
  - 三个入口均有实际页面承接。
  - profile 请求失败可重试。

---

## Sprint C（一致性与信息架构）

### C1. 文案一致化（UX-008）
- 目标：下单相关按钮文案统一。
- 验收：
  - 全站统一为一套术语（例如都用“立即下单”或“立即购买”）。

### C2. 首页/漫展信任感增强（UX-009）
- 目标：减少“看起来像真数据，实际是 mock”的误导。
- 验收：
  - mock 区块有示例标识，或接入真实接口。
  - 首页轮播可点击并有明确落地页。

### C3. 买入口收敛方案（UX-010）
- 目标：降低用户“该去哪买”的认知成本。
- 产物：
  - 一页 IA 决策：保留入口、移除入口、跳转关系、灰度策略。

---

## 四、可直接分配到人的任务卡模板

## 任务卡（示例）
- **任务ID**：UX-004  
- **任务名**：搜索页错误态修复  
- **目标用户收益**：网络失败时用户能明确知道“系统出错”而不是“没结果”。  
- **改动文件**：`pages/search/search.js`、`pages/search/search.wxml`  
- **完成定义**：
  1. 请求失败显示错误态与重试；
  2. 请求成功且空数据才显示“暂无结果”；
  3. 冒烟测试通过。  
- **风险**：低  
- **回滚方式**：恢复原分支逻辑

---

## 五、验收清单（发布前）

- [ ] 关键点击链路无“即将接入”断点（至少核心买卖路径）
- [ ] 订单状态均为用户可读中文
- [ ] 搜索页错误态与空态已分离
- [ ] 我的页一级入口都有落地页
- [ ] `npm run smoke:miniprogram` 通过

---

## 六、建议的本周执行顺序（最短路径）

1. UX-002（费率跳转修正）  
2. UX-004（搜索错误态修复）  
3. UX-003（接妆发布语义修正）  
4. UX-001（商品详情落地）  
5. UX-005（订单状态中文化）

做到这 5 项，用户感知会明显提升。

