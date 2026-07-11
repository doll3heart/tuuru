# Local Data Integrity and Recovery v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Tuuru's local data contract fail safely on malformed nested work data, prove editor exports remain reader-compatible, and add a two-phase whole-library restore flow that can recover missing, valid, or corrupt local storage without deleting the previous value first.

**Architecture:** `js/work-schema.js` becomes the single pure work validation/normalization boundary; `js/storage.js` composes it into raw database inspection, outgoing validation, backup parsing, and a prepared restore transaction. A focused restore UI module owns file selection and destructive confirmation so both the normal homepage and corrupt-storage startup screen use the same behavior without adding a server or runtime dependency.

**Tech Stack:** Browser JavaScript ES modules, `localStorage`, Node.js `node:test` and `assert/strict`, JSDOM 27, DOMPurify, existing stegano helpers, TypeScript project checking, Vite 6.

## Global Constraints

- The application remains frontend-only and local-only; add no server, upload, community, telemetry, remote database, account, or new network behavior.
- Preserve existing editor, reader, JSON export, PNG export, backup, and corrupt-data recovery behavior unless this plan explicitly changes it.
- Reading passwords remain client-side gates; copy must never claim that exported content is encrypted.
- Missing legacy optional collections may receive in-memory defaults; a present collection with the wrong type must fail and must never be silently replaced with `[]`.
- Preserve unknown top-level and nested fields through normalization, backup parsing, restore, and ordinary writes.
- Reject future work schema versions; never lower them to the current version during export, restore, or write.
- This phase uses whole-database fail-closed handling for malformed known works. Do not quarantine, delete, filter, or auto-repair invalid entries.
- Restore replaces the complete library. Do not merge records or remap IDs.
- Restore must never call `removeItem()` before replacement and must never automatically roll back with a second destructive write after an uncertain readback.
- Keep existing backup file limits: 25 MB for complete-library JSON, 10 MB for reader JSON, 25 MB for reader PNG, and 10 MB for stegano payload data.
- Do not add IndexedDB, a service worker, PWA caching, CRDTs, Web Locks, a framework, or a new runtime dependency.
- Follow strict TDD: add one failing behavior test, verify the expected RED failure, implement the minimum code, then verify GREEN.
- Begin every task with a clean worktree; keep only one logical task uncommitted; create one Conventional Commit per task.
- After every commit run the focused tests, `npm test`, `npm run build:verify`, `git diff --check`, and `git status --short`.

## File Structure

- Modify `js/work-schema.js`: pure context-aware work validation and normalization; retain `validateWorkForImport()` as the reader-compatible wrapper.
- Modify `js/storage.js`: pure raw inspection, database-wide validation, backup validation reuse, and prepared restore transaction.
- Create `js/work-import.js`: one validate-then-sanitize reader preparation boundary shared by JSON and PNG imports.
- Create `js/library-restore-ui.js`: shared local file picker, preview, recovery download, confirmation, commit, and reload behavior.
- Modify `js/pages/home.js`: truthful password copy, truthful download copy, and shared restore flow entry.
- Modify `js/pages/reader.js`: truthful reading-password gate copy.
- Modify `reader/reader.js`: consume the shared validate-then-sanitize import boundary.
- Modify `js/app.js`: corrupt startup recovery entry using the shared restore flow.
- Modify `css/styles.css`: one small help-text rule for the reading-password disclosure.
- Create `tests/security-copy.test.mjs`: security promise source contract.
- Modify `tests/work-schema.test.mjs`: deep work-shape, immutability, legacy, unknown-field, and context tests.
- Modify `tests/storage.test.mjs`: database-wide validation and restore transaction tests.
- Create `tests/work-transport-parity.test.mjs`: editor JSON and stegano payload parity fixtures.
- Create `tests/library-restore-ui.test.mjs`: restore UI state-machine tests.
- Create `tests/storage-recovery-ui.test.mjs`: corrupt startup integration test.

---

### Task 1: Make the reading-password promise truthful

**Files:**
- Create: `tests/security-copy.test.mjs`
- Modify: `js/pages/home.js:62,259-264`
- Modify: `js/pages/reader.js:20-24`
- Modify: `css/styles.css:1160-1164`

**Interfaces:**
- Consumes: existing `locked`/`password` fields and existing password comparison behavior.
- Produces: source-level copy contract: “需阅读密码” and an explicit non-encryption disclosure.

- [ ] **Step 1: Write the failing security-copy test**

Create `tests/security-copy.test.mjs`:

```js
import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const homeSource = await readFile(new URL("../js/pages/home.js", import.meta.url), "utf8")
const previewSource = await readFile(new URL("../js/pages/reader.js", import.meta.url), "utf8")
const securityCopy = homeSource + "\n" + previewSource

test("reading-password UI never claims that works are encrypted", () => {
  assert.doesNotMatch(securityCopy, /已加密|此作品已加密/)
  assert.match(homeSource, /需阅读密码/)
  assert.match(previewSource, /此作品设有阅读密码/)
  assert.match(homeSource, /不会加密导出的 JSON 或 PNG 文件/)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/security-copy.test.mjs
```

Expected: FAIL because `home.js` still contains `已加密`, `reader.js` still contains `此作品已加密`, and the export disclosure is absent.

- [ ] **Step 3: Replace only the inaccurate copy**

In `js/pages/home.js`, change the locked badge to `需阅读密码`. Replace the password row with:

```js
body += '<div class="wi-row"><label class="wi-label">阅读密码（选填）</label><input class="wi-input" id="wiPwd" value="' + escHtml(w.password || '') + '" placeholder="设置后读者需输入密码"><div class="wi-help">阅读密码仅限制通过阅读界面进入，不会加密导出的 JSON 或 PNG 文件。</div></div>'
```

In `js/pages/reader.js`, replace the gate heading and supporting copy with:

```html
<h2>此作品设有阅读密码</h2>
<p>请输入阅读密码后继续；该密码不是文件加密。</p>
```

Append to `css/styles.css` beside the work-information rules:

```css
.wi-help { color: var(--c-text2); font-size: .72rem; line-height: 1.5; }
```

Do not change password fields, comparisons, session keys, export payloads, or lock icons.

- [ ] **Step 4: Verify GREEN and the complete repository**

Run:

```powershell
node --test tests/security-copy.test.mjs
npm test
npm run build:verify
git diff --check
```

Expected: the focused test and all repository checks pass.

- [ ] **Step 5: Commit the isolated copy correction**

```powershell
git add tests/security-copy.test.mjs js/pages/home.js js/pages/reader.js css/styles.css
git commit -m "fix(security): clarify reading password boundary"
```

After the commit, rerun the verification commands from Step 4 and confirm `git status --short` is empty.

---

### Task 2: Establish one deep work validation and normalization contract

**Files:**
- Modify: `tests/work-schema.test.mjs`
- Modify: `js/work-schema.js`

**Interfaces:**
- Consumes: arbitrary parsed work data.
- Produces: `validateAndNormalizeWork(input, { context, path })` and the existing `validateWorkForImport(input)` wrapper.
- Context values: `reader-import`, `local-database`, and `backup`.

- [ ] **Step 1: Add failing deep-shape and compatibility tests**

Append to `tests/work-schema.test.mjs` and import `validateAndNormalizeWork`:

