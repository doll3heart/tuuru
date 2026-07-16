import assert from "node:assert/strict"
import test from "node:test"

import { prepareEmergencyLocalDatabaseBackup } from "../js/emergency-backup.js"
import {
  LOCAL_DATABASE_KEY,
  parseLocalDatabaseBackup,
} from "../js/storage.js"
import { createKeyedStorage } from "./helpers/keyed-storage.mjs"

const BACKUP_TIME = Date.UTC(2026, 6, 16, 8, 9, 10, 11)
const BACKUP_ISO = "2026-07-16T08:09:10.011Z"
const BACKUP_STAMP = "2026-07-16T08-09-10-011Z"

function work(id, title, extra = {}) {
  return { id, title, updatedAt: 10, ...extra }
}

function database({
  target = work("work-a", "baseline"),
  other = work("work-b", "other"),
  privateMarker = "private",
} = {}) {
  return {
    works: [target, other],
    contacts: [{ id: "contact-a", privateNote: privateMarker }],
    groups: [],
    futureLibraryField: privateMarker,
  }
}

function snapshot(state = "clean", otherActiveEditors = []) {
  return { state, otherActiveEditors }
}

function ordinary(candidate) {
  return {
    kind: "ordinary",
    candidateRaw: candidate === null ? null : JSON.stringify(candidate),
  }
}

function unknown(expected, candidate, later, extra = {}) {
  return {
    kind: "unknown",
    expectedCurrentRaw: expected,
    candidateRaw: candidate,
    laterCandidateRaw: later,
    ...extra,
  }
}

function prepare(options) {
  return prepareEmergencyLocalDatabaseBackup({
    workId: "work-a",
    saveSnapshot: snapshot(),
    now: BACKUP_TIME,
    recoveryWorkId: "recovery-a",
    ...options,
  })
}

function mainDatabase(result) {
  const artifact = result.artifacts[0]
  assert.equal(artifact.kind, "library-backup")
  assert.equal(artifact.restorable, true)
  assert.equal(artifact.filename, `tuuru-emergency-backup-${BACKUP_STAMP}.json`)
  assert.equal(artifact.mimeType, "application/json;charset=utf-8")
  return parseLocalDatabaseBackup(artifact.contents).database
}

test("exports the pure emergency full-library backup preparer", () => {
  assert.equal(typeof prepareEmergencyLocalDatabaseBackup, "function")
})

test("ordinary recovery merges only its target into the newest valid library", () => {
  const lastValid = database({ privateMarker: "last" })
  const current = database({
    other: work("work-b", "other-current", { futureWorkField: "keep" }),
    privateMarker: "current",
  })
  const candidate = database({
    target: work("work-a", "local-pending", { privateDraft: "keep-local" }),
    other: work("work-b", "stale-other"),
    privateMarker: "candidate-stale",
  })
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify(current)]])

  const result = prepare({
    storage,
    lastValidRaw: JSON.stringify(lastValid),
    localCandidateRaw: ordinary(candidate),
    saveSnapshot: snapshot("dirty"),
  })

  const restored = mainDatabase(result)
  assert.equal(restored.works.find(item => item.id === "work-a").title, "local-pending")
  assert.equal(restored.works.find(item => item.id === "work-a").privateDraft, "keep-local")
  assert.equal(restored.works.find(item => item.id === "work-b").title, "other-current")
  assert.equal(restored.works.find(item => item.id === "work-b").futureWorkField, "keep")
  assert.equal(restored.futureLibraryField, "current")
  assert.equal(result.warning.browserStorageStatus, "confirmed")
  assert.equal(storage.count("getItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0)
  const envelope = JSON.parse(result.artifacts[0].contents)
  assert.deepEqual(Object.keys(envelope), ["format", "backupVersion", "exportedAt", "database"])
  assert.equal(envelope.exportedAt, BACKUP_ISO)
})

test("ordinary retryable recovery falls back from invalid storage to last valid raw", () => {
  const lastValid = database({ privateMarker: "last-valid" })
  const candidate = database({
    target: work("work-a", "retryable-local"),
    privateMarker: "candidate-stale",
  })
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, "{"]])

  const result = prepare({
    storage,
    lastValidRaw: JSON.stringify(lastValid),
    localCandidateRaw: ordinary(candidate),
    saveSnapshot: snapshot("error-retryable"),
  })

  const restored = mainDatabase(result)
  assert.equal(restored.works.find(item => item.id === "work-a").title, "retryable-local")
  assert.equal(restored.futureLibraryField, "last-valid")
  assert.equal(result.warning.browserStorageStatus, "invalid")
  assert.equal(storage.count("getItem", LOCAL_DATABASE_KEY), 1)
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
})

