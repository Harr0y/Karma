# Karma 文档

> 最后更新：2026-02-24

---

## 核心文档

| 文档 | 说明 |
|------|------|
| **[CURRENT_STATUS.md](./CURRENT_STATUS.md)** | 项目当前状态（推荐先看这个） |
| **[architecture.md](./architecture.md)** | 完整架构设计 |
| **[quality-report.md](./quality-report.md)** | 代码质量报告 |

## 用户文档

| 文档 | 说明 |
|------|------|
| **[USER_GUIDE.md](./USER_GUIDE.md)** | 用户指南（推荐） |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | 部署指南 |

## 开发文档

| 文档 | 说明 |
|------|------|
| **[next-iteration-plan.md](./next-iteration-plan.md)** | 下一步迭代计划 |
| **[karma-simulator-guide.md](./karma-simulator-guide.md)** | 自动化测试指南（Agent-to-Agent） |
| **[platform-adapter-design.md](./platform-adapter-design.md)** | 平台适配层设计 |
| **[issue-analysis-2026-02-19.md](./issue-analysis-2026-02-19.md)** | 问题排查报告 |

---

## 归档文档

### 已完成的计划 (`archive/completed/`)

- `mvp-plan.md` - MVP 验证计划（已完成）
- `refactor-plan-platform-adapter.md` - 平台适配层重构计划（已完成）
- `prompt-externalization-plan.md` - Prompt 外置化方案（已完成）

### 开发阶段记录 (`archive/phases/`)

- `phase1-storage-tests.md` - Phase 1 存储层
- `phase2-skills-tests.md` - Phase 2 Skills 系统
- `phase3-prompt-tests.md` - Phase 3 Prompt 系统
- `phase4-session-tests.md` - Phase 4 会话管理
- `phase5-multi-platform.md` - Phase 5 多平台
- `phase6-summary.md` - Phase 6 日志/人设系统
- `phase7-integration-plan.md` - Phase 7 数据闭环（已完成）
- `phase8-simulator-design.md` - Phase 8 模拟器设计（已实现）
- `phase8-test-cases.md` - Phase 8 测试用例
- `phase9-iteration-plan.md` - Phase 9 迭代计划

---

## 快速导航

### 新手入门
1. 看 [CURRENT_STATUS.md](./CURRENT_STATUS.md) 了解项目现状
2. 看 [USER_GUIDE.md](./USER_GUIDE.md) 快速上手
3. 看 [../README.md](../README.md) 运行项目
4. 看 [DEPLOYMENT.md](./DEPLOYMENT.md) 部署到生产

### 深入理解
1. 看 [architecture.md](./architecture.md) 了解架构设计
2. 看 `src/` 目录的源码
3. 看 `tests/` 目录的测试

### 开发计划
1. 看 [next-iteration-plan.md](./next-iteration-plan.md)
2. 看 [karma-simulator-guide.md](./karma-simulator-guide.md) 了解自动化测试
3. 看 `archive/phases/` 了解历史开发过程

---

## 更新日志

### 2026-02-24
- 📁 重组文档目录结构
- 📦 创建 `archive/completed/` 存放已完成的计划
- 📦 创建 `archive/phases/` 存放历史阶段文档
- 🗑️ 移除过期的 MVP/重构计划文档

### 2026-02-19
- ✅ 创建 CURRENT_STATUS.md
- ✅ 更新 architecture.md 实现状态
- ✅ 归档历史 Phase 文档
- ✅ 创建文档索引
- ✅ 更新 next-iteration-plan.md（Phase 7 完成）
- ✅ 创建 USER_GUIDE.md
- ✅ 创建 DEPLOYMENT.md