```js
test("missing legacy collections normalize without mutating source", () => {
  const input = {
    type: "article",
    nodes: [{ id: "start", content: "hello" }],
    futureField: { enabled: true },
  }
  const original = structuredClone(input)

  const result = validateAndNormalizeWork(input, { context: "reader-import", path: "$" })

  assert.equal(result.ok, true)
  assert.deepEqual(input, original)
  assert.deepEqual(result.work.nodes[0].choices, [])
  assert.deepEqual(result.work.chapters, [])
  assert.deepEqual(result.work.futureField, { enabled: true })
  assert.notEqual(result.work.futureField, input.futureField)
})

test("present wrong-typed article collections fail at a stable path", () => {
  const result = validateAndNormalizeWork({
    type: "article",
    nodes: [{ id: "start", choices: null }],
  }, { context: "reader-import", path: "$" })

  assert.equal(result.ok, false)
  assert.equal(result.code, "invalid-article")
  assert.equal(result.issues[0].code, "invalid-record-array")
  assert.equal(result.issues[0].path, "$.nodes[0].choices")
})

test("null and primitive collection entries fail without incidental throws", () => {
  for (const input of [
    { type: "article", nodes: [null] },
    { type: "article", nodes: [{ choices: ["bad"] }] },
    { type: "phone", phoneData: { contacts: [null] } },
    { type: "phone", phoneData: { chats: [{ messages: [7] }] } },
    { type: "phone", phoneData: { chats: [{ rounds: [{ messages: null }] }] } },
    { type: "phone", phoneData: { moments: [{ comments: [false] }] } },
    { type: "phone", phoneData: { forumPosts: [{ comments: {} }] } },
  ]) {
    const result = validateAndNormalizeWork(input, { context: "reader-import", path: "$" })
    assert.equal(result.ok, false)
    assert.ok(result.issues[0].path.startsWith("$"))
  }
})

test("local and backup contexts preserve unknown legacy work types", () => {
  const input = { id: "legacy", type: "legacy-tool", future: { value: 1 } }

  for (const context of ["local-database", "backup"]) {
    const result = validateAndNormalizeWork(input, { context, path: "$.works[0]" })
    assert.equal(result.ok, true)
    assert.deepEqual(result.work, input)
    assert.notEqual(result.work, input)
  }
  assert.equal(validateWorkForImport(input).code, "unsupported-type")
})

test("future schema versions fail in every context without downgrade", () => {
  const input = {
    schemaVersion: CURRENT_WORK_SCHEMA_VERSION + 1,
    type: "article",
    nodes: [],
  }

  for (const context of ["reader-import", "local-database", "backup"]) {
    const result = validateAndNormalizeWork(input, { context, path: "$" })
    assert.equal(result.ok, false)
    assert.equal(result.code, "unsupported-version")
  }
  assert.equal(input.schemaVersion, CURRENT_WORK_SCHEMA_VERSION + 1)
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
node --test tests/work-schema.test.mjs
```

Expected: FAIL because `validateAndNormalizeWork` is not exported and existing normalization accepts wrong-typed optional arrays.

- [ ] **Step 3: Implement the pure shared validator**

Refactor `js/work-schema.js` around these exact collections and result contract:

```js
export const CURRENT_WORK_SCHEMA_VERSION = 1

const SUPPORTED_WORK_TYPES = new Set(["article", "phone"])
const ARTICLE_COLLECTIONS = ["chapters", "phoneModules", "placeholders", "scenes"]
const PHONE_COLLECTIONS = [
  "contacts", "chats", "moments", "forumPosts", "forumNpcs", "apps",
  "memos", "photos", "albums", "browserHistory", "shoppingItems",
]

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function cloneJsonValue(value) {
  if (Array.isArray(value)) return value.map(cloneJsonValue)
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJsonValue(child)]))
  }
  return value
}

function failure(code, message, issues = []) {
  return { ok: false, code, message, issues }
}

function recordArray(value, path, { required = false } = {}) {
  if (value === undefined && !required) return { ok: true, value: [] }
  if (!Array.isArray(value)) {
    return failure("invalid-record-array", "字段必须是对象数组。", [{
      code: "invalid-record-array",
      path,
      message: "字段必须是对象数组。",
    }])
  }
  const invalidIndex = value.findIndex(item => !isRecord(item))
  if (invalidIndex >= 0) {
    return failure("invalid-record-entry", "数组包含无效条目。", [{
      code: "invalid-record-entry",
      path: `${path}[${invalidIndex}]`,
      message: "数组条目必须是对象。",
    }])
  }
  return { ok: true, value: value.map(cloneJsonValue) }
}

function asWorkFailure(result, code, message) {
  return result.ok ? result : failure(code, message, result.issues)
}

function normalizeArticle(input, path) {
  const nodesResult = recordArray(input.nodes, `${path}.nodes`, { required: true })
  if (!nodesResult.ok) return asWorkFailure(nodesResult, "invalid-article", "文章作品结构无效。")

  const work = cloneJsonValue(input)
  work.nodes = nodesResult.value
  for (const key of ARTICLE_COLLECTIONS) {
    const result = recordArray(input[key], `${path}.${key}`)
    if (!result.ok) return asWorkFailure(result, "invalid-article", "文章作品结构无效。")
    work[key] = result.value
  }
  for (let index = 0; index < work.nodes.length; index += 1) {
    const result = recordArray(input.nodes[index].choices, `${path}.nodes[${index}].choices`)
    if (!result.ok) return asWorkFailure(result, "invalid-article", "文章作品结构无效。")
    work.nodes[index].choices = result.value
  }
  for (let index = 0; index < work.phoneModules.length; index += 1) {
    const moduleData = input.phoneModules[index].data
    if (moduleData !== undefined && !isRecord(moduleData)) {
      return failure("invalid-article", "文章手机模块结构无效。", [{
        code: "invalid-record",
        path: `${path}.phoneModules[${index}].data`,
        message: "手机模块 data 必须是对象。",
      }])
    }
  }
  if (!work.startNode && work.nodes.length > 0) work.startNode = work.nodes[0].id
  return { ok: true, work }
}

function normalizePhoneData(phoneData, path) {
  const normalized = cloneJsonValue(phoneData)
  for (const key of PHONE_COLLECTIONS) {
    const result = recordArray(phoneData[key], `${path}.${key}`)
    if (!result.ok) return result
    normalized[key] = result.value
  }

  for (let index = 0; index < normalized.chats.length; index += 1) {
    const sourceChat = phoneData.chats[index]
    for (const key of ["messages", "rounds"]) {
      const result = recordArray(sourceChat[key], `${path}.chats[${index}].${key}`)
      if (!result.ok) return result
      normalized.chats[index][key] = result.value
    }
    for (let roundIndex = 0; roundIndex < normalized.chats[index].rounds.length; roundIndex += 1) {
      const result = recordArray(
        sourceChat.rounds[roundIndex].messages,
        `${path}.chats[${index}].rounds[${roundIndex}].messages`,
      )
      if (!result.ok) return result
      normalized.chats[index].rounds[roundIndex].messages = result.value
    }
  }

  for (const [collection, nested] of [["moments", "comments"], ["forumPosts", "comments"]]) {
    for (let index = 0; index < normalized[collection].length; index += 1) {
      const result = recordArray(
        phoneData[collection][index][nested],
        `${path}.${collection}[${index}].${nested}`,
      )
      if (!result.ok) return result
      normalized[collection][index][nested] = result.value
    }
  }
  return { ok: true, value: normalized }
}

export function validateAndNormalizeWork(input, {
  context = "reader-import",
  path = "$",
} = {}) {
  if (!isRecord(input)) {
    return failure("invalid-work", "文件内容不是有效的 Tuuru 作品对象。", [{
      code: "invalid-record", path, message: "作品必须是对象。",
    }])
  }

  const sourceVersion = input.schemaVersion === undefined ? 0 : input.schemaVersion
  if (!Number.isInteger(sourceVersion) || sourceVersion < 0) {
    return failure("invalid-version", "作品格式版本无效。", [{
      code: "invalid-version", path: `${path}.schemaVersion`, message: "格式版本必须是非负整数。",
    }])
  }
  if (sourceVersion > CURRENT_WORK_SCHEMA_VERSION) {
    return failure(
      "unsupported-version",
      `该作品使用格式版本 ${sourceVersion}，当前版本最高支持 ${CURRENT_WORK_SCHEMA_VERSION}。请升级阅读器后重试。`,
      [{ code: "unsupported-version", path: `${path}.schemaVersion`, message: "作品来自更新版本。" }],
    )
  }

  if (!SUPPORTED_WORK_TYPES.has(input.type)) {
    if (context !== "reader-import" && (input.type === undefined || typeof input.type === "string")) {
      return {
        ok: true,
        work: cloneJsonValue(input),
        sourceVersion,
        migrated: false,
        warnings: [],
      }
    }
    return failure("unsupported-type", "作品类型无效或当前阅读器不支持。", [{
      code: "unsupported-type", path: `${path}.type`, message: "作品类型不受支持。",
    }])
  }

  let normalized
  if (input.type === "article") normalized = normalizeArticle(input, path)
  else if (!isRecord(input.phoneData)) {
    normalized = failure("invalid-phone", "手机作品缺少有效的手机数据。", [{
      code: "invalid-record", path: `${path}.phoneData`, message: "phoneData 必须是对象。",
    }])
  } else {
    const phoneResult = normalizePhoneData(input.phoneData, `${path}.phoneData`)
    normalized = phoneResult.ok
      ? { ok: true, work: { ...cloneJsonValue(input), phoneData: phoneResult.value } }
      : asWorkFailure(phoneResult, "invalid-phone", "手机作品结构无效。")
  }
  if (!normalized.ok) return normalized

  normalized.work.schemaVersion = CURRENT_WORK_SCHEMA_VERSION
  for (const key of ["placeholders", "scenes"]) {
    const result = recordArray(input[key], `${path}.${key}`)
    if (!result.ok) return asWorkFailure(result, `invalid-${input.type}`, "作品公共结构无效。")
    normalized.work[key] = result.value
  }
  return {
    ok: true,
    work: normalized.work,
    sourceVersion,
    migrated: sourceVersion < CURRENT_WORK_SCHEMA_VERSION,
    warnings: [],
  }
}

export function validateWorkForImport(input) {
  return validateAndNormalizeWork(input, { context: "reader-import", path: "$" })
}
```

