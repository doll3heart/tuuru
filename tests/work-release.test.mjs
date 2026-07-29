import test from "node:test"
import assert from "node:assert/strict"

import {
  classifyWorkRelease,
  createWorkRelease,
  normalizeWorkRelease,
  workContentFingerprint,
} from "../js/work-release.js"

function work(overrides = {}) {
  return {
    id: "work-alpha",
    type: "article",
    title: "First release",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_100_000,
    nodes: [{ id: "start", content: "Hello" }],
    ...overrides,
  }
}

function released(overrides = {}, releaseOptions = {}) {
  const candidate = work(overrides)
  candidate.release = createWorkRelease(candidate, {
    exportedAt: "2026-07-28T00:00:00.000Z",
    ...releaseOptions,
  })
  return candidate
}

test("work fingerprints are deterministic across object key order and ignore editor-only metadata", () => {
  const first = work({
    editorSettings: { pane: "outline" },
    readerPhValues: { name: ["Reader"] },
  })
  const second = {
    nodes: [{ content: "Hello", id: "start" }],
    updatedAt: first.updatedAt + 10,
    createdAt: first.createdAt,
    title: first.title,
    type: first.type,
    id: first.id,
  }

  assert.equal(workContentFingerprint(first), workContentFingerprint(second))
  assert.match(workContentFingerprint(first), /^fnv1a32:[0-9a-f]{8}$/)
})

test("release metadata binds a revision and fingerprint to the permanent work id", () => {
  const candidate = work()
  const release = createWorkRelease(candidate, {
    exportedAt: "2026-07-28T00:00:00.000Z",
  })

  assert.deepEqual(release, {
    version: 1,
    workId: candidate.id,
    revision: candidate.updatedAt,
    exportedAt: "2026-07-28T00:00:00.000Z",
    fingerprint: workContentFingerprint(candidate),
  })
  assert.deepEqual(normalizeWorkRelease(release, candidate.id), release)
})

test("invalid or mismatched release metadata is ignored", () => {
  const valid = createWorkRelease(work(), {
    exportedAt: "2026-07-28T00:00:00.000Z",
  })

  assert.equal(normalizeWorkRelease({ ...valid, workId: "another-work" }, "work-alpha"), null)
  assert.equal(normalizeWorkRelease({ ...valid, revision: 0 }, "work-alpha"), null)
  assert.equal(normalizeWorkRelease({ ...valid, exportedAt: "yesterday" }, "work-alpha"), null)
  assert.equal(normalizeWorkRelease({ ...valid, fingerprint: "not-a-fingerprint" }, "work-alpha"), null)
})

test("release comparison distinguishes newer, identical, older, conflict, and unknown imports", () => {
  const existing = released({}, { revision: 20 })
  const newer = released({ title: "Second release" }, { revision: 21 })
  const older = released({ title: "Draft zero" }, { revision: 19 })
  const same = JSON.parse(JSON.stringify(existing))
  const conflict = released({ title: "Conflicting content" }, { revision: 20 })

  assert.equal(classifyWorkRelease(newer, existing), "newer")
  assert.equal(classifyWorkRelease(same, existing), "same")
  assert.equal(classifyWorkRelease(older, existing), "older")
  assert.equal(classifyWorkRelease(conflict, existing), "conflict")
  assert.equal(classifyWorkRelease(work({ title: "Legacy export" }), existing), "unknown")
  assert.equal(classifyWorkRelease(newer, work({ title: "Legacy cache" })), "unknown")
  assert.equal(classifyWorkRelease(newer, work({ id: "another-work" })), "unrelated")
})

test("tampered content conflicts with its declared release fingerprint", () => {
  const existing = released({}, { revision: 20 })
  const tampered = JSON.parse(JSON.stringify(existing))
  tampered.nodes[0].content = "Changed without a new release"

  assert.equal(classifyWorkRelease(tampered, existing), "conflict")
})
