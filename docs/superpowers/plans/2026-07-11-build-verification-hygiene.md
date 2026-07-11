# Build Verification Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cross-platform verification command that type-checks and builds both Vite targets in a unique system temporary directory without changing formal build outputs or Git-visible workspace state.

**Architecture:** A focused Node ESM module will plan and run the two existing Vite configurations with only `build.outDir` overridden to safe temporary children. The orchestration layer accepts injected filesystem and build dependencies so ordering, cleanup, path safety, and combined failures can be unit-tested without running Vite; npm scripts then expose the real integration path.

**Tech Stack:** Node.js ESM, Node `fs/promises`, Vite 6 public `build()` API, TypeScript project references, Node `node:test` and `assert/strict`.

## Global Constraints

- Keep `build`, `build:editor`, `build:reader`, `preview`, and `preview:reader` behavior unchanged.
- Keep `dist-editor/`, `dist-reader/`, both Vite `base` values, reader `root`, and formal entry files unchanged.
- Do not stop tracking, refresh, delete, ignore, or commit formal build artifacts.
- Temporary builds must use `os.tmpdir()` plus `mkdtemp()` and must execute sequentially.
- Cleanup may recursively delete only the validated path returned by the current `mkdtemp()` call.
- Build and cleanup failures must both remain visible when they occur together.
- The application remains frontend-only and local-only; add no server, upload, telemetry, remote database, or network behavior.
- Begin every task with a clean worktree, make one Conventional Commit per logical task, and run full post-commit validation.

## File Structure

- Create `scripts/verify-builds.mjs`: safe temporary path planning, sequential Vite orchestration, cleanup, direct-execution entry point.
- Create `tests/build-verification.test.mjs`: unit contracts for paths, order, cleanup, failure behavior, import safety, and package scripts.
- Modify `package.json`: expose `build:verify` and `verify` without changing formal build or preview scripts.
- Do not modify `vite.config.ts`, `vite.reader.config.ts`, `.gitignore`, `dist-editor/`, or create `dist-reader/`.

---

### Task 1: Add the safe temporary Vite build runner

**Files:**
- Create: `scripts/verify-builds.mjs`
- Create: `tests/build-verification.test.mjs`

**Interfaces:**
- Consumes: Vite `build(inlineConfig)`, Node `mkdtemp(prefix)`, Node `rm(path, options)`, `os.tmpdir()`, and the existing `vite.config.ts` / `vite.reader.config.ts` files.
- Produces: `createBuildPlan({ repoRoot, tempParent, tempRoot }) -> Array<{ name, configFile, outDir }>` and `runBuildValidation(options?) -> Promise<void>`.

- [ ] **Step 1: Write the failing path and lifecycle tests**

Create `tests/build-verification.test.mjs`:

