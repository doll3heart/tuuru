# Reader Call Progressive Playback and Background Beautification Design

**Date:** 2026-07-16
**Status:** Approved in conversation
**Scope:** Reader-side phone call playback and reader-owned call background customization

## Summary

Tuuru's authoring UI already stores voice and video call dialogue as `callLines`, but the reader currently renders every line as soon as a call opens. This exposes future dialogue and removes the intended dramatic pacing.

The reader will instead reveal one line at a time under explicit reader control. Previously revealed lines remain visible in a subdued transcript, the current line remains prominent, and no timer advances the scene. The existing reader-owned Messages beautification settings will also gain a global call-background control with safe presets and local image upload. Neither change modifies authored work data.

## Goals

- Show only the first available call line when a call opens.
- Reveal exactly one additional line per reader activation.
- Keep all revealed prior lines visible but visually subordinate to the current line.
- Support pointer activation and native Enter/Space keyboard activation.
- Keep Hang Up available throughout the call.
- Leave the completed call visible until the reader explicitly hangs up.
- Restart a call from its first line every time the reader reopens it.
- Remove the dotted background from call scenes.
- Let readers choose a shared call background from presets or a local image.
- Keep call playback and call customization independent of author work storage, imports, exports, and schema versions.
- Preserve legacy calls that use `msg.text` instead of `callLines`.

## Non-goals

- Automatic or timed dialogue playback.
- Persisting in-call progress across close, refresh, or reopen.
- Per-work, per-character, or per-call reader background settings.
- Author-controlled call backgrounds.
- Reader overrides for character names, remarks, or avatars.
- Actual audio/video media playback or elapsed-time tracking.
- Freeform forum posting, multi-bubble reader replies, Reading Flow sorting, or other backlog work.
- Removing existing optional URL fields elsewhere in the reader. Existing reader image surfaces must continue to offer local upload; the new call-background control itself will not accept an external URL.

## Confirmed Product Decisions

1. Playback is manual: click/tap the transcript card or use Enter/Space.
2. The approved visual treatment is the rolling transcript: old lines remain, become smaller and lighter, and the current line stays dominant.
3. The call background contains no dot pattern.
4. Voice and video calls share one reader-local global background setting.
5. Built-in plain/gradient presets, local image upload, and Restore Default are supported.
6. A local image receives a fixed readability overlay; overlay strength is not another user setting.
7. Hang Up works before or after the final line.
8. Reopening any call starts again from its first line.
9. The final line remains visible with an ended status until Hang Up is activated.
10. Authored character names and avatars remain authoritative.

## Architecture

### Pure call playback model

Create `reader/call-playback.js` as a DOM-free, storage-free module. It owns only dialogue normalization and advancement.

The module exposes two operations:

- `createCallPlaybackState(callLines, fallbackText)` returns an immutable initial state.
- `advanceCallPlayback(state)` returns the next immutable state or the same state when empty or complete.

The state contains:

- `lines`: a frozen normalized array;
- `currentIndex`: `-1` for an empty call, otherwise the visible current line index;
- `isEmpty`: true when no line is available;
- `isComplete`: true when empty or when `currentIndex` is the final index.

The view is derived without mutation:

- prior lines are `lines.slice(0, currentIndex)`;
- the current line is `lines[currentIndex]`;
- future lines are never returned to the renderer.

Normalization accepts only strings, trims surrounding whitespace, removes empty strings, and does not coerce objects or invoke accessors. If no valid `callLines` remain, a non-empty string `fallbackText` becomes the sole line. Inputs are never mutated.

### Reader integration

`openReaderChat()` keeps its existing chat-session and auto-open protections. `openCallScene(msg, callKey)` creates a fresh playback state every time it is called, so a reopened call naturally restarts.

The call renderer has one local `renderCallPlayback()` function. It renders the approved scene from the current playback snapshot and binds only scene-local controls. Advancing replaces the call transcript state and restores focus to the new advance control. No document-level listener, interval, timeout, or cross-call registry is introduced.

Hang Up discards the local playback state by returning to `renderChat()`. Focus returns to the call card identified by the same `callKey`. Existing `openedCallScenes` behavior still prevents one completed or dismissed auto-open call from immediately causing the next call to open.

Playback itself never writes local storage. Explicit reader customization remains the only write path introduced by this feature.

