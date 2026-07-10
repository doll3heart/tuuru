# Mobile Reader Foundation Design

## Context and goal

Tuuru is a frontend-only, local-only interactive fiction tool. The phone editor was originally composed around a fixed 360-375px desktop preview, while the standalone reader and article phone overlay reuse parts of that renderer on real mobile screens.

The current mobile reader has three functional failures:

1. Both HTML entries disable browser zoom, and the standalone reader also lacks the `viewport-fit=cover` contract needed for safe-area layout.
2. The standalone reader injects `.cu-panel`, `.cu-header`, and `.cu-body`, but its stylesheet does not define their layout. Opening an App can therefore expose only the phone background or an unbounded panel.
3. Nested `100vh` containers, parent padding, and broad mobile `.phone-frame` rules create competing scroll areas and unstable height when mobile browser chrome changes.

The first mobile foundation phase makes the existing reader usable at 320px and above without changing work schemas, App content, routes, storage, or the established visual identity.

## Approved product constraints

- Keep the application frontend-only and local-only. Add no server, community, upload endpoint, telemetry service, or database service.
- Preserve imported work compatibility and all persisted phone coordinates.
- Preserve desktop reader behavior unless a mobile accessibility fix also benefits desktop.
- Do not rewrite `reader/reader.js` or merge the two reader implementations in this phase.
- Do not redesign Tuuru's colors, typography, or content hierarchy in this foundation phase.
- Keep every logical change independently reviewable and revertible.

## Design read

Reading this as: a targeted evolution of a local-first interactive fiction reader for touch and small screens, preserving Tuuru's restrained editorial product language and using native HTML, CSS, and JavaScript.

- `DESIGN_VARIANCE: 3`: familiar product controls and predictable mobile structure.
- `MOTION_INTENSITY: 2`: state feedback only; no decorative animation.
- `VISUAL_DENSITY: 5`: the phone metaphor stays information-dense, while touch controls and safe areas remain usable.

This is product UI. The design serves reading and editing tasks, so accessibility, stable layout, and consistent affordances take priority over visual novelty.

## Target context

- Devices: mobile web from 320px portrait through phone landscape, plus existing tablet and desktop surfaces.
- Input: coarse touch first, while retaining mouse and keyboard compatibility.
- Environment: iOS Safari, Android Chromium, and desktop browsers; the application must continue to work offline after assets load.
- Usage: focused reading and short App interactions, sometimes with browser chrome, a notch, or a home indicator reducing the usable viewport.

## Architecture

### 1. Accessible viewport contract

Both HTML entry points remove `maximum-scale` and `user-scalable=no`, so pinch zoom remains available. The standalone reader entry uses:

```text
width=device-width, initial-scale=1, viewport-fit=cover
```

The root editor entry keeps `width=device-width, initial-scale=1` without `viewport-fit=cover` in this phase. Its header and editor shell do not yet consume safe-area insets, so extending the root layout into the cutout would create a new notch-overlap regression. Root safe-area work belongs to the later editor/mobile-article phase.

### 2. Reader viewport tokens

`reader/reader.css` owns reader-specific viewport and safe-area tokens:

- a `100vh` fallback upgraded to `100dvh` when supported;
- top, right, bottom, and left safe-area values using `env(safe-area-inset-*, 0px)`.

The standalone phone screen consumes these tokens when either condition is true:

- viewport width is at most 480px; or
- viewport height is at most 480px and the primary pointer is coarse.

The second condition covers mobile landscape such as 844x390 without converting a short desktop window into a fullscreen phone. Under this contract, `body` and `#app` use the dynamic viewport token, `.phone-reader` is a fixed bounded surface with `height`, `min-height: 0`, and `overflow: hidden`, and its direct phone frame fills the available safe-area content box.

The phone home screen, `#phoneDesktopReader`, overrides its legacy inline `min-height: 420px` only inside a bounded phone. It uses `min-height: 0 !important` and becomes the home screen's vertical scroll owner. An embedded App uses its own bounded body instead.