```js
import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { readFile } from "node:fs/promises"

import {
  createBuildPlan,
  runBuildValidation,
} from "../scripts/verify-builds.mjs"

function fixturePaths() {
  const repoRoot = path.resolve("build-verify-repo-fixture")
  const tempParent = path.resolve("..", "build-verify-temp-fixture")
  const tempRoot = path.join(tempParent, "tuuru-build-fixture")
  return { repoRoot, tempParent, tempRoot }
}

function dependencies(overrides = {}) {
  const paths = fixturePaths()
  return {
    ...paths,
    makeTempDir: async prefix => {
      assert.equal(prefix, path.join(paths.tempParent, "tuuru-build-"))
      return paths.tempRoot
    },
    build: async () => {},
    remove: async () => {},
    ...overrides,
  }
}

test("the build plan uses existing configs and isolated output children", () => {
  const paths = fixturePaths()
  const plan = createBuildPlan(paths)

  assert.deepEqual(plan, [
    {
      name: "editor",
      configFile: path.join(paths.repoRoot, "vite.config.ts"),
      outDir: path.join(paths.tempRoot, "editor"),
    },
    {
      name: "reader",
      configFile: path.join(paths.repoRoot, "vite.reader.config.ts"),
      outDir: path.join(paths.tempRoot, "reader"),
    },
  ])
})

test("successful validation builds sequentially and cleans once", async () => {
  const events = []
  const options = dependencies({
    build: async config => events.push(["build", config]),
    remove: async (target, removeOptions) => events.push(["remove", target, removeOptions]),
  })
  const plan = createBuildPlan(options)

  await runBuildValidation(options)

  assert.deepEqual(events, [
    ["build", { configFile: plan[0].configFile, build: { outDir: plan[0].outDir, emptyOutDir: true } }],
    ["build", { configFile: plan[1].configFile, build: { outDir: plan[1].outDir, emptyOutDir: true } }],
    ["remove", options.tempRoot, { recursive: true, force: true }],
  ])
})

test("an editor failure stops the reader and still cleans", async () => {
  const buildError = new Error("editor failed")
  let buildCalls = 0
  let removeCalls = 0
  const options = dependencies({
    build: async () => {
      buildCalls += 1
      throw buildError
    },
    remove: async () => { removeCalls += 1 },
  })

  await assert.rejects(runBuildValidation(options), error => error === buildError)
  assert.equal(buildCalls, 1)
  assert.equal(removeCalls, 1)
})

test("a reader failure still cleans after both build attempts", async () => {
  const buildError = new Error("reader failed")
  let buildCalls = 0
  let removeCalls = 0
  const options = dependencies({
    build: async () => {
      buildCalls += 1
      if (buildCalls === 2) throw buildError
    },
    remove: async () => { removeCalls += 1 },
  })

  await assert.rejects(runBuildValidation(options), error => error === buildError)
  assert.equal(buildCalls, 2)
  assert.equal(removeCalls, 1)
})

test("build and cleanup failures remain visible together", async () => {
  const buildError = new Error("build failed")
  const cleanupError = new Error("cleanup failed")
  const options = dependencies({
    build: async () => { throw buildError },
    remove: async () => { throw cleanupError },
  })

  const error = await runBuildValidation(options).catch(value => value)
  assert.ok(error instanceof AggregateError)
  assert.deepEqual(error.errors, [buildError, cleanupError])
})

test("unsafe temporary roots are rejected without recursive removal", async () => {
  const paths = fixturePaths()
  let removeCalls = 0
  const options = dependencies({
    makeTempDir: async () => paths.repoRoot,
    remove: async () => { removeCalls += 1 },
  })

  await assert.rejects(runBuildValidation(options), /outside the repository/)
  assert.equal(removeCalls, 0)
})

test("formal package scripts remain available before command wiring", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
  assert.equal(packageJson.scripts.build, "npm run build:editor && npm run build:reader")
  assert.equal(packageJson.scripts["build:editor"], "tsc -b && vite build --config vite.config.ts")
  assert.equal(packageJson.scripts["build:reader"], "vite build --config vite.reader.config.ts")
  assert.equal(packageJson.scripts.preview, "vite preview --config vite.config.ts")
  assert.equal(packageJson.scripts["preview:reader"], "vite preview --config vite.reader.config.ts")
})
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```powershell
node --test tests/build-verification.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/verify-builds.mjs`.

- [ ] **Step 3: Implement the minimal safe runner**

Create `scripts/verify-builds.mjs`:

```js
import { build as viteBuild } from "vite"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const TEMP_PREFIX = "tuuru-build-"
const DEFAULT_REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)))

function isWithin(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate))
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )
}

function assertSafeTempRoot({ repoRoot, tempParent, tempRoot }) {
  const resolvedParent = path.resolve(tempParent)
  const resolvedRoot = path.resolve(tempRoot)
  const relative = path.relative(resolvedParent, resolvedRoot)
  const isChild = Boolean(relative) && (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )

  if (!isChild || !path.basename(resolvedRoot).startsWith(TEMP_PREFIX) || isWithin(repoRoot, resolvedRoot)) {
    throw new Error("Build verification output must stay in a unique temporary directory outside the repository")
  }

  return resolvedRoot
}

export function createBuildPlan({ repoRoot, tempParent, tempRoot }) {
  const resolvedRepoRoot = path.resolve(repoRoot)
  const safeTempRoot = assertSafeTempRoot({
    repoRoot: resolvedRepoRoot,
    tempParent,
    tempRoot,
  })

  return [
    {
      name: "editor",
      configFile: path.join(resolvedRepoRoot, "vite.config.ts"),
      outDir: path.join(safeTempRoot, "editor"),
    },
    {
      name: "reader",
      configFile: path.join(resolvedRepoRoot, "vite.reader.config.ts"),
      outDir: path.join(safeTempRoot, "reader"),
    },
  ]
}

