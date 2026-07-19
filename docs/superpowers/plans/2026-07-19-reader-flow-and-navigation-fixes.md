# Reader Flow and Navigation Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复文章与独立小手机的阅读路径、支付卡片、通话顺序和读者预设保存问题。

**Architecture:** 保持纯本地、单端口和现有作品格式；读者端消费作者已导出的 `readingFlow`，并对旧作品做兼容归一化。文章内手机模块复用现有 App 渲染器，但直接进入目标 App。

**Tech Stack:** 原生 JavaScript、CSS、JSDOM、Node.js test runner。

## Global Constraints

- 不引入后端或网络依赖。
- 不破坏旧作品中的整轮消息阅读序列。
- 不覆盖当前工作区内无关改动。

---

## Tasks

- [x] 用失败回归测试固定六个问题。
- [x] 文章模块直达目标 App，并增加真正的“上一节”。
- [x] 读者端接通作者阅读流程：旧轮次自动拆分、逐项红点、聊天逐字段显现、选择完成后推进，通话最后触发。
- [x] 红包与转账使用统一尺寸和信息层级，两个类型都显式标注。
- [x] 读者预设增加明确的“保存到本地”按钮和保存反馈。
- [x] 跑聚焦测试、全量测试、构建，并验证 `127.0.0.1:8765`。