Keep messages user-readable and preserve the existing exported names and existing test expectations.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
node --test tests/work-schema.test.mjs tests/sanitize.test.mjs
```

Expected: all work-schema and sanitation tests pass, including the new exact paths.

- [ ] **Step 5: Run complete verification and commit**

```powershell
npm test
npm run build:verify
git diff --check
git add js/work-schema.js tests/work-schema.test.mjs
git commit -m "feat(schema): validate nested work structures"
```

After the commit, rerun complete verification and confirm `git status --short` is empty.

---

### Task 3: Apply shared validation to local databases, writes, and backups

**Files:**
- Modify: `tests/storage.test.mjs`
- Modify: `js/storage.js`

**Interfaces:**
- Consumes: `validateAndNormalizeWork()` from Task 2.
- Produces: `LOCAL_DATABASE_KEY`, `inspectLocalDatabaseRaw(raw)`, stricter `inspectLocalDatabase()`, stricter `writeLocalDatabase()`, and backup parsing that uses the same database contract.

- [ ] **Step 1: Add failing storage-boundary tests**

Extend `tests/storage.test.mjs` imports with `LOCAL_DATABASE_KEY` and `inspectLocalDatabaseRaw`, then add:

```js
test("raw inspection normalizes missing legacy collections without writing", () => {
  const raw = JSON.stringify({
    works: [{ type: "article", nodes: [{ id: "start" }], future: true }],
    futureDatabaseField: { enabled: true },
  })

  const status = inspectLocalDatabaseRaw(raw)

  assert.equal(status.ok, true)
  assert.deepEqual(status.data.contacts, [])
  assert.deepEqual(status.data.groups, [])
  assert.deepEqual(status.data.works[0].nodes[0].choices, [])
  assert.deepEqual(status.data.futureDatabaseField, { enabled: true })
  assert.equal(status.raw, raw)
})

test("known nested corruption fails closed and preserves exact raw data", () => {
  const raw = JSON.stringify({
    works: [{ type: "phone", phoneData: { contacts: [null] } }],
    contacts: [],
    groups: [],
  })
  const storage = createStorage(raw)

  const status = inspectLocalDatabase(storage)

  assert.equal(status.ok, false)
  assert.equal(status.code, "invalid-structure")
  assert.equal(status.raw, raw)
  assert.equal(status.issues[0].path, "$.works[0].phoneData.contacts[0]")
  assert.throws(() => readLocalDatabase(storage), LocalDatabaseError)
  assert.equal(storage.calls.set, 0)
})

test("present wrong-typed top-level collections are never defaulted away", () => {
  for (const database of [
    { works: [], contacts: null, groups: [] },
    { works: [], contacts: [], groups: "bad" },
    { works: [], contacts: [null], groups: [] },
  ]) {
    const status = inspectLocalDatabaseRaw(JSON.stringify(database))
    assert.equal(status.ok, false)
    assert.equal(status.code, "invalid-structure")
  }
})

test("invalid outgoing nested data never reaches setItem", () => {
  const storage = createStorage(JSON.stringify({ works: [], contacts: [], groups: [] }))

  assert.throws(
    () => writeLocalDatabase({
      works: [{ type: "article", nodes: [{ choices: [null] }] }],
      contacts: [],
      groups: [],
    }, storage),
    error => error instanceof LocalDatabaseError && error.code === "invalid-write",
  )
  assert.equal(storage.calls.set, 0)
})

test("backup parsing and local inspection share nested work validation", () => {
  const database = {
    works: [{ type: "article", nodes: [{ choices: null }] }],
    contacts: [],
    groups: [],
  }
  const envelope = {
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-11T00:00:00.000Z",
    database,
  }

  assert.equal(inspectLocalDatabaseRaw(JSON.stringify(database)).code, "invalid-structure")
  assert.throws(
    () => parseLocalDatabaseBackup(JSON.stringify(envelope)),
    error => error instanceof LocalDatabaseError && error.code === "invalid-backup-database",
  )
})

test("database key remains a stable public storage contract", () => {
  assert.equal(LOCAL_DATABASE_KEY, "tuuru_works")
})
```

- [ ] **Step 2: Run focused storage tests and verify RED**

```powershell
node --test tests/storage.test.mjs
```

Expected: FAIL because the pure raw inspector and exported key do not exist and nested corruption still passes startup inspection.

- [ ] **Step 3: Introduce pure database validation and reuse it everywhere**

At the top of `js/storage.js` import `validateAndNormalizeWork` and export the key:

```js
import { validateAndNormalizeWork } from "./work-schema.js"

export const LOCAL_DATABASE_KEY = "tuuru_works"
const DATABASE_KEY = LOCAL_DATABASE_KEY
```

Add pure helpers before `inspectLocalDatabase()`:

```js
function recordArray(value, path, { optional = false } = {}) {
  if (value === undefined && optional) return { ok: true, value: [] }
  if (!Array.isArray(value)) {
    return { ok: false, issues: [{ code: "invalid-record-array", path, message: "字段必须是对象数组。" }] }
  }
  const invalidIndex = value.findIndex(item => !isRecord(item))
  if (invalidIndex >= 0) {
    return { ok: false, issues: [{
      code: "invalid-record-entry",
      path: `${path}[${invalidIndex}]`,
      message: "数组条目必须是对象。",
    }] }
  }
  return { ok: true, value: value.map(item => ({ ...item })) }
}