test("ordinary recovery falls back from unreadable storage without attempting a write", () => {
  let writes = 0
  const storage = {
    getItem() {
      throw new Error("storage read denied")
    },
    setItem() {
      writes += 1
      throw new Error("must not write")
    },
  }
  const lastValid = database({ privateMarker: "fallback" })
  const candidate = database({ target: work("work-a", "offline-local") })

  const result = prepare({
    storage,
    lastValidRaw: JSON.stringify(lastValid),
    localCandidateRaw: ordinary(candidate),
    saveSnapshot: snapshot("dirty"),
  })

  assert.equal(mainDatabase(result).works[0].title, "offline-local")
  assert.equal(result.warning.browserStorageStatus, "unreadable")
  assert.equal(writes, 0)
})

test("backup preparation fails closed when no valid library baseline exists", () => {
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, "{"]])

  assert.throws(
    () => prepare({
      storage,
      lastValidRaw: "[]",
      localCandidateRaw: ordinary(database()),
    }),
    error => error?.code === "emergency-backup-unavailable",
  )
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
})

test("a safely serialized schema-invalid candidate becomes a separate raw draft", () => {
  const baseline = database()
  const invalidRaw = JSON.stringify({
    works: "invalid-collection",
    contacts: [],
    groups: [],
    privateDraftField: "keep-for-manual-recovery",
  })
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify(baseline)]])

  const result = prepare({
    storage,
    lastValidRaw: JSON.stringify(baseline),
    localCandidateRaw: { kind: "ordinary", candidateRaw: invalidRaw },
    saveSnapshot: snapshot("error-invalid"),
  })

  assert.deepEqual(result.artifacts.map(artifact => artifact.kind), [
    "library-backup",
    "raw-draft",
  ])
  assert.deepEqual(result.artifacts[1], {
    kind: "raw-draft",
    restorable: false,
    filename: `tuuru-emergency-unverified-draft-${BACKUP_STAMP}.txt`,
    mimeType: "text/plain;charset=utf-8",
    contents: invalidRaw,
  })
  assert.deepEqual(mainDatabase(result), baseline)
  assert.match(result.warning.message, /不可直接恢复/)
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
})

test("null or non-string hostile candidates never create a misleading draft", () => {
  const baseline = database()
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify(baseline)]])
  let hookCalls = 0
  const hostile = { self: null }
  hostile.self = hostile
  Object.defineProperty(hostile, "toJSON", {
    value() {
      hookCalls += 1
      return { stolen: true }
    },
  })

  for (const candidateRaw of [null, hostile, "{"]) {
    const result = prepare({
      storage,
      lastValidRaw: JSON.stringify(baseline),
      localCandidateRaw: { kind: "ordinary", candidateRaw },
      saveSnapshot: snapshot("error-invalid"),
    })

    assert.deepEqual(result.artifacts.map(artifact => artifact.kind), ["library-backup"])
    assert.deepEqual(mainDatabase(result), baseline)
    assert.match(result.warning.message, /未生成草稿/)
  }
  assert.equal(hookCalls, 0)
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
})

test("unknown current-candidate equality overlays only the later local target", () => {
  const expectedRaw = JSON.stringify(database({ privateMarker: "expected" }))
  const candidate = database({
    target: work("work-a", "uncertain"),
    other: work("work-b", "candidate-other", { keep: "current" }),
    privateMarker: "candidate-library",
  })
  const candidateRaw = JSON.stringify(candidate)
  const laterRaw = JSON.stringify({
    ...candidate,
    works: [
      work("work-a", "later-only", { laterPrivate: true }),
      work("work-b", "must-not-replace-current-other"),
    ],
    futureLibraryField: "must-not-replace-current-library",
  })
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, candidateRaw]])
  let uncertainApplyCalls = 0

  const result = prepare({
    storage,
    lastValidRaw: expectedRaw,
    localCandidateRaw: unknown(expectedRaw, candidateRaw, laterRaw, {
      apply() {
        uncertainApplyCalls += 1
        throw new Error("uncertain callback replayed")
      },
    }),
    saveSnapshot: snapshot("error-unknown"),
  })

  const restored = mainDatabase(result)
  assert.equal(restored.works.find(item => item.id === "work-a").title, "later-only")
  assert.equal(restored.works.find(item => item.id === "work-a").laterPrivate, true)
  assert.equal(restored.works.find(item => item.id === "work-b").title, "candidate-other")
  assert.equal(restored.works.find(item => item.id === "work-b").keep, "current")
  assert.equal(restored.futureLibraryField, "candidate-library")
  assert.equal(uncertainApplyCalls, 0)
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
})