### 3. Scoped embedded App panels

Only panels injected directly into a phone frame receive the missing layout rules:

```css
.phone-frame > .cu-panel.cu-panel-embedded
```

The panel is an absolute, bounded flex column. Its header does not shrink and its body is the scroll container. Direct-child scoping prevents the generic `.cu-*` names from leaking into reader customization controls.

### 4. Explicit scroll ownership

The target ownership model is:

- Home and article reading: document scrolls.
- Standalone phone work: `.phone-reader` is viewport-bound; the phone's current screen scrolls.
- Article phone overlay: overlay and wrapper are viewport-bound; the phone's current screen scrolls.
- Per-App customization modal: `.cu-modal` is bounded; `.cu-modal-body` scrolls. The separate reader-settings bottom sheet already has one shell-level scroll owner and is not changed here.

The article phone overlay receives explicit class names instead of depending on large inline style strings. This change is isolated from App data rendering.

### 5. Responsive phone desktop coordinates

Persisted `desktopX` and `desktopY` remain the source of truth. A small pure helper converts logical coordinates into CSS variable offsets for both the imported phone renderer and customization preview. The containing `.phone-desktop` supplies a container-relative horizontal origin:

```css
clamp(4px, calc(100% - 330px), 20px)
```

Four 72px icons separated by the existing 80px cell width occupy 312px. The expression resolves to 4px at a 320px desktop container, keeping columns `[4, 84, 164, 244]` inside it. Global border-box sizing means a legacy 360px framed preview has a 350px inner desktop and a 375px frame has a 365px inner desktop; both resolve to the legacy 20px origin and preserve `[20, 100, 180, 260]` exactly.

In bounded mobile overlay mode, the overlay drops its decorative 20px outer padding and the phone frame border. Without that override, a 320px viewport would expose only a 270px phone desktop after padding and borders, which cannot physically contain the 312px four-column span. Desktop overlays retain the existing framed presentation.

Because percentage resolution belongs to CSS, it always uses the actual standalone, overlay, or preview container width and automatically reacts to rotation and resize. No window-width approximation, DOM read, observer, or cleanup lifecycle is required.

## Accessibility and interaction requirements

- Browser zoom remains available.
- Fixed controls account for safe-area insets.
- New or changed mobile controls have a minimum 44px coarse-pointer hit area.
- Functional behavior cannot depend on hover.
- Any retained animation honors reduced motion; this phase adds no decorative motion.
- Phone App content remains readable against the panel surface and is not allowed to inherit the frame's pale decorative text color.

## Compatibility boundaries

This phase does not:

- change phone App payloads or work schema versions;
- reinterpret `desktopX` or `desktopY`;
- migrate the legacy in-editor reader implementation;
- change App-specific business logic;
- redesign the article editor's mobile tree or toolbar;
- add swipe navigation or other new gestures.

## Test strategy

- Parse viewport metadata semantically rather than snapshotting the full string.
- Assert scoped CSS contracts and scroll ownership without relying on JSDOM layout calculations.
- Test the coordinate helper and its container-relative CSS contract at 320px, 350px, and 365px, corresponding to a borderless 320px mobile frame and the inner widths of legacy 360px/375px framed surfaces.
- Add a wiring check proving both production render paths use the helper.
- After every commit, run the full Node test suite, TypeScript build validation, and both Vite production builds into temporary directories.
- Browser automation against localhost is unavailable in the current environment due browser security policy. Manual real-device verification remains an explicit handoff, not a substitute for automated contracts.

## Manual verification matrix

When the user is available, verify at 320x568, 360x640, 390x844, and 844x390:

- pinch zoom is available;
- phone content is visible rather than only the background;
- the fourth icon is not clipped;
- back and settings controls avoid notches and screen edges;
- long App content scrolls inside the phone once;
- leaving the phone returns article or home document scrolling to normal.
