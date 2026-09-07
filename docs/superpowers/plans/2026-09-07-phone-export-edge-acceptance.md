# Phone Export Edge Acceptance Implementation Plan

> **For agentic workers:** Execute the bounded test work in this session; use independent review for the new oracle and runner.

**Goal:** Supplement real PNG export acceptance for oversized messages, failed external images, imported fonts/complex supported CSS, and available WebKit.

**Architecture:** Reuse the real reader export UI and existing native-render/PNG comparison. Add deterministic edge fixtures and an explicit oversized-row pagination oracle, keeping ordinary-case thresholds unchanged. Simulate image responses on a second loopback origin, not the public internet.

**Tech Stack:** Node test runner, Playwright, Vite, pngjs, pixelmatch.

## Global Constraints

- Testing only: do not edit production reader code, commit, push or deploy.
- Preserve existing uncommitted work and retained acceptance evidence.
- Keep PNG width 720 pixels, page height at most 3200 pixels, page mismatch at most 1%, message mismatch at most 2.5%.
- Real iPhone Safari is untested unless actually available; Playwright WebKit is not a substitute for that claim.
- Oversized messages may span pages, but windows must cover the entire content without gaps/duplication; ordinary rows must remain whole.
- New failures remain visible in reports; do not loosen thresholds to hide defects.

### Task 1: Oversized pagination oracle

**Files:** Create `browser-tests/phone-export/edge-assertions.mjs` and `tests/phone-export-edge-assertions.test.mjs`.

**Interface:** Export `assertOversizedPagination(pages, commonIds, oversizedIds)` using the existing `measureExportPage()` geometry shape. Ordinary rows use the existing containment rule. Require each declared oversized ID exactly once, actually taller than 1600 CSS pixels, visible on at least two pages, with summed page intersections matching its complete height within 2 pixels. Check page order, positive sizes, continuous coverage, identical row IDs and complete panel end independently.

- [x] Add a positive 3300-pixel row fixture between ordinary `owner` / `ending` rows with page windows `[0,1600]`, `[1600,3200]`, `[3200,3600]`.
- [x] Add negative controls for a page gap, duplicate page, omitted final page, wrong oversized ID, a normal row split, and missing authored messages. Independent review additionally required row reflow and full-panel-shift negatives; all are implemented.
- [x] Run `node --test tests/phone-export-edge-assertions.test.mjs`; inspect every result. Ten oracle tests pass.

### Task 2: Real browser edge fixtures and engine selection

**Files:** Create `browser-tests/phone-export/edge-fixture.mjs`; modify the test-only runner/probe and relevant oracle tests.

- [x] Add `--suite=edge` and `--browser=chromium|webkit` while preserving default cases.
- [x] Use the original complete message/branch fixture; replace one long message with numbered text long enough to cross pages.
- [x] Add three controlled image cases: HTTP 404, loading timeout, and loaded image with denied cross-origin fetch. Assert that each intended request was exercised and preserve dimensions/results. Added a same-image CORS-allowed positive control.
- [x] Load a system font as reader `customFonts` under the unique family `ExportFixtureFont`, without redistributing font files. Add fractional font size, letter spacing, gradient, shadow and generated content through supported custom CSS. Assert computed styles/font availability, not merely saved settings.
- [x] Run the original Chromium suite and both available engines against supplemental cases; retain evidence using `--keep-artifacts`.

### Task 3: Review and record actual results

**Files:** Update `docs/testing/phone-export-browser.md` and this checklist.

- [x] Independently inspect test logic and representative native/export/diff PNGs, especially failed cases. Supplemental-code review approved after closing both demonstrated continuity false passes.
- [x] Run focused Node tests and `git diff --check`; run `npm run verify` serially after browser testing.
- [x] Record exact successes, failures, evidence paths and environment limits. Report newly found defects without silently repairing production code.

## Results ledger

- Chromium: `run-njL5j0`, 10 cases / 45 PNGs, 9 passed; denied-CORS image loss remains a real failure. Matching allowed-CORS control passed.
- Windows Playwright WebKit 26.6: `run-NN6E8q`, 10 cases / 45 PNGs, all fail full raster-fidelity acceptance. All ZIPs produced; remaining text/shadow differences are not a true iPhone Safari finding.
- WebKit reference capture initially raced compositor refresh; two animation frames resolve the invalid-reference discrepancy. Original `run-0eumr6` is diagnostic only, not final acceptance evidence.
- Final strengthened oversized oracle independently passed stored geometry from both complete runs; fresh Chromium oversized rerun `run-frHjXO` passed 7 PNGs and all three browser negative controls.
- Focused Node verification: 66 passed, 0 failed. Final `npm run verify`: exit 0, 2443 tests passed, TypeScript and production build passed. Syntax and diff checks passed.
- No production edits, commits, push or deployment in this supplemental-testing turn.