test("unknown expected equality uses the final later-only candidate even when retryable", () => {
  const expected = database({ privateMarker: "expected" })
  const expectedRaw = JSON.stringify(expected)
  const candidate = database({
    target: work("work-a", "uncertain"),
    privateMarker: "candidate",
  })
  const candidateRaw = JSON.stringify(candidate)
  const later = {
    ...candidate,
    works: [work("work-a", "later-after-not-written"), candidate.works[1]],
    futureLibraryField: "later-candidate-library",
  }
  const laterRaw = JSON.stringify(later)
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, expectedRaw]])

  const result = prepare({
    storage,
    lastValidRaw: expectedRaw,
    localCandidateRaw: unknown(expectedRaw, candidateRaw, laterRaw),
    saveSnapshot: snapshot("error-retryable"),
  })

  assert.deepEqual(mainDatabase(result), later)
  assert.equal(result.warning.browserStorageStatus, "confirmed")
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
})

test("unknown third-valid state preserves current and appends the final local work", () => {
  const expected = database({ privateMarker: "expected" })
  const candidate = database({ target: work("work-a", "uncertain") })
  const later = database({
    target: work("work-a", "later-local", {
      createdAt: 1,
      privateFutureField: "keep-local",
    }),
  })
  const third = database({
    target: work("work-a", "external-current", { externalField: "keep-external" }),
    other: work("work-b", "external-other"),
    privateMarker: "external-library",
  })
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify(third)]])

  const result = prepare({
    storage,
    lastValidRaw: JSON.stringify(expected),
    localCandidateRaw: unknown(
      JSON.stringify(expected),
      JSON.stringify(candidate),
      JSON.stringify(later),
    ),
    saveSnapshot: snapshot("error-unknown"),
  })

  const restored = mainDatabase(result)
  assert.deepEqual(restored.works.map(item => item.id), ["work-a", "work-b", "recovery-a"])
  assert.equal(restored.works[0].title, "external-current")
  assert.equal(restored.works[1].title, "external-other")
  assert.equal(restored.works[2].title, "later-local（冲突恢复副本）")
  assert.equal(restored.works[2].privateFutureField, "keep-local")
  assert.equal(restored.futureLibraryField, "external-library")
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
})

test("unknown unreadable or invalid storage prefers expected raw and appends local recovery", () => {
  const expected = database({ privateMarker: "expected-fallback" })
  const expectedRaw = JSON.stringify(expected)
  const candidate = database({ target: work("work-a", "uncertain") })
  const candidateRaw = JSON.stringify(candidate)
  const laterRaw = JSON.stringify(database({ target: work("work-a", "offline-later") }))
  const fixtures = [
    {
      status: "invalid",
      storage: createKeyedStorage([[LOCAL_DATABASE_KEY, "{"]]),
    },
    {
      status: "unreadable",
      storage: {
        getItem() {
          throw new Error("offline")
        },
        setItem() {
          throw new Error("must not write")
        },
      },
    },
  ]

  for (const fixture of fixtures) {
    const result = prepare({
      storage: fixture.storage,
      lastValidRaw: "[]",
      localCandidateRaw: unknown(expectedRaw, candidateRaw, laterRaw),
      saveSnapshot: snapshot("error-unknown"),
    })

    const restored = mainDatabase(result)
    assert.deepEqual(restored.works.map(item => item.id), ["work-a", "work-b", "recovery-a"])
    assert.equal(restored.works[0].title, "baseline")
    assert.equal(restored.works[2].title, "offline-later（冲突恢复副本）")
    assert.equal(restored.futureLibraryField, "expected-fallback")
    assert.equal(result.warning.browserStorageStatus, fixture.status)
  }
})

