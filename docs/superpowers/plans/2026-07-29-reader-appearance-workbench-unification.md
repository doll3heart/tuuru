# Reader Appearance Workbench Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify every reader-side appearance editor around collapsible settings sections and preserve the desktop preview-left/settings-right mental model on phones through a two-page horizontal workbench.

**Architecture:** Reuse native `details/summary` disclosures and one shared workbench layout vocabulary instead of maintaining separate card, section, and one-off profile dialogs. Desktop remains a two-column grid; narrow screens become a horizontally snapping two-page surface with preview first and controls second, plus explicit page controls so swipe is optional.

**Tech Stack:** Vanilla JavaScript, semantic HTML, CSS Grid/Flexbox, native `details`, JSDOM tests, Vite build verification.

## Global Constraints

- Preserve every existing setting key, storage namespace, save/cancel behavior, image validation, and CSS sanitization path.
- The preview is the first/left page and settings are the second/right page.
- Use native disclosure elements with 44px minimum interactive targets and visible focus.
- Only one top-level settings group is open by default in each editor.
- Do not commit, push, or deploy unless the user asks.

---

### Task 1: Shared collapsible and mobile-page workbench

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Produces: `readerAppearanceDisclosure(id, title, body, open, className)`
- Produces: `bindReaderAppearancePager(root)`
- Consumes: existing `.app-appearance-layout`, `.phone-appearance-layout`, and `.rs-panel-body` shells.

- [ ] **Step 1: Write failing structure tests**

Assert that workbench dialogs expose `data-appearance-page="preview"` and `data-appearance-page="controls"`, a named pager, and native top-level disclosures.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `node --test --test-name-pattern="appearance workbench|appearance pager" tests/reader-app-settings-dialog.test.mjs`

- [ ] **Step 3: Implement shared disclosure and pager markup**

Keep the desktop grid unchanged and add explicit preview/settings page buttons that scroll the mobile workbench to the matching page.

- [ ] **Step 4: Implement the narrow-screen two-page layout**

At `max-width: 860px`, use horizontal overflow, mandatory snap points, full-width pages, sticky page navigation, and reduced-motion-safe scrolling.

- [ ] **Step 5: Re-run the focused tests**

Expected: all new shared workbench tests pass.

### Task 2: Convert every per-App editor from cards to disclosures

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Consumes: `cuSettingsSection(...)`
- Produces: stable App-specific section IDs for forum, memo, gallery, browser, shopping, and contacts.

- [ ] **Step 1: Write a failing test for every App type**

Open each App editor and assert that no direct `.cu-card` remains, all logical groups are `details.cu-settings-section`, the first group is open, and “应用与高级” is the final collapsed group.

- [ ] **Step 2: Confirm the test fails against legacy cards**

Run: `node --test --test-name-pattern="every reader App appearance editor uses collapsible groups" tests/reader-app-settings-dialog.test.mjs`

- [ ] **Step 3: Replace legacy `cuCard` calls**

Map existing groups without changing controls:

- Forum: 头像 / 帖子卡片 / 标题与时间 / 应用与高级
- Memo: 卡片风格 / 外观与文字 / 应用与高级
- Gallery: 网格 / 图片外观 / 应用与高级
- Browser: 标题与 URL / 时间与条目 / 应用与高级
- Shopping: 商品名称 / 价格 / 应用与高级
- Contacts: 头像 / 名称 / 应用与高级

- [ ] **Step 4: Re-run per-App tests**

Expected: all App types expose the same disclosure vocabulary and existing save tests still pass.

### Task 3: Convert phone appearance into collapsible groups

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-home-navigation.test.mjs`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Consumes: `readerAppearanceDisclosure(...)`
- Preserves: `#phoneAppearancePreview`, all `cu*` control IDs, package transfer, dirty-state and save logic.

- [ ] **Step 1: Write a failing phone-appearance structure test**

Assert sections for 壁纸与边框 / 尺寸与材质 / 字体与系统组件 / 高级 CSS / 外观迁移, with only the first open.

- [ ] **Step 2: Confirm failure**

Run the focused phone-appearance tests.

- [ ] **Step 3: Wrap the existing controls in shared disclosures**

Do not rename input IDs or change event binding. Put transfer controls in their own final disclosure and keep reset outside the groups.

- [ ] **Step 4: Verify the preview remains live**

Change wallpaper, border radius, font size, and CSS in tests; assert the preview updates and Cancel preserves storage.

### Task 4: Convert article reading appearance into collapsible groups

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Consumes: shared workbench page markup and disclosure styling.
- Preserves: every `rs*` control ID, auto-save behavior, image/font upload, CSS validation, and reading-position restoration.

- [ ] **Step 1: Write a failing article-appearance structure test**

Assert top-level groups for 文字排版 / 标题与结构 / 字体 / 选项与图片 / 主题与背景 / 阅读效果 / 高级 CSS / 外观迁移.

- [ ] **Step 2: Confirm failure**

Run the focused article appearance test.

- [ ] **Step 3: Regroup existing controls without changing IDs**

Move the current markup into disclosure bodies; keep 文字排版 open by default and all other groups collapsed.

- [ ] **Step 4: Verify existing live update and persistence**

Exercise font size, line height, theme, background, typing effect, and CSS controls.

### Task 5: Replace the one-off profile dialog with the shared workbench

**Files:**
- Modify: `reader/reader.js`
- Modify: `reader/reader.css`
- Test: `tests/reader-home-navigation.test.mjs`
- Test: `tests/reader-app-settings-dialog.test.mjs`

**Interfaces:**
- Consumes: `openCuModal(...)`, `renderPhonePreview(...)`, shared pager/disclosures.
- Preserves: reader nickname, avatar, top background image, local upload/clear, save/cancel.

- [ ] **Step 1: Write a failing profile workbench test**

Assert a real phone preview on the left page, disclosures for 基本信息 / 头像 / 顶部背景, and standard modal actions.

- [ ] **Step 2: Confirm failure against the inline-styled legacy modal**

Run the profile-focused test.

- [ ] **Step 3: Implement profile draft preview**

Render the current phone shell and update nickname, avatar, and top background in real time without writing storage until Save.

- [ ] **Step 4: Verify dismissal behavior**

Check Cancel, close button, backdrop, and Escape preserve exact raw storage.

### Task 6: Visual QA and full regression

**Files:**
- Modify only if QA finds a scoped defect: `reader/reader.css`, `reader/reader.js`

- [ ] **Step 1: Inspect desktop widths**

Open article, phone, profile, messages, forum, memo, gallery, browser, shopping, and contacts editors at desktop width. Verify preview-left/settings-right, one open section, reachable actions, and no clipping.

- [ ] **Step 2: Inspect phone widths**

At 390px width, verify preview is the first snap page, controls are the second, both pager buttons work, swipe remains available, fields do not overflow, and footer actions stay reachable.

- [ ] **Step 3: Run the full suite**

Run: `npm test`

Expected: zero failures.

- [ ] **Step 4: Run production verification**

Run: `npm run build:verify`

Expected: TypeScript and both Vite builds complete successfully.

- [ ] **Step 5: Check patch integrity**

Run: `git diff --check -- reader/reader.js reader/reader.css tests/reader-app-settings-dialog.test.mjs tests/reader-home-navigation.test.mjs`

Expected: no whitespace errors.
