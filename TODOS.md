# TODOS

## P0 - 域名注册与 DNS 解析（当前未购买）

- **What:** 购买域名；在 DNS 控制台添加 **A 记录**（例如 `api` → 云服务器**公网 IPv4**），供小程序 request 合法域名与 HTTPS 证书使用。
- **Why:** 无域名则无法用微信要求的 **HTTPS 合法域名** 访问 API；仅靠 IP 无法配置小程序服务器域名。
- **Pros:** 解锁备案（若需要）、证书、品牌 URL。
- **Cons:** 年费成本；需等待解析生效（通常数分钟～48h）。
- **Context:** 你已购腾讯云服务器；域名可在腾讯云或任意注册商购买，解析指向该实例 IP 即可。
- **Effort:** S（human） -> S（CC）
- **Depends on:** 服务器公网 IP 已固定（或知晓弹性 IP）。

## P0 - HTTPS（TLS 证书 + 反代）（当前未完成，依赖域名）

- **What:** 为 API 域名申请 **免费 DV 证书**（腾讯云 SSL 控制台或 Let’s Encrypt）；在服务器部署 **Nginx 或 Caddy**，对外 **443** 终结 TLS，反代到本机 Node（如 `127.0.0.1:3000`）。
- **Why:** 微信小程序 **仅允许 HTTPS**；生产环境变量与联调见 `docs/tutorials/生产环境变量与真机联调（小白版）.md`。
- **Pros:** 满足微信与浏览器安全要求。
- **Cons:** 需维护证书续期与反代配置。
- **Effort:** M（human） -> S（CC）
- **Depends on:** 域名已解析到本机；安全组放行 **80/443**。

## P0 - ICP 备案（使用大陆境内服务器并对内地用户正式服务时；当前未启动）

- **What:** 按云服务商流程提交 **网站/APP 备案**（主体、域名证书、核验单等）。
- **Why:** 未备案域名在大陆机房上 **不能对外提供 Web 服务**（或会被拦截），影响小程序合法域名访问。
- **Pros:** 合规上线内地流量。
- **Cons:** 周期常以周计；需配合短信核验与材料准备。
- **Effort:** M（human） -> —（人工流程为主）
- **Depends on:** 已购境内服务器、已注册域名；若用香港/境外机房规避备案则另权衡合规与延迟（本项可能标为 N/A）。
- **Context:** 若你明确走「境外机 + 无备案」路线，在条目标题旁注明 **N/A** 并记录决策日期。

## P0 - 微信小程序侧：合法域名与生产鉴权（非腾讯云购物车；可能仍待完成）

- **What:** 微信公众平台 → 服务器域名配置 **request 合法域名**；与后端 `WECHAT_APPID` / `WECHAT_SECRET` / `COSII_SESSION_SECRET` 一致；小程序 `app.js` 生产用 HTTPS `apiBase` + `useWeChatSession: true`；完成一次 **真机** `wx.login` 链并联调证据（见 `docs/go-live-checklist.md`）。
- **Why:** 无合法域名或未换 Bearer 时，真机请求会失败或长期依赖不安全 dev 头。
- **Pros:** 与代码里生产鉴权模型一致。
- **Cons:** 依赖域名+HTTPS+（常需）备案；个人/企业主体规则以微信为准。
- **Effort:** M（human） -> S（CC）
- **Depends on:** 上两项 P0（域名、HTTPS）；备案是否完成视机房与政策。

## P1 - 云服务器初始化（已购服务器 — 不依赖域名即可开始）

- **What:** SSH 登录；**安全组** 收紧（**22** 建议限源 IP；**80/443** 预留给反代；**3000** 勿对公网全开 unless 临时调试）；`apt/yum` 更新；安装 **Node.js ≥ 22.5**、git；可选：创建非 root 部署用户、`fail2ban`、自动安全更新。
- **Why:** 裸机默认暴露面大；Cosii 运行时要求见根目录 `CLAUDE.md`。
- **Pros:** 降低被扫库/撞库风险；为后续部署打底。
- **Effort:** S–M（human） -> S（CC）
- **Depends on:** 厂商控制台安全组 + SSH 密钥/密码。

## P1 - 生产部署 Cosii API（代码与进程）

- **What:** 将仓库同步到服务器（git clone / rsync）；配置环境变量（`NODE_ENV=production`、`COSII_TRUST_DEV_HEADER=0`、`WECHAT_*`、`COSII_SESSION_SECRET`、`DATA_DIR`/`DB_PATH` 等）；`npm ci && npm run build`；用 **systemd** 或 **pm2** 常驻 `node`；健康检查 `GET /health`、`GET /v1/ready`。
- **Why:** 仅买服务器不等于 API 已在跑；需可重启、可观测的进程管理。
- **Pros:** 与 `npm run verify:ready` / `docs/go-live-checklist.md` 对齐。
- **Cons:** 首次排障需看日志与防火墙。
- **Effort:** M（human） -> M（CC）
- **Depends on:** 服务器初始化；域名+HTTPS 可后置（先用本机 `curl localhost:3000` 验证）。

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
