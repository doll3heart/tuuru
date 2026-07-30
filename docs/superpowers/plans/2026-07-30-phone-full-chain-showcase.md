# 小手机全链路示例作品 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 生成一部可直接导入 Tuuru 阅读器、能够完整跑通小手机阅读引导、覆盖全部消息卡片并实际使用占位符的示例作品。

**Architecture:** 用独立 fixture 构建确定性的作品对象，生成 JSON 与承载同一数据的 PNG；测试同时校验作品 schema、流程目标、消息类型、占位符覆盖和两个产物的一致性。

**Tech Stack:** JavaScript ES modules、Node.js test、Tuuru work schema、PNG steganography。

## Global Constraints

- 不依赖网络资源，图片全部使用确定性的内嵌素材。
- 不修改现有验收样例，避免影响既有测试。
- 流程中的每一步必须能解析到真实内容。
- 示例正文必须使用正常中文，不沿用已有乱码样例。

---

## Task 1: 建立示例作品 fixture

- [x] 新建小手机示例 fixture 和固定资源。
- [x] 覆盖文字、图片、语音、链接、红包、转账、亲属卡、外卖、位置、时间、系统消息、语音通话、视频通话。
- [x] 配置聊天选择与后续消息、群聊、朋友圈、论坛、备忘录、相册、浏览器和购物。
- [x] 配置至少三个会在内容中实际出现的占位符。

## Task 2: 配置可跑通的阅读引导

- [x] 为全部消息卡片建立有序流程步骤。
- [x] 在消息之后串联论坛、朋友圈、备忘录、相册、浏览器和购物。
- [x] 校验所有流程目标均可解析。

## Task 3: 生成可导入产物

- [x] 生成格式化 JSON。
- [x] 生成承载相同作品数据的 PNG。
- [x] 在作品作者说明中加入最短导入与体验提示。

## Task 4: 自动测试与真实阅读器验证

- [x] 测试 schema、产物一致性、卡片类型和占位符覆盖。
- [x] 在浏览器中导入 PNG，填写占位符并启动流程。
- [x] 跑相关回归测试和生产构建。
