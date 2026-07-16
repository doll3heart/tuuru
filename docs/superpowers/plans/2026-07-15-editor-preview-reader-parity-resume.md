# Editor Preview Reader Parity Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this tightly coupled dirty-worktree resume plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish and prove the P0 that replaces the author SPA's duplicate preview with a same-tab, read-only launch into the real reader.

**Architecture:** Keep the candidate author bridge (`buildReaderPreviewUrl` / `openReaderPreview`) and the candidate real-reader preview loader (`prepareEditorPreview`) only if tests prove their behavior. Resolve exactly one validated local author work, call the existing `reader/reader.js` runtime with `{ remember: false }`, fail closed for every invalid cardinality or storage state, and package `reader/index.html` in the editor build.

**Tech Stack:** Vanilla JavaScript ES modules, Vite 6 multi-page build, Node.js `node:test`, JSDOM 27, the existing storage inspection and work-import validation boundaries.

## Global Constraints

- Change only the P0 author-preview parity path; do not mix in forum, call, message-detail, drag-sort, typography/contrast, or reader-empty-state backlog work.
- Work in the current `codex/phone-runtime-overhaul` checkout because the real-reader dependencies exist only in its uncommitted UI tree.
- Do not stage or commit any file; preserve all pre-existing dirty-worktree edits.
- Keep preview same-tab and full-page, with `reader/reader.js` as the only article/phone runtime.
- Never write preview work to `tuuru_works`, `moirain_work_<id>`, or `moirain_recent`.
- Resolve the requested work by exact ID and require exactly one match; zero or multiple matches must fail closed.
- Preserve the ordinary reader, schema/import validation, sanitization, password, placeholder, choice, phone overlay, and character-connection behavior.
- Evidence must include RED, GREEN, focused regressions, the full suite, both production builds, real-browser acceptance, independent review, and a fresh final verification run.

---

### Task 1: Reconcile the candidate implementation with the approved P0

**Files:**
- Verify: `js/pages/reader.js`
- Verify: `js/app.js`
- Verify: `vite.config.ts`
- Verify: `reader/editor-preview.js`
- Verify: `reader/reader.js`
- Test: `tests/editor-reader-preview.test.mjs`
- Test: `tests/reader-editor-preview.test.mjs`

**Interfaces:**
- Consumes: author hash route `/read/:id`, `tuuru_works`, and the existing real reader runtime.
- Produces: `buildReaderPreviewUrl(workId, baseUrl): string`, `openReaderPreview(workId, locationObject): string`, and `prepareEditorPreview(options): preview result`.

- [ ] **Step 1: Run the complete focused candidate suite**

```powershell
node --test tests/editor-reader-preview.test.mjs tests/reader-editor-preview.test.mjs
```

Expected: 7 tests pass: three author-bridge/build contracts and four real-reader preview contracts.

- [ ] **Step 2: Inspect only the P0 implementation surfaces**

```powershell
git diff --check -- js/pages/reader.js js/app.js vite.config.ts reader/editor-preview.js reader/reader.js tests/editor-reader-preview.test.mjs tests/reader-editor-preview.test.mjs
git status --short -- js/pages/reader.js js/app.js vite.config.ts reader/editor-preview.js reader/reader.js tests/editor-reader-preview.test.mjs tests/reader-editor-preview.test.mjs
```

Expected: no whitespace errors; the author route calls only `openReaderPreview`, the editor build includes `reader/index.html`, preview startup calls `loadWork(preview.work, { remember: false })`, and no file is staged.

---

### Task 2: Prove duplicate IDs fail closed with RED then minimal GREEN

**Files:**
- Modify: `tests/reader-editor-preview.test.mjs`
- Modify: `reader/editor-preview.js`

**Interfaces:**
- Consumes: the validated `database.data.works` array and the requested preview ID.
- Produces: a preview failure unless `matchingWorks.length === 1`.

- [ ] **Step 1: Confirm the regression test has the complete duplicate-ID contract**

The test must remain exactly behavior-oriented: seed two works with the same requested ID but distinct secret titles, import the real reader, require `.rd-preview-error`, require neither title to appear, and require `.rd-landing` to be absent.

```js
test("duplicate author preview ids fail closed without choosing either work", async t => {
  installDom(t, "author-preview-article")
  const firstWork = previewArticleWork()
  firstWork.title = "First duplicate must stay hidden"
  const secondWork = previewArticleWork()
  secondWork.title = "Second duplicate must stay hidden"
  seedAuthorDatabase([firstWork, secondWork])

  await import(`../reader/reader.js?duplicate-author-preview=${Date.now()}-${Math.random()}`)

  const error = document.querySelector(".rd-preview-error")
  assert.ok(error)
  assert.doesNotMatch(error.textContent, /First duplicate|Second duplicate/)
  assert.equal(document.querySelector(".rd-landing"), null)
})
```

