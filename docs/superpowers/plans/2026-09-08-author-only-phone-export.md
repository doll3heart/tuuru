# Author-only Phone Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every reader export delivery path and offer phone-content PNG/ZIP export only from the author's own local creative work library.

**Architecture:** The author owns the export controller, dialog, job planning, rasterization, archive and download. An isolated author render document reuses the reader's rendering primitives but can only produce DOM; it cannot deliver files. Canonical author work snapshots are validated before and during export, never sourced from reader imports or reading progress.

**Tech Stack:** Existing JavaScript modules, Vite multi-page build, Node test runner/JSDOM, Playwright Chromium/WebKit, html-to-image and fflate.

## Global Constraints

- Reader zero export of anything, any format. Only authors may export their own authored works.
- Remove all three reader delivery paths: reading-data JSON, appearance JSON, phone-content PNG/ZIP. Preserve reading, import/restore and local customization.
- Close the author local-profile migration bypass: newly serialized migration packages contain only the author database/settings, with empty `readerEntries`; retain legacy reader-entry import compatibility. Do not delete existing local reader data.
- Application ownership is the unique validated record in canonical `tuuru_works`; reader `moirain_readerLibrary`, `moirain_work_*`, editable author names and edit-session leases grant no export authority. No new account/backend system and no claims of authenticated original authorship.
- Ordinary reader and ordinary author reading preview have no export UI, downloader, batch planner or callable export delivery bridge. URL flags alone grant nothing.
- Preserve existing uncommitted resource, transfer-card layout, font, masking, cancellation, independent branch pagination and external-image failure fixes.
- Author exports must not read private reader progress/customization or write either author's work data or reader storage. Use canonical authored appearance and fresh/default author-preview choices.
- Retain all-reachable chat branch enumeration with an aggregate maximum of 64 branches, stable masked filenames and independent pagination. Non-chat modules export once.
- Canonical missing, duplicate, invalid, deleted or changed work is a fatal export error, never a recoverable per-module failure. Revalidate across asynchronous boundaries and immediately before download.
- No production deployment, commit, push, destructive cleanup, new dependency, external rendering service, weakened pixel thresholds or claim that Windows WebKit/Safari raster fidelity is repaired.
- Preserve the dirty working tree. Apply source edits with apply_patch. Generated reports/diffs are allowed. Required helper skills absent from the catalog are replaced by explicit local tests and independent review, without inventing instructions.

### Task 1: Move delivery to the author and close every reader export path

**Files:**
- Create focused author modules under `js/author-phone-*.js`, dedicated render HTML/entry and tests under `tests/author-phone-*.test.mjs`.
- Modify `reader/reader.js`, `reader/reader.css`, `js/pages/home.js`, author styles, `vite.config.ts`, `js/pages/resources.js`.
- Modify `js/local-profile-transport.js` and `tests/local-profile-transport.test.mjs` to exclude all reader entries from new author migration exports while testing legacy imports from explicit old-format fixtures.
- Update `tests/reader-phone-content-export.test.mjs`, `tests/reader-phone-story-events.test.mjs`, `tests/entry-loading-performance.test.mjs`, `tests/reader-data-backup-ui.test.mjs`, `tests/reader-article-appearance-dialog.test.mjs`, `tests/resources-page.test.mjs`, plus directly affected existing tests.
- Retain `reader/phone-content-export.js` and `reader/phone-export-assets.js` as shared pure helpers imported exclusively by author orchestration.

**Interfaces:**
- UI begins at existing `window.openWorkExport(workId)` and adds `[data-work-phone-images]` only for a canonical work with phone content. Clicking it opens an author modal with `[data-author-phone-export-start]`, `[data-author-phone-export-cancel]`, status/progress and default/all-branch choices.
- Author snapshot helper `readAuthorPhoneExportSnapshot(workId, {storage})` returns cloned work plus a full JSON token. A session's `assertCurrent()` re-reads unique canonical data and rejects stale/invalid authority.
- Render-only adapter supplies `{phoneData, frame, renderChat, renderForum, renderApp, dispose}`. It uses isolated globals and explicit author/default settings, not `getPhoneCustom()`/saved reader books. No ordinary reader route may initialize a file-delivery bridge.
- Author planner receives the adapter and snapshot; it no longer closes over the live reader's `_work` or choice session. Capture continues to use existing pure `capturePhonePanelPages`/archive helpers.

- [ ] Step 1: Write failing executable regressions for reader-only records, duplicate/malformed canonical data, stale work during capture, no reader export buttons/delivery imports, and preserved import controls. Use assertions such as:

```js
assert.throws(() => readAuthorPhoneExportSnapshot('reader-only', {storage}), /作品/)
assert.equal(readerRoot.querySelector('[data-reader-data-export]'), null)
assert.equal(readerRoot.querySelector('[data-reader-appearance-export]'), null)
assert.equal(readerRoot.querySelector('[data-reader-phone-control="export"]'), null)
assert.ok(readerRoot.querySelector('[data-reader-data-import]'))
assert.ok(readerRoot.querySelector('[data-reader-appearance-import]'))
```