function validateDatabaseObject(data, { context = "local-database", raw = null } = {}) {
  if (!isRecord(data)) {
    return { ok: false, code: "invalid-structure", raw, issues: [{
      code: "invalid-record", path: "$", message: "创作库必须是对象。",
    }], message: "本地作品数据缺少有效的顶层对象。" }
  }

  const works = recordArray(data.works, "$.works")
  const contacts = recordArray(data.contacts, "$.contacts", { optional: true })
  const groups = recordArray(data.groups, "$.groups", { optional: true })
  const failed = [works, contacts, groups].find(result => !result.ok)
  if (failed) {
    return {
      ok: false,
      code: "invalid-structure",
      raw,
      issues: failed.issues,
      message: "本地作品数据包含无效的集合结构。",
    }
  }

  const normalizedWorks = []
  for (let index = 0; index < works.value.length; index += 1) {
    const result = validateAndNormalizeWork(works.value[index], {
      context,
      path: `$.works[${index}]`,
    })
    if (!result.ok) {
      return {
        ok: false,
        code: "invalid-structure",
        raw,
        issues: result.issues,
        message: result.message,
      }
    }
    normalizedWorks.push(result.work)
  }
  return {
    ok: true,
    raw,
    data: { ...data, works: normalizedWorks, contacts: contacts.value, groups: groups.value },
  }
}

export function inspectLocalDatabaseRaw(raw) {
  if (raw === null) return { ok: true, data: createEmptyDatabase(), raw: null }
  let data
  try {
    data = JSON.parse(raw)
  } catch (error) {
    return {
      ok: false,
      code: "invalid-json",
      raw,
      issues: [{ code: "invalid-json", path: "$", message: "JSON 无法解析。" }],
      message: describeError(error, "本地作品数据不是有效的 JSON。"),
    }
  }
  return validateDatabaseObject(data, { context: "local-database", raw })
}
```

Refactor `inspectLocalDatabase()` so it reads the key once, maps access failure to `storage-unavailable`, and otherwise returns `inspectLocalDatabaseRaw(raw)`.

Refactor `writeLocalDatabase()` in this order:

```js
const current = inspectLocalDatabase(storage)
if (!current.ok) throw integrityError(current)

const candidate = validateDatabaseObject(data, { context: "local-database" })
if (!candidate.ok) {
  throw new LocalDatabaseError("拒绝写入无效的作品数据库。", "invalid-write")
}

let serialized
try {
  serialized = JSON.stringify(candidate.data)
  storage.setItem(DATABASE_KEY, serialized)
} catch (error) {
  throw new LocalDatabaseError(
    "作品保存失败。请检查浏览器存储空间并立即导出备份。",
    "write-failed",
    error,
  )
}
```

In `parseLocalDatabaseBackup()`, replace the independent `validCollections`/`validEntries` checks with:

```js
const databaseResult = validateDatabaseObject(database, { context: "backup" })
if (!databaseResult.ok) {
  throw new LocalDatabaseError(
    "备份文件中的创作库结构无效。",
    "invalid-backup-database",
    undefined,
    { issues: databaseResult.issues },
  )
}
const validatedDatabase = databaseResult.data
```

Use `validatedDatabase` for the returned `database` and summary counts. Extend `LocalDatabaseError` with an optional fourth `details` argument without changing the existing `cause` argument:

```js
constructor(message, code, cause, details) {
  super(message)
  this.name = "LocalDatabaseError"
  this.code = code
  if (cause) this.cause = cause
  if (details) this.details = details
}
```

Update the existing read-only summary fixture so its known work types satisfy the now-shared contract: the article fixture must include `nodes: []`, and the phone fixture must include `phoneData: {}`. Keep the legacy unknown-type fixture unchanged so the summary still proves `otherCount` compatibility.

- [ ] **Step 4: Verify focused and full GREEN**

```powershell
node --test tests/storage.test.mjs tests/work-schema.test.mjs
npm test
npm run build:verify
git diff --check
```

Expected: all old shallow-boundary tests and all new deep-boundary tests pass.

- [ ] **Step 5: Commit the database boundary**

```powershell
git add js/storage.js tests/storage.test.mjs
git commit -m "feat(storage): reject malformed nested work data"
```

After the commit, rerun complete verification and confirm a clean worktree.

---

### Task 4: Prove editor JSON and PNG payloads converge on one reader contract

**Files:**
- Create: `js/work-import.js`
- Create: `tests/work-transport-parity.test.mjs`
- Modify: `reader/reader.js:1-3,429-435`

**Interfaces:**
- Consumes: `exportWorkAsJSON()`, `writeSteganoPayload()`, `readSteganoPayload()`, `validateWorkForImport()`, and `sanitizeImportedWork()`.
- Produces: `prepareImportedWork(input, windowObject)` and two golden fixtures proving JSON and stegano transport yield equivalent reader-safe works.

- [ ] **Step 1: Write the transport parity test**

Create `tests/work-transport-parity.test.mjs`:

```js
import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import { exportWorkAsJSON } from "../js/data.js"
import { readSteganoPayload, writeSteganoPayload } from "../js/stegano.js"
import { prepareImportedWork } from "../js/work-import.js"

function rgbaPixelsFor(byteLength) {
  return new Uint8ClampedArray(Math.ceil((byteLength + 4) / 3) * 4)
}

function throughReaderContract(serialized, windowObject) {
  const result = prepareImportedWork(JSON.parse(serialized), windowObject)
  assert.equal(result.ok, true)
  return result.work
}

function throughStegano(serialized, windowObject) {
  const payload = new TextEncoder().encode(serialized)
  const pixels = rgbaPixelsFor(payload.length)
  writeSteganoPayload(pixels, payload)
  const decoded = new TextDecoder().decode(readSteganoPayload(pixels))
  return throughReaderContract(decoded, windowObject)
}

test("current article and phone exports have identical JSON and PNG reader semantics", t => {
  const originalStorage = globalThis.localStorage
  const windowObject = new JSDOM("<!doctype html><html><body></body></html>").window
  const fixtures = [
    {
      id: "article-golden",
      schemaVersion: 1,
      type: "article",
      title: "Article",
      nodes: [{ id: "start", content: '<b>safe</b><img src="javascript:bad">', choices: [] }],
      chapters: [],
      scenes: [],
      placeholders: [],
      phoneModules: [{ id: "module", type: "memo", data: { memos: [] } }],
      editorSettings: { fontSize: 18 },
      futureField: { preserved: true },
    },
    {
      id: "phone-golden",
      schemaVersion: 1,
      type: "phone",
      title: "Phone",
      placeholders: [],
      scenes: [],
      phoneData: {
        contacts: [{ id: "contact", name: "A" }],
        chats: [], moments: [], forumPosts: [], forumNpcs: [],
        apps: [
          { id: "settings", type: "settings" },
          { id: "messages", type: "messages", icon: "<svg></svg>" },
        ],
        memos: [], photos: [], albums: [], browserHistory: [], shoppingItems: [],
        futurePhoneField: { preserved: true },
      },
      editorSettings: { fontSize: 12 },
    },
  ]
  globalThis.localStorage = {
    getItem() { return JSON.stringify({ works: fixtures, contacts: [], groups: [] }) },
    setItem() { throw new Error("export must not write") },
  }
  t.after(() => { globalThis.localStorage = originalStorage })

  for (const fixture of fixtures) {
    const serialized = exportWorkAsJSON(fixture.id)
    const jsonWork = throughReaderContract(serialized, windowObject)
    const pngWork = throughStegano(serialized, windowObject)

    assert.deepEqual(pngWork, jsonWork)
    assert.equal(jsonWork.editorSettings, undefined)
    if (fixture.type === "article") assert.deepEqual(jsonWork.futureField, { preserved: true })
    if (fixture.type === "phone") {
      assert.equal(jsonWork.phoneData.apps.some(app => app.type === "settings"), false)
      assert.deepEqual(jsonWork.phoneData.futurePhoneField, { preserved: true })
    }
  }
})
```

- [ ] **Step 2: Run the focused test and verify its initial state**

```powershell
node --test tests/work-transport-parity.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/work-import.js`.

- [ ] **Step 3: Add the single validate-then-sanitize boundary**

Create `js/work-import.js`:

```js
import { sanitizeImportedWork } from "./sanitize.js"
import { validateWorkForImport } from "./work-schema.js"

