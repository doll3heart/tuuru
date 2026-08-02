# Reader Widget Direction V7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the approved v6 widget logic into a polished board of at least twenty distinct small components using appropriately cropped assets from `D:\jili` and `D:\qiqi`.

**Architecture:** Preserve `reader-widget-direction-v6.html` as the approved baseline and create a self-contained v7 prototype beside it. Copy only the selected raster assets into a dedicated prototype asset folder, then compose them with semantic HTML and shared CSS tokens across functional, photo, and purely decorative widgets. Keep filtering local to the prototype and verify both desktop and phone layouts with rendered screenshots.

**Tech Stack:** Semantic HTML, vanilla CSS, minimal vanilla JavaScript, local PNG/JPG assets, existing project screenshot tooling or Chromium.

## Global Constraints

- A widget is not automatically a shortcut; decorative and photo-only specimens must not imply click behavior.
- Functional fields must match the component theme and may not cover important artwork.
- Every user-photo position is an empty slot in the prototype; the product supplies only the base, mask, spacing, and crop while the user selects the image.
- No single fixed character family should dominate the decorative set; balance character art with ribbons, tickets, fruit, lace, and other purchased material families.
- Rejected component types may return when their composition, cropping, and finish are materially improved.
- Preserve v6 unchanged as the comparison baseline.
- Use only assets copied from `D:\jili`, `D:\qiqi`, or the already approved v6 asset set.
- Support a 320 px minimum viewport and `prefers-reduced-motion`.

---

### Task 1: Curate and normalize the material set

**Files:**
- Create: `docs/design-prototypes/assets/widget-direction-v7/*`

**Interfaces:**
- Consumes: raster assets under `D:\jili` and `D:\qiqi`
- Produces: stable, descriptive local filenames referenced by the v7 prototype

- [x] **Step 1: Audit candidate assets by contact sheet**

  Generate labeled thumbnails grouped by source folder and reject assets that lose their silhouette at widget scale, contain baked-in placeholder copy, or require destructive cropping.

- [x] **Step 2: Select a cohesive subset**

  Select frames, ribbons, ticket shells, photo mounts, circular grounds, and rabbit illustrations that share the approved rose / powder-blue / soft-neutral register.

- [x] **Step 3: Copy assets with descriptive filenames**

  Copy the selected raster sources into `docs/design-prototypes/assets/widget-direction-v7/` without modifying the originals.

- [x] **Step 4: Verify copied assets**

  Run: `Get-ChildItem docs/design-prototypes/assets/widget-direction-v7 -File`

  Expected: every v7 `src` target exists and no source path points directly to `D:\jili` or `D:\qiqi`.

### Task 2: Build the expanded direction board

**Files:**
- Create: `docs/design-prototypes/reader-widget-direction-v7.html`

**Interfaces:**
- Consumes: descriptive assets from Task 1
- Produces: a standalone filterable prototype with `data-kind="function|photo|decor"`

- [x] **Step 1: Establish the shared visual system**

  Define the approved ink, rose, powder-blue, line, surface, spacing, radius, and focus tokens; use one product UI type family and variable grid spans.

- [x] **Step 2: Add functional specimens**

  Implement reading, music, date/time, voice, countdown, schedule, and progress concepts. Each specimen must expose only fields native to its theme.

- [x] **Step 3: Add photo specimens**

  Implement polaroid, photo booth, cameo, heart locket, hanging frame, and paired portrait concepts where the image remains the dominant content.

- [x] **Step 4: Add decorative specimens**

  Implement ribbon, sticker, dessert, charm, doily, and circular-plate objects with no open arrow, state, status, or fake click affordance.

- [x] **Step 5: Add filtering and accessibility**

  Keep native buttons for filters, synchronize `aria-pressed`, hide nonmatching figures with `hidden`, add visible keyboard focus, and disable nonessential transitions under reduced motion.

### Task 3: Render and refine

**Files:**
- Create: `docs/design-prototypes/reader-widget-direction-v7.png`
- Create: `docs/design-prototypes/reader-widget-direction-v7-mobile.png`
- Modify: `docs/design-prototypes/reader-widget-direction-v7.html`

**Interfaces:**
- Consumes: the standalone v7 board from Task 2
- Produces: desktop and mobile visual proofs

- [x] **Step 1: Render the desktop board**

  Render at 1440 px viewport width and capture the full page.

- [x] **Step 2: Render the mobile board**

  Render at 390 px viewport width and capture the full page.

- [x] **Step 3: Inspect composition**

  Check artwork clipping, text overlap, inconsistent visual weight, over-repeated card shells, and deceptive affordances; revise the HTML/CSS until all checks pass.

- [x] **Step 4: Validate document integrity**

  Run a local-link check for every image `src`, confirm all filter categories contain specimens, and ensure the board contains at least twenty figures.

- [x] **Step 5: Review the diff**

  Run: `git diff --check -- docs/design-prototypes/reader-widget-direction-v7.html docs/superpowers/plans/2026-08-01-reader-widget-direction-v7.md`

  Expected: no whitespace errors; v6 remains untouched.