- [ ] Step 2: Run the new tests, record their failing result in `.superpowers/sdd/author-export-task-1-report.md`.
- [ ] Step 3: Extract the reader export block around `readerPhoneExportContactTargets` through `openReaderPhoneExportDialog` into author orchestration, preserving job semantics. Replace globals with explicit adapter/snapshot dependencies. Remove reader `downloadBlob`, JSON serializer imports/handlers/buttons; change backup/share text to import/restore text and focus to import controls.
- [ ] Step 4: Create isolated render startup that reuses reader renderers without normal reader boot. Guard frame setup with parent-owned author controller/context, validate canonical data, bypass shared reader appearance and active-slot lookup. Close/remove the frame on failure, cancellation and completion. The frame renders authored DOM only; author code calls capture and download.
- [ ] Step 5: Add author modal using existing modal/toast/design tokens. Label modes `默认分支` and `全部分支`, explain each chat branch is paginated independently. Keep masking, disabled/pending state, accessible status, progress, cancel, partial asset warning and zero-file failure. Author-only lazy import must retain separation from the reader bundle.
- [ ] Step 6: Revalidate canonical token after readiness, before jobs, after capture/archive awaits and synchronously before `downloadBlob`. Distinguish fatal author-context errors from recoverable asset errors, so stale authority discards all generated files.
- [ ] Step 7: Update tutorial sections to author `导出作品 → 小手机图片`; remove reader backup/appearance sharing instructions. Move existing positive export integration tests to author context and retain negative reader tests. Keep pure serializer tests as import-format compatibility coverage.
- [ ] Step 7b: Change `serializeLocalProfile` to emit `readerEntries:{}` rather than scanning `moirain_*`, retaining format/version and legacy inspector/merge logic. Test with sentinel reader cached work/progress/customization that none appear anywhere in the output and original storage is unchanged. Update home migration label/copy to `作者搬家`, author library/settings only, and legacy restore explanation; update tutorial/affected copy tests.
- [ ] Step 8: Run focused tests, `npm test`, `npm run build:verify`, `git diff --check`. Record exact evidence and all touched files. No commits. Report adapter API/build entry/test selectors for Task 2. Independent review must approve both spec and quality.

### Task 2: Retarget acceptance and the isolated test starter to the author workflow

**Files:**
- Modify `scripts/run-phone-export-browser.mjs`, `browser-tests/phone-export/fixture.mjs`, `edge-fixture.mjs`, `probe.mjs`, `prepare-preview.mjs`, `verify-preview.mjs`, related fixture/test helpers as needed.
- Update `docs/testing/phone-export-browser.md`, `.github/workflows/phone-export-browser.yml` only if command interface changes, and focused Node browser-fixture tests.

**Interfaces:**
- Trigger the real author home `window.openWorkExport(workId)` / `[data-work-phone-images]`, then author modal selectors from Task 1.
- Observe actual rendering iframe via Playwright binding `source.frame`, not the parent reader DOM. The author-only controller still imports the existing pure rasterizer, so the probe may instrument that module's raster boundary.
- Fixtures seed a synthetic canonical author work. Normal reader storage may be separately seeded as a poison/isolation control, never used as source. Public starter stores the synthetic test work only in an explicitly labelled author-test library context and navigates author UI; it refuses overwriting existing creative data and rolls back atomically on quota failure.

- [ ] Step 1: Add failing fixture assertions that starter does not create/import a reader book, labels itself author-only, navigates author entry, rejects existing data, and rolls back partial storage writes. Keep real JPEG/PNG/download assertions and unchanged pixel thresholds.
- [ ] Step 2: Migrate browser navigation/seeding and observer-frame capture. Retain 13 scenario coverage, three branch routes, atomic job failure, CORS/no-CORS/wallpaper/404 cases, cancellation, masking, independent pagination and storage-isolation assertions. Do not delete tests merely because moving the controller changes their setup.
- [ ] Step 3: Rewrite the preview starter/verification to the real author workflow and fresh build input. The currently deployed reader-based preview is obsolete and must not be described as valid acceptance. Build a corrected isolated preview artifact locally; do not deploy production.
- [ ] Step 4: Run focused fixture tests and full Chromium browser acceptance. Run scoped Windows WebKit contract cases and clearly retain the known typography/shadow failures; do not change rasterizer or thresholds to conceal them. Verify no reader download in a real ordinary reader page or normal author reading preview, including forged query flags and stale export control elements.
- [ ] Step 5: Run fresh `npm run verify`, syntax/diff checks and local preview smoke. Record exact artifact paths and counts. Update docs with author ownership, obsolete preview notice and genuine Safari limitations. No commit/push/production deployment.
- [ ] Step 6: Independent task review, then broad final review of this turn's diff. Fix Critical/Important findings with covering tests and re-review; record all final evidence in `.superpowers/sdd/progress.md`.
