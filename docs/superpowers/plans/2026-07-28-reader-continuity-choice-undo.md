# Reader Continuity and Choice Undo Implementation Plan

**Goal:** Make article reading feel continuous when temporary reader surfaces open and close, and make consequential article choices forgiving without adding a new feature area.

**Architecture:** Keep the behavior inside the existing reader runtime. Capture a semantic reading anchor before opening transient surfaces, then restore the same anchor relative to the viewport after they close. For article choices, snapshot the existing route and interaction state before a valid choice, briefly suppress repeated commits, and expose one compact undo action that restores the snapshot through the normal article render and persistence path.

**Tech Stack:** Vanilla JavaScript, CSS, Node test runner, JSDOM, Vite.

---

### Task 1: Preserve the exact article reading position

**Files:**
- Modify: `reader/reader.js`
- Test: `tests/reader-reading-continuity.test.mjs`

**Steps:**
1. Add article reading-position capture and restore helpers that prefer a visible semantic content anchor and fall back to the current scroll offset.
2. Capture the position before opening reader appearance settings, phone-module overlays, and non-routing interactive scenes.
3. Restore the captured anchor after those surfaces close and return keyboard focus to the control that opened them.
4. Add integration coverage for layout changes while settings or a phone-module overlay is open.

### Task 2: Add brief article-choice undo and rapid-click protection

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-choice-undo.test.mjs`

**Steps:**
1. Snapshot route, branch memory, interaction selections, checkpoints, work identity, and reading position immediately before a valid article choice.
2. Reject repeated choice commits during a short transition guard.
3. Show one restrained bottom feedback bar after a state-changing choice, with a five-second undo action.
4. Restore the complete pre-choice snapshot through the normal renderer so local progress is saved consistently.
5. Cover undo persistence, replacement by a newer choice, rapid clicks, keyboard focus, small screens, and reduced-motion behavior.

### Task 3: Regression verification

**Files:**
- Verify: `reader/reader.js`
- Verify: `reader/reader.css`
- Verify: `tests/**/*.test.mjs`

**Steps:**
1. Run the focused continuity and choice-undo tests.
2. Run the full test suite.
3. Run the production build.
4. Review the final diff for unrelated changes and incomplete plan markers.
