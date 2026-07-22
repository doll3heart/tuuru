# Phone Social Identity Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in forum IP labels, stable contact ordering/pinning, separate message/forum avatars, per-message follow-up actors, and author-assisted @ mentions without breaking existing works.

**Architecture:** Keep schema version 1 and add only optional fields with legacy fallbacks. Put pure ordering and mention parsing in focused modules, extend the shared contact identity resolver, then wire author controls and reader rendering to those helpers.

**Tech Stack:** Vanilla JavaScript ES modules, CSS, JSDOM/node:test, Vite/TypeScript build verification.

## Global Constraints

- Forum IP display defaults to off and only renders authored non-empty locations.
- Old `avatarUrl` remains the fallback for contact-book, message, and forum surfaces.
- Contact references remain ID-based; sorting never changes IDs or linked content.
- @ mentions remain plain readable text in exported works and receive semantic visual highlighting only when recognized.
- Do not implement cross-work contact transfer, global author habits, or tutorials in this task.

---

### Task 1: Shared contact identity and ordering

**Files:**
- Create: `js/contact-order.js`
- Create: `tests/contact-order.test.mjs`
- Modify: `js/contact-identity.js`
- Modify: `tests/contact-identity.test.mjs`

**Interfaces:**
- Produces: `orderedContacts(contacts, mode)`, `reorderContacts(...)`, and surface-aware `resolveContactIdentity(...).avatar/ipLocation`.

- [ ] Write failing tests for pinned/custom/A–Z order and legacy avatar fallbacks.
- [ ] Run the two targeted test files and confirm failure.
- [ ] Implement pure ordering and identity helpers without mutating source arrays.
- [ ] Run targeted tests and confirm pass.

### Task 2: Author contact controls and forum IP switch

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `js/data.js`
- Modify: `css/styles.css`
- Modify: `tests/phone-app-modal.test.mjs`
- Modify: `tests/phone-social-choice-editor.test.mjs`

**Interfaces:**
- Consumes: shared contact ordering and identity helpers.
- Produces: `phoneData.contactSortMode`, contact `pinned/messageAvatarUrl/forumAvatarUrl/forumIpLocation`, alias `forumIpLocation`, NPC `ipLocation`, and `phoneData.forumSettings.showIpLocation`.

- [ ] Add failing UI tests for sort mode, pinning, avatar fields, IP fields, and default-off switch.
- [ ] Run targeted tests and confirm failure.
- [ ] Add compact native controls, custom drag/keyboard ordering, and save bindings.
- [ ] Add forum IP toggle and NPC/contact IP inputs; snapshot IP on authored posts/comments.
- [ ] Run targeted tests and confirm pass.

### Task 3: Per-message follow-up actors

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `tests/phone-social-choice-editor.test.mjs`
- Modify: `tests/reader-social-choice-runtime.test.mjs`

**Interfaces:**
- Consumes: existing `followUpMessages[].senderId` runtime contract.
- Produces: one author row per follow-up containing actor selector and message text.

- [ ] Add a failing editor test with two follow-ups from different actors.
- [ ] Replace the one-textarea editor with repeatable actor/message rows while reading legacy arrays.
- [ ] Reuse the same editor for message, moment, and forum choice owners.
- [ ] Run editor and reader social-choice tests and confirm pass.

### Task 4: Group-chat and forum mentions

**Files:**
- Create: `js/mention-text.js`
- Create: `tests/mention-text.test.mjs`
- Modify: `js/pages/phone.js`
- Modify: `reader/reader.js`
- Modify: `css/styles.css`
- Modify: `reader/reader.css`

**Interfaces:**
- Produces: `splitMentionText(text, names)` and author @ pickers that insert readable `@显示名` text.

- [ ] Add failing parser tests for overlapping names, punctuation, duplicates, and unrecognized text.
- [ ] Implement parser and escaped author/reader rendering helpers.
- [ ] Add a compact @ control to group composer and forum post/comment editors.
- [ ] Highlight recognized mentions in author preview and reader bubbles/posts/comments.
- [ ] Run mention, chat, forum, and security-focused tests.

### Task 5: Reader integration and compatibility verification

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Modify: `js/work-schema.js` only if nested collection normalization requires it.
- Modify: `tests/reader-contact-identity.test.mjs`
- Modify: `tests/work-schema.test.mjs`

**Interfaces:**
- Consumes: all optional author fields with legacy fallback.
- Produces: ordered reader contact book, split avatars, optional IP labels, actor-specific follow-ups, and mention highlighting.

- [ ] Add reader regressions for old works and each new field.
- [ ] Implement reader wiring with safe URL and escaped-text paths.
- [ ] Run all targeted tests.
- [ ] Run `git diff --check` and `npm run verify`; expect zero failures and a successful production build.