export async function runBuildValidation({
  repoRoot = DEFAULT_REPO_ROOT,
  tempParent = tmpdir(),
  makeTempDir = mkdtemp,
  build = viteBuild,
  remove = rm,
} = {}) {
  const resolvedTempParent = path.resolve(tempParent)
  const tempRoot = await makeTempDir(path.join(resolvedTempParent, TEMP_PREFIX))
  const plan = createBuildPlan({ repoRoot, tempParent: resolvedTempParent, tempRoot })
  let buildError
  let cleanupError

  try {
    for (const target of plan) {
      await build({
        configFile: target.configFile,
        build: {
          outDir: target.outDir,
          emptyOutDir: true,
        },
      })
    }
  } catch (error) {
    buildError = error
  }

  try {
    await remove(tempRoot, { recursive: true, force: true })
  } catch (error) {
    cleanupError = error
  }

  if (buildError && cleanupError) {
    throw new AggregateError(
      [buildError, cleanupError],
      "Build validation and temporary cleanup both failed",
    )
  }
  if (buildError) throw buildError
  if (cleanupError) throw cleanupError
}

const isDirectExecution = Boolean(process.argv[1]) && (
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
)

if (isDirectExecution) {
  runBuildValidation().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
```

- [ ] **Step 4: Run the focused tests to verify GREEN**

Run:

```powershell
node --test tests/build-verification.test.mjs
```

Expected: 7 tests pass; no Vite production build runs during module import.

- [ ] **Step 5: Run the real temporary builds and prove Git stability**

Run:

```powershell
$before = git status --porcelain=v2 --untracked-files=all
node scripts/verify-builds.mjs
$after = git status --porcelain=v2 --untracked-files=all
if (($before -join "`n") -ne ($after -join "`n")) { throw "Build verification changed Git-visible state" }
git diff --exit-code -- dist-editor
if (Test-Path -LiteralPath .\dist-reader) { throw "Verification created workspace dist-reader" }
```

Expected: editor and reader builds exit 0 in a `tuuru-build-*` system temporary directory; all assertions pass; `git status --short` lists only Task 1 files.

- [ ] **Step 6: Commit Task 1**

```powershell
git add -- scripts/verify-builds.mjs tests/build-verification.test.mjs
git commit -m "feat(build): add isolated build verifier"
```

- [ ] **Step 7: Run Task 1 post-commit validation**

```powershell
npm test
npx tsc -b --pretty false
node scripts/verify-builds.mjs
git diff --exit-code -- dist-editor
git status --short
```

Expected: 255 tests pass, TypeScript and both temporary Vite builds pass, tracked formal artifacts are unchanged, and the working tree is clean.

---

### Task 2: Expose clean npm verification commands

**Files:**
- Modify: `tests/build-verification.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `scripts/verify-builds.mjs` from Task 1 and existing `npm test` / `tsc -b` commands.
- Produces: `npm run build:verify` for TypeScript plus two temporary Vite builds, and `npm run verify` for the complete Node-test and build gate.

- [ ] **Step 1: Expand the existing package-script contract**

Replace the Task 1 test named `formal package scripts remain available before command wiring` in `tests/build-verification.test.mjs` with:

```js
test("package exposes clean verification without changing release commands", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))

  assert.equal(packageJson.scripts["build:verify"], "tsc -b --pretty false && node scripts/verify-builds.mjs")
  assert.equal(packageJson.scripts.verify, "npm test && npm run build:verify")
  assert.equal(packageJson.scripts.build, "npm run build:editor && npm run build:reader")
  assert.equal(packageJson.scripts["build:editor"], "tsc -b && vite build --config vite.config.ts")
  assert.equal(packageJson.scripts["build:reader"], "vite build --config vite.reader.config.ts")
  assert.equal(packageJson.scripts.preview, "vite preview --config vite.config.ts")
  assert.equal(packageJson.scripts["preview:reader"], "vite preview --config vite.reader.config.ts")
})
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```powershell
node --test tests/build-verification.test.mjs
```

Expected: the expanded test fails because `build:verify` and `verify` are undefined; the other six Task 1 tests remain green.

- [ ] **Step 3: Add only the verification scripts**

Modify the `scripts` object in `package.json` so it contains:

```json
{
  "dev": "vite --config vite.config.ts",
  "dev:reader": "vite --config vite.reader.config.ts",
  "build": "npm run build:editor && npm run build:reader",
  "build:editor": "tsc -b && vite build --config vite.config.ts",
  "build:reader": "vite build --config vite.reader.config.ts",
  "build:verify": "tsc -b --pretty false && node scripts/verify-builds.mjs",
  "verify": "npm test && npm run build:verify",
  "test": "node --test",
  "preview": "vite preview --config vite.config.ts",
  "preview:reader": "vite preview --config vite.reader.config.ts"
}
```

- [ ] **Step 4: Run the focused test to verify GREEN**

Run:

```powershell
node --test tests/build-verification.test.mjs
```

Expected: 7 tests pass.

- [ ] **Step 5: Run both npm verification entry points with a Git-state guard**

Run:

```powershell
$before = git status --porcelain=v2 --untracked-files=all
npm run build:verify
$afterBuild = git status --porcelain=v2 --untracked-files=all
if (($before -join "`n") -ne ($afterBuild -join "`n")) { throw "build:verify changed Git-visible state" }
npm run verify
$afterVerify = git status --porcelain=v2 --untracked-files=all
if (($before -join "`n") -ne ($afterVerify -join "`n")) { throw "verify changed Git-visible state" }
git diff --exit-code -- dist-editor
if (Test-Path -LiteralPath .\dist-reader) { throw "Verification created workspace dist-reader" }
```

Expected: 255 tests pass inside `npm run verify`; TypeScript and both temporary Vite builds pass twice; Git-visible state remains limited to Task 2 files.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- package.json tests/build-verification.test.mjs
git commit -m "chore(build): expose clean verification commands"
```

- [ ] **Step 7: Run final post-commit validation**

```powershell
npm run verify
git diff --check
git diff --check master...HEAD
git diff --exit-code -- dist-editor
if (Test-Path -LiteralPath .\dist-reader) { throw "Verification created workspace dist-reader" }
git status --porcelain=v2 --untracked-files=all
```

Expected: 255 tests pass; TypeScript and both temporary production builds pass; all diff checks pass; no workspace `dist-reader/` exists; the final Git-status command prints nothing.

---

## Review Follow-up Task 3: Canonicalize and Harden the Temporary Boundary

**Files:**

- Modify: `scripts/verify-builds.mjs`
- Modify: `tests/build-verification.test.mjs`

- [ ] Add focused failing tests proving an in-repository or canonically aliased temp parent is rejected before `mkdtemp()`, and that missing-prefix, nested, outside-parent, and repository-ancestor roots never reach recursive removal.
- [ ] Inject `realpath` as the production canonicalizer, canonicalize the repository and existing temp parent before creation, and reject a temp parent inside or equal to the repository.
- [ ] Canonicalize the returned root, require it to be one direct `tuuru-build-` child of the canonical parent, reject repository overlap in either direction, and use only that validated path for output and cleanup.
- [ ] Run the focused test RED then GREEN, run the Git-state-guarded full verification, commit as `fix(build): harden temporary output boundary`, and rerun post-commit verification.

## Review Follow-up Task 4: Preserve Falsy Dependency Failures

**Files:**

- Modify: `scripts/verify-builds.mjs`
- Modify: `tests/build-verification.test.mjs`

- [ ] Add focused failing cases for falsy build and cleanup rejections.
- [ ] Replace truthiness-based error detection with explicit failure-state tracking while preserving the original rejection values and combined-error ordering.
- [ ] Run focused RED/GREEN and the Git-state-guarded full verification, commit as `fix(build): preserve falsy verification failures`, and rerun post-commit verification.

## Review Follow-up Task 5: Lock Sequential Awaiting in the Test Contract

**Files:**

- Modify: `tests/build-verification.test.mjs`

- [ ] Replace the immediately resolved sequencing stub with a deferred first build, assert the reader has not started while it is pending, then release it and confirm reader-before-cleanup order.
- [ ] Run the focused test and the Git-state-guarded full verification, commit as `test(build): prove verification builds sequentially`, and rerun post-commit verification.

---

## Review Checklist

- Confirm `scripts/verify-builds.mjs` never calls `rm()` before validating the unique temp root.
- Confirm the actual Vite config files are loaded and only `build.outDir` / `emptyOutDir` are overridden.
- Confirm build calls are sequential, not parallel.
- Confirm temp-parent validation happens before directory creation and canonical returned paths cannot overlap the repository in either direction.
- Confirm falsy thrown values still produce a failed verification.
- Confirm import has no side effects.
- Confirm formal npm build/preview scripts and both Vite config files remain unchanged.
- Confirm no network, deployment, application runtime, storage schema, or formal artifact changes appear in either implementation commit.
