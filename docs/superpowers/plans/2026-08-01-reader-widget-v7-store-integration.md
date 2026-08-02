# Reader Widget V7 Store Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship the 26 approved V7 widgets as installable products in the reader phone component store, including local user-selected photos and non-interactive decorative products.

**Architecture:** Add a product catalog above the existing story-content resolver. Each product owns its approved composition, category, size, assets, text color ramp, content source, and photo-slot count; persisted items reference `productId`, while legacy `kind` records migrate to the first compatible V7 product. Store thumbnails, installed previews, and the live phone desktop all call the same product renderer.

**Tech Stack:** Vanilla ES modules, HTML/CSS, localStorage appearance settings, FileReader image uploads, Node test runner, JSDOM.

## Global Constraints

- The store contains exactly 26 V7 products: 9 function, 9 photo, and 8 decor.
- Every photo slot is empty by default and may only display a photo explicitly selected by the reader for that product.
- Decorative products render as non-interactive desktop objects, not fake shortcuts.
- Product text keeps the decoration's hue and saturation and uses a lower lightness.
- The scattered-polaroid product uses independent photo cards in one coordinate system.
- V6 and the V7 prototype remain unchanged except for production asset copies.
- Existing local reader and appearance changes outside the widget surface must be preserved.

---

### Task 1: Define and test the V7 product catalog

**Files:**
- Modify: `reader/phone-desktop-widgets.js`
- Modify: `tests/reader-phone-desktop-widgets.test.mjs`

**Interfaces:**
- Produces: `PHONE_DESKTOP_WIDGET_PRODUCTS`, normalized item shape `{ productId, kind, enabled, size, photos }`, and `renderPhoneDesktopWidgets(candidate, phoneData, context)`.
- Consumes: existing sanitizer helpers and story-content data.

- [x] **Step 1: Write failing catalog and normalization tests**

Assert 26 unique product IDs, category counts `{ function:9, photo:9, decor:8 }`, 17 total photo slots, safe photo URL normalization, legacy-kind migration, and no automatic story-gallery image inside a photo product.

- [x] **Step 2: Run the focused test and confirm the new assertions fail**

Run: `node --test tests/reader-phone-desktop-widgets.test.mjs`

Expected: FAIL because `PHONE_DESKTOP_WIDGET_PRODUCTS` and `productId` do not exist.

- [x] **Step 3: Implement the catalog, migration, and safe item normalization**

Each catalog record follows this contract:

```js
{
  id:"v7-resume-dessert",
  label:"续读横幅",
  category:"function",
  kind:"resume",
  layout:"resume-dessert",
  defaultSize:"wide",
  photoSlots:0,
  hint:"沿用阅读进度与作品标题",
}
```

Normalize `photos` to exactly `photoSlots` entries using only `isSafeImageUrl` values; fill missing entries with `null`.

- [x] **Step 4: Implement the 26 shared product templates**

Render each product with `data-widget-product`, `data-widget-category`, and its approved asset composition. Use `<button>` only for function products and `<div>` for photo/decor products. Render empty photo slots without story images.

- [x] **Step 5: Run the focused test and confirm it passes**

Run: `node --test tests/reader-phone-desktop-widgets.test.mjs`

Expected: PASS.

### Task 2: Add production assets and V7 component styling

**Files:**
- Create: `reader/assets/widgets/v7/*.png`
- Modify: `reader/reader.css`

**Interfaces:**
- Consumes: product markup emitted by `renderPhoneDesktopWidgets`.
- Produces: responsive `.phone-story-widget-v7` layouts shared by store, preview, and runtime.

- [x] **Step 1: Copy the 25 curated, referenced V7 PNG files into the reader asset tree**

Copy only files referenced by the catalog; do not copy prototype QA images or unused assets.

- [x] **Step 2: Port the approved compositions with scoped CSS**

Prefix production rules with `.phone-story-widget-v7` and use percentage geometry so wide and half products scale inside phone/store previews. Bind per-product `--v7-ink`, `--v7-muted`, and `--v7-accent` values using identical hue/saturation and darker lightness.

- [x] **Step 3: Add responsive and reduced-motion behavior**

Ensure all products fit at 320px phone width, store cards fit at the existing mobile breakpoint, and no product relies on motion for visibility.

### Task 3: Replace the generic shell store with the V7 product store

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Modify: `tests/reader-phone-appearance-dialog.test.mjs`

**Interfaces:**
- Consumes: `PHONE_DESKTOP_WIDGET_PRODUCTS` and normalized `productId` items.
- Produces: product filters, add/remove/order controls, and local photo-slot controls.

- [x] **Step 1: Write failing dialog tests**

Assert 26 cards, four category filters, product-based installation, no generic skin chooser, a non-interactive decor preview, and photo controls for every installed product slot.

- [x] **Step 2: Run the dialog test and confirm failure**

Run: `node --test tests/reader-phone-appearance-dialog.test.mjs`

Expected: FAIL on the old 12-card generic store.

- [x] **Step 3: Render and bind the product store**

Key every store/install action by `productId`; filter by `all/function/photo/decor`; keep size/composition fixed to the approved product defaults; preserve ordering controls.

- [x] **Step 4: Add local photo selection controls**

For each product slot, create `选择照片` and `清除` actions. Read local images through `FileReader`, store the resulting safe data URL in `item.photos[index]`, and refresh both installed preview and live phone preview.

- [x] **Step 5: Run the focused dialog test and confirm it passes**

Run: `node --test tests/reader-phone-appearance-dialog.test.mjs`

Expected: PASS.

### Task 4: Preserve privacy through appearance packages and verify

**Files:**
- Modify: `reader/appearance-package.js`
- Modify: `tests/reader-appearance-package.test.mjs`

**Interfaces:**
- Consumes: normalized product items.
- Produces: appearance packages that preserve installed product IDs but omit local photo bytes.

- [x] **Step 1: Write a failing package privacy test**

Assert exported items retain `productId` and installed state while serialized output contains neither private note text nor `photos` data URLs.

- [x] **Step 2: Update the package picker and run focused tests**

Run: `node --test tests/reader-appearance-package.test.mjs tests/reader-phone-desktop-widgets.test.mjs tests/reader-phone-appearance-dialog.test.mjs`

Expected: PASS.

- [x] **Step 3: Run the complete verification suite**

Run: `npm run verify`

Expected: all checks pass.

- [x] **Step 4: Perform final visual and repository checks**

Render the reader phone appearance dialog at desktop and mobile widths; confirm empty/user-photo states, store filtering, decor non-interactivity, and asset loading. Run `git diff --check` and report unrelated pre-existing changes separately.
