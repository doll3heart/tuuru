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