export function prepareImportedWork(input, windowObject = window) {
  const result = validateWorkForImport(input)
  if (!result.ok) return result
  return {
    ...result,
    work: sanitizeImportedWork(result.work, windowObject),
  }
}
```

In `reader/reader.js`, replace the direct `validateWorkForImport` and `sanitizeImportedWork` imports with `prepareImportedWork`; keep `escapeHtmlAttribute` imported from `sanitize.js`. Replace `importWork()` with:

```js
function importWork(work) {
  var result = prepareImportedWork(work)
  if (!result.ok) {
    alert(result.message)
    return
  }
  loadWork(result.work)
}
```

Both JSON and PNG already call `importWork()`, so this preserves their common activation path while making it independently testable.

- [ ] **Step 4: Verify focused GREEN and the existing reader resilience tests**

```powershell
node --test tests/work-transport-parity.test.mjs tests/reader-import-resilience.test.mjs tests/sanitize.test.mjs
```

Expected: all focused tests pass.

- [ ] **Step 5: Run full verification and commit the golden contract**

```powershell
npm test
npm run build:verify
git diff --check
git add js/work-import.js reader/reader.js tests/work-transport-parity.test.mjs
git commit -m "refactor(reader): unify imported work preparation"
```

After the commit, rerun complete verification and confirm a clean worktree.

---

### Task 5: Add the prepared single-replacement restore transaction

**Files:**
- Modify: `tests/storage.test.mjs`
- Modify: `js/storage.js`

**Interfaces:**
- Consumes: a parsed backup from `parseLocalDatabaseBackup()` or `readLocalDatabaseBackupFile()`.
- Produces: immutable `prepareLocalDatabaseRestore(parsedBackup, storage, now)` plans and `restoreLocalDatabaseBackup(plan, storage)` results.

- [ ] **Step 1: Extend the fake storage for sequenced reads**

Change the test helper so `options.getValues` can control successive reads while preserving all existing behavior:

```js
getItem() {
  calls.get += 1
  if (options.getErrorAt === calls.get) throw options.getError || new Error("read failed")
  if (options.getValues && calls.get <= options.getValues.length) {
    return options.getValues[calls.get - 1]
  }
  if (options.getError) throw options.getError
  return value
},
```

- [ ] **Step 2: Add failing preparation and commit tests**

Import `prepareLocalDatabaseRestore` and `restoreLocalDatabaseBackup`, then append:

```js
function parsedBackup(database) {
  return parseLocalDatabaseBackup(JSON.stringify({
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-11T00:00:00.000Z",
    database,
  }))
}

test("restore preparation is read-only and creates a valid-library recovery artifact", () => {
  const currentRaw = JSON.stringify({ works: [{ id: "old" }], contacts: [], groups: [] })
  const storage = createStorage(currentRaw)
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [], future: true }),
    storage,
    new Date("2026-07-11T01:00:00.000Z"),
  )

  assert.equal(Object.isFrozen(plan), true)
  assert.equal(plan.expectedCurrentRaw, currentRaw)
  assert.equal(plan.previousState, "valid")
  assert.equal(plan.currentSummary.workCount, 1)
  assert.equal(plan.recoveryArtifact.kind, "library-backup")
  assert.match(plan.recoveryArtifact.filename, /^tuuru-library-before-restore-/)
  assert.deepEqual(JSON.parse(plan.candidateRaw).future, true)
  assert.equal(storage.calls.set, 0)
  assert.equal(storage.calls.remove, 0)
})

test("restore preparation preserves corrupt raw data as the recovery artifact", () => {
  const storage = createStorage('{"works":[')
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [], contacts: [], groups: [] }),
    storage,
    new Date("2026-07-11T01:00:00.000Z"),
  )

  assert.equal(plan.previousState, "corrupt")
  assert.equal(plan.recoveryArtifact.kind, "corrupt-raw")
  assert.equal(plan.recoveryArtifact.contents, '{"works":[')
  assert.equal(storage.calls.set, 0)
})

test("a successful restore performs one replacement and exact readback", () => {
  const oldRaw = JSON.stringify({ works: [{ id: "old" }], contacts: [], groups: [] })
  const storage = createStorage(oldRaw)
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [], future: true }),
    storage,
  )

  const result = restoreLocalDatabaseBackup(plan, storage)

  assert.equal(result.code, "restored")
  assert.equal(result.previousState, "valid")
  assert.equal(storage.calls.set, 1)
  assert.equal(storage.calls.remove, 0)
  assert.equal(storage.value, plan.candidateRaw)
})

test("restore from corrupt storage bypasses only the ordinary-write guard", () => {
  const storage = createStorage("not-json")
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [], contacts: [], groups: [] }),
    storage,
  )

  assert.throws(() => writeLocalDatabase({ works: [] }, createStorage("not-json")), LocalDatabaseError)
  assert.equal(restoreLocalDatabaseBackup(plan, storage).code, "restored")
})

test("a stale restore plan performs no write", () => {
  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const changedRaw = JSON.stringify({ works: [{ id: "other-tab" }], contacts: [], groups: [] })
  const storage = createStorage(oldRaw, { getValues: [oldRaw, changedRaw] })
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "backup" }], contacts: [], groups: [] }),
    storage,
  )

  assert.throws(
    () => restoreLocalDatabaseBackup(plan, storage),
    error => error.code === "restore-conflict" && error.details.commitState === "unchanged",
  )
  assert.equal(storage.calls.set, 0)
})

test("quota failure preserves the exact old raw value", () => {
  const oldRaw = JSON.stringify({ works: [{ id: "old" }], contacts: [], groups: [] })
  const storage = createStorage(oldRaw, { setError: new Error("quota") })
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [] }),
    storage,
  )

  assert.throws(
    () => restoreLocalDatabaseBackup(plan, storage),
    error => error.code === "restore-write-failed" && error.details.commitState === "unchanged",
  )
  assert.equal(storage.value, oldRaw)
  assert.equal(storage.calls.set, 1)
  assert.equal(storage.calls.remove, 0)
})