test("unknown null later candidate keeps the valid baseline without silently dropping memory", () => {
  const expectedRaw = JSON.stringify(database({ privateMarker: "expected" }))
  const candidateRaw = JSON.stringify(database({
    target: work("work-a", "uncertain"),
    privateMarker: "uncertain",
  }))
  const current = database({
    target: work("work-a", "external-current"),
    privateMarker: "external",
  })
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify(current)]])

  const result = prepare({
    storage,
    lastValidRaw: expectedRaw,
    localCandidateRaw: unknown(expectedRaw, candidateRaw, null),
    saveSnapshot: snapshot("error-unknown"),
  })

  assert.deepEqual(mainDatabase(result), current)
  assert.deepEqual(result.artifacts.map(artifact => artifact.kind), ["library-backup"])
  assert.match(result.warning.message, /无法安全序列化/)
  assert.match(result.warning.message, /未生成草稿文件/)
})

test("ordinary target changes preserve current and append an exact recovery copy", () => {
  const lastValid = database({ privateMarker: "last" })
  const current = database({
    target: work("work-a", "external-current", { externalOnly: true }),
    other: work("work-b", "external-other"),
    privateMarker: "external-library",
  })
  const local = database({
    target: work("work-a", "local-draft", {
      createdAt: 1,
      updatedAt: 99,
      privateUnknown: { secret: "keep" },
    }),
  })
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify(current)]])

  const result = prepare({
    storage,
    lastValidRaw: JSON.stringify(lastValid),
    localCandidateRaw: ordinary(local),
    saveSnapshot: snapshot("dirty"),
  })

  const restored = mainDatabase(result)
  assert.deepEqual(restored.works.map(item => item.id), ["work-a", "work-b", "recovery-a"])
  assert.equal(restored.works[0].title, "external-current")
  assert.equal(restored.works[0].externalOnly, true)
  assert.deepEqual(restored.works[2], {
    ...local.works[0],
    id: "recovery-a",
    title: "local-draft（冲突恢复副本）",
    recoveryMetadata: {
      sourceWorkId: "work-a",
      sourceState: "dirty",
      recoveredAt: BACKUP_ISO,
    },
  })
  assert.equal(restored.futureLibraryField, "external-library")
})

test("ordinary conflict preserves equal storage and uses the unnamed recovery title", () => {
  const baseline = database()
  const local = database({
    target: work("work-a", "", { privateDraft: "keep" }),
  })
  const raw = JSON.stringify(baseline)
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, raw]])

  const result = prepare({
    storage,
    lastValidRaw: raw,
    localCandidateRaw: ordinary(local),
    saveSnapshot: snapshot("conflict"),
  })

  const restored = mainDatabase(result)
  assert.equal(restored.works[0].title, "baseline")
  assert.equal(restored.works[2].title, "未命名作品（冲突恢复副本）")
  assert.equal(restored.works[2].privateDraft, "keep")
  assert.deepEqual(restored.works[2].recoveryMetadata, {
    sourceWorkId: "work-a",
    sourceState: "conflict",
    recoveredAt: BACKUP_ISO,
  })
})

test("unknown lease loss always appends even when current equals the uncertain candidate", () => {
  const expectedRaw = JSON.stringify(database({ privateMarker: "expected" }))
  const candidate = database({
    target: work("work-a", "uncertain"),
    privateMarker: "uncertain-library",
  })
  const candidateRaw = JSON.stringify(candidate)
  const laterRaw = JSON.stringify(database({
    target: work("work-a", "later-terminal", { privateDraft: "terminal" }),
  }))
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, candidateRaw]])

  const result = prepare({
    storage,
    lastValidRaw: expectedRaw,
    localCandidateRaw: unknown(expectedRaw, candidateRaw, laterRaw),
    saveSnapshot: snapshot("lease-lost"),
  })

  const restored = mainDatabase(result)
  assert.equal(restored.works[0].title, "uncertain")
  assert.equal(restored.works[2].title, "later-terminal（冲突恢复副本）")
  assert.equal(restored.works[2].privateDraft, "terminal")
  assert.equal(restored.works[2].recoveryMetadata.sourceState, "lease-lost")
  assert.equal(restored.futureLibraryField, "uncertain-library")
})

