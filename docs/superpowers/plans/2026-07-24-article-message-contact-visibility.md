# Article Message Contact Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authors choose which contacts are visible inside each interactive-article Message module, while preventing later-created contacts from leaking into older modules.

**Architecture:** Persist a module-scoped `visibleContactIds` allowlist alongside the Message module payload. The draft builder derives a safe allowlist for new and legacy modules, the author Message editor exposes visibility toggles while locking contacts already used by content, and the article reader filters the current module’s contact snapshot by that allowlist. Standalone phone works remain unchanged because they do not carry the module-only allowlist.

**Tech Stack:** Vanilla JavaScript ES modules, JSDOM-based Node tests, existing Tuuru CSS and tutorial renderer.

## Global Constraints

- Match the current author and reader phone UI vocabulary.
- Do not modify interactive-image / interactive-scene work from the other window.
- New contacts added after a module is created must remain hidden from that older module until explicitly enabled.
- Contacts referenced by a chat or moment cannot be hidden until the related content is removed.
- Legacy modules without `visibleContactIds` derive visibility from their saved contact snapshot.
- Remove “上移一位 / 下移一位” from the work-card More menu; keep drag sorting and pinning.

---

### Task 1: Simplify the work-card menu

**Files:**
- Modify: `js/pages/home.js`
- Modify: `js/pages/resources.js`
- Test: `tests/home-work-order-ui.test.mjs`

**Interfaces:**
- Consumes: existing drag handle, `pinShelfWork`, and shelf ordering model.
- Produces: a smaller More menu with pinning but no one-step movement actions.

- [ ] **Step 1: Update the UI regression test**

Assert that the menu source contains pinning and drag affordances, but contains neither “上移一位” nor “下移一位”.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test tests/home-work-order-ui.test.mjs`
Expected: FAIL because the two menu actions still exist.

- [ ] **Step 3: Remove the two menu buttons and stale render-time move state**

Delete the two buttons and the now-unused `moveState` local from `renderWorks()`. Keep keyboard-enabled drag sorting and the existing movement model used by drag.

- [ ] **Step 4: Update tutorial wording**

Describe desktop drag as the movement interaction and More → pin/unpin as the grouping interaction. Remove every tutorial claim that one-step menu movement exists.

- [ ] **Step 5: Run the targeted test**

Run: `node --test tests/home-work-order-ui.test.mjs tests/resources-page.test.mjs`
Expected: PASS.

### Task 2: Define module-scoped contact visibility

**Files:**
- Modify: `js/phone-module-draft.js`
- Test: `tests/phone-module-draft.test.mjs`

**Interfaces:**
- Consumes: article-global contacts and the saved module contact snapshot.
- Produces: `visibleContactIds`, `referencedMessageContactIds(phoneData)`, and `visiblePhoneModuleContacts(phoneData)`.

- [ ] **Step 1: Write failing model tests**

Cover:

- new Message modules start with all contacts that exist at creation;
- legacy modules use IDs from their saved contact snapshot, not later article contacts;
- saved Message payloads retain `visibleContactIds`;
- referenced contact IDs include chat participants and moment authors/comments;
- filtering returns only allowlisted contacts and leaves standalone data unfiltered.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --test tests/phone-module-draft.test.mjs`
Expected: FAIL because visibility helpers and metadata do not exist.

- [ ] **Step 3: Implement visibility normalization and filtering**

When creating a draft:

- clone current article contacts for editing;
- for a new module, initialize `visibleContactIds` from current contacts;
- for a legacy module, initialize it from the saved module contact snapshot;
- for an updated module, preserve its explicit allowlist and discard IDs that no longer exist.

Project `visibleContactIds` only for the Message module. Treat a missing allowlist as “all contacts” outside article-module migration so standalone phones remain unchanged.

- [ ] **Step 4: Run the model tests**

Run: `node --test tests/phone-module-draft.test.mjs`
Expected: PASS.

### Task 3: Add author visibility controls

**Files:**
- Modify: `js/pages/phone.js`
- Modify: `css/styles.css`
- Test: `tests/phone-message-editor.test.mjs`

**Interfaces:**
- Consumes: `visibleContactIds` and `referencedMessageContactIds`.
- Produces: accessible per-contact visibility buttons in Message → Contacts.

- [ ] **Step 1: Write failing author UI tests**

Open a virtual article module draft with two contacts. Assert that each contact has a visibility button, an unused contact can be hidden and persisted, and a referenced contact’s button is disabled with explanatory copy.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test tests/phone-message-editor.test.mjs`
Expected: FAIL because visibility controls are absent.

- [ ] **Step 3: Render and bind the controls**

In the Contacts tab:

- show a compact “本模块可见 X / Y” summary;
- render an eye-style button for every contact;
- use `aria-pressed` and a clear label;
- disable the button for referenced contacts;
- save the allowlist immediately through the existing virtual draft update path.

- [ ] **Step 4: Add scoped styles**

Use existing tokens, 44px touch targets, visible focus, a subdued hidden state, and no new card-within-card treatment.

- [ ] **Step 5: Run author UI tests**

Run: `node --test tests/phone-message-editor.test.mjs`
Expected: PASS.

### Task 4: Enforce visibility in the article reader

**Files:**
- Modify: `reader/reader.js`
- Test: `tests/reader-phone-module-contact-visibility.test.mjs`

**Interfaces:**
- Consumes: saved module contacts and `visibleContactIds`.
- Produces: a reader overlay whose identity resolution cannot see hidden or newly added global contacts.

- [ ] **Step 1: Write a failing reader regression test**

Build an article whose global contact list contains an older visible contact and a later secret contact, while the Message module allowlist includes only the older contact. Open the module and assert the reader runtime uses only the allowlisted module contacts.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test tests/reader-phone-module-contact-visibility.test.mjs`
Expected: FAIL because the reader currently prioritizes article-global contacts.

- [ ] **Step 3: Filter module contacts at the overlay boundary**

Use the module’s saved contact snapshot as the source of truth and filter it with `visibleContactIds`. Do not change standalone phone rendering.

- [ ] **Step 4: Run reader tests**

Run: `node --test tests/reader-phone-module-contact-visibility.test.mjs tests/reader-phone-module-back.test.mjs`
Expected: PASS.

### Task 5: Document and verify the complete workflow

**Files:**
- Modify: `js/pages/resources.js`
- Test: `tests/resources-page.test.mjs`

**Interfaces:**
- Consumes: the final author workflow.
- Produces: searchable tutorial and FAQ entries describing module-only visibility and legacy/new-contact behavior.

- [ ] **Step 1: Add tutorial assertions**

Assert that the tutorial names “本模块可见”, explains Message → Contacts, and states that later-created contacts stay hidden in existing modules.

- [ ] **Step 2: Update the tutorial**

Add the feature under interactive articles / phone modules and add an FAQ for preventing contact spoilers. Clarify that visibility affects only the current Message card, not the standalone phone or other modules.

- [ ] **Step 3: Run targeted verification**

Run: `node --test tests/home-work-order-ui.test.mjs tests/phone-module-draft.test.mjs tests/phone-message-editor.test.mjs tests/reader-phone-module-contact-visibility.test.mjs tests/resources-page.test.mjs`
Expected: PASS.

- [ ] **Step 4: Run project verification**

Run the repository’s full test and build commands from `package.json`. Report unrelated failures separately and do not modify interactive-scene files.