test("uncertain readback never reports success or rolls back", () => {
  const oldRaw = JSON.stringify({ works: [], contacts: [], groups: [] })
  const mismatchedRaw = JSON.stringify({ works: [{ id: "other" }], contacts: [], groups: [] })
  const storage = createStorage(oldRaw, { getValues: [oldRaw, oldRaw, mismatchedRaw] })
  const plan = prepareLocalDatabaseRestore(
    parsedBackup({ works: [{ id: "new" }], contacts: [], groups: [] }),
    storage,
  )

  assert.throws(
    () => restoreLocalDatabaseBackup(plan, storage),
    error => error.code === "restore-verification-failed" && error.details.commitState === "unknown",
  )
  assert.equal(storage.calls.set, 1)
  assert.equal(storage.calls.remove, 0)
})
```

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
node --test tests/storage.test.mjs
```

Expected: FAIL because restore preparation and commit exports do not exist.

- [ ] **Step 4: Implement the two-phase transaction**

Add private backup serialization and stable restore errors to `js/storage.js`:

```js
function serializeBackupDatabase(database, exportedAt) {
  return JSON.stringify({
    format: LOCAL_DATABASE_BACKUP_FORMAT,
    backupVersion: LOCAL_DATABASE_BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    database,
  }, null, 2)
}

function summarizeDatabase(database) {
  const articleCount = database.works.filter(work => isRecord(work) && work.type === "article").length
  const phoneCount = database.works.filter(work => isRecord(work) && work.type === "phone").length
  return {
    workCount: database.works.length,
    articleCount,
    phoneCount,
    otherCount: database.works.length - articleCount - phoneCount,
    contactCount: database.contacts.length,
    groupCount: database.groups.length,
  }
}

function restoreError(message, code, phase, commitState, cause) {
  return new LocalDatabaseError(message, code, cause, { phase, commitState })
}

function readExactRaw(storage) {
  try {
    return storage.getItem(DATABASE_KEY)
  } catch (error) {
    throw restoreError("浏览器无法读取当前本地创作库。", "restore-readback-failed", "prepare", "unchanged", error)
  }
}

function freezeRestorePlan(plan) {
  if (plan.summary) Object.freeze(plan.summary)
  if (plan.currentSummary) Object.freeze(plan.currentSummary)
  if (plan.recoveryArtifact) Object.freeze(plan.recoveryArtifact)
  return Object.freeze(plan)
}
```

Refactor `serializeLocalDatabaseBackup()` to call `serializeBackupDatabase(readLocalDatabase(storage), exportedAt)` inside its existing error boundary.
Refactor `parseLocalDatabaseBackup()` to return `summary: summarizeDatabase(validatedDatabase)` so preview and restore plans use one count contract.

Add the preparation function:

```js
export function prepareLocalDatabaseRestore(parsedBackup, storage = localStorage, now = new Date()) {
  if (!isRecord(parsedBackup) || !isRecord(parsedBackup.database)) {
    throw restoreError("恢复计划缺少有效备份。", "restore-serialize-failed", "prepare", "unchanged")
  }

  let candidateRaw
  try {
    candidateRaw = JSON.stringify(parsedBackup.database)
  } catch (error) {
    throw restoreError("无法序列化待恢复的创作库。", "restore-serialize-failed", "prepare", "unchanged", error)
  }
  const candidateStatus = inspectLocalDatabaseRaw(candidateRaw)
  if (!candidateStatus.ok) {
    throw restoreError("待恢复的创作库未通过完整校验。", "restore-serialize-failed", "prepare", "unchanged")
  }

  const expectedCurrentRaw = readExactRaw(storage)
  const currentStatus = inspectLocalDatabaseRaw(expectedCurrentRaw)
  const previousState = expectedCurrentRaw === null ? "missing" : currentStatus.ok ? "valid" : "corrupt"
  const stamp = now.toISOString().replace(/[:.]/g, "-")
  let recoveryArtifact = null
  if (previousState === "valid") {
    recoveryArtifact = {
      kind: "library-backup",
      filename: `tuuru-library-before-restore-${stamp}.json`,
      mimeType: "application/json;charset=utf-8",
      contents: serializeBackupDatabase(currentStatus.data, now),
    }
  } else if (previousState === "corrupt") {
    recoveryArtifact = {
      kind: "corrupt-raw",
      filename: `tuuru-corrupt-before-restore-${stamp}.txt`,
      mimeType: "text/plain;charset=utf-8",
      contents: expectedCurrentRaw,
    }
  }

  return freezeRestorePlan({
    candidateRaw,
    expectedCurrentRaw,
    summary: { ...parsedBackup.summary },
    currentSummary: currentStatus.ok ? summarizeDatabase(currentStatus.data) : null,
    previousState,
    recoveryArtifact,
  })
}
```

Add the commit function:

```js
export function restoreLocalDatabaseBackup(plan, storage = localStorage) {
  const currentRaw = readExactRaw(storage)
  if (currentRaw !== plan.expectedCurrentRaw) {
    throw restoreError("当前创作库已发生变化，请重新检查备份。", "restore-conflict", "replace", "unchanged")
  }

  try {
    storage.setItem(DATABASE_KEY, plan.candidateRaw)
  } catch (error) {
    throw restoreError("恢复写入失败，原创作库保持不变。", "restore-write-failed", "replace", "unchanged", error)
  }

  let readback
  try {
    readback = storage.getItem(DATABASE_KEY)
  } catch (error) {
    throw restoreError("恢复后无法确认本地数据状态，请重新加载检查。", "restore-readback-failed", "verify", "unknown", error)
  }
  const verified = readback === plan.candidateRaw && inspectLocalDatabaseRaw(readback).ok
  if (!verified) {
    throw restoreError("恢复结果无法确认，请重新加载检查。", "restore-verification-failed", "verify", "unknown")
  }

  return {
    ok: true,
    code: "restored",
    summary: plan.summary,
    previousState: plan.previousState,
    restoredBytes: new TextEncoder().encode(plan.candidateRaw).length,
  }
}
```

Do not add rollback writes, temporary storage keys, or `removeItem()` calls.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
node --test tests/storage.test.mjs
npm test
npm run build:verify
git diff --check
git add js/storage.js tests/storage.test.mjs
git commit -m "feat(storage): add safe library restore transaction"
```

After the commit, rerun complete verification and confirm a clean worktree.

---

### Task 6: Add the shared restore picker and homepage flow

**Files:**
- Create: `js/library-restore-ui.js`
- Create: `tests/library-restore-ui.test.mjs`
- Modify: `js/pages/home.js:1-161`

**Interfaces:**
- Consumes: Task 5 storage APIs, existing `downloadBlob()`, and injected `modal`, notification, and reload functions.
- Produces: `startLocalLibraryRestore(options)` used by normal and corrupt startup flows.

- [ ] **Step 1: Write failing UI state-machine tests**

Create `tests/library-restore-ui.test.mjs` with JSDOM and dependency injection. The test must cover these exact observable contracts:

```js
import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

import { startLocalLibraryRestore } from "../js/library-restore-ui.js"

function environment() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://tuuru.local/" })
  const events = []
  return {
    dom,
    events,
    modal(title, body, footer, onClose) {
      const overlay = dom.window.document.createElement("div")
      overlay.innerHTML = `<section><h2>${title}</h2><div class="modal-body">${body}</div><div class="modal-footer">${footer}</div></section>`
      overlay.closeModal = onClose
      dom.window.document.body.append(overlay)
      return overlay
    },
    download(blob, filename) { events.push(["download", filename, blob.type]) },
    notify(message, type) { events.push(["notify", message, type]) },
    reload() { events.push(["reload"]) },
  }
}

