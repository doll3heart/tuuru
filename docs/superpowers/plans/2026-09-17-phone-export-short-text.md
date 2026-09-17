# Phone Export Short Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent short chat text from gaining an overflowing last line when exported under fractional zoom.

**Architecture:** Stabilize text content widths on the disposable export DOM after assets settle and before pagination. Preserve measured image/card sizes and exact fonts. Exercise the real author workflow and inspect the serialized raster clone as well as its final PNG.

**Tech Stack:** JavaScript, html-to-image 1.11.13, Playwright Chromium/WebKit, node:test, PNGJS.

**Local result (2026-09-17):** Implemented and independently reviewed. Full verification passed 2496/2496 tests plus build; Chromium 13 core/edge scenarios and 8 focused text scenarios passed. WebKit serialized geometry passed but its final PNG fidelity still fails unchanged thresholds; real Safari not verified. CI and `verify:phone-export` now include the focused test. The later system-message complaint was separately reproduced with the timestamp-hiding setting, and the user confirmed that setting was the cause; no timestamp behavior was changed. The user subsequently authorized a local commit only, not push or deployment.

## Global Constraints

- Reader exports remain forbidden; canonical author ownership and capability boundaries stay unchanged.
- Do not change live reader/editor CSS, font sizes, message content, pagination policy, or non-text card dimensions.
- Operate only on the disposable export tree; keep exact font sizes and SVG icon styles.
- Preserve image, voice, payment, skin and quote rendering. Preserve original skin minimum heights when changing box sizing.
- No push or deployment is authorized in this turn; preserve unrelated untracked files.
- Production feedback device is unknown; local emulation is not real iPad Safari verification.

## Evidence

The ignored diagnostic `.superpowers/sdd/short-bubble-diagnostic.mjs`, run with `DIAG_ENGINE=chromium` and `DIAG_ZOOM=1.1`, produced the exact short-text overflow in `artifacts/phone-export-browser/short-diagnostic-GZ9Mde/`. A 142.652px border-box with 0.826446px borders is serialized, then borders snap to 1px, leaving 116.64px for 117px of text while keeping one-line height. Merely switching to content-box still fails at zoom0.9: computed used widths can be copied slightly smaller. A stable integer CSS min-width prevents that second quantization.

### Task 1: Stabilize text export and add a discriminating browser regression

**Files:**
- Create: `reader/phone-export-text-layout.js` (export-only text sizing helper).
- Modify: `reader/phone-content-export.js` (call helper after assets/layout, before raster preservation and pagination).
- Create: `tests/phone-export-text-layout.test.mjs` (box conversion/isolation tests).
- Create: `scripts/run-phone-export-text-browser.mjs` (real author ZIP + serialization regression).
- Modify: `package.json`, `docs/testing/phone-export-browser.md` (document/integrate focused command).
- Optional focused shared fixture/assertion file under `browser-tests/phone-export/` if runner otherwise mixes concerns.

**Interfaces:**
- Consumes: `capturePhonePanelPages(sourcePanel, options)`, existing author fixture/workflow and browser geometry helpers.
- Produces: `stabilizePhoneExportTextBoxes(root): void` and executable `npm run test:phone-export:text`.

- [ ] Add regression before the fix: actual authored short messages on both sides (`……？`, `是不小心按错了吗？`, `你真的考虑清楚了吗？`, `我在资料室里等你`, `还是说...要我过去找你？`, `你好`, `你好。`, English, emoji), interspersed with multiline text, quote and image. Test zoom0.9,1,1.1,1.25 with zoom confined to the hidden render document; include fractional font stress separately from authored capability. Reuse the real author entry, do not create a reader export path.

```js
const serialized = await toSvg(node, options)
await node.ownerDocument.defaultView.__phoneExportTextProbe(serialized)
return realToBlob(node, options)
// Test-only Vite transform. Replay serialized foreignObject in a clean page,
// measure its text lines, assert they stay inside bubbles and retain source
// line count; capture its native rendering, then compare real downloaded PNG.
```

- [ ] Run unfixed regression and record failure (line count or vertical escape) rather than accepting a mock-only failing test.

```powershell
npm run test:phone-export:text -- --browser=chromium
```

- [ ] Implement a two-phase text-only normalization. Skip voice and image/SVG/media-containing bubbles. Snapshot computed constraints before mutations. Convert pixel min/max width and min/max height from border-box to content-box by subtracting padding plus borders on the appropriate axis; leave non-pixel keywords unchanged. Ceil the converted maximum content width so rounding cannot further narrow it. Preserve existing fixed dimensions if present. Do not globally drop copied dimensions.

```js
// In the new helper, after conversion to content-box and a fresh layout read:
const usedWidth = Number.parseFloat(ownerWindow.getComputedStyle(bubble).width)
if (Number.isFinite(usedWidth) && usedWidth > 0) {
  bubble.style.setProperty('min-width', `${Math.ceil(usedWidth)}px`, 'important')
}
// min-width retains its specified value during serialization; width is a
// quantized used value and cannot provide this guarantee by itself.
```

```js
// capturePhonePanelPages, after waitForPhoneExportLayout and before measurement:
stabilizePhoneExportTextBoxes(viewport)
preserveExportRasterStyles(viewport)
```

- [ ] Unit-test border-box constraint conversion, normal/content-box text, invalid/zero dimensions, skin minimum height, preserved font and source DOM, image/voice exclusions. The existing dependency remains responsible for rasterization; no new dependency or schema.

```powershell
node --test tests/phone-export-text-layout.test.mjs tests/phone-content-export.test.mjs
```

- [ ] Strengthen the focused PNG assertion with tight bubble plus spill-margin regions and a negative control that moves a small glyph-sized patch below a bubble. A whole-page threshold alone must not accept this damage. Assert expected text is nonempty. Keep known Windows WebKit unrelated shadow differences explicit rather than relaxing existing global thresholds.

- [ ] Verify Chromium zoom regression, then WebKit geometry/PNG with honest platform-specific results; run existing full core+edge phone export suite to guard images, voice, payment cards, skins and branch pagination.

```powershell
npm run test:phone-export:text -- --browser=chromium
npm run test:phone-export:text -- --browser=webkit
npm run test:phone-export:browser -- --suite=all
npm run verify
git -c core.safecrlf=false diff --check
```

- [ ] Independent spec/code-quality review and final integration check; report scope and remaining real-device limitation. Leave changes uncommitted for user review (no deployment).
