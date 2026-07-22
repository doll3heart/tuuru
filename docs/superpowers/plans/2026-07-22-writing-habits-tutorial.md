# Writing Habits and Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact author-shell entry to a local writing-habits and tutorial page, with versioned contact transfer and globally managed placeholder presets.

**Architecture:** Keep transferable contacts in an explicit versioned JSON packet handled by a pure module; the page selects one existing work at a time and merges imported contacts without replacing the work or its existing contacts. Continue using `tuuru_author_placeholder_presets` as the separate author-global namespace, while every work keeps its own instantiated placeholder records. Render both writing habits and tutorial as hash-routed, progressively enhanced author pages using existing controls and color tokens.

**Tech Stack:** Browser ES modules, localStorage-backed author database, hash router, plain HTML/CSS, Node test runner with JSDOM.

## Global Constraints

- Do not rename or delete old work fields; imported contacts must preserve old-field fallback behavior.
- Do not clear, migrate, or bulk-overwrite IndexedDB/localStorage.
- Contact import must merge into one explicitly selected work and resolve contact and alias ID conflicts.
- Author-global preferences remain in their own localStorage namespace and never rewrite existing works.
- JSON and PNG work transport semantics must remain unchanged.
- Preserve the existing gray-pink UI, 44px touch targets, keyboard focus, and reduced-motion behavior.
- Do not commit, push, or deploy without explicit user instruction; ignore `.vite-8765.log`.

---

### Task 1: Versioned contact packets

**Files:**
- Create: `js/contact-bundles.js`
- Test: `tests/contact-bundles.test.mjs`

**Interfaces:**
- Produces: `serializeContactBundle(contacts, options) -> string`, `parseContactBundle(input) -> bundle`, and `mergeContactBundle(existingContacts, input, options) -> { contacts, added, reassignedIds }`.
- Consumes: plain contact records already stored at `work.phoneData.contacts`.

- [ ] **Step 1: Write failing round-trip and merge tests**

```js
const json = serializeContactBundle([contact], { now: () => 123 })
assert.equal(parseContactBundle(json).version, 1)
const merged = mergeContactBundle([{ id: "same", name: "原联系人" }], json, {
  idFactory: () => "new-contact",
})
assert.deepEqual(merged.contacts.map(item => item.id), ["same", "new-contact"])
assert.equal(merged.reassignedIds, 1)
```

- [ ] **Step 2: Run the focused test and confirm the module is missing**

Run: `node --test tests/contact-bundles.test.mjs`
Expected: FAIL with module-not-found for `js/contact-bundles.js`.

- [ ] **Step 3: Implement strict packet parsing and non-destructive merge**

```js
export const CONTACT_BUNDLE_TYPE = "tuuru-contact-bundle"
export const CONTACT_BUNDLE_VERSION = 1

export function serializeContactBundle(contacts, { now = Date.now } = {}) {
  return JSON.stringify({
    type: CONTACT_BUNDLE_TYPE,
    version: CONTACT_BUNDLE_VERSION,
    exportedAt: Number(now()),
    contacts: sanitizeContacts(contacts),
  }, null, 2)
}
```

Parsing must reject malformed type/version/contact arrays. Merging must clone the target, append imports, generate fresh contact IDs when any target ID collides, and also generate fresh nested alias IDs when they collide with an existing or already-imported alias ID.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/contact-bundles.test.mjs`
Expected: all contact packet tests PASS.

### Task 2: Global writing-habits page

**Files:**
- Create: `js/pages/resources.js`
- Modify: `js/app.js`
- Test: `tests/resources-page.test.mjs`

**Interfaces:**
- Consumes: `getWorks()`, `updateWork()`, `downloadBlob()`, contact packet functions, and the existing author-placeholder preset functions.
- Produces: `renderResourcesPage({ initialTab })` plus `bindResourcesPage()`; routes `/resources` and `/resources/tutorial`.

- [ ] **Step 1: Write failing page-structure tests**

```js
assert.match(source, /写作习惯/)
assert.match(source, /使用教程/)
assert.match(source, /data-contact-work/)
assert.match(source, /tuuru_author_placeholder_presets|readAuthorPlaceholderPresets/)
```

- [ ] **Step 2: Run the focused page test**

Run: `node --test tests/resources-page.test.mjs`
Expected: FAIL because the resources page does not exist.

- [ ] **Step 3: Render and bind the writing-habits controls**

The contact section uses one explicit work selector, an export button, and an import file picker. Export is disabled when the selected work has no contacts. Import previews the file name/count and requires the user to press “合并到所选作品”; only that handler calls `updateWork(selectedId, { phoneData: nextPhoneData })`.

The placeholder section reads the existing global preset library. Each preset editor exposes name plus rows for `key`, `label`, `prompt`, `mode`, and comma/newline-separated `forbidden`; save calls `saveAuthorPlaceholderPreset`, delete calls `deleteAuthorPlaceholderPreset`, and import/export reuse the existing versioned bundle functions. No handler calls `updateWork` for placeholder presets.

- [ ] **Step 4: Register hash routes and bind after markup insertion**

```js
router("/resources", () => {
  app.innerHTML = renderHeader() + renderResourcesPage({ initialTab: "habits" })
  bindResourcesPage()
})
router("/resources/tutorial", () => {
  app.innerHTML = renderHeader() + renderResourcesPage({ initialTab: "tutorial" })
  bindResourcesPage()
})
```

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/contact-bundles.test.mjs tests/author-placeholder-presets.test.mjs tests/resources-page.test.mjs`
Expected: all focused tests PASS.

