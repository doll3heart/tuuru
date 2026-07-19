import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { access, readFile } from "node:fs/promises"

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
    canonicalize: async target => path.resolve(target),
    makeTempDir: async prefix => {
      assert.equal(prefix, path.join(paths.tempParent, "tuuru-build-"))
      return paths.tempRoot
    },
    build: async () => {},
    remove: async () => {},
    ...overrides,
  }
}

async function captureOutcome(promise) {
  return promise.then(
    value => ({ status: "fulfilled", value }),
    reason => ({ status: "rejected", reason }),
  )
}

test("the build plan uses one unified app config and isolated output child", () => {
  const paths = fixturePaths()
  const plan = createBuildPlan(paths)

  assert.deepEqual(plan, [
    {
      name: "app",
      configFile: path.join(paths.repoRoot, "vite.config.ts"),
      outDir: path.join(paths.tempRoot, "app"),
    },
  ])
})

test("successful validation builds the unified app once and cleans once", async () => {
  const events = []
  const options = dependencies({
    build: async config => events.push(["build", config]),
    remove: async (target, removeOptions) => events.push(["remove", target, removeOptions]),
  })
  const plan = createBuildPlan(options)
  const expectedAppBuild = [
    "build",
    { configFile: plan[0].configFile, build: { outDir: plan[0].outDir, emptyOutDir: true } },
  ]
  await runBuildValidation(options)

  assert.deepEqual(events, [
    expectedAppBuild,
    ["remove", options.tempRoot, { recursive: true, force: true }],
  ])
})

