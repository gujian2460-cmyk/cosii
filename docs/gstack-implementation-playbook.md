# GStack 实施操作手册（Cos 小程序）

## 目标

这份手册用于把现有规划文档转成可执行开发流程，按 `Day1-2` 到 `Day9-10` 推进，并在每一步使用 gstack 做评审、测试与修复闭环。

## 开工前准备

1. 打开项目目录：`c:\cosii`
2. 确保规划文档可用：
   - `docs/designs/eng-implementation-plan-cos-miniapp.md`
   - `docs/designs/eng-review-test-plan.md`
   - `TODOS.md`
3. 建议先初始化 git（如果还没做）：

```bash
git init
git add .
git commit -m "chore: initialize planning baseline"
```

## 每日标准节奏（推荐）

### A. 锁定当天范围

在聊天里发：

```text
今天只做 DayX-Y，禁止扩 scope。先列文件清单，再实施，再给验收结果。
```

### B. 先做报告式 QA

```text
/qa-only
测试范围：今天实现的链路
```

### C. 修复缺陷并补回归

```text
根据刚才 qa-only 报告修复 high/critical，并补回归测试。
```

### D. 日终工程复核

```text
/plan-eng-review
复核今天新增实现，重点看失败路径、测试覆盖、性能风险。
```

## 关键 gstack 指令与场景

- `/plan-eng-review`：每个阶段结束做工程复核（必须）
- `/plan-design-review`：任何 UI 结构变化后复核设计一致性
- `/qa-only`：先出缺陷报告，不自动改代码
- `/qa`：需要自动修复时使用
- `/ship`：所有门槛满足后再用

## 你项目的实施顺序（按规划文档）

### Day1-2

- 基线库表 + 约束（结果写入 `docs/designs/autoplan-review-day1-2.md`）
- API envelope + 错误码字典（结果写入 `docs/designs/autoplan-review-day1-2.md`）
- 交易单/约妆单创建 API（结果写入 `docs/designs/autoplan-review-day1-2.md`）

### Day3-4

- 支付发起（结果写入 `docs/designs/autoplan-review-day3-4.md`）
- webhook 验签 + 原子幂等（结果写入 `docs/designs/autoplan-review-day3-4.md`）
- 档期锁与占位过期（结果写入 `docs/designs/autoplan-review-day3-4.md`）

### Day5-6

- 争议流程 + 证据上传 + SLA（结果写入 `docs/designs/autoplan-review-day5-6.md`）
- 结算账本 + 结算任务（同上）

### Day7-8

- 内容发布 + 转化卡（结果写入 `docs/designs/autoplan-review-day7-8.md`）
- 同城核销流程（同上）

### Day9-10

- 全回归 + 4 条 E2E（结果写入 `docs/designs/autoplan-review-day9-10.md`）
- 监控、告警、上线检查清单（同上）

## 上线前门槛（必须全部通过）

1. CRITICAL 回归（T11-T17）全部通过
2. 四条 E2E 主链路通过
3. 金融对账验收达标（容差、告警、冻结条件）
4. 设计系统基线明确（`DESIGN.md` 或已冻结临时 token）

## 常用“任务包”提示词（可复制）

```text
按 docs/designs/eng-implementation-plan-cos-miniapp.md 实施 Day1-2。
要求：
1) 先输出将修改文件清单
2) 再实施
3) 最后输出验收清单（数据库约束、API contract、错误码）
4) 如发现计划冲突，先停下来问我
```

## 何时执行 /ship

当你确认“测试、回归、对账、设计基线”全部达标后，再执行：

```text
/ship
```

不要在“仅实现了 happy path”时提前执行。
