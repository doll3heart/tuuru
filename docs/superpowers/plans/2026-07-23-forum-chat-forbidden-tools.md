# 论坛回复、会话排序与违禁词工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复论坛楼中楼回复关系，为消息会话加入置顶与持久排序，并把占位符预设和违禁词整理成可搜索、可去重、可全局同步的紧凑工具。

**Architecture:** 楼中楼继续使用现有递归 `replies` 数据，新增稳定的回复目标元数据并让作者端与读者端共用显示语义。会话顺序直接由 `phoneData.chats` 数组保存，`pinned` 只负责分区。违禁词解析、去重、搜索与全局合并放入纯函数模块，两套占位符界面复用同一规则，并把全局词库保存在作品顶层 `globalForbidden`。

**Tech Stack:** 原生 JavaScript ES modules、JSDOM、Node test、现有 modal 与 CSS tokens。

## Global Constraints

- 兼容没有 `pinned`、`replyTo*`、`globalForbidden` 字段的旧作品。
- 拖拽只能在置顶区或普通区内排序；键盘上下键提供同等能力。
- 全局违禁词持续应用于所有占位符，专属违禁词继续单独保留。
- 批量词语支持换行、逗号、顿号、分号、斜杠和竖线分隔。
- 去重按去除首尾空白后的完整词语处理，保留第一次出现的顺序。
- 导入、导出和预设管理合并为次级工具区，新增占位符仍为主要操作。
- 作者端和读者端都显示“回复对象”，楼中楼视觉上与一级评论有轻微差异。

---

### Task 1: 修复楼中楼回复关系

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `reader/reader.js`
- Modify: `css/styles.css`
- Modify: `reader/reader.css`
- Test: `tests/phone-social-choice-editor.test.mjs`

**Interfaces:**
- Consumes: `post.comments`, recursive `comment.replies`.
- Produces: reply records with `replyToCommentId`, `replyToContactId`, `replyToAliasId`, `replyToName`; every comment/reply exposes a reply action.

- [ ] 写一个失败测试：回复深层 `forum-reply-a` 后，新记录必须位于它的 `replies` 中，并保存回复目标名称。
- [ ] 运行 `node --test tests/phone-social-choice-editor.test.mjs`，确认缺少楼中楼回复按钮或目标元数据导致失败。
- [ ] 用现有递归查找函数定位任意深度目标，把新回复写入目标的 `replies`。
- [ ] 作者端与读者端显示“发送者 回复 目标”，为回复项使用轻微底色和紧凑间距。
- [ ] 重跑测试，确认编辑、删除、点赞、排序和回复选项仍通过。

### Task 2: 会话置顶与持久排序

**Files:**
- Create: `js/chat-order.js`
- Modify: `js/pages/phone.js`
- Modify: `reader/reader.js`
- Modify: `css/styles.css`
- Modify: `reader/reader.css`
- Test: `tests/chat-order.test.mjs`
- Test: `tests/phone-message-editor.test.mjs`

**Interfaces:**
- Consumes: `orderChats(chats)` and `reorderChats(chats, sourceId, targetId, position)`.
- Produces: pinned-first stable order and immutable same-section reorder result.

- [ ] 写纯函数失败测试，覆盖置顶优先、稳定顺序、跨区拒绝和同区重排。
- [ ] 实现 `orderChats`、`toggleChatPinned`、`reorderChats`。
- [ ] 消息列表加入置顶按钮、拖拽手柄、方向键排序与焦点恢复。
- [ ] 读者端按同一 pinned-first 顺序显示会话，并显示克制的置顶标识。
- [ ] 运行纯函数与消息编辑器测试。

### Task 3: 共享违禁词规则

**Files:**
- Create: `js/forbidden-words.js`
- Modify: `js/placeholders.js`
- Modify: `js/data.js`
- Modify: `js/work-schema.js` only if normalization does not preserve the new field
- Test: `tests/forbidden-words.test.mjs`
- Test: `tests/work-schema.test.mjs`

**Interfaces:**
- Produces:
  - `parseForbiddenWords(value)`
  - `dedupeForbiddenWords(words)`
  - `filterForbiddenWords(words, query)`
  - `effectiveForbiddenWords(placeholder, globalForbidden)`
  - `syncGlobalForbidden(placeholders, previousGlobal, nextGlobal)`

- [ ] 写失败测试，覆盖多种分隔符、空项、稳定去重、搜索和全局词合并。
- [ ] 实现纯函数，不修改传入数组。
- [ ] 让读者输入校验使用专属词与作品全局词的合并结果。
- [ ] 验证旧作品与导出导入保留兼容。

### Task 4: 精简两套占位符界面

**Files:**
- Modify: `js/pages/editor.js`
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Test: `tests/article-editor-mobile-shell.test.mjs`
- Test: `tests/phone-message-editor.test.mjs`
- Test: `tests/author-placeholder-ui.test.mjs`

**Interfaces:**
- Consumes: Task 3 pure helpers.
- Produces: search field, global forbidden editor, one-click cleanup, grouped preset actions, grouped import/export.

- [ ] 用静态与 JSDOM 测试锁定搜索框、全局词库、去重按钮和合并后的工具区。
- [ ] 顶部只保留“添加占位符”主要按钮和紧凑预设选择；导入、导出、删除放入“管理预设”次级区。
- [ ] 搜索同时匹配占位符名称、标记、问题和违禁词；清空输入立即恢复列表。
- [ ] “整理词库”解析多分隔符并去重；“应用到全部”保存 `globalForbidden`。
- [ ] 两套界面使用相同文案和行为，保持 44px 触控目标及窄屏换行。

### Task 5: 完整验证

**Files:**
- Verify all modified files.

**Interfaces:**
- Produces: production-ready build.

- [ ] 运行 `git diff --check`。
- [ ] 运行论坛、消息、占位符定向测试。
- [ ] 运行 `npm run verify`，要求全量测试零失败且 Vite 生产构建成功。
