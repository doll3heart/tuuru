# Phone Export Raster Fidelity Implementation Plan

> **For agentic workers:** Use task-by-task execution and independent review. The user has authorized repair in the current session; no commit, push or deployment is requested.

**Goal:** Repair the real PNG distortion detected by the existing 4-scenario / 22-image browser acceptance suite.

**Architecture:** Preserve the settled export DOM's dimensions and typography when html-to-image clones it. Keep the detached render, masking, page measurement and ZIP flow. Address SVG descendant paint styles separately because the dependency deep-clones SVG without computing child styles.

**Tech Stack:** Vanilla JavaScript, html-to-image 1.11.13, JSDOM / node:test, Playwright Chromium.

## Global Constraints

- Preserve all existing uncommitted acceptance infrastructure and unrelated user files.
- Do not lower PNG comparison thresholds or skip failing message types.
- Never mutate the live reader DOM or saved reading state.
- No dependency patch in node_modules and no dependency upgrade.
- No publication, commit or deployment without a new user request.

## Evidence and hypothesis

The retained baseline is `artifacts/phone-export-browser/run-TGMb6s/report.json`: 4 scenarios / 22 PNGs fail only raster comparison; DOM geometry, branch content, pagination and storage checks pass. Images show a location image growing and contacts avatars flattening.

`reader/phone-content-export.js` excludes `height` and `block-size` globally. Those computed dimensions are necessary for stylesheet-sized images, avatars and headers in the stylesheet-free SVG clone. `node_modules/html-to-image/es/clone-node.js` also floors every pixel font-size then subtracts 0.1, and deep-clones SVG descendants without copying their CSS. These are separately testable causes of the remaining differences.

## Task 1: Preserve element dimensions

Files: `reader/phone-content-export.js`, `tests/phone-content-export.test.mjs`.

- [x] Replace the obsolete height-omission test with a failing assertion that `includeStyleProperties` contains `height` and `block-size`.
- [x] Run `node --test tests/phone-content-export.test.mjs` and record the expected new failure.
- [x] Minimal experiment: change `exportCloneStyleProperties` to `return Array.from(style)` so fixed card / avatar dimensions survive the dependency clone.
- [x] Run `node scripts/run-phone-export-browser.mjs --case=desktop-current --keep-artifacts`; inspect actual PNGs and residual per-message differences before further changes.

## Task 2: Preserve exact text and SVG paint styles

Files: `reader/phone-content-export.js`, `tests/phone-content-export.test.mjs`.

- [x] Add a failing test with CSS-only `font-size:13.5px` and `svg rect { fill:rgb(120, 130, 140) }`. The rasterizer callback must observe the exact staged styles and the live source must remain unchanged.
- [x] Snapshot resolved font-size values for the detached export viewport and descendants, then set them inline before rasterization. Omit only `font-size` from the dependency property-copy list so its rounding workaround cannot change the authored size; retain dimensions.
- [x] Snapshot resolved SVG descendant styles before applying any mutation and materialize them inline, because html-to-image bypasses decoration for those descendants.
- [x] Preserve independent generated-content font sizes with clone-local marker rules, including viewport-root pseudos. Added a failing unit case, fixed it, and added decorative 8px pseudo text to the full-skin browser fixture.
- [x] Re-run targeted Node tests and the desktop PNG acceptance case. Investigate residual differences independently; do not adjust thresholds without an evidenced oracle error.

## Task 3: Verification and handoff

Files: acceptance helpers only if independent audit finds an actual oracle defect; `docs/testing/phone-export-browser.md`.

- [x] Run all four browser cases, keeping one final evidence set; review the native/PNG pair around location cards, transfer cards and contact avatars.
- [x] Run `npm run verify` separately from the browser workload to avoid stressing timer-sensitive existing tests.
- [x] Review the final diff, document the actual results and limitations, preserve the original failure evidence, and report whether all checks passed. Do not commit or deploy.

## Recorded evidence

- Height-only regression initially failed as expected. Restoring heights reduced desktop page mismatch from 8.34% / 14.32% / 1.83% to 1.57% / 0.705% / 0.234%; residual differences were text and SVG paint.
- Exact font / SVG / pseudo tests failed before their respective fixes; the focused export + assertion suite passed 37 tests after implementation.
- Final browser run: `artifacts/phone-export-browser/run-tgmeKD/report.json`, exit 0. Desktop/current 3 PNGs (max 0.133%); narrow/all 7 (0.137%); full skin plus decorative pseudo text 3 (0.057%); slice skin 9 (0.057%). All negative controls passed, thresholds unchanged.
- Independent review identified and verified fixes for reference-backdrop corner noise, missing nested-owner assertion, and the pseudo-font edge case. Final review found no actionable blocker.
- Intermediate image runs were moved to the Recycle Bin; original failing `run-TGMb6s` and final passing `run-tgmeKD` were retained. Existing unrelated files were preserved.
- Final `npm run verify`: exit 0, 2431/2431 tests passed; TypeScript and production Vite build passed. `git diff --check` passed. Nothing committed, pushed or deployed.
