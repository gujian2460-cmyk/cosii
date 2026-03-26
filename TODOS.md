# TODOS

## P3 - 直播/短视频带货模块（已确认延后）

- **What:** 增加直播与短视频内容带货能力。
- **Why:** 在完成交易与约妆闭环后，作为高上限增长渠道。
- **Pros:** 活动期流量爆发强，提升曝光和转化上限。
- **Cons:** 内容运营、审核和风控成本显著上升。
- **Context:** 当前阶段优先“可信成交与履约”；直播模块不阻塞首期 PMF 验证。
- **Effort:** XL（human） -> L（CC）
- **Depends on:** 稳定供给侧、内容审核体系、基础转化漏斗稳定。

## P1 - 上线前冻结 3 项支付/履约规则

- **What:** 在首个可上线版本前，冻结三项规则：抽成分层、定金/托管并行策略、履约凭证标准。
- **Why:** 这三项直接决定数据表、状态机和结算逻辑，若开发中途变更会产生高成本返工。
- **Pros:** 防止反复改表与迁移；提升联调与测试稳定性。
- **Cons:** 需要前置产品与运营协同，短期决策压力变大。
- **Context:** 外部审视指出“未决=0”与关键开放问题冲突，此项用于关闭该风险。
- **Effort:** M（human） -> S（CC）
- **Depends on:** 支付策略评审、履约争议处理规则明确。

## P1 - WeChat 支付/结算合规能力清单

- **What:** 建立微信支付相关能力与合规清单（保证金、回调验签、退款能力、结算限制、异常处理）。
- **Why:** 托管/抽成/仲裁路径高度依赖平台能力，若前置不清会造成排期失真和架构返工。
- **Pros:** 提前识别不可行路径；降低支付链路上线风险。
- **Cons:** 增加前置调研和对接时间。
- **Context:** 工程计划包含事件账本与异步结算，需要与平台能力逐条映射。
- **Effort:** M（human） -> S（CC）
- **Depends on:** 商户主体资质、微信支付产品能力确认。

## P1 - 建立 DESIGN.md 设计系统基线

- **Status:** 根目录已新增 `DESIGN.md` 基线（舞台感深色 + 非模板字体方向）；品牌主色与小程序内字体源仍需你方最终确认。
- **What:** 新建 `DESIGN.md`，定义语义色板、字体层级、间距系统、关键组件规范（卡片、状态条、按钮、表单、空态）。
- **Why:** 当前缺失统一设计系统，跨页面实现容易风格漂移，影响信任感和可维护性。
- **Pros:** UI 一致性提升；设计评审与开发实现有共同锚点；后续迭代成本降低。
- **Cons:** 需要前置投入一次系统化整理。
- **Context:** `/plan-design-review` 已给出临时 token，本项用于把临时规则升级为正式标准。
- **Effort:** M（human） -> S（CC）
- **Depends on:** 品牌基调确认、主色与语义色确认。

## P2 - 完整 `/design-review`（视觉审计）前置条件

- **What:** 初始化 git 工作区；有可访问的**小程序预览或 Web 前端 URL** 后再跑完整 browse 截图审计。
- **Why:** 当前仓库仅有 API + `DESIGN.md`，无法进行首屏/排版/对比度等像素级评审；报告见 `.gstack/design-reports/design-audit-cosii-2026-03-26.md`。
- **Effort:** S（human） -> S（CC）

## P1 - 微信小程序工程（UI 壳）

- **What:** 初始化小程序仓库（或 monorepo 子包）、全局样式对齐 `DESIGN.md`、五 Tab 导航壳、首页线框、统一请求层对接现有 API envelope（`code` / `trace_id` / 错误映射）。
- **Why:** `/autoplan` UI 层评审结论依赖可运行界面；当前 `src/` 仅后端，无页面可测。
- **Ref:** `docs/designs/autoplan-review-ui.md`、`docs/designs/autoplan-ui-test-plan-20260326.md`、`docs/designs/miniprogram-ui-shell-spec.md`（UI 壳实现规格）
- **Effort:** M（human） -> M（CC）
- **Depends on:** 小程序 AppID/开发者工具、字体与类目合规确认。
