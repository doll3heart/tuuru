# Mobile Editor Shell Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce five isolated, interactive mobile article-editor shells for user selection without changing the production editor.

**Architecture:** Put the comparison surface under `prototypes/` so Vite can serve it during local review but the production Rollup inputs remain unchanged. Share Tuuru's existing gray-pink tokens, sample story data, and prototype-only interaction helpers across five structurally distinct shells.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Vite, Playwright-compatible browser inspection.

## Global Constraints

- Do not modify `js/pages/editor.js`, `js/app.js`, or `css/styles.css` during selection.
- Show five genuinely different interaction structures, not five color variations.
- Every shell must expose writing, outline, insert/format access, inline chapter creation, and visible node drag handles.
- Use no `prompt()`, `confirm()`, or `alert()` in the prototypes.
- Keep touch targets at least 44px and verify at 320px and 390px.

---

### Task 1: Build the isolated comparison surface

**Files:**
- Create: `prototypes/mobile-editor-shells.html`
- Create: `prototypes/mobile-editor-shells.css`
- Create: `prototypes/mobile-editor-shells.js`

**Interfaces:**
- Consumes: Tuuru's existing visual tokens and a fixed local sample story.
- Produces: `data-variant="1"` through `data-variant="5"`, `.prototype-node[data-node-id]`, and prototype-only view/panel controls.

- [ ] Create one review header with five variant selectors and a 390px phone viewport.
- [ ] Render all five shells from static sample data so their content is directly comparable.
- [ ] Implement prototype-only view switches, progressive tool panels, and inline chapter creation.
- [ ] Implement pointer-based node dragging with visible before/after feedback and no persistence.

### Task 2: Verify and present the five candidates

**Files:**
- Modify only prototype files if verification finds a problem.

**Interfaces:**
- Consumes: the five rendered shells.
- Produces: five screenshots plus concise trade-off notes for user selection.

- [ ] Run a static scan confirming five variants and zero native dialog calls.
- [ ] Serve the prototype locally with Vite on a non-production port.
- [ ] At 320px and 390px, verify every shell has no horizontal overflow and all primary controls remain reachable.
- [ ] Exercise inline chapter creation and node dragging in the browser.
- [ ] Deliver the local preview URL, screenshots, and one recommended candidate without changing production code.
