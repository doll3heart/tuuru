# Phone Export WebKit Investigation and Repair Plan

**Goal:** Resolve the remaining reproducible WebKit startup and PNG text/shadow failures without changing authored appearance or claiming real Safari coverage.

**Architecture:** Separate test-server/browser navigation diagnostics from the production DOM-to-SVG-to-canvas pipeline. Preserve earlier external-image and pagination fixes. Only promote a change into production after a minimal failing example proves its cause; record the exact change alongside the evidence below.

**Tech Stack:** Existing Playwright Chromium/WebKit, Vite, html-to-image, Node/JSDOM and PNG comparison harness.

## Global Constraints

- Preserve all current uncommitted work. No commit, push, deployment, dependency changes, external uploads, or CORS bypass.
- No changed fonts, removed shadows, fixed sleeps, increased failure thresholds, or silent scenario skips to make screenshots pass.
- Keep page/branch/ZIP behavior, privacy masking, image failure semantics, cancellation and live reader state isolation intact.
- One browser investigation at a time on this host. Independent code/artifact review may run concurrently.
- Use existing per-page 1% and per-message 2.5% mismatch thresholds. Real iPhone Safari requires an actual device and remains separately identified.

## Task 1: Navigation boundary investigation

**Files:** inspect `scripts/run-phone-export-browser.mjs`, `vite.config.ts`, existing reports; a dedicated temporary diagnostic module may live under `browser-tests/phone-export/`.

- [x] Record loopback request/response/failure events and lifecycle events, then use controlled interception/watcher comparisons and CPU profiling to locate the stall.
- [x] Inspect outstanding requests and event-loop timing; distinguish unloaded entry modules from application startup and browser-only event failures.
- [x] Implement the confirmed acceptance-only watcher correction, with a real resolved-Vite regression test; no navigation timeout increase.
- [x] Re-run `image-all-failed` and `css-image-cors` through the real dialog (`run-qHPmOR`, `run-VsZQb1`, then full `run-p8gGG8`).

Diagnostic event shape:

```js
page.on('request', request => pending.set(request, { url: request.url(), startedAt: Date.now() }))
page.on('requestfinished', request => pending.delete(request))
page.on('requestfailed', request => { failures.push({ url: request.url(), error: request.failure() }); pending.delete(request) })
page.on('domcontentloaded', () => lifecycle.push('domcontentloaded'))
```

**Confirmed startup cause and change:** CPU profile identified about 8.28 s in Node `FSWatcher` creation via Vite/chokidar while traversing the workspace (including `.toolchains` and `artifacts`). Removing loopback interception did not improve it. Inline `server.watch:null` was not effective because Vite configuration merging discarded the null. The acceptance-only plugin will disable watching after resolution:

```js
configResolved(config) {
  config.server.watch = null
}
```

The effective `NoopWatcher` discriminator (`startup-XvMOZC`) reduced navigation to 400 ms and maximum event-loop stall to 73 ms, from 8–9 s and 5.5–5.9 s. Normal app development does not load this plugin.

## Task 2: Raster fidelity investigation

**Files:** `reader/phone-content-export.js`, dependency source read-only, `browser-tests/phone-export/probe.mjs`, existing native/export/diff PNGs.

- [x] Compare the same page's native and exported PNGs; locate whether differences are geometric, font metrics, glyph paint or shadow paint.
- [x] Trace WebKit computed-style serialization and SVG/canvas scaling; build a minimal local fixture to change one variable at a time.
- [ ] Record the proved hypothesis and exact production delta before applying it; add a failing regression test, then verify the smallest fix.
- [x] Preserve authored typography, shadow values, source tree and existing Chromium behavior (final Chromium `run-AHsPsG`: 13/13, 42 PNGs).

**Raster boundary evidence:** `raster-probe-AiYPev` reproduces the discrepancy with only text and rounded shadows. Serialized foreignObject HTML rendered back as normal HTML matches the native source (Chromium 0 differing pixels, WebKit 1); WebKit PNG differs at 5,488 pixels. Computed `cssText` is empty in both engines, ruling out the library's cssText branch here. Doubling SVG intrinsic dimensions with the same viewBox makes no difference. CSS zoom also fails: `raster-probe-ZOsMPt` worsens both engines' fidelity. Neither hypothesis was promoted to production.

**Resolution discriminator:** `raster-probe-X19JzM` confirms the native DPR2 page and internal SVG-image page evaluate `min-resolution:1.5dppx` differently in BOTH engines. This is shared boundary evidence, not a WebKit-specific bug proof. Current WebKit source rounds text baselines using document device scale while its SVG-image internal Page starts at scale 1; this supports the alternating-line observation, but does not prove the exact shipped revision or the shadow mechanism. A real Safari reproduction is needed before expanding into a replacement rasterizer. No authored style or acceptance threshold was changed; raster repair remains open.

## Additional confirmed acceptance issues

- [x] Full `run-p8gGG8` exposed `image-404` conflating HTTP 404 with CORS denial. Return ACAO on the controlled 404 fixture only; dedicated denial cases stay denied. Header regression RED (`null` instead of `*`) then GREEN.
- [x] Existing CORS diagnostic predicate accepted an unrelated TypeError solely because its URL contained `/cors/`. Extract the predicate, reproduce RED, and narrow to exact known WebKit messages for the exact loopback host, path and query. Unknown messages remain failures. Covering Node tests 20/20 GREEN.

## Task 3: Integration verification

- [x] Independent read-only reviews of the watcher hook, real-Vite test, fixture isolation and exact CORS diagnostic classifier: no actionable findings.
- [x] Run both engines with `node scripts/run-phone-export-browser.mjs --browser=<engine> --suite=all --keep-artifacts`: Chromium `run-AHsPsG` 13/13, 42 PNGs and all three negative controls; WebKit `run-NsbUzN` 5/13, 42 PNGs, no startup timeout, remaining 8 fail raster fidelity. Thresholds unchanged.
- [x] Run `npm run verify` serially after browser runs: exit 0, 2466/2466, no failures/skips, TypeScript and production build passed; syntax and diff checks clean.
- [x] Update `docs/testing/phone-export-browser.md` and the progress ledger with exact outcomes and the real-iPhone limitation. Raster repair remains explicitly open pending real Safari evidence and a justified rendering approach.
