import test from "node:test"
import assert from "node:assert/strict"

import {
  resolvePlaceholderValue,
  substitutePlaceholders,
} from "../js/placeholders.js"

test("placeholder values use defaults and reader-provided overrides", () => {
  const placeholder = { id: "name", key: "NAME", values: ["author"], default: "unknown" }

  assert.equal(resolvePlaceholderValue({ ...placeholder, values: [] }), "unknown")
  assert.equal(resolvePlaceholderValue(placeholder), "author")
  assert.equal(resolvePlaceholderValue(placeholder, { valuesMap: { name: ["reader"] } }), "reader")
})

test("locked placeholders always select the first value", () => {
  assert.equal(resolvePlaceholderValue({ mode: "locked", values: ["first", "second"] }), "first")
})

test("scene placeholders use their scene mapping and fall back to the first value", () => {
  const placeholder = {
    mode: "scene",
    values: ["fallback", "other"],
    sceneMap: { sceneA: "mapped" },
  }

  assert.equal(resolvePlaceholderValue(placeholder, { sceneId: "sceneA" }), "mapped")
  assert.equal(resolvePlaceholderValue(placeholder, { sceneId: "missing" }), "fallback")
})

test("random selection can be deterministic in tests", () => {
  const placeholder = { values: ["first", "middle", "last"] }

  assert.equal(resolvePlaceholderValue(placeholder, { random: () => 0 }), "first")
  assert.equal(resolvePlaceholderValue(placeholder, { random: () => 0.99 }), "last")
})

test("legacy readers can deliberately ignore author selection modes", () => {
  const placeholder = { mode: "locked", values: ["first", "second"] }

  assert.equal(resolvePlaceholderValue(placeholder, {
    usePlaceholderMode: false,
    random: () => 0.99,
  }), "second")
})

test("the default reader pattern remains key-or-label", () => {
  const result = substitutePlaceholders("NAME met FRIEND", [
    { id: "name", key: "NAME", values: ["Alice"] },
    { id: "friend", label: "FRIEND", values: ["Bob"] },
  ])

  assert.equal(result, "Alice met Bob")
})

test("callers can preserve editor-specific alias patterns", () => {
  const result = substitutePlaceholders("某某 / XX / name", [
    { id: "name", key: "name", values: ["Alice"] },
  ], {
    patternsFor: placeholder => placeholder.key === "name" ? ["某某", "XX", "name"] : [placeholder.key],
  })

  assert.equal(result, "Alice / Alice / Alice")
})