test("recovery ID collisions fail closed with the valid main library and raw draft", () => {
  const lastValid = database()
  const current = database({
    target: work("work-a", "external-current"),
    other: work("recovery-a", "existing-recovery"),
    privateMarker: "current",
  })
  const local = database({ target: work("work-a", "local-draft") })
  const localRaw = JSON.stringify(local)
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify(current)]])

  const result = prepare({
    storage,
    lastValidRaw: JSON.stringify(lastValid),
    localCandidateRaw: { kind: "ordinary", candidateRaw: localRaw },
    saveSnapshot: snapshot("dirty"),
  })

  assert.deepEqual(mainDatabase(result), current)
  assert.deepEqual(result.artifacts.map(artifact => artifact.kind), ["library-backup", "raw-draft"])
  assert.equal(result.artifacts[1].contents, localRaw)
  assert.match(result.warning.message, /不可直接恢复/)
})

test("missing or duplicate local targets fail closed without inventing a recovery work", () => {
  const lastValid = database()
  const current = database({ target: work("work-a", "external-current") })
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify(current)]])
  const candidates = [
    { ...database(), works: [work("work-b", "only-other")] },
    {
      ...database(),
      works: [work("work-a", "first-local"), work("work-a", "second-local")],
    },
  ]

  for (const local of candidates) {
    const localRaw = JSON.stringify(local)
    const result = prepare({
      storage,
      lastValidRaw: JSON.stringify(lastValid),
      localCandidateRaw: { kind: "ordinary", candidateRaw: localRaw },
      saveSnapshot: snapshot("dirty"),
    })

    assert.deepEqual(mainDatabase(result), current)
    assert.deepEqual(result.artifacts.map(artifact => artifact.kind), ["library-backup", "raw-draft"])
    assert.equal(result.artifacts[1].contents, localRaw)
  }
})

test("append validation failures keep the baseline and expose only a non-restorable draft", () => {
  const lastValid = database()
  const current = database({ target: work("work-a", "external-current") })
  const local = database({ target: work("work-a", "local-draft") })
  const localRaw = JSON.stringify(local)
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, JSON.stringify(current)]])

  const result = prepareEmergencyLocalDatabaseBackup({
    storage,
    workId: "work-a",
    saveSnapshot: snapshot("dirty"),
    lastValidRaw: JSON.stringify(lastValid),
    localCandidateRaw: { kind: "ordinary", candidateRaw: localRaw },
    now: BACKUP_TIME,
    recoveryWorkId: "<invalid-recovery-id>",
  })

  assert.deepEqual(mainDatabase(result), current)
  assert.deepEqual(result.artifacts.map(artifact => artifact.kind), ["library-backup", "raw-draft"])
  assert.equal(result.artifacts[1].contents, localRaw)
})

test("other editors are strictly projected, sorted, frozen, and disclosed as omitted memory", () => {
  const baseline = database()
  const raw = JSON.stringify(baseline)
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, raw]])
  const editors = [
    {
      workId: "work-z",
      ownerId: "owner-b",
      expiresAt: 30,
      leaseId: "private-lease-z",
      heartbeatAt: 20,
      privateDevice: "must-not-leak",
    },
    {
      workId: "work-a",
      ownerId: "owner-c",
      expiresAt: 40,
      leaseId: "private-lease-c",
    },
    {
      workId: "work-a",
      ownerId: "owner-a",
      expiresAt: 50,
      networkAddress: "must-not-leak",
    },
  ]

  const result = prepare({
    storage,
    lastValidRaw: raw,
    localCandidateRaw: ordinary(baseline),
    saveSnapshot: snapshot("clean", editors),
  })

  assert.deepEqual(result.otherActiveEditors, [
    { workId: "work-a", ownerId: "owner-a", expiresAt: 50 },
    { workId: "work-a", ownerId: "owner-c", expiresAt: 40 },
    { workId: "work-z", ownerId: "owner-b", expiresAt: 30 },
  ])
  assert.equal(result.warning.omitsOtherEditorMemory, true)
  assert.match(result.warning.message, /未包含其他编辑器的内存中改动/)
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.artifacts), true)
  assert.equal(result.artifacts.every(Object.isFrozen), true)
  assert.equal(Object.isFrozen(result.warning), true)
  assert.equal(Object.isFrozen(result.otherActiveEditors), true)
  assert.equal(result.otherActiveEditors.every(Object.isFrozen), true)
})

