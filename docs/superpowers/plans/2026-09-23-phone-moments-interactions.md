# Phone Moments Interaction Repairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair missing Moments comment deletion, NPC-to-NPC replies, likes and authored line breaks.

**Architecture:** Keep the existing flat comments and thread-choice runtime. Add targeted reply metadata using the forum's `replyToCommentId`, `replyToContactId`, `replyToName` vocabulary; use independent reader progress for reader likes and preserve canonical author content. Preserve whitespace with scoped CSS, not unescaped HTML.

**Tech Stack:** Existing JavaScript modules, node:test/JSDOM, Vite, Playwright Chromium/WebKit.

## Completion and delivery

- Implementation and two independent code reviews completed on September 24, 2026. Chromium and Windows WebKit acceptance covered exact deletion, two-way NPC replies, multiline layout, reader like persistence/work isolation and authored PNG/source isolation. This is not physical iPad/Safari acceptance.
- Preserved string/name/object legacy likes, stable contact-ID precedence and deleted reply-target fallbacks. A pre-existing image-decode regression test was made deterministic without changing its timeout/error/cleanup assertions or production code.
- Fresh pre-publication verification: `node --test --test-concurrency=4` passed 2,503/2,503 with no failures; `npm run build` passed. The earlier implementation-phase timeout failures are superseded by this complete passing run.
- The user subsequently authorized commit, push and deployment to the existing Cloudflare production project. The implementation-phase no-publication restriction below is historical; unrelated artifacts and plans remain excluded from delivery.

## Global Constraints

- Preserve existing works, authored IDs, choices, metadata, escaping and mentions. Keep `moments[].comments` flat; no comment-tree migration.
- Reader exports remain forbidden. Reader likes must not modify canonical author works, imported source works, or author export snapshots.
- Reuse the existing compact product UI and tokens; no redesign, new dependency or unrelated forum behavior changes.
- No commit, push, deployment or deletion of acceptance artifacts is authorized in this turn. Preserve unrelated untracked files.
- Production bug-report device is unknown. Browser emulation is not real iPad/Safari acceptance.

## Evidence

- Author diagnosis `.superpowers/sdd/moments-author-diagnosis.mjs`: three RED assertions for missing comment delete, missing targeted reply, and ignored reply metadata.
- Existing reply composer saves flat comments with no target; author rows expose only Edit and choice `+`.
- `.superpowers/sdd/moments-likes-newline-probe.mjs` proved internal newlines survive textarea save and reader storage load, but author/reader bodies and comments compute `white-space: normal`; scoped pre-wrap restores lines and blank lines.
- Both views lack like controls. Existing `likes` arrays contain authored names, e.g. `scripts/showcase-phone-fixture.mjs:392`; do not assume IDs only.

### Task 1: Repair the complete Moments interaction contract

**Files:**
- Modify: `js/pages/phone.js` — author comment actions, target-aware compose/edit, authored likes editor.
- Modify: `reader/reader.js` — reply-target presentation, isolated like toggle and progress hydration/save.
- Modify: `reader/reader-library-state.js` — optional bounded `momentLikedIds` normalization in phone progress.
- Modify: `css/styles.css`, `reader/reader.css` — scoped white-space, wrapping and accessible actions.
- Create if shared logic is needed: `js/phone-moments.js`, `tests/phone-moments.test.mjs` — pure likes/reply presentation policy only, no new generic framework.
- Modify: `tests/phone-social-choice-editor.test.mjs`, `tests/reader-social-choice-runtime.test.mjs` — real DOM author/reader interactions and non-mutation regressions.
- Modify: the existing reader-library/progress tests for optional progress normalization and reload behavior.

**Interfaces:**
- Authored comments stay `{id, contactId, contactName, content, time, choices?, replyToCommentId?, replyToContactId?, replyToName?}`.
- A targeted reply writes the selected target's exact stable ID, contact ID and display-name fallback. It is appended to `moment.comments`, not nested under `replies`.
- Existing `moment.likes` arrays remain supported, including name strings; ID-backed entries may resolve to current contact names. Unrelated editing must not rewrite likes. A numeric legacy count must at least render safely and remain unchanged unless likes are explicitly edited.
- Reader state uses `momentLikedIds: Set<string>` in the phone session and optional `momentLikedIds: string[]` in phone progress. Empty state should be omitted from normalized progress to avoid changing existing empty progress contracts.
- Author selectors: `[data-moment-comment-delete]`, `[data-moment-comment-reply]`, `[data-moment-likes-edit]`. Preserve current edit/choice selectors used by tests.
- Reader selector: `[data-moment-like]` with `aria-pressed`; authored/reader count and names render without mutating `moment.likes`.

