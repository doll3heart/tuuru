# Phone Export Isolated Preview Deployment Plan

**Goal:** Give the user an iPad-accessible acceptance URL without updating tuuru.chat.

**Architecture:** Build current source into a fresh isolated output, append a preview-only starter with a synthetic existing regression fixture, and upload static assets to an explicit non-production Cloudflare Pages branch. Preserve all existing source/worktree changes; no commit or push.

**Tech Stack:** Existing Vite, Node, Playwright and Cloudflare Wrangler.

## Constraints

- Existing Pages project: `tuuru`; production branch is `codex/phone-runtime-overhaul` (also current checkout). NEVER deploy without an explicit different branch.
- Production deployment before upload: `e57b5d1c-ff06-4908-bd60-e8d95e403522`; verify unchanged afterward.
- Preview branch: `codex/phone-export-preview-20260907`. Do not change project settings, domains, production bindings or access policy.
- Publish fresh built static assets only, not repository/private files, credentials or generated test reports.
- Starter is preview-only, uses synthetic data and refuses to replace any existing preview bookshelf. Never runs on the production domains.
- WebKit PNG fidelity remains unresolved; URL availability is not iPad Safari acceptance.

## Build and starter

- [x] Create `browser-tests/phone-export/prepare-preview.mjs`: use Vite build into a unique `artifacts/phone-export-browser/preview-*` directory; validate an existing group fixture with `validateWorkForImport`; generate starter HTML and fixture JSON only in this output.
- [x] Starter button checks local/preview hostname and empty library before setting the fixed sample/library/appearance keys, then opens `/reader/`. It never clears storage and reports write failures inline.
- [x] Run `node node_modules/typescript/bin/tsc -b --pretty false` and `node browser-tests/phone-export/prepare-preview.mjs`: exit 0; fresh output `preview-FFDXlr`, 52 files / 26,838,076 bytes, no oversized or unexpected source/private files.
- [x] Verify built output, starter click, refusal on existing library, and actual export download in an isolated local Chromium context (`preview-check-wfA1Mi`, 7 PNGs / 3 branches, quota rollback). Independent read-only review clean; 5 fake-storage cases pass. Visual starter inspection at tablet width completed.

## Deployment and handoff

- [x] Upload only the generated output via `npx --yes wrangler@4.129.1 pages deploy D:/Projects/Tuuru/artifacts/phone-export-browser/preview-FFDXlr --project-name tuuru --branch codex/phone-export-preview-20260907 --commit-dirty=true`: exit 0.
- [x] Cloudflare metadata confirms deployment `4cf222a1-cb7c-4d1a-9bb6-22d60f493cf2`, environment `preview`, branch `codex/phone-export-preview-20260907`, deploy stage `success`.
- [x] Re-read production deployment: `e57b5d1c-ff06-4908-bd60-e8d95e403522` unchanged.
- [x] HTTPS starter returned 200/noindex; remote Chromium smoke `preview-check-cfFCFZ` passed starter, real 7-PNG/3-branch ZIP, existing-data refusal, quota rollback and no page errors. Handoff: `https://4cf222a1.tuuru.pages.dev/phone-export-test.html`. Actual iPad Safari acceptance remains pending; no production release or full compatibility claim.