test("warning copy names private full-library recovery and download-start limits", () => {
  const baseline = database()
  const raw = JSON.stringify(baseline)
  const storage = createKeyedStorage([[LOCAL_DATABASE_KEY, raw]])

  const result = prepare({
    storage,
    lastValidRaw: raw,
    localCandidateRaw: ordinary(baseline),
    saveSnapshot: snapshot("clean"),
  })

  assert.equal(result.warning.containsPrivateFullLibraryData, true)
  assert.equal(result.warning.omitsOtherEditorMemory, false)
  assert.match(result.warning.message, /完整创作库/)
  assert.match(result.warning.message, /私密编辑数据/)
  assert.match(result.warning.message, /仅用于恢复/)
  assert.match(result.warning.message, /不适合作为单篇作品分享/)
  assert.match(result.warning.message, /已发起下载/)
  assert.match(result.warning.message, /不能保证.*写入磁盘/)
  assert.doesNotMatch(result.warning.message, /未包含其他编辑器的内存中改动/)
})

test("same recovery identity re-reads storage while keeping filename and metadata stable", () => {
  const lastValid = database()
  const firstCurrent = database({
    target: work("work-a", "external-one"),
    other: work("work-b", "other-one"),
  })
  const secondCurrent = database({
    target: work("work-a", "external-two"),
    other: work("work-b", "other-two"),
  })
  const local = database({ target: work("work-a", "stable-local") })
  const storage = createKeyedStorage([], {
    getSequences: [[LOCAL_DATABASE_KEY, [
      JSON.stringify(firstCurrent),
      JSON.stringify(secondCurrent),
    ]]],
  })
  const options = {
    storage,
    lastValidRaw: JSON.stringify(lastValid),
    localCandidateRaw: ordinary(local),
    saveSnapshot: snapshot("dirty"),
  }

  const first = prepare(options)
  const second = prepare(options)

  assert.equal(first.artifacts[0].filename, second.artifacts[0].filename)
  assert.equal(first.artifacts[0].filename, `tuuru-emergency-backup-${BACKUP_STAMP}.json`)
  assert.equal(mainDatabase(first).works[1].title, "other-one")
  assert.equal(mainDatabase(second).works[1].title, "other-two")
  for (const result of [first, second]) {
    const recovery = mainDatabase(result).works.find(item => item.id === "recovery-a")
    assert.equal(recovery.recoveryMetadata.recoveredAt, BACKUP_ISO)
    assert.equal(recovery.recoveryMetadata.sourceWorkId, "work-a")
  }
  assert.equal(storage.count("getItem", LOCAL_DATABASE_KEY), 2)
  assert.equal(storage.count("setItem", LOCAL_DATABASE_KEY), 0)
  assert.equal(storage.count("removeItem", LOCAL_DATABASE_KEY), 0)
})

test("epoch time is canonical and invalid time or identity inputs are rejected", () => {
  const baseline = database()
  const raw = JSON.stringify(baseline)
  const makeOptions = overrides => ({
    storage: createKeyedStorage([[LOCAL_DATABASE_KEY, raw]]),
    workId: "work-a",
    saveSnapshot: snapshot("clean"),
    lastValidRaw: raw,
    localCandidateRaw: ordinary(baseline),
    now: 0,
    recoveryWorkId: "recovery-a",
    ...overrides,
  })

  const epoch = prepareEmergencyLocalDatabaseBackup(makeOptions())
  assert.equal(epoch.artifacts[0].filename, "tuuru-emergency-backup-1970-01-01T00-00-00-000Z.json")
  assert.equal(JSON.parse(epoch.artifacts[0].contents).exportedAt, "1970-01-01T00:00:00.000Z")

  for (const now of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN]) {
    assert.throws(
      () => prepareEmergencyLocalDatabaseBackup(makeOptions({ now })),
      TypeError,
    )
  }
  assert.throws(
    () => prepareEmergencyLocalDatabaseBackup(makeOptions({
      now: 8_640_000_000_000_001,
    })),
    RangeError,
  )
  for (const overrides of [{ workId: "" }, { recoveryWorkId: "" }]) {
    assert.throws(
      () => prepareEmergencyLocalDatabaseBackup(makeOptions(overrides)),
      TypeError,
    )
  }
})
