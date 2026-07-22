# Tuuru PWA/TWA and New Page Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the oversized `RW` decoration and ship an installable Tuuru web app plus an Android TWA shell whose content follows `https://tuuru.chat` deployments.

**Architecture:** Keep the author and reader as one Vite build. A root web manifest and Service Worker make both entries installable/offline-capable while network-first navigation and hashed assets preserve prompt web updates. Bubblewrap produces the thin Android shell for package `chat.tuuru.app`; the signing key remains local and its certificate fingerprint is published through `/.well-known/assetlinks.json`.

**Tech Stack:** Vite 6, vanilla JavaScript, Web App Manifest, Service Worker, Bubblewrap/Trusted Web Activity, Node test runner.

## Global Constraints

- Do not change author or reader storage keys or work schemas.
- Do not cache cross-origin requests or failed responses.
- Do not commit release keystores, passwords, generated Gradle caches, or APK intermediates.
- Do not push or deploy without a separate user instruction.

---

### Task 1: Remove the oversized RW decoration

**Files:**
- Modify: `js/pages/new.js`
- Test: `tests/home-write-ui.test.mjs`

**Interfaces:**
- Consumes: `renderNew(): string`
- Produces: the same interactive-article card and form without the literal decorative `RW` block

- [ ] Add an assertion that `renderNew()` still contains the interactive article action and does not contain `>RW<`.
- [ ] Run `node --test tests/home-write-ui.test.mjs` and confirm the new assertion fails.
- [ ] Delete only `<div style="font-size:3rem;margin-bottom:12px">RW</div>` from `renderNew()`.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Add an update-safe PWA shell

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Create: `public/icons/tuuru-icon.svg`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/icon-maskable-512.png`
- Create: `js/pwa-register.js`
- Modify: `index.html`
- Modify: `reader/index.html`
- Modify: `public/_headers`
- Test: `tests/pwa-twa.test.mjs`

**Interfaces:**
- Consumes: author route `/#/new`, reader route `/reader/`, Vite public-directory copying
- Produces: root-scoped manifest and Service Worker registration shared by both entries

- [ ] Assert the manifest identity, standalone display, start URL, scope, 192/512 icons, and author/reader shortcuts.
- [ ] Assert both HTML entries link the manifest, declare theme color, and load `pwa-register.js`.
- [ ] Assert the Service Worker uses network-first navigation, same-origin runtime caching, cache cleanup, `skipWaiting()`, and `clients.claim()`.
- [ ] Add deterministic gray-pink Tuuru wing icons and the manifest.
- [ ] Add Service Worker registration without forcing a reload while an author may be typing.
- [ ] Add no-cache response headers for `/sw.js` and `/manifest.webmanifest`.
- [ ] Run `node --test tests/pwa-twa.test.mjs tests/stylesheet-recovery.test.mjs` and confirm all assertions pass.

### Task 3: Prepare and build the TWA Android shell

**Files:**
- Create: `android/twa-manifest.json`
- Create: `android/README.md`
- Create: `public/.well-known/assetlinks.json`
- Modify: `.gitignore`
- Test: `tests/pwa-twa.test.mjs`

**Interfaces:**
- Consumes: `https://tuuru.chat/manifest.webmanifest`, package id `chat.tuuru.app`, permanent local signing certificate
- Produces: a signed installable APK that opens `https://tuuru.chat/` and follows later web deployments

- [ ] Assert the TWA host, start URL, package id, `appVersion`, icon URLs, and signing exclusions.
- [ ] Initialize Bubblewrap from the Tuuru manifest and keep its generated project under `android/`.
- [ ] Generate one permanent local release keystore outside tracked paths, build the signed APK, and calculate its SHA-256 certificate fingerprint.
- [ ] Write `assetlinks.json` with relation `delegate_permission/common.handle_all_urls`, target package `chat.tuuru.app`, and the real fingerprint.
- [ ] Verify the APK archive exists and the TWA configuration points only to `tuuru.chat`.

### Task 4: Production verification

**Files:**
- Test: `tests/pwa-twa.test.mjs`
- Test: `tests/home-write-ui.test.mjs`

**Interfaces:**
- Consumes: all outputs from Tasks 1-3
- Produces: evidence that web builds, local data contracts, installation metadata, and APK packaging are intact

- [ ] Run the focused UI/PWA/TWA tests.
- [ ] Run `npm run build:verify` and confirm both HTML entries and public assets build successfully.
- [ ] Inspect the new page at a mobile viewport and confirm the RW gap is gone without changing either creation form.
- [ ] Report the local APK, keystore-backup location, certificate fingerprint, and the fact that nothing was pushed or deployed.