test("an app build failure still cleans", async () => {
  const buildError = new Error("app failed")
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

test("a falsy build rejection is preserved and still cleans", async () => {
  let removeCalls = 0
  const options = dependencies({
    build: async () => Promise.reject(undefined),
    remove: async () => { removeCalls += 1 },
  })

  const outcome = await captureOutcome(runBuildValidation(options))

  assert.deepEqual(outcome, { status: "rejected", reason: undefined })
  assert.equal(removeCalls, 1)
})

test("a falsy cleanup rejection is preserved", async () => {
  const options = dependencies({
    remove: async () => Promise.reject(null),
  })

  const outcome = await captureOutcome(runBuildValidation(options))

  assert.deepEqual(outcome, { status: "rejected", reason: null })
})

test("falsy build and cleanup rejections remain visible together in order", async () => {
  const options = dependencies({
    build: async () => Promise.reject(undefined),
    remove: async () => Promise.reject(0),
  })

  const outcome = await captureOutcome(runBuildValidation(options))

  assert.equal(outcome.status, "rejected")
  assert.ok(outcome.reason instanceof AggregateError)
  assert.deepEqual(outcome.reason.errors, [undefined, 0])
  assert.equal(outcome.reason.message, "Build validation and temporary cleanup both failed")
})

test("an in-repository temporary parent is rejected before directory creation", async () => {
  const paths = fixturePaths()
  const tempParent = path.join(paths.repoRoot, "temporary-builds")
  let makeTempDirCalls = 0
  const options = dependencies({
    tempParent,
    makeTempDir: async () => {
      makeTempDirCalls += 1
      return path.join(tempParent, "tuuru-build-in-repo")
    },
  })

  await assert.rejects(runBuildValidation(options), /outside the repository/)
  assert.equal(makeTempDirCalls, 0)
})

test("a temporary parent canonically aliased into the repository is rejected before creation", async () => {
  const paths = fixturePaths()
  const canonicalInRepoParent = path.join(paths.repoRoot, "linked-temporary-builds")
  let makeTempDirCalls = 0
  const options = dependencies({
    canonicalize: async target => (
      path.resolve(target) === paths.tempParent
        ? canonicalInRepoParent
        : path.resolve(target)
    ),
    makeTempDir: async () => {
      makeTempDirCalls += 1
      return paths.tempRoot
    },
  })

  await assert.rejects(runBuildValidation(options), /outside the repository/)
  assert.equal(makeTempDirCalls, 0)
})

test("a temporary root without the required prefix is rejected without recursive removal", async () => {
  const paths = fixturePaths()
  let removeCalls = 0
  const options = dependencies({
    makeTempDir: async () => path.join(paths.tempParent, "unprefixed-build"),
    remove: async () => { removeCalls += 1 },
  })

  await assert.rejects(runBuildValidation(options), /unique temporary directory/)
  assert.equal(removeCalls, 0)
})

test("a nested temporary root is rejected without recursive removal", async () => {
  const paths = fixturePaths()
  let removeCalls = 0
  const options = dependencies({
    makeTempDir: async () => path.join(paths.tempParent, "nested", "tuuru-build-fixture"),
    remove: async () => { removeCalls += 1 },
  })

  await assert.rejects(runBuildValidation(options), /unique temporary directory/)
  assert.equal(removeCalls, 0)
})

test("a temporary root outside its parent is rejected without recursive removal", async () => {
  const paths = fixturePaths()
  const canonicalOutsideRoot = path.join(path.dirname(paths.tempParent), "tuuru-build-outside")
  let removeCalls = 0
  const options = dependencies({
    canonicalize: async target => (
      path.resolve(target) === paths.tempRoot
        ? canonicalOutsideRoot
        : path.resolve(target)
    ),
    remove: async () => { removeCalls += 1 },
  })

  await assert.rejects(runBuildValidation(options), /unique temporary directory/)
  assert.equal(removeCalls, 0)
})

test("a temporary root containing the repository is rejected without recursive removal", async () => {
  const tempParent = path.resolve("..", "build-verify-ancestor-parent")
  const tempRoot = path.join(tempParent, "tuuru-build-ancestor")
  const repoRoot = path.join(tempRoot, "repository")
  let removeCalls = 0
  const options = dependencies({
    repoRoot,
    tempParent,
    tempRoot,
    makeTempDir: async () => tempRoot,
    remove: async () => { removeCalls += 1 },
  })

  await assert.rejects(runBuildValidation(options), /outside the repository/)
  assert.equal(removeCalls, 0)
})

test("only the validated canonical temporary root is built and removed", async () => {
  const paths = fixturePaths()
  const returnedRoot = path.join(paths.tempParent, "tuuru-build-returned-alias")
  const canonicalRoot = path.join(paths.tempParent, "tuuru-build-canonical")
  const events = []
  const options = dependencies({
    makeTempDir: async () => returnedRoot,
    canonicalize: async target => (
      path.resolve(target) === returnedRoot
        ? canonicalRoot
        : path.resolve(target)
    ),
    build: async config => events.push(["build", config]),
    remove: async (target, removeOptions) => events.push(["remove", target, removeOptions]),
  })
  const plan = createBuildPlan({ ...paths, tempRoot: canonicalRoot })

  await runBuildValidation(options)

  assert.deepEqual(events, [
    ["build", { configFile: plan[0].configFile, build: { outDir: plan[0].outDir, emptyOutDir: true } }],
    ["remove", canonicalRoot, { recursive: true, force: true }],
  ])
})

test("package exposes one supported app development and release surface", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
  const nodeConfig = JSON.parse(await readFile(new URL("../tsconfig.node.json", import.meta.url), "utf8"))

  assert.equal(packageJson.scripts["build:verify"], "tsc -b --pretty false && node scripts/verify-builds.mjs")
  assert.equal(packageJson.scripts.verify, "npm test && npm run build:verify")
  assert.equal(packageJson.scripts.dev, "vite --config vite.config.ts")
  assert.equal(packageJson.scripts.build, "tsc -b && vite build --config vite.config.ts")
  assert.equal(packageJson.scripts.preview, "vite preview --config vite.config.ts")
  assert.equal(packageJson.scripts["dev:reader"], undefined)
  assert.equal(packageJson.scripts["build:editor"], undefined)
  assert.equal(packageJson.scripts["build:reader"], undefined)
  assert.equal(packageJson.scripts["preview:reader"], undefined)
  assert.match(packageJson.devDependencies["@types/node"], /^\^24\./)
  assert.deepEqual(nodeConfig.compilerOptions.types, ["node"])
  assert.deepEqual(nodeConfig.include, ["vite.config.ts"])
  await assert.rejects(access(new URL("../vite.reader.config.ts", import.meta.url)))
})