## Interaction and Rendering

### Opening and advancing

- A call with two or more lines opens with line 1 only.
- The transcript card is a native button while more dialogue remains.
- Each click, tap, Enter, or Space activation advances once.
- Prior lines remain in order and use the subdued `old` treatment.
- The current line is visually strongest and is the only newly announced live-region content.
- A visible `current / total` progress label reflects the playback state.
- The transcript scroll area keeps the newest line visible without removing earlier lines.

### Completion

- When the final line appears, the advance affordance becomes a non-interactive completed transcript.
- The hint changes to `通话内容已结束`.
- Focus moves predictably to Hang Up instead of disappearing with the advance button.
- The scene does not auto-dismiss.
- Hang Up returns to the current chat and restores focus to that call's card.

### Empty calls

If both `callLines` and `msg.text` contain no valid dialogue, render `本次通话没有台词`. Do not render an advance control. Hang Up remains available and receives initial focus.

### Visual treatment

- The default call background is a plain gray-pink surface with no radial or dotted texture.
- The portrait, name, status, transcript, and Hang Up control preserve the established Tuuru gray-pink phone language.
- Old transcript lines are smaller and quieter but remain readable.
- Image backgrounds use centered cover cropping plus a fixed soft overlay behind the full call scene.
- Text surfaces retain opaque or strongly translucent paper backgrounds so the uploaded image cannot destroy text contrast.
- This task does not add real elapsed-time behavior; existing presentational duration content does not drive playback.

## Reader-owned Background Customization

### Storage location and shape

Extend the existing `phoneCustom.appSettings.messages` record with flat, defensively normalized fields:

- `callBackgroundType`: `preset` or `image`;
- `callBackgroundPreset`: `plain`, `rose`, `water`, or `cream`;
- `callBackgroundImage`: a safe raster data URL or `null`.

The default is `{ callBackgroundType: "preset", callBackgroundPreset: "plain", callBackgroundImage: null }`.

Preset keys map to code-owned CSS values; arbitrary persisted CSS strings are never executed. Unknown types or keys fall back to `plain`. An invalid image falls back to the selected safe preset and is not placed in an inline style.

The setting is reader-local and shared by every voice and video call in every work. It is not copied into authored work, recent-reading entries, exports, or editor preview payloads. Explicit customization may write `moirain_phoneCustom` in editor preview because it is reader-owned data; preview startup and playback still perform no writes.

### Messages beautification UI

Add a `通话背景` card to the existing Messages App beautification modal. It contains:

- four named preset buttons with pressed state;
- `选择本地图片`;
- a preview of the current draft background;
- `恢复默认`, which resets only the call-background draft;
- the modal's existing Save and Cancel actions.

Preset, upload, and restore actions change only the modal draft. Save persists the candidate; Cancel discards it. The modal does not expose an external URL input for this setting.

### Local image policy

- Accept PNG, JPEG, and WebP raster files only.
- Reject SVG and animated formats for this surface.
- Reject files larger than 2 MiB before reading.
- Read accepted files with `FileReader.readAsDataURL()`.
- Verify that the resulting data URL has an allowed MIME and passes the repository's safe-image rules before preview or persistence.
- Decode the validated data URL with an `Image` and reject load failures or zero-dimension images before preview or persistence.
- Keep the previous saved background on type, size, read, decode, or validation failure.

The reader's existing avatar, cover, wallpaper, and custom-icon surfaces already provide local file upload. This feature follows that same local-only user path without expanding into a repository-wide image-control rewrite.

## Storage Failure and Recovery

The customization modal constructs a candidate `phoneCustom` value without mutating the saved object. Save uses the existing guarded reader-storage write path.

On success:

- save `moirain_phoneCustom` once;
- close the modal;
- refresh the customization preview;
- restore focus to the Messages settings trigger;
- show the existing success feedback.

On quota, serialization, or storage-access failure:

- keep the modal open;
- retain focus on the Save control;
- show the existing reader-storage error feedback;
- leave the exact previously saved value in storage;
- permit the reader to remove the image, choose a smaller file, or retry.

Corrupt persisted customization data is read defensively and falls back to defaults without preventing the call from opening.

## Accessibility and Motion