- [ ] **Step 1: Write RED tests for the four reported omissions.** Use the existing DOM fixtures and real UI clicks. Include these assertions after opening the author Moments tab:

```js
assert.ok(overlay.querySelector('[data-moment-comment-delete]'))
assert.ok(overlay.querySelector('[data-moment-comment-reply]'))
assert.ok(overlay.querySelector('[data-moment-likes-edit]'))
// Save a reply through mrSender/mrContent/mrSave, then inspect the draft.
assert.equal(savedReply.replyToCommentId, 'moment-comment-a')
assert.equal(savedReply.replyToContactId, 'contact-1')
assert.match(replyRow.textContent, /白榆\s*回复\s*林澈/)
```

Run `node --test tests/phone-social-choice-editor.test.mjs tests/reader-social-choice-runtime.test.mjs` before implementation; retain failing output in the report.

- [ ] **Step 2: Implement safe author comment actions.** Add keyboard-operable buttons for Reply and Delete. Confirm comment deletion with Cancel; remove only the selected comment and its own choices, preserving siblings byte-for-byte, including replies to it. Resolve the exact object/stable ID again when submitting a dialog so stale indices cannot delete or edit a different row. Legacy ID-less comments must still work without corrupting another record; duplicated IDs must not silently select the wrong record. A reply target deleted while its composer is open must fail safely with a clear message. Keep dynamic target names when resolvable and `replyToName` as fallback when the target is absent. Editing content/time must retain ID, target and choices. Reuse the same reply composer for top-level and targeted replies.

```js
Object.assign(reply, {
  replyToCommentId: target.id,
  replyToContactId: target.contactId,
  replyToName: resolvedTargetName,
})
// Still flat: m.comments.push(reply).
// Confirmation removes the exact selected item; no recursive deletion.
```

- [ ] **Step 3: Implement likes without crossing ownership boundaries.** Author UI can choose NPCs who liked the dynamic; cancel is non-mutating, save explicitly updates the authored list. Preserve/display legacy name lists, including names not present in contacts. Show the list/count in author and reader views. Reader toggle changes only session `momentLikedIds`, updates count exactly once, supports unlike, survives navigation and persisted reader reopen, and is scoped to the work. Normalize persisted IDs as bounded nonempty deduplicated strings, reject malformed values, and do not reintroduce the optional field when empty. Export-mode rendering must show authored likes only, with no interactive like control affecting output. Test old numeric count fallback separately.

```js
const liked = session.momentLikedIds.has(String(moment.id))
button.setAttribute('aria-pressed', String(liked))
// Toggle membership only; never moment.likes.push('self').
// saveCurrentReaderProgress serializes Array.from(session.momentLikedIds).
```

- [ ] **Step 4: Render targets and multiline text consistently.** Author and reader rows show “NPC A 回复 NPC B” for metadata-backed replies, and normal comments retain their existing label. Names and content stay escaped. Apply scoped rules to author dynamic content/comment content and reader dynamic/comment content:

```css
.moment-content,
.moment-comment-content,
.rd-moment-content,
.rd-thread-comment-content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
```

Keep these declarations in each owning stylesheet, not an unrelated global rule. Preserve blank lines, mentions and literal `<script>` text. Scope buttons with accessible names and visible keyboard focus; wrap actions at narrow phone widths.

- [ ] **Step 5: GREEN/regression tests.** Verify delete/Cancel/sibling preservation, A replies B then B replies A, editing and deleting targets, legacy plain comments, choices/reselection, unknown names, likes repeated toggle/navigation/reload/work isolation, exact original source storage, authored export isolation, newlines/blank lines/escaping. Run focused tests while iterating; root runs one full `npm run verify` after implementation.

```powershell
node --test tests/phone-social-choice-editor.test.mjs tests/reader-social-choice-runtime.test.mjs tests/reader-progress-persistence.test.mjs
npm run verify
git -c core.safecrlf=false diff --check
```

- [ ] **Step 6: Independent browser and code review.** Root uses synthetic works in isolated browser contexts to inspect desktop and narrow author/reader views, actual two-way replies, delete Cancel/confirm, likes before/after reload, and bounding/text-line geometry. Check a real author export for preserved multiline content and no reader-only like state. Record the exact engine and any known WebKit raster limitations. Independently review scope/quality, resolve findings, and leave changes uncommitted for user review.
