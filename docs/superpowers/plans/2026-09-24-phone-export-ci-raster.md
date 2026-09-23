# Phone export CI raster parity implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Diagnose and correct the Linux Chromium export comparison failure without hiding image defects.

**Architecture:** Keep the production exporter and raster oracle unchanged. Use shared test-only browser launch options to make native screenshot text use grayscale antialiasing, as the SVG/canvas export does; prove this hypothesis on an isolated GitHub branch before claiming resolution.

**Tech Stack:** Node test runner, Playwright Chromium/WebKit, Vite, pixelmatch, GitHub Actions.

## Global Constraints

- No production deployment or merge; the user authorized a temporary verification branch only.
- Keep page mismatch <= 1%, message mismatch <= 2.5%, pixelmatch threshold 0.15.
- Preserve geometry, pagination, privacy, cancellation, and damaged-image negative controls.
- Do not modify production UI, fonts, or exporter behavior for a test-environment difference.
- If Linux still fails, retain artifacts and return to diagnosis rather than widening thresholds.

## Evidence

Run 35888318787 at 4eaf6d2 fails identically to run 35236430657 at 1ad67ec. Its native screenshots have colored text-edge pixels while actual exports have grayscale edges. Local Windows Chromium 153.0.8010.12 passes all four core scenarios. Both environments use that same Chromium revision. This supports an antialiasing hypothesis but remote verification is still required.

### Task 1: Normalize only the test browser's text antialiasing

**Files:**
- Create: `browser-tests/phone-export/browser-options.mjs`
- Modify: `scripts/run-phone-export-browser.mjs`
- Modify: `scripts/run-phone-export-text-browser.mjs`
- Test: `tests/phone-export-browser-assertions.test.mjs`
- Document: `docs/testing/phone-export-browser.md`

**Interfaces:**
- Consumes: runner engine string `chromium` or `webkit`.
- Produces: `phoneExportBrowserOptions(engine)` returning Playwright launch options.

- [x] Add unit assertions and verify RED before adding the module:

```js
assert.deepEqual(phoneExportBrowserOptions('chromium'), {
  headless: true, args: ['--disable-lcd-text', '--font-render-hinting=none'],
})
assert.deepEqual(phoneExportBrowserOptions('webkit'), { headless: true })
```

Run: `node --test tests/phone-export-browser-assertions.test.mjs` (missing module failure expected).

- [x] Add the shared implementation; use it in both runners and record launch options in both reports:

```js
export function phoneExportBrowserOptions(engine) {
  return engine === 'chromium'
    ? { headless: true, args: ['--disable-lcd-text', '--font-render-hinting=none'] }
    : { headless: true }
}
// Each runner imports the function and uses:
const launchOptions = phoneExportBrowserOptions(engine)
browser = await ({ chromium, webkit }[engine]).launch(launchOptions)
report.launchOptions = launchOptions
```

- [x] Verify both unit and real downloaded-image tests, with unchanged oracles:

```sh
node --test tests/phone-export-browser-assertions.test.mjs tests/phone-export-text-layout.test.mjs
node scripts/run-phone-export-browser.mjs --keep-artifacts
node scripts/run-phone-export-text-browser.mjs
git diff --check
```

- [x] Create `codex/phone-export-ci-raster-20260924`, commit only the files listed above plus this plan, and push only that branch. Do not create a PR, merge, or deploy production.
- [ ] Inspect the new GitHub run through completion, including the previously skipped short-text step. If any check fails, inspect its actual images and revise the hypothesis.
- [ ] Document verified local/remote outcomes and remaining real-Safari limitations; keep evidence in ignored artifacts. Report results and stop before production merge/deployment.

## Hypothesis refinement

930e9b4's Linux run 35891487232 disproves LCD antialiasing as the complete explanation: native text loses colored edges, but page/region differences remain (2.01% / 4.46%). Actual PNG bytes remain identical to 4eaf6d2 for all 22 pages. Chromium's Linux font implementation selects hinting/subpixel positioning using device scale factor. The second single-variable experiment adds `--font-render-hinting=none` (headless's documented override). Verify the updated assertion RED, then run the 15 targeted tests and desktop-current locally before repeating the full Linux workflow. No thresholds or production styles change.

8734abf's Linux run 35892339478 also fails (1.97% page / 4.68% event region). Stop adjusting launch flags. Add optional test-only `__phoneExportSerializedProbe` in `browser-tests/phone-export/probe.mjs` and collect, for desktop-current's first two pages, the real serialized SVG, its re-mounted native screenshot/geometry, and native-to-clone / clone-to-export mismatch ratios in `scripts/run-phone-export-browser.mjs`. The original acceptance comparisons and thresholds remain active. Extend the observer unit test, run it plus desktop-current locally, and push only the diagnostic commit to the same temporary branch. This is boundary instrumentation, not a third claimed fix.