### Task 3: Built-in tutorial and glossary

**Files:**
- Modify: `js/pages/resources.js`
- Test: `tests/resources-page.test.mjs`

**Interfaces:**
- Produces: tutorial anchors and glossary `<details>` entries within the same resources page.

- [ ] **Step 1: Add copy-presence tests for misunderstood concepts**

```js
for (const term of ["别名", "小号", "消息头像", "论坛头像", "视频通话背景", "占位符", "@ 提及", "IP 属地"]) {
  assert.match(source, new RegExp(term))
}
assert.match(source, /固定脸[^。]*旧称|原“固定脸”/)
```

- [ ] **Step 2: Add concise workflow guidance and glossary entries**

Explain that alias is a contact nickname, small accounts are forum-only identities, generic/message/forum avatars have separate surfaces, the old fixed-face URL is now the video-call background and is unused by voice calls, placeholders are authored templates instantiated independently per work, mentions remain plain text in exports, and reader-authored replies do not receive a forged IP.

- [ ] **Step 3: Run the page test**

Run: `node --test tests/resources-page.test.mjs`
Expected: PASS.

### Task 4: Compact responsive shell entry and page styling

**Files:**
- Modify: `js/app.js`
- Modify: `css/styles.css`
- Modify: `tests/author-shell-visual.test.mjs`
- Test: `tests/resources-page.test.mjs`

**Interfaces:**
- Produces: `.app-resources-link`, `.resources-page`, `.resources-tabs`, `.habit-section`, `.preset-editor`, and tutorial topic styles.

- [ ] **Step 1: Add shell and responsive assertions**

```js
assert.match(app, /class="app-resources-link"/)
assert.match(app, /aria-label="写作习惯与使用教程"/)
assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*\.app-resources-link-label\s*\{[^}]*display\s*:\s*none/)
```

- [ ] **Step 2: Add the compact header link and product-native layout CSS**

The entry remains beside the mode switch, has a 44px target, uses the existing border/focus vocabulary, and collapses its text label at 480px. The page uses a bounded prose column, existing tabs/buttons/forms, single-level sections rather than nested card grids, mobile one-column field rows, overflow wrapping, and no decorative page-load animation.

- [ ] **Step 3: Run shell and page tests**

Run: `node --test tests/author-shell-visual.test.mjs tests/resources-page.test.mjs`
Expected: PASS.

### Task 5: Regression and transport verification

**Files:**
- Verify only; do not modify unrelated files to silence failures.

- [ ] **Step 1: Run contact, preset, shell, and work-transport tests**

Run: `node --test tests/contact-bundles.test.mjs tests/author-placeholder-presets.test.mjs tests/author-placeholder-preset-ui.test.mjs tests/author-shell-visual.test.mjs tests/resources-page.test.mjs tests/work-transport-parity.test.mjs`
Expected: all tests PASS.

- [ ] **Step 2: Run the complete verification**

Run: `npm run verify`
Expected: Node tests, TypeScript build check, and Vite production build all PASS.

- [ ] **Step 3: Check whitespace and workspace scope**

Run: `git diff --check` and `git status --short`
Expected: no whitespace errors; pre-existing changes remain present; `.vite-8765.log` remains untracked and untouched.

- [ ] **Step 4: Perform mobile visual QA**

At 500×900 and 360×800, verify the header remains one row, the resource link remains reachable, selectors and preset fields do not overflow, tutorial prose wraps, focus is visible, and both tabs can be operated by touch and keyboard.
