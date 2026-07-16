---
target: 手机模块 UI 与交互
total_score: 22
p0_count: 0
p1_count: 4
timestamp: 2026-07-12T23-20-57Z
slug: js-pages-phone-js
---
# Tuuru Phone Module UI/UX Critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 2.5 | Save state and draft state are not consistently communicated. |
| 2 | Match with the real world | 3 | The phone metaphor is strong, but authoring conventions are sometimes sacrificed to simulation. |
| 3 | User control and freedom | 2.5 | Save, Cancel, close, and Back do not always imply the same draft behavior. |
| 4 | Consistency and standards | 2 | App editors use different visual and interaction vocabularies. |
| 5 | Error prevention | 2 | Hidden gestures and dense controls make accidental actions plausible. |
| 6 | Recognition rather than recall | 2 | Dragging, title swapping, and contextual actions require discovery or memory. |
| 7 | Flexibility and efficiency | 2.5 | The feature set is deep, but repeated modal workflows slow experienced users. |
| 8 | Aesthetic and minimalist design | 1.5 | Feature accumulation, inline styling, and modal density weaken visual hierarchy. |
| 9 | Error recovery | 2 | Recovery and cancel semantics are not always obvious. |
| 10 | Help and documentation | 1.5 | Sparse onboarding for arrangement, reading flow, and app-specific interactions. |
| **Total** | | **22/40** | **Promising foundation; needs focused refinement.** |

## Anti-Patterns Verdict

The interface does not read as generic AI slop. The phone metaphor is coherent, specific, and backed by real feature depth. Its weaker tell is prototype accumulation: each new App appears to have brought its own local controls, colors, spacing, and modal patterns instead of strengthening one shared product language.

The deterministic detector found one true-positive side-tab accent border in `js/pages/phone.js:4526`. This is minor by itself, but it matches the broader issue: local decorative treatments are accumulating without a disciplined shared system.

## Overall Impression

The phone is a compelling preview object, but it is doing too much work as the primary authoring interface. The biggest opportunity is to separate immersive preview from efficient editing: keep the phone as the emotional center, and move complex authoring into a stable, consistent inspector or sheet.

## What's Working

- The 360px phone frame and App grid provide an immediately understandable creative canvas.
- Apps have meaningful narrative depth rather than acting as decorative mockups.
- Recent accessibility work gives App icons, modal focus, Back controls, and mobile sizing a stronger technical base than the visual surface initially suggests.

## Priority Issues

### P1 — Save and Cancel do not form one trustworthy mental model

Some edits save immediately or on blur, while others use explicit Save and Cancel. Reading-flow state is edited through references that make Cancel feel unreliable. Users cannot confidently answer “is this already saved?”

Fix: choose one model per editor surface. Prefer an explicit draft with one Save action for multi-field editors, a visible dirty state, and a true rollback on Cancel. Reserve autosave for atomic, low-risk changes and label it.

### P1 — Important interactions are hidden behind gestures or unlabeled icons

Icon arrangement, title-side switching, contextual message actions, and several clickable visual elements are discoverable mainly by experimentation.

Fix: add a visible Arrange mode, first-use guidance, persistent action affordances on selection, and text labels/tooltips for nonstandard actions. Do not let hover carry essential meaning.

### P1 — Modal-first editing fractures context

Users repeatedly leave the phone desktop, enter an App panel, open another modal, then decide between Back, close, Save, and Cancel. This adds navigation decisions and working-memory cost.

Fix: use a stable inspector on desktop and a bottom sheet/full-screen editor on mobile. Keep the phone visible as a live preview where space permits. Reserve modal dialogs for short destructive or confirmation tasks.

### P1 — The visual language is assembled per feature rather than systematized

The global editor uses square controls and double borders; the phone shell uses rounded device geometry; individual Apps introduce many unrelated saturated colors, inline sizes, and bespoke controls.

Fix: define a phone-module system for radius, spacing, control heights, icon stroke, surface hierarchy, semantic colors, headers, lists, empty states, and feedback. Let each App express identity through content and one accent, not an entirely new component grammar.

### P2 — Mobile layout preserves the simulator geometry instead of optimizing the task

On narrow screens, nested scrolling and absolute icon positioning remain while some device chrome is removed. Several controls remain 28–34px despite stronger 44px targets elsewhere.

Fix: make mobile authoring full-screen, move secondary controls into an overflow menu or bottom sheet, and enforce 44px touch targets. Avoid horizontal toolbars that require precision scrolling.

## Persona Red Flags

**First-time creator:** will understand the phone metaphor but not know what is draggable, which titles are clickable, or how content reaches reading flow. They are likely to explore successfully and then hesitate before committing edits.

**Power creator:** will feel slowed by repeated modal entry, lack of bulk actions, limited keyboard support, and no stable inspector for rapid cross-App editing.

**Mobile creator:** will face nested scroll regions, absolute-position drag interactions, and mixed target sizes. The interface fits the screen, but the task has not been fully recomposed for touch.

## Minor Observations

- `user-select: none` across the phone frame conflicts with text-oriented authoring expectations.
- Hidden scrollbars reduce awareness of longer App content.
- Back, close, and cancel should have a single hierarchy and consistent placement.
- The memo card side accent is a small visual-system outlier.

## Questions to Consider

- Is the product primarily a phone simulator, or a structured story-authoring tool with a phone preview?
- Which three Apps define the product's personality strongly enough to set the design language for the rest?
- Should reading flow become the backbone of authoring rather than a late-stage configuration panel?
