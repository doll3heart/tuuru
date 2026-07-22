# Message Cards And Takeaway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authored message cards readable and clickable, move round completion into the conversation menu, and add a generic takeaway card that searches the order text on an external delivery service.

**Architecture:** Keep existing message records compatible and add only optional fields for `takeaway`. Share HTTP-link normalization and takeaway search URL construction between author and reader. Remove the author-only bubble appearance control without deleting legacy appearance data.

**Tech Stack:** Vanilla JavaScript, CSS, JSDOM, Node test runner.

## Global Constraints

- Product UI calls the feature “外卖卡片”; no external brand name or visual imitation appears in Tuuru.
- External navigation permits only HTTP(S), opens in a new context, and uses `noopener noreferrer`.
- Existing works and existing payment/link cards remain importable.

---

### Task 1: Safe message-card links

**Files:**
- Create: `js/message-card-links.js`
- Create: `tests/message-card-links.test.mjs`

**Interfaces:**
- Produces: `safeMessageCardUrl(raw)` and `buildTakeawaySearchUrl(shop, order)`.

- [ ] Write tests for HTTP(S), rejected unsafe schemes, encoded order searches, and blank searches.
- [ ] Run `node --test tests/message-card-links.test.mjs` and confirm failure before implementation.
- [ ] Implement the two pure helpers.
- [ ] Re-run the test and confirm it passes.

### Task 2: Author message controls and cards

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Modify: `tests/phone-message-editor.test.mjs`

**Interfaces:**
- Consumes: the safe-link helpers from Task 1.
- Produces: `takeaway` messages with `takeawayShop`, `takeawayOrder`, `takeawayAmount`, and `takeawayStatus`.

- [ ] Add failing tests proving links are anchors, takeaway persists, the plus sheet excludes round completion, and the top menu owns it.
- [ ] Replace the appearance action with a conversation-action menu and stop applying author bubble overrides.
- [ ] Add the takeaway author form and render clickable link/takeaway cards.
- [ ] Give card classes explicit readable foreground/background colors.
- [ ] Run `node --test tests/phone-message-editor.test.mjs`.

### Task 3: Reader parity

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Modify: `js/phone-reading-flow.js`
- Modify: `tests/reader-critical-flow.test.mjs`

**Interfaces:**
- Consumes: persisted link and takeaway message fields plus Task 1 helpers.

- [ ] Add failing reader assertions for clickable safe link and takeaway cards.
- [ ] Render both card types with safe external anchors and readable shared styling.
- [ ] Add a takeaway label to reading-flow summaries.
- [ ] Run focused tests, `npm run build:verify`, then the full test suite before release.
