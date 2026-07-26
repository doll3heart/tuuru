# 发布前体检 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在作品卡片中提供只读的发布前体检，发现会破坏阅读流程的问题，并完成主要创作内容的重新编辑入口审计。

**Architecture:** 新建纯函数模块 `js/work-preflight.js`，把作品数据转换为稳定、可测试的问题列表；首页只负责打开结果界面。规则分为“需要处理”和“建议检查”，不修改作品数据。

**Tech Stack:** 原生 JavaScript ES modules、现有 modal 组件、Node test、JSDOM、现有 CSS tokens。

## Global Constraints

- 入口位于作品卡片“更多”菜单。
- 体检过程只读，不自动修改作品。
- 每条结果必须包含级别、标题、位置和处理建议。
- 手机端保持 44px 可点击目标，复用现有按钮与弹窗语言。
- 正常作品显示明确的“未发现问题”结果。

---

### Task 1: 纯函数体检规则

**Files:**
- Create: `js/work-preflight.js`
- Test: `tests/work-preflight.test.mjs`

**Interfaces:**
- Consumes: 当前作品对象。
- Produces: `inspectWorkBeforePublish(work)`，返回 `{ issues, counts }`。

- [ ] **Step 1: Write the failing test**

```js
const report = inspectWorkBeforePublish({
  type:"article",
  startNode:"missing",
  nodes:[{ id:"start", title:"", content:"", choices:[{ text:"继续", targetId:"gone" }] }],
  placeholders:[],
})
assert.deepEqual(report.counts, { error:2, warning:1 })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/work-preflight.test.mjs`

Expected: FAIL because `js/work-preflight.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

```js
export function inspectWorkBeforePublish(work) {
  const issues = []
  // Validate article start, empty nodes, branch targets, phone references,
  // hidden App content, placeholder keys, image URLs, and external links.
  return {
    issues,
    counts:{
      error:issues.filter(issue => issue.level === "error").length,
      warning:issues.filter(issue => issue.level === "warning").length,
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/work-preflight.test.mjs`

Expected: PASS.

### Task 2: 首页入口与结果界面

**Files:**
- Modify: `js/pages/home.js`
- Modify: `css/styles.css`
- Test: `tests/work-preflight-ui.test.mjs`

**Interfaces:**
- Consumes: `inspectWorkBeforePublish(work)`.
- Produces: `window.inspectWorkBeforePublishFromHome(workId)` and accessible result markup.

- [ ] **Step 1: Write the failing UI test**

```js
assert.match(homeSource, /data-work-preflight/)
assert.match(homeSource, /发布前体检/)
assert.match(authorCss, /\.work-preflight-summary/)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/work-preflight-ui.test.mjs`

Expected: FAIL because the menu entry is missing.

- [ ] **Step 3: Add the menu action and modal**

```js
<button data-work-preflight="${w.id}"
  onclick="event.stopPropagation();inspectWorkBeforePublishFromHome('${w.id}')">
  发布前体检
</button>
```

Render error and warning counts, then render each result as a plain list with its location and action.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/work-preflight-ui.test.mjs`

Expected: PASS.

### Task 3: 重新编辑入口审计

**Files:**
- Test: `tests/author-content-editability.test.mjs`
- Modify: `js/pages/phone.js` only when the audit finds a missing entry.

**Interfaces:**
- Consumes: author-facing controls in the phone editor.
- Produces: regression coverage for newly created chats, messages, moments, forum posts, comments, memos, photos, browser records, shopping items, and calls.

- [ ] **Step 1: Add an audit table**

```js
const contracts = [
  ["动态", "data-moment-edit"],
  ["动态评论", "data-moment-comment-edit"],
  ["论坛主楼", "forum-post-edit"],
  ["聊天消息", "chat-ctx-menu"],
]
for (const [name, marker] of contracts) {
  assert.match(phoneSource, new RegExp(marker), `${name} needs a reopen editor`)
}
```

- [ ] **Step 2: Run the audit**

Run: `node --test tests/author-content-editability.test.mjs`

Expected: PASS, or FAIL naming the missing entry.

- [ ] **Step 3: Repair each concrete failure**

Reuse the creation form with the existing record as initial data. Save into the same stable ID and preserve comments, choices, and unknown metadata.

- [ ] **Step 4: Run related integration tests**

Run: `node --test tests/phone-message-editor.test.mjs tests/phone-social-choice-editor.test.mjs tests/author-content-editability.test.mjs`

Expected: PASS.

### Task 4: 完整验证

**Files:**
- Verify all modified files.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: production-ready build.

- [ ] **Step 1: Run format checks**

Run: `git diff --check`

Expected: exit 0.

- [ ] **Step 2: Run the full project verification**

Run: `npm run verify`

Expected: all tests pass and Vite production build succeeds.
