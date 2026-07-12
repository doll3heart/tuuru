# Import and Restore XSS Hardening Design

**Date:** 2026-07-13

## Goal

Close the confirmed persistent-XSS paths in JSON/PNG work import and full-library backup restore without removing legitimate customization. This change is limited to the P0 security boundary; reliable-save rollout, unrelated editor bugs, modal accessibility, and release artifact updates remain out of scope.

## Confirmed Root Cause

Tuuru validates much of an imported work's structure, but several scalar values remain unrestricted. Those values later enter HTML strings, inline style attributes, and inline event handlers. In particular:

- work import sanitizes rich HTML, media URLs, and App SVG icons, but leaves App colors and other style scalars untouched;
- backup parsing validates collection shape but accepts unsafe work IDs, App colors, and App icons;
- home, editor, phone, and reader renderers interpolate some of those values into `innerHTML` strings.

The security boundary therefore fails across two components: untrusted data is accepted too broadly, and renderers assume accepted data is safe enough for HTML-string interpolation.

## Policy

### JSON and PNG work import

Work import is content-oriented and may safely normalize individual values. It will:

- preserve valid colors, safe image URLs, plain-text identifiers, and sanitized App icons;
- replace unsafe optional presentation values with stable safe defaults;
- reject the work only when a required identity or structural value cannot be made safe without changing what the work refers to;
- continue sanitizing rich HTML and media fields under the existing profiles.

### Full-library backup restore

A backup promises exact library replacement and should not be silently rewritten. Backup parsing will reject the entire backup before a restore plan is created when a security-sensitive identity or presentation field is unsafe. The error must identify a stable validation code/path and no storage mutation may occur.

## Validation Boundary

Add shared, context-independent validators for values that cross into DOM identity or presentation contexts:

- identifiers: bounded non-empty strings using a conservative character set suitable for storage keys, data attributes, selectors, and routes;
- colors: valid CSS color tokens from the product's supported formats, with no quotes, angle brackets, statement delimiters, escapes, or URL/function injection;
- icons: plain text or SVG sanitized through the existing DOMPurify SVG profile;
- image URLs: the existing `isSafeImageUrl` policy;
- rich HTML: the existing `sanitizeRichHtml` profiles.

Work import applies normalization through the sanitizer. Backup parsing applies strict validation and reports an invalid backup rather than normalizing it.

## Rendering Defense

Validation is not sufficient by itself. The confirmed sinks will also stop placing untrusted values directly into executable HTML contexts:

- escape every identifier used in HTML attributes;
- remove inline event-handler construction for work-card actions and bind behavior with `addEventListener`/delegation;
- assign color and similar presentation values through DOM style properties where practical;
- render sanitized icon markup only at the dedicated icon boundary; render all other labels as text.

This keeps a future validation regression from immediately becoming script execution.

## Error Handling

- Unsafe JSON/PNG presentation values are replaced with defaults and the import remains usable.
- Unsafe required identifiers cause import rejection with the existing reader/import error surface.
- Unsafe backup values cause backup inspection to fail before the destructive confirmation dialog and before any recovery download or storage write.
- Error messages describe the invalid field without echoing attacker-controlled markup as HTML.

## Test Strategy

Use test-driven development and prove each exploit before changing production code:

1. JSON and PNG import tests show malicious App colors/icons cannot create attack nodes or executable handlers after real preparation and rendering.
2. Backup parser/restore tests show malicious work IDs, App colors, and App icons are rejected before plan creation and produce zero storage writes.
3. Renderer tests show work-card IDs and phone/reader App presentation values cannot break out of their intended DOM nodes even if a hostile object reaches the renderer.
4. Compatibility tests preserve normal hex/RGB/theme colors, supported SVG icons, safe image URLs, and existing legitimate exports.
5. Run focused security/import/restore tests, then all Node tests, TypeScript, both production builds, `git diff --check`, and a clean-status check.

## Non-Goals

- enabling `reliableLocalWrites`;
- changing storage or backup formats;
- redesigning phone modules;
- fixing typing-effect, choice deletion, or modal accessibility issues;
- rebuilding tracked release artifacts.

## Success Criteria

- Both confirmed exploit paths fail under automated regression tests.
- Normal imported works and valid backups retain their supported customization.
- Rejected backups perform no mutation.
- No renderer in the covered home/phone/reader paths can create attacker-supplied elements or inline handlers from the tested fields.
- The full existing test and build gates pass with a clean worktree except for the intentional P0 commit.