- [ ] **Step 2: Verify RED with a controlled mutation**

Temporarily change only this line in `reader/editor-preview.js`:

```js
if (matchingWorks.length === 0) {
```

Run:

```powershell
node --test --test-name-pattern="duplicate author preview ids" tests/reader-editor-preview.test.mjs
```

Expected: FAIL because the unsafe mutation selects the first duplicate and renders `.rd-landing` instead of `.rd-preview-error`. Do not leave the mutation in the worktree.

- [ ] **Step 3: Restore the minimal exact-cardinality fix and verify GREEN**

Restore exactly:

```js
if (matchingWorks.length !== 1) {
```

Run:

```powershell
node --test --test-name-pattern="duplicate author preview ids" tests/reader-editor-preview.test.mjs
```

Expected: the duplicate-ID test passes and neither duplicate work is rendered.

- [ ] **Step 4: Re-run all P0 focused tests after GREEN**

```powershell
node --test tests/editor-reader-preview.test.mjs tests/reader-editor-preview.test.mjs tests/reader-phone-module-trigger.test.mjs tests/reader-contact-context.test.mjs tests/reader-phone-gallery.test.mjs tests/reader-article-dangling-choice.test.mjs tests/reader-home-navigation.test.mjs tests/reader-import-resilience.test.mjs tests/reader-phone-call.test.mjs tests/reader-chat-choice-runtime.test.mjs tests/reader-social-choice-runtime.test.mjs tests/security-copy.test.mjs tests/build-verification.test.mjs
```

Expected: every focused bridge, preview, ordinary-reader, phone, security, and build-contract test passes.

---

### Task 3: Complete automated and production-build verification

**Files:**
- Verify: the complete repository test surface and both Vite production entries.

**Interfaces:**
- Consumes: all Task 1 and Task 2 behavior.
- Produces: fresh evidence that the existing dirty UI tree and the P0 work together without generated output.

- [ ] **Step 1: Run the complete automated suite**

```powershell
npm test
```

Expected: exit code 0 with zero failed, cancelled, or error-skipped tests.

- [ ] **Step 2: Run TypeScript and both temporary production builds**

```powershell
npm run build:verify
```

Expected: exit code 0; the editor output contains `reader/index.html`, the independent reader build succeeds, and temporary outputs are removed.

- [ ] **Step 3: Check scoped whitespace and generated-file state**

```powershell
git diff --check -- js/pages/reader.js js/app.js vite.config.ts reader/editor-preview.js reader/reader.js tests/editor-reader-preview.test.mjs tests/reader-editor-preview.test.mjs
git status --short
```

Expected: no scoped whitespace error, no staged file, and no generated build output.

---

### Task 4: Real-browser acceptance, independent review, and final proof

**Files:**
- Verify: author work-list route, built reader entry, local storage, and real reader interaction.

**Interfaces:**
- Consumes: an article containing a character-bound phone module in the author library.
- Produces: browser evidence for same-tab navigation, author-control removal, character gating, read-only storage, and author return behavior.

- [ ] **Step 1: Start the local author app**

```powershell
npm run dev -- --host 127.0.0.1
```

Expected: the author app is reachable on port 8765.

- [ ] **Step 2: Exercise the complete P0 flow in the real browser**

1. Open an author article containing a character-bound memo, gallery, browser, or shopping module.
2. Click its reader action and require a same-tab URL matching `/reader/index.html?preview=<encoded-id>`.
3. Start reading and require `.rd-pm-trigger`; require no `.pm-inline-card` or `[data-a="pm-hamburger"]`.
4. Open the bound app; require the character/prompt gate before content.
5. Cancel and require no content; reopen and confirm; require only the bound character's content.
6. Use the reader-home control and require return to the author app.
7. Compare `tuuru_works`, `moirain_recent`, and `moirain_work_<id>` before and after; require no preview-caused mutation.

- [ ] **Step 3: Request an independent read-only review**

Give the reviewer the approved design, this resume plan, the original implementation plan, the scoped diff, and fresh test/build evidence. Require explicit verdicts for exact-cardinality failure, URL safety, storage writes, duplicate-runtime removal, ordinary-reader preservation, build packaging, and unrelated dirty-worktree isolation.

Expected: no unresolved Critical or Important finding.

- [ ] **Step 4: Run fresh final verification after any review fix**

```powershell
node --test tests/editor-reader-preview.test.mjs tests/reader-editor-preview.test.mjs tests/reader-phone-module-trigger.test.mjs tests/reader-contact-context.test.mjs
npm test
npm run build:verify
git diff --check
git status --short
```

Expected: every test/build command exits 0, `git diff --check` is clean, no generated output remains, and all changes stay unstaged.