test("restore remains gated by recovery download and exact confirmation", async () => {
  const env = environment()
  const storage = {
    value: JSON.stringify({ works: [{ id: "old" }], contacts: [], groups: [] }),
    getItem() { return this.value },
    setItem(_key, value) { this.value = value },
  }
  const raw = JSON.stringify({
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-11T00:00:00.000Z",
    database: { works: [{ id: "new" }], contacts: [], groups: [] },
  })
  const file = { name: "backup.json", size: raw.length, async text() { return raw } }

  const controller = startLocalLibraryRestore({
    storage,
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify: env.notify,
    reload: env.reload,
    now: () => new Date("2026-07-11T01:00:00.000Z"),
  })
  await controller.handleFile(file)

  const restore = env.dom.window.document.querySelector("#libraryRestoreCommit")
  const phrase = env.dom.window.document.querySelector("#libraryRestorePhrase")
  assert.match(env.dom.window.document.body.textContent, /当前 1 个作品 \/ 备份 1 个作品/)
  assert.equal(restore.disabled, true)
  phrase.value = "RESTORE"
  phrase.dispatchEvent(new env.dom.window.Event("input"))
  assert.equal(restore.disabled, true)

  env.dom.window.document.querySelector("#libraryRestoreRecovery").click()
  assert.equal(restore.disabled, false)
  restore.click()
  restore.click()

  assert.equal(env.events.filter(event => event[0] === "download").length, 1)
  assert.equal(env.events.filter(event => event[0] === "reload").length, 1)
  assert.equal(JSON.parse(storage.value).works[0].id, "new")
})

test("invalid files never open the destructive confirmation", async () => {
  const env = environment()
  const controller = startLocalLibraryRestore({
    storage: { getItem: () => null, setItem() {} },
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify: env.notify,
    reload: env.reload,
  })

  await controller.handleFile({ name: "bad.json", size: 5, async text() { return "bad" } })

  assert.equal(env.dom.window.document.querySelector("#libraryRestoreCommit"), null)
  assert.equal(env.events.some(event => event[0] === "notify"), true)
})

test("a storage event invalidates an open restore plan", async () => {
  const env = environment()
  const raw = JSON.stringify({
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-11T00:00:00.000Z",
    database: { works: [], contacts: [], groups: [] },
  })
  const controller = startLocalLibraryRestore({
    storage: { getItem: () => null, setItem() {} },
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify: env.notify,
    reload: env.reload,
  })
  await controller.handleFile({ name: "backup.json", size: raw.length, async text() { return raw } })
  env.dom.window.dispatchEvent(new env.dom.window.StorageEvent("storage", { key: "tuuru_works" }))

  assert.equal(env.dom.window.document.querySelector("#libraryRestoreCommit").disabled, true)
  assert.match(env.dom.window.document.querySelector("#libraryRestoreStatus").textContent, /重新检查/)
})

test("an uncertain readback disables retry and never reloads", async () => {
  const env = environment()
  const raw = JSON.stringify({
    format: "tuuru-local-library-backup",
    backupVersion: 1,
    exportedAt: "2026-07-11T00:00:00.000Z",
    database: { works: [], contacts: [], groups: [] },
  })
  const mismatch = JSON.stringify({ works: [{ id: "other-tab" }], contacts: [], groups: [] })
  let reads = 0
  const controller = startLocalLibraryRestore({
    storage: {
      getItem() { reads += 1; return reads < 3 ? null : mismatch },
      setItem() {},
    },
    documentObject: env.dom.window.document,
    windowObject: env.dom.window,
    modal: env.modal,
    download: env.download,
    notify: env.notify,
    reload: env.reload,
  })
  await controller.handleFile({ name: "backup.json", size: raw.length, async text() { return raw } })
  const phrase = env.dom.window.document.querySelector("#libraryRestorePhrase")
  const commit = env.dom.window.document.querySelector("#libraryRestoreCommit")
  phrase.value = "RESTORE"
  phrase.dispatchEvent(new env.dom.window.Event("input"))
  commit.click()

  assert.equal(commit.disabled, true)
  assert.equal(env.events.some(event => event[0] === "reload"), false)
  assert.match(env.dom.window.document.querySelector("#libraryRestoreStatus").textContent, /不能再次提交/)
})
```

- [ ] **Step 2: Run UI tests and verify RED**

```powershell
node --test tests/library-restore-ui.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/library-restore-ui.js`.

- [ ] **Step 3: Implement the dependency-injected restore controller**

Create `js/library-restore-ui.js` with these exports and state transitions:

```js
import { downloadBlob } from "./download.js"
import {
  LOCAL_DATABASE_KEY,
  prepareLocalDatabaseRestore,
  readLocalDatabaseBackupFile,
  restoreLocalDatabaseBackup,
} from "./storage.js"

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function startLocalLibraryRestore({
  storage = localStorage,
  documentObject = document,
  windowObject = window,
  modal,
  download = downloadBlob,
  notify = message => windowObject.alert(message),
  reload = () => windowObject.location.reload(),
  now = () => new Date(),
} = {}) {
  let activeOverlay = null
  let invalidated = false
  let committing = false

  function cleanup() {
    windowObject.removeEventListener("storage", onStorage)
    if (activeOverlay?.isConnected) activeOverlay.remove()
    activeOverlay = null
  }

  function onStorage(event) {
    if (event.key !== LOCAL_DATABASE_KEY || !activeOverlay) return
    invalidated = true
    const button = activeOverlay.querySelector("#libraryRestoreCommit")
    const status = activeOverlay.querySelector("#libraryRestoreStatus")
    if (button) button.disabled = true
    if (status) status.textContent = "当前创作库已变化，请关闭窗口后重新检查备份。"
  }

  async function handleFile(file) {
    let backup
    let plan
    try {
      backup = await readLocalDatabaseBackupFile(file)
      plan = prepareLocalDatabaseRestore(backup, storage, now())
    } catch (error) {
      notify(`备份检查失败：${error instanceof Error ? error.message : "无法读取文件"}`, "error")
      return null
    }

    invalidated = false
    committing = false
    const recoveryRequired = Boolean(plan.recoveryArtifact)
    let recoveryStarted = !recoveryRequired
    const currentDescription = plan.currentSummary
      ? `当前 ${plan.currentSummary.workCount} 个作品 / 备份 ${backup.summary.workCount} 个作品`
      : plan.previousState === "corrupt"
        ? `当前数据已损坏 / 备份 ${backup.summary.workCount} 个作品`
        : `当前没有作品库 / 备份 ${backup.summary.workCount} 个作品`
    const body = `
      <div class="library-restore-summary">
        <p><strong>恢复将替换整个当前创作库。</strong></p>
        <p>文件：${escapeHtml(file.name)}</p>
        <p>备份时间：${escapeHtml(new Date(backup.exportedAt).toLocaleString())}</p>
        <p>${escapeHtml(currentDescription)}</p>
        <p>作品：${backup.summary.workCount}；联系人：${backup.summary.contactCount}；分组：${backup.summary.groupCount}</p>
        <label for="libraryRestorePhrase">输入 RESTORE 确认整库替换</label>
        <input id="libraryRestorePhrase" class="form-input" autocomplete="off">
        <p id="libraryRestoreStatus" class="text-muted">${recoveryRequired ? "请先发起下载当前数据的恢复副本。" : "当前没有已有创作库。"}</p>
      </div>`
    const footer = `
      ${recoveryRequired ? '<button type="button" class="btn btn-outline" id="libraryRestoreRecovery">下载当前数据</button>' : ""}
      <button type="button" class="btn btn-danger" id="libraryRestoreCommit" disabled>恢复并替换</button>
      <button type="button" class="btn btn-ghost" id="libraryRestoreCancel">取消</button>`
    activeOverlay = modal("检查 / 恢复备份", body, footer, cleanup)
    windowObject.addEventListener("storage", onStorage)

    const phrase = activeOverlay.querySelector("#libraryRestorePhrase")
    const commit = activeOverlay.querySelector("#libraryRestoreCommit")
    const status = activeOverlay.querySelector("#libraryRestoreStatus")
    function updateGate() {
      commit.disabled = invalidated || committing || !recoveryStarted || phrase.value !== "RESTORE"
    }
    phrase.addEventListener("input", updateGate)
    activeOverlay.querySelector("#libraryRestoreCancel").addEventListener("click", cleanup)

    const recovery = activeOverlay.querySelector("#libraryRestoreRecovery")
    if (recovery) recovery.addEventListener("click", () => {
      const artifact = plan.recoveryArtifact
      download(new Blob([artifact.contents], { type: artifact.mimeType }), artifact.filename)
      recoveryStarted = true
      status.textContent = "恢复副本下载已发起；请确认文件后输入 RESTORE。"
      updateGate()
    })

    commit.addEventListener("click", () => {
      if (commit.disabled || committing) return
      committing = true
      updateGate()
      try {
        restoreLocalDatabaseBackup(plan, storage)
        status.textContent = "恢复成功，正在重新加载。"
        notify("完整创作库已恢复", "success")
        reload()
      } catch (error) {
        committing = false
        const unchanged = error?.details?.commitState === "unchanged"
        const retryBlocked = error?.code === "restore-conflict" || !unchanged
        if (retryBlocked) invalidated = true
        status.textContent = error?.code === "restore-conflict"
          ? "当前创作库已变化，请关闭窗口后重新检查备份。"
          : unchanged
            ? "恢复未发生，原数据保持不变。"
          : "恢复结果无法确认，请重新加载检查；当前窗口不能再次提交。"
        notify(error instanceof Error ? error.message : "恢复失败", "error")
        updateGate()
      }
    })
    return { backup, plan, overlay: activeOverlay }
  }

  function pickFile(trigger) {
    const input = documentObject.createElement("input")
    input.type = "file"
    input.accept = ".json,application/json"
    input.addEventListener("change", async () => {
      const file = input.files?.[0]
      if (!file) return
      if (trigger) trigger.disabled = true
      try { await handleFile(file) } finally { if (trigger) trigger.disabled = false }
    }, { once: true })
    input.click()
  }

  return { handleFile, pickFile, dispose: cleanup }
}
```

- [ ] **Step 4: Wire the homepage to the shared flow**

In `js/pages/home.js`:

- import `startLocalLibraryRestore`;
- change the button label to `检查 / 恢复备份` and call `restoreLibraryBackup()`;
- remove the old local-only `showBackupPreview()` and `inspectLibraryBackup()` flow after the new handler replaces it;
- create one controller lazily and pass existing `modal`, `showToast`, `localStorage`, and reload dependencies;
- change backup success copy from `备份已下载` to `备份下载已发起`.

Use this handler:

```js
let libraryRestoreController
window.restoreLibraryBackup = function() {
  if (!libraryRestoreController) {
    libraryRestoreController = startLocalLibraryRestore({
      modal,
      notify: showToast,
      reload: () => location.reload(),
    })
  }
  libraryRestoreController.pickFile(document.getElementById("backupInspectBtn"))
}
```

- [ ] **Step 5: Verify UI and repository GREEN, then commit**

```powershell
node --test tests/library-restore-ui.test.mjs tests/storage.test.mjs
npm test
npm run build:verify
git diff --check
git add js/library-restore-ui.js js/pages/home.js tests/library-restore-ui.test.mjs
git commit -m "feat(backup): add guarded library restore flow"
```

After the commit, rerun complete verification and confirm a clean worktree.

---

### Task 7: Offer valid backup restore on the corrupt-storage startup screen

**Files:**
- Create: `tests/storage-recovery-ui.test.mjs`
- Modify: `js/app.js:1-3,191-259`

**Interfaces:**
- Consumes: `startLocalLibraryRestore()` from Task 6.
- Produces: one “从完整备份恢复” action before destructive reset when raw corrupt data is available.

- [ ] **Step 1: Write the failing corrupt-startup UI test**

Create `tests/storage-recovery-ui.test.mjs`:

```js
import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

