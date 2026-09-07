# Phone Export External Images Implementation Plan

> **For agentic workers:** Use subagent-driven-development for the independent browser-contract task and review; retain all existing uncommitted changes.

**Goal:** Prevent external images from silently disappearing while phone image export reports success.

**Architecture:** Inline readable image resources on the disposable export tree before rasterization, respecting browser CORS, exact source URLs and cancellation. Reject the entire affected capture on unreadable images; retain the existing partial-job ZIP behavior with unmistakable warning feedback. Do not repair WebKit typography/shadows in this task.

**Tech Stack:** Browser Fetch/FileReader/image decoding, JavaScript, Node/JSDOM tests, existing Playwright/Vite PNG acceptance.

## Global Constraints

- No proxy, third-party upload, CORS bypass, global fetch interception or dependency mutation.
- Do not change live reader DOM, saved work, localStorage or branch/page behavior.
- Preserve exact resource query strings; do not add cache-busting parameters.
- Bound image fetch/body/decode work to 2500 ms per resource; cancel promptly and clean listeners/timers/staging.
- Inline once per unique resource within a capture; verify all resources before returning pages.
- Cover message images, avatars/covers, CSS backgrounds/border images/masks and generated image content.
- Skip an unreadable job rather than put known-missing images into its PNGs. Preserve other successful jobs, explicitly warn, list failures; all failures mean no download.
- No commit, push or deployment requested.

**Browser-discovered addition:** Exact signed-URL checks found the existing wallpaper renderer HTML-escaped the URL and then escaped the entire style attribute, changing `&` to literal `&amp;`. Correct the shared reader/export-preview wallpaper serialization to quote CSS first and HTML-escape once. This preserves the supplied address without changing saved appearance, navigation or layout.

### Task 1: Resource preparation and UI integration (root)

**Files:** Create `reader/phone-export-assets.js`, `tests/phone-export-assets.test.mjs`; modify `reader/phone-content-export.js`, `reader/reader.js`, `tests/reader-phone-content-export.test.mjs`.

**Interface:** `inlinePhoneExportImages(root, { signal, timeoutMs = 2500 } = {})` returns `null` when no external resources exist, otherwise a promise which rewrites only the supplied clone or rejects with `PhoneExportImageError` / `AbortError`. Error text must give a recovery action and omit URLs/tokens.

- [x] Add failing tests for readable/rejected/404/timeout/invalid images, deduplication, exact signed URLs, cancellation, CSS resources and source isolation; run the focused command to confirm RED.
- [x] Implement image collection, bounded fetch/validation, clone-only replacement and local pseudo rules. Call before existing layout/asset settling in `capturePhonePanelPages`.
- [x] Make partial-result label/toast say “部分导出” and skipped count with warning semantics; open existing failure details. Replace obsolete “可能显示为空白” copy with the new failure contract.
- [x] Run `node --test tests/phone-export-assets.test.mjs tests/phone-content-export.test.mjs tests/reader-phone-content-export.test.mjs` (66/66).
- [x] Correct shared wallpaper CSS/HTML URL serialization; add `tests/reader-phone-wallpaper-url.test.mjs` (RED 0/3, GREEN 3/3).

### Task 2: Real browser failure contract

**Files:** Modify `browser-tests/phone-export/edge-fixture.mjs`, `scripts/run-phone-export-browser.mjs`, relevant fixture unit tests only.

**Interface:** Image 404/timeout/denied-CORS fixtures now expect a warning and only the unaffected Contacts PNG; allowed-CORS retains full PNG fidelity comparisons. Add a no-successful-job fixture to verify error/no download and a CSS-image denied/allowed pair. Maintain existing normal-case geometry/raster thresholds.

- [x] Extend runner to wait for terminal export state, then inspect a warning ZIP or assert no download on error; never convert a successful-but-blank image into a passing case.
- [x] Assert explicit partial label, open failure details, warning toast, no failed chat entries, clean staging, restored buttons, unchanged storage. Preserve strict real-PNG comparison on remaining Contacts / allowed-image files.
- [x] Adjust pre-raster resource assertions: readable external images are embedded data URLs, not fetched again by the rasterizer. Record actual controlled resource requests and assert they occurred.
- [x] Add failure-only and CSS-image control cases; run fixture/oracle unit tests and report results. Root runs browser acceptance after integration.

### Task 3: Review and final verification

**Files:** Update `docs/testing/phone-export-browser.md` and this ledger.

- [x] Independent code review of new resource lifecycle, privacy, CSS replacement and failure contract. Final production/spec review approved; minor browser download-promise rejection handling corrected and re-reviewed.
- [x] Chromium full core+edge suite (13/13, 42 PNGs, `run-g7LyHh`); WebKit scoped resource cases (message CORS passes; two other cases blocked before export by initial navigation timeouts), without claiming typography/Safari fixes.
- [x] Serial `npm run verify` (2464/2464, TypeScript and production build, exit 0), syntax checks and `git diff --check`.
- [x] Document exact outcomes, image readability limitation and remaining WebKit/real-iPhone gap.
