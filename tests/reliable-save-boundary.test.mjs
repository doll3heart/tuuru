import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { FEATURE_FLAGS, featureEnabled } from "../js/feature-flags.js"

const featureFlagsSource = readFileSync(
  new URL("../js/feature-flags.js", import.meta.url),
  "utf8",
)

test("featureEnabled accepts only a strict true from injected flags", () => {
  assert.equal(featureEnabled("reliableLocalWrites", { reliableLocalWrites: true }), true)

  for (const value of [false, 1, "true", null, undefined]) {
    assert.equal(featureEnabled("reliableLocalWrites", { reliableLocalWrites: value }), false)
  }
  assert.equal(featureEnabled("reliableLocalWrites", null), false)
})

test("production feature flags are immutable and contain only the closed reliable-write flag", () => {
  assert.deepEqual(FEATURE_FLAGS, { reliableLocalWrites: false })
  assert.equal(Object.isFrozen(FEATURE_FLAGS), true)
  assert.throws(() => {
    FEATURE_FLAGS.reliableLocalWrites = true
  }, TypeError)
  assert.equal(FEATURE_FLAGS.reliableLocalWrites, false)
})

test("the single reliable-write production default is literal false", () => {
  const reliableWriteDefaults = featureFlagsSource.match(
    /\breliableLocalWrites\s*:\s*(?:true|false)\b/g,
  ) ?? []

  assert.deepEqual(reliableWriteDefaults, ["reliableLocalWrites: false"])
})
