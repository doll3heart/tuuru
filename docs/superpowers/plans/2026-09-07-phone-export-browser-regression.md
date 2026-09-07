# Phone Export Browser Regression Implementation Plan

**Goal:** Automatically validate real downloaded phone-export PNGs for layout fidelity, complete messages, and independent branch pagination.

**Architecture:** Run the actual reader UI in isolated Playwright Chromium contexts against a loopback Vite server. A test-only Vite transform observes the real html-to-image call, without replacing its PNG output. Compare each ZIP image to Chromium's native screenshot of the same staged page and separately validate message geometry, route content, and page continuity. Native reference images are made in the same browser run to avoid OS font-dependent golden files.

**Tech Stack:** Node, Vite, Playwright, pngjs, pixelmatch, existing fflate.

## Constraints

- Scope is automated export acceptance only. No reader features, runtime fixes, publication or deployment.
- Preserve existing untracked user artifacts and plans.
- Use disposable browser profiles and embedded fixture assets; never use the user's bookshelf or Downloads directory.
- The real exporter must produce every tested PNG and ZIP. No fake rasterizer/blob.
- Fail on missing routes, clipped ordinary-sized messages, overlap, image differences, download failure or unexpected browser errors.
- Explicitly document that a message taller than a page is outside the whole-message pagination guarantee.
- Keep failed-run PNGs, native references, differences and a JSON report in an ignored run directory. Automatically remove successful run artifacts unless explicitly requested.

## Task 1: Deterministic fixture and real-export observer

Files: `browser-tests/phone-export/fixture.mjs`, `browser-tests/phone-export/probe.mjs`, `scripts/run-phone-export-browser.mjs`, `package.json`, `package-lock.json`.

- [x] Build a fixed phone work with all rendered message/card families, alternating senders, Chinese/Latin multiline text, an embedded image, three conditional terminal routes including endRound, and custom full/slice bubble skins.
- [x] Start Vite on an OS-assigned loopback port; install an observer only in the test server transform of `reader/phone-content-export.js`.
- [x] Seed a fresh context and drive the real reader export dialog; receive the actual download and decode ZIP entries.
- [x] Capture a native Chromium screenshot and DOM geometry before each real rasterization. Restore stage positioning after observing it.

## Task 2: Assertions, negative controls, and reusable command

Files: `browser-tests/phone-export/assertions.mjs`, `scripts/run-phone-export-browser.mjs`, `tests/phone-export-browser-assertions.test.mjs`, `tests/local-lock-browser-harness.test.mjs`, `docs/testing/phone-export-browser.md`, `.github/workflows/phone-export-browser.yml`, `.gitignore`.

- [x] Check PNG dimensions, per-message image fidelity, text/card containment, adjacent-item overlap, page continuity and whole-message containment for ordinary-sized items.
- [x] Verify expected route content, independent numbering and reader storage isolation. Cover desktop/current, narrow/all, full skin and slice skin.
- [x] Run negative controls that introduce a payment overlap, a cut through a message, and a corrupted raster image; require the corresponding assertions to reject them.
- [x] Expose `npm run test:phone-export:browser` and a combined `verify:phone-export` gate. Document browser install and artifact retention.
- [x] Run browser acceptance and negative controls, relevant Node tests and `npm run build:verify`; record actual results.

## Verification results

- `npm run verify`: exit 0 on final standalone run (complete Node suite, TypeScript and production Vite build).
- New oracle tests: 6/6 passed. Updated the existing exact package-manifest guard for the approved test-only dependencies and commands; production dependencies are unchanged.
- `node scripts/run-phone-export-browser.mjs --keep-artifacts`: exit 1, correctly reporting real raster mismatches in all 4 scenarios / 22 downloaded PNGs. Route content, DOM geometry, DOM pagination, storage isolation and staging cleanup passed; no browser exceptions. All three negative controls rejected their damaged input.
- Final evidence: `artifacts/phone-export-browser/run-TGMb6s/report.json` and sibling case directories (ignored by Git). Superseded debug runs were moved to the Windows Recycle Bin; unrelated pre-existing artifacts were preserved.
- Confirmed visually: location-card images become taller in PNG and push a contact card across the page boundary; the contacts-page round avatar becomes flattened. These are existing exporter defects, not waived baseline differences.
- Production reader/export sources were not modified. CI workflow was added but has not run remotely; nothing was committed, pushed or deployed.
