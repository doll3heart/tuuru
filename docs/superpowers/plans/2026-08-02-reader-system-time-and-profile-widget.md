# Reader System-Time and Identity Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every date/time-facing desktop widget reflect the reader device's local system time, remove unknown fictional placeholder copy in favor of reader-owned blank fields, and make the cover/avatar/ID/signature identity card a movable home-screen component.

**Architecture:** Keep time formatting and countdown math in a small pure module, keep personal widget copy in a normalized product-keyed field map, and render the identity card through the same `phone-home-layout` definitions used by Apps and V7 widgets. The appearance editor remains the only drag-enabled surface, while the real phone reuses the persisted layout and live system-time markers.

**Tech Stack:** Vanilla ES modules, DOM Pointer Events, local-time `Date` APIs, CSS custom properties, Node test runner, JSDOM, Vite browser QA.

---

### Task 1: Lock the hardcoded-copy and time regressions

- [x] Add pure tests for local day, month, weekday, clock, and countdown values at deterministic dates.
- [x] Add widget tests proving schedule/voice/quote copy no longer reads story NPC messages or fictional defaults.
- [x] Add escaping and normalization tests for reader-owned component fields and target dates.

### Task 2: Introduce reader-owned widget fields and system-time rendering

- [x] Add a product-keyed field schema with bounded title/detail/target-date values and safe legacy quote migration.
- [x] Resolve date, time, weekday, and countdown values from the local system clock for every affected V7 product.
- [x] Mark live time nodes and synchronize them while the phone or appearance preview stays open.
- [x] Keep invalid or unfilled personal text blank instead of inventing names, meetings, places, or messages.

### Task 3: Expose the right fillable controls

- [x] Render only the text/date controls native to each installed functional component.
- [x] Update draft state through delegated input handling without collapsing the component store or losing the active screen.
- [x] Preserve private text locally and continue excluding it, target dates, and reader photos from appearance packages.

### Task 4: Make the identity card a first-class desktop component

- [x] Add a stable wide `profile:identity` definition and footprint to the shared home-layout model.
- [x] Migrate legacy layouts by inserting the identity card and collision-safely reflowing first-screen Apps.
- [x] Render cover, avatar, ID, and optional signature inside the paged home track in both preview and reader phone.
- [x] Add a signature field to the personal-information editor and keep ID/avatar/signature private during appearance transfer.

### Task 5: Verify migration, interaction, and finish quality

- [x] Update layout, appearance-package, and dialog integration tests for identity-card placement, movement, save/reopen, and private-field omission.
- [x] Run focused tests, then the full verification suite and production build.
- [x] Browser-test current-time rendering, blank/personalized fields, identity-card drag across screens, persistence, and narrow layout.