- The advance interaction is a native button with a specific accessible name.
- Its visual target is at least 44 by 44 CSS pixels.
- The current line uses a polite live region; rerendering must not reannounce all old lines.
- Progress and the completed status are available to assistive technology.
- Focus enters the advance control when dialogue remains, otherwise Hang Up.
- After each advancement, focus remains on the replacement advance control.
- After the final line, focus moves to Hang Up.
- Hang Up returns focus to the originating call card.
- Background preset buttons have names and synchronized `aria-pressed` state.
- Local upload and Restore Default have visible focus and 44-pixel targets.
- Nonessential line-entry animation runs only when `shouldUseMotion()` permits it; reduced-motion mode reveals the new line immediately.
- The overlay and paper surfaces must preserve WCAG AA contrast for all default preset backgrounds.

## Security and Compatibility

- Every authored line, caller name, and attribute value continues through the existing escaping helpers.
- No future line appears in the DOM before it is advanced.
- Persisted preset keys are whitelisted.
- Uploaded SVG, external call-background URLs, malformed data URLs, and unsupported MIME values are rejected.
- Existing voice/video `callMode`, caller lookup, multi-call reopening, and auto-open behavior remain intact.
- Legacy calls using `msg.text` remain readable.
- Ordinary reader imports and editor previews use the same call runtime.
- No author-database key, work cache, or recent-reading entry is written by playback.
- No work schema migration is required.

## Test Strategy

### Pure model tests

Create `tests/reader-call-playback.test.mjs` covering:

- normalization and non-mutation;
- fallback to `msg.text`;
- empty calls;
- first-line-only initial state;
- exactly one line per advance;
- immutable prior/current derivation;
- idempotent completion;
- independent fresh states for reopened calls;
- hostile non-string values without coercion or accessor execution.

### Reader integration tests

Extend `tests/reader-phone-call.test.mjs` to prove:

- only the first line exists in the initial DOM;
- pointer and native keyboard activation reveal one line;
- prior/current classes match the approved A treatment;
- future lines are absent from the DOM;
- early Hang Up returns to chat;
- reopen restarts at line 1;
- final state remains visible until Hang Up;
- focus enters, advances, completes, and returns correctly;
- two calls never share progress or auto-open in sequence;
- legacy calls and escaped caller/line content remain safe.

### Customization tests

Extend `tests/reader-app-settings-dialog.test.mjs`, `tests/reader-phone-accessibility.test.mjs`, and `tests/default-color-contrast.test.mjs` to prove:

- call background controls appear only in Messages settings;
- default and preset normalization;
- named pressed-state controls and 44-pixel targets;
- safe local PNG/JPEG/WebP draft preview and save;
- oversize, SVG, malformed, read-error, and storage-failure rejection;
- Cancel and failed Save preserve the exact prior stored value;
- Restore Default resets only call-background fields;
- corrupt stored fields fall back to the plain no-dot background;
- image overlays and default presets meet the contrast contract.

### Final verification

Run focused call, app-settings, accessibility, contact, and editor-preview tests; then run the complete Node test suite and both production builds. In a real browser, verify voice and video calls, pointer and keyboard progression, early/final Hang Up, replay, preset selection, local image upload, Restore Default, reduced motion, and narrow-screen behavior.

## Expected File Scope

- Create: `reader/call-playback.js`
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Create: `tests/reader-call-playback.test.mjs`
- Modify: `tests/reader-phone-call.test.mjs`
- Modify: `tests/reader-app-settings-dialog.test.mjs`
- Modify: `tests/reader-phone-accessibility.test.mjs`
- Modify: `tests/default-color-contrast.test.mjs`

No author editor file, work schema, import/export module, or unrelated backlog subsystem belongs in this change.

## Acceptance Criteria

- A call never exposes an unadvanced future line.
- One activation reveals exactly one line.
- All revealed prior lines remain readable and subdued.
- The last line remains until explicit Hang Up.
- Early Hang Up and reopen restart from line 1.
- Voice and video calls behave identically for playback.
- Default call scenes have no dot pattern.
- Reader-local presets, local raster upload, and Restore Default work without author-data writes.
- Invalid or unsavable images preserve the prior background and leave recovery available.
- The feature is keyboard, touch, focus, contrast, and reduced-motion safe.
- Focused tests, the full suite, both builds, and the real-browser acceptance path pass.
