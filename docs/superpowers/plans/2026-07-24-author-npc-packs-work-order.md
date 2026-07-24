# Author NPC Packs and Work Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable, named author-level NPC packs; named contact bundle exports; per-work forum NPC pack import/export; and accessible work pinning and manual ordering without breaking Tuuru's current UI.

**Architecture:** Keep portable packet parsing and collision-safe merging in focused pure modules. Store the author's reusable NPC pack library in local storage beside existing author placeholder presets, while work-level NPCs remain inside each phone work. Keep work order in the existing database `works` array and add a `pinned` flag to each work; rendering preserves the stored order while grouping pinned works first.

**Tech Stack:** Vanilla JavaScript ES modules, localStorage-backed author settings, Tuuru database storage, Node test runner, JSDOM, Vite, existing CSS tokens/components.

## Global Constraints

- Match the existing restrained, compact author UI and reuse its buttons, forms, cards, borders, colors, and mobile breakpoints.
- Do not overwrite unrelated dirty-worktree changes in `css/styles.css`, `js/data.js`, or other files.
- Imported NPCs and contacts append without overwriting existing work data; colliding identity IDs receive new IDs.
- Work movement must be available through both pointer drag and keyboard/touch-friendly menu actions.
- NPC pack storage must participate in the existing “整机搬家” author-setting transport.

---

### Task 1: Named Contact and NPC Bundle Models

**Files:**
- Modify: `js/contact-bundles.js`
- Create: `js/npc-bundles.js`
- Modify: `js/local-profile-transport.js`
- Modify: `tests/contact-bundles.test.mjs`
- Create: `tests/npc-bundles.test.mjs`

**Interfaces:**
- `serializeContactBundle(contacts, { name, now })` and `parseContactBundle(input)` expose a sanitized `name`.
- `readNpcPacks(storage)`, `saveNpcPack(pack, options)`, `deleteNpcPack(id, storage)`, `mergeNpcPack(existingNpcs, pack, options)`, `serializeNpcPackLibrary(packs)`, and `importNpcPackLibrary(input, options)` own reusable author NPC data.
- `NPC_PACK_STORAGE_KEY` is added to the author-setting allowlist used by local-profile transport.

- [ ] **Step 1: Add failing tests for named contact packets and NPC pack sanitization, persistence, import, deletion, and collision-safe merge**

  Verify packet metadata, supported NPC fields (`id`, `type`, `name`, `avatarUrl`, `ipLocation`, `time`), input immutability, duplicate-name replacement, and ID reassignment.

- [ ] **Step 2: Run focused model tests and confirm the new assertions fail**

  Run: `node --test tests/contact-bundles.test.mjs tests/npc-bundles.test.mjs`

  Expected: FAIL because contact bundle names and the NPC pack module do not exist.

- [ ] **Step 3: Implement the minimal pure model and storage APIs**

  Use versioned JSON payloads, sanitize every imported field, clone returned records, and fall back to generated unique IDs without mutating callers.

- [ ] **Step 4: Add the NPC pack key to local-profile migration**

  Extend `AUTHOR_SETTING_KEYS` with the exported `NPC_PACK_STORAGE_KEY` string so an author’s global NPC packs move with existing author settings.

- [ ] **Step 5: Re-run focused tests**

  Run: `node --test tests/contact-bundles.test.mjs tests/npc-bundles.test.mjs`

  Expected: PASS.

### Task 2: Work Pinning and Manual Order Model

**Files:**
- Create: `js/work-order.js`
- Modify: `js/data.js`
- Create: `tests/work-order.test.mjs`

**Interfaces:**
- `orderedWorks(works)` returns pinned works followed by ordinary works, preserving manual order inside both groups.
- `moveWorkBefore(works, workId, targetId)` reorders only inside the source work’s pinned/unpinned group.
- `moveWorkByOffset(works, workId, offset)` supports accessible one-step movement.
- `toggleWorkPinnedRecord(works, workId, pinned)` places newly pinned works at the end of the pinned group and newly unpinned works at the start of the ordinary group.
- Data wrappers `moveWorkBefore`, `moveWorkByOffset`, and `setWorkPinned` persist the resulting `works` array.

- [ ] **Step 1: Add failing pure ordering tests**

  Cover stable grouping, moving within a group, blocked cross-group movement, pinning, unpinning, missing IDs, and input immutability.

- [ ] **Step 2: Run the focused test and confirm failure**

  Run: `node --test tests/work-order.test.mjs`

  Expected: FAIL because `js/work-order.js` does not exist.

- [ ] **Step 3: Implement pure order functions and database wrappers**

  Avoid changing `updatedAt` because shelf arrangement is author-library metadata rather than work content.

- [ ] **Step 4: Re-run the focused test**

  Run: `node --test tests/work-order.test.mjs`

  Expected: PASS.

### Task 3: Writing Habits NPC Pack Library and Named Contact Export

**Files:**
- Modify: `js/pages/resources.js`
- Modify: `css/styles.css`
- Create: `tests/author-npc-pack-ui.test.mjs`

**Interfaces:**
- The habits page renders a named contact export field and an author-global NPC pack section.
- NPC pack cards expose pack name, NPC count, source work, updated date, file export, file import, and deletion.
- A source-work selector can save that work’s forum NPCs into a named global pack.

