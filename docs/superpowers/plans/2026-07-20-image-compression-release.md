# Image Compression Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically compress locally selected article images to roughly 500KB, enforce a 1MB stored-image ceiling, and release the accumulated verified fixes.

**Architecture:** Put browser image decoding, canvas resizing, quality iteration, and Data URL conversion in one focused module. Keep animated GIFs unchanged when already safe, reject unsupported or oversized results, and let the existing editor insertion path store only the processed Data URL.

**Tech Stack:** Vanilla JavaScript, Canvas, FileReader, Node test runner, Vite, GitHub/Cloudflare Pages.

## Global Constraints

- Target encoded file size: 500KB.
- Hard stored-image limit: 1MB.
- Maximum selected source file: 10MB.
- Maximum image edge: 1920px.
- Do not include prototype or showcase artifacts in the release commit.

---

### Task 1: Compression policy and browser pipeline

**Files:**
- Create: `js/image-compression.js`
- Create: `tests/image-compression.test.mjs`
- Modify: `js/pages/editor.js`

**Interfaces:**
- Consumes: a browser `File` selected by the author.
- Produces: `compressEditorImage(file)` resolving to `{ dataUrl, originalBytes, outputBytes, compressed }`.

- [ ] **Step 1: Write failing tests** for constants, pass-through files, GIF safety, source limits, and mocked compression results.
- [ ] **Step 2: Run** `node --test tests/image-compression.test.mjs` and confirm failure before implementation.
- [ ] **Step 3: Implement** canvas resize/quality iteration and replace direct `FileReader` insertion in the editor.
- [ ] **Step 4: Run** focused tests and confirm pass.

### Task 2: Verify and release

**Files:**
- Modify only the already-scoped source and regression files from this release.

**Interfaces:**
- Consumes: the complete local release diff.
- Produces: one pushed commit that triggers the existing Cloudflare Pages deployment.

- [ ] **Step 1: Run** `npm test`, expecting zero failures.
- [ ] **Step 2: Run** `npm run build:verify` and `git diff --check`, expecting exit code 0.
- [ ] **Step 3: Stage only scoped files, commit, and push the current branch.**
- [ ] **Step 4: Verify the remote branch and deployment endpoint without modifying reader data.**