test("corrupt storage offers backup restore before destructive reset", async t => {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: "https://tuuru.local/",
  })
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalLocation = globalThis.location
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.location = dom.window.location
  t.after(() => {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
    globalThis.location = originalLocation
  })

  const { renderStorageRecovery } = await import(`../js/app.js?storage-recovery=${Date.now()}`)
  let restoreCalls = 0
  const container = document.getElementById("app")
  renderStorageRecovery(container, {
    ok: false,
    code: "invalid-json",
    raw: "bad",
    message: "invalid",
  }, {
    startRestore() {
      return { pickFile() { restoreCalls += 1 } }
    },
  })

  const labels = Array.from(container.querySelectorAll("button"), button => button.textContent)
  assert.ok(labels.indexOf("从完整备份恢复") > labels.indexOf("下载原始数据"))
  assert.ok(labels.indexOf("从完整备份恢复") < labels.indexOf("重置本地数据库"))
  Array.from(container.querySelectorAll("button"))
    .find(button => button.textContent === "从完整备份恢复")
    .click()
  assert.equal(restoreCalls, 1)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
node --test tests/storage-recovery-ui.test.mjs
```

Expected: FAIL because `renderStorageRecovery` is not exported and no backup-restore action exists.

- [ ] **Step 3: Inject and wire the shared restore controller**

In `js/app.js`, import `startLocalLibraryRestore`, export the renderer, and add an optional dependency object:

```js
export function renderStorageRecovery(container, status, {
  startRestore = startLocalLibraryRestore,
} = {}) {
```

After the raw download button and before the reload/reset buttons, add:

```js
if (status.raw !== null && (status.code === "invalid-json" || status.code === "invalid-structure")) {
  actions.append(h("button", {
    className: "btn btn-outline",
    onClick: event => {
      const controller = startRestore({
        modal,
        notify: showToast,
        reload: () => location.reload(),
      })
      controller.pickFile(event.currentTarget)
    },
  }, "从完整备份恢复"))
}
```

Keep raw download first, restore second, reload third, and typed `RESET` destructive deletion last. Do not show restore when `status.code === "storage-unavailable"`.

- [ ] **Step 4: Verify focused and full GREEN**

```powershell
node --test tests/storage-recovery-ui.test.mjs tests/library-restore-ui.test.mjs tests/storage.test.mjs
npm test
npm run build:verify
git diff --check
```

- [ ] **Step 5: Commit the corrupt-startup integration**

```powershell
git add js/app.js tests/storage-recovery-ui.test.mjs
git commit -m "feat(recovery): restore backups from corrupt startup"
```

After the commit, rerun complete verification and confirm a clean worktree.

---

## Final branch verification

After all seven implementation tasks have passed per-task review:

```powershell
npm run verify
git diff --check
git status --short
git log --oneline --decorate -12
```

Expected:

- all Node tests pass with zero failures;
- TypeScript project checks pass;
- editor and reader verification builds pass in the isolated temporary directory;
- no tracked build artifact or Git-visible temporary file changes;
- the worktree is clean;
- every logical task is represented by one small Conventional Commit.

Then perform a whole-branch code review against commit `fab5d0a`, fix every Critical or Important finding in one atomic fix wave, rerun `npm run verify`, and use the finishing-a-development-branch workflow. Do not push, merge, squash, or delete the worktree without explicit user authorization.