- [ ] **Step 1: Add failing UI source/DOM tests**

  Assert semantic labels, live status text, named export plumbing, empty states, source work counts, and existing button/component vocabulary.

- [ ] **Step 2: Run the focused UI tests and confirm failure**

  Run: `node --test tests/author-npc-pack-ui.test.mjs`

  Expected: FAIL because the NPC pack library UI is absent.

- [ ] **Step 3: Implement habits-page rendering and handlers**

  Re-render only the habits surface after mutations, keep destructive deletion confirmed, and show precise added/replaced/error status through existing toast and live-region patterns.

- [ ] **Step 4: Add restrained responsive styles**

  Reuse `.habit-section`, `.resource-actions`, `.form-input`, `.btn`, and current mobile breakpoints. Add only layout selectors needed for the pack list and compact metadata.

- [ ] **Step 5: Re-run the focused UI tests**

  Run: `node --test tests/author-npc-pack-ui.test.mjs`

  Expected: PASS.

### Task 4: Per-Work Forum NPC Pack Import and Export

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Create: `tests/phone-npc-pack-ui.test.mjs`

**Interfaces:**
- “保存到 NPC 包” prompts for a pack name and writes the current work’s entire NPC list to the author library.
- “导入 NPC 包” presents existing named packs and appends the chosen pack through `mergeNpcPack`.
- Imported NPC IDs are collision-safe, the work is saved once, and the NPC view refreshes with a live result message/toast.

- [ ] **Step 1: Add failing integration-source tests**

  Assert both actions are present on the NPC management surface and wired to `saveNpcPack`, `readNpcPacks`, and `mergeNpcPack`.

- [ ] **Step 2: Run the focused test and confirm failure**

  Run: `node --test tests/phone-npc-pack-ui.test.mjs`

  Expected: FAIL because the work-level import/export controls are absent.

- [ ] **Step 3: Implement the modal flows**

  Use the existing `modal`, form, button, empty-state, and toast vocabulary; disable saving an empty NPC list and show a useful empty-library path linking users conceptually to “写作习惯”.

- [ ] **Step 4: Re-run focused tests**

  Run: `node --test tests/phone-npc-pack-ui.test.mjs tests/npc-bundles.test.mjs`

  Expected: PASS.

### Task 5: Work Shelf Drag, Pin, and Accessible Move Controls

**Files:**
- Modify: `js/pages/home.js`
- Modify: `css/styles.css`
- Create: `tests/home-work-order-ui.test.mjs`

**Interfaces:**
- Every work card has a dedicated drag handle on fine-pointer devices and a visible pinned badge when applicable.
- The “更多” menu exposes pin/unpin, move earlier, and move later; unavailable moves are disabled.
- Native drag events call `moveWorkBefore`, show an insertion target state, persist once on drop, and refresh while retaining the active tab filter.

- [ ] **Step 1: Add failing shelf interaction tests**

  Assert dedicated drag affordance, accessible labels, menu fallback actions, pin copy, disabled boundaries, and CSS drop-target/focus/reduced-motion states.

- [ ] **Step 2: Run the focused test and confirm failure**

  Run: `node --test tests/home-work-order-ui.test.mjs`

  Expected: FAIL because shelf order controls are absent.

- [ ] **Step 3: Implement ordered rendering and menu actions**

  Render `orderedWorks(getWorks())`, persist through data wrappers, close menus after actions, restore focus where possible, and rebind collection plus order handlers after list refreshes.

- [ ] **Step 4: Implement dedicated-handle native drag**

  Set card `draggable` only after handle pointer-down, reject targets in the opposite pin group, clear all drag state on drop/end, and avoid interfering with long-press collection selection.

- [ ] **Step 5: Add current-UI styles and responsive behavior**

  Keep the handle subtle on desktop, keyboard-visible on focus, hidden for coarse pointers, and leave menu actions available at all sizes.

- [ ] **Step 6: Re-run focused tests**

  Run: `node --test tests/home-work-order-ui.test.mjs tests/work-order.test.mjs tests/author-shell-visual.test.mjs`

  Expected: PASS.

### Task 6: Full Verification and Visual QA

**Files:**
- Modify only files requiring fixes discovered by verification.

**Interfaces:**
- All existing author, storage, transport, phone, and build guarantees remain green.

- [ ] **Step 1: Run focused regression tests**

  Run: `node --test tests/contact-bundles.test.mjs tests/npc-bundles.test.mjs tests/work-order.test.mjs tests/author-npc-pack-ui.test.mjs tests/phone-npc-pack-ui.test.mjs tests/home-work-order-ui.test.mjs tests/author-ui-polish.test.mjs tests/author-shell-visual.test.mjs`

  Expected: PASS with zero failures.

- [ ] **Step 2: Run the full automated suite**

  Run: `npm test`

  Expected: PASS with zero failures.

- [ ] **Step 3: Run build verification**

  Run: `npm run build:verify`

  Expected: exit code 0.

- [ ] **Step 4: Inspect the habits page, forum NPC page, and work shelf at desktop and narrow viewport widths**

  Verify no clipped popovers, no accidental card dragging, usable touch controls, readable pack metadata, keyboard focus, and stable pinned/manual order after reload.

- [ ] **Step 5: Review the final diff against the requirement checklist**

  Confirm: author-level named NPC packs; named contact packets; forum NPC save/import; collision-safe merging; work drag; menu movement; work pin/unpin; current-UI adaptation; transport/backup inclusion.
