import test from "node:test"
import assert from "node:assert/strict"

import { createFormDraftRegistry } from "../js/form-draft-registry.js"

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function registerDraft(registry, overrides = {}) {
  const state = {
    dirty: overrides.dirty ?? true,
    focused: 0,
  }
  const registration = {
    id: overrides.id ?? "draft-a",
    isDirty: overrides.isDirty ?? (() => state.dirty),
    validate: overrides.validate ?? (() => true),
    save: overrides.save ?? (() => { state.dirty = false }),
    discard: overrides.discard ?? (() => { state.dirty = false }),
    focus: overrides.focus ?? (() => { state.focused += 1 }),
  }
  const unregister = registry.register(registration)
  return { state, registration, unregister }
}

test("clean navigation bypasses the chooser", async () => {
  let chooseCalls = 0
  const registry = createFormDraftRegistry({
    choose() {
      chooseCalls += 1
      return "save"
    },
  })
  registerDraft(registry, { dirty: false })

  assert.equal(registry.hasDirtyDrafts(), false)
  assert.equal(await registry.confirmNavigation(), true)
  assert.equal(chooseCalls, 0)
})

test("save validates every dirty form before awaiting commits and drains in order", async () => {
  const firstCommit = deferred()
  const firstCommitStarted = deferred()
  const events = []
  const registry = createFormDraftRegistry({
    choose() {
      events.push("choose")
      return "save"
    },
  })
  let firstDirty = true
  let secondDirty = true
  registerDraft(registry, {
    id: "first",
    isDirty: () => firstDirty,
    validate: async () => { events.push("validate:first"); return true },
    save: async () => {
      events.push("commit:first")
      firstCommitStarted.resolve()
      await firstCommit.promise
      events.push("drain:first")
      firstDirty = false
    },
  })
  registerDraft(registry, {
    id: "second",
    isDirty: () => secondDirty,
    validate: () => { events.push("validate:second"); return true },
    save: async () => {
      events.push("commit:second")
      await Promise.resolve()
      events.push("drain:second")
      secondDirty = false
    },
  })

  let settled = false
  const confirmation = registry.confirmNavigation().then(result => {
    settled = true
    return result
  })
  await firstCommitStarted.promise

  assert.deepEqual(events, ["choose", "validate:first", "validate:second", "commit:first"])
  assert.equal(settled, false)

  firstCommit.resolve()
  assert.equal(await confirmation, true)
  assert.deepEqual(events, [
    "choose",
    "validate:first",
    "validate:second",
    "commit:first",
    "drain:first",
    "commit:second",
    "drain:second",
  ])
  assert.equal(registry.hasDirtyDrafts(), false)
})

test("failed validation focuses that form and starts no save", async () => {
  const events = []
  const registry = createFormDraftRegistry({ choose: () => "save" })
  registerDraft(registry, {
    id: "first",
    validate: () => { events.push("validate:first"); return true },
    save: () => events.push("save:first"),
  })
  const second = registerDraft(registry, {
    id: "second",
    validate: () => { events.push("validate:second"); return false },
    save: () => events.push("save:second"),
    focus: () => events.push("focus:second"),
  })

  assert.equal(await registry.confirmNavigation(), false)
  assert.deepEqual(events, ["validate:first", "validate:second", "focus:second"])
  assert.equal(second.state.dirty, true)
})

test("a failed save keeps drafts dirty, focuses the first remaining form, and returns false", async () => {
  const failure = new Error("commit rejected")
  const events = []
  const registry = createFormDraftRegistry({ choose: () => "save" })
  registerDraft(registry, {
    save: async () => { throw failure },
    focus: () => events.push("focus"),
  })

  assert.equal(await registry.confirmNavigation(), false)
  assert.deepEqual(events, ["focus"])
  assert.equal(registry.hasDirtyDrafts(), true)
})

test("a failed save cannot focus its form after that callback made it clean", async () => {
  let firstDirty = true
  const events = []
  const registry = createFormDraftRegistry({ choose: () => "save" })
  registerDraft(registry, {
    id: "first",
    isDirty: () => firstDirty,
    save() {
      firstDirty = false
      return false
    },
    focus: () => events.push("focus:first"),
  })
  registerDraft(registry, {
    id: "second",
    save: () => events.push("save:second"),
    focus: () => events.push("focus:second"),
  })

  assert.equal(await registry.confirmNavigation(), false)
  assert.deepEqual(events, ["focus:second"])
})

test("a save that resolves without clearing its draft cannot allow navigation", async () => {
  let focusCalls = 0
  const registry = createFormDraftRegistry({ choose: () => "save" })
  registerDraft(registry, {
    save: () => true,
    focus: () => { focusCalls += 1 },
  })

  assert.equal(await registry.confirmNavigation(), false)
  assert.equal(focusCalls, 1)
  assert.equal(registry.hasDirtyDrafts(), true)
})

test("discard calls only discard and allows navigation only after drafts clear", async () => {
  const events = []
  const registry = createFormDraftRegistry({ choose: () => "discard" })
  let firstDirty = true
  let secondDirty = true
  registerDraft(registry, {
    id: "first",
    isDirty: () => firstDirty,
    validate: () => events.push("validate:first"),
    save: () => events.push("save:first"),
    discard: () => { events.push("discard:first"); firstDirty = false },
    focus: () => events.push("focus:first"),
  })
  registerDraft(registry, {
    id: "second",
    isDirty: () => secondDirty,
    validate: () => events.push("validate:second"),
    save: () => events.push("save:second"),
    discard: () => { events.push("discard:second"); secondDirty = false },
    focus: () => events.push("focus:second"),
  })

  assert.equal(await registry.confirmNavigation(), true)
  assert.deepEqual(events, ["discard:first", "discard:second"])
  assert.equal(registry.hasDirtyDrafts(), false)
})

test("discard return values do not override the final dirty-state check", async () => {
  let dirty = true
  const registry = createFormDraftRegistry({ choose: () => "discard" })
  registerDraft(registry, {
    isDirty: () => dirty,
    discard() {
      dirty = false
      return false
    },
  })

  assert.equal(await registry.confirmNavigation(), true)
  assert.equal(registry.hasDirtyDrafts(), false)
})

test("each destructive action rechecks whether the later form is still dirty", async () => {
  for (const choice of ["discard", "save"]) {
    let firstDirty = true
    let secondDirty = true
    const events = []
    const registry = createFormDraftRegistry({ choose: () => choice })
    registerDraft(registry, {
      id: "first",
      isDirty: () => firstDirty,
      validate: () => true,
      save() {
        events.push("save:first")
        firstDirty = false
        secondDirty = false
      },
      discard() {
        events.push("discard:first")
        firstDirty = false
        secondDirty = false
      },
    })
    registerDraft(registry, {
      id: "second",
      isDirty: () => secondDirty,
      validate: () => true,
      save: () => events.push("save:second"),
      discard: () => events.push("discard:second"),
    })

    assert.equal(await registry.confirmNavigation(), true, choice)
    assert.deepEqual(events, [`${choice}:first`], choice)
  }
})

test("a later dirty-check failure blocks its destructive callback", async () => {
  for (const choice of ["discard", "save"]) {
    let firstDirty = true
    let secondDirty = true
    let secondCheckThrows = false
    const events = []
    const registry = createFormDraftRegistry({ choose: () => choice })
    registerDraft(registry, {
      id: "first",
      isDirty: () => firstDirty,
      validate: () => true,
      save() {
        events.push("save:first")
        firstDirty = false
        secondCheckThrows = true
      },
      discard() {
        events.push("discard:first")
        firstDirty = false
        secondCheckThrows = true
      },
    })
    registerDraft(registry, {
      id: "second",
      isDirty() {
        if (secondCheckThrows) throw new Error("dirty check failed")
        return secondDirty
      },
      validate: () => true,
      save: () => events.push("save:second"),
      discard: () => events.push("discard:second"),
      focus: () => events.push("focus:second"),
    })

    assert.equal(await registry.confirmNavigation(), false, choice)
    assert.deepEqual(events, [`${choice}:first`, "focus:second"], choice)
    secondDirty = false
  }
})

test("discardAll synchronously clears current dirty forms without prompting", () => {
  let chooseCalls = 0
  const registry = createFormDraftRegistry({
    choose() {
      chooseCalls += 1
      return "continue-editing"
    },
  })
  const first = registerDraft(registry, { id: "first" })
  const second = registerDraft(registry, { id: "second", dirty: false })

  assert.equal(registry.discardAll(), true)
  assert.equal(first.state.dirty, false)
  assert.equal(second.state.dirty, false)
  assert.equal(chooseCalls, 0)
})

test("discardAll rechecks each later form before discarding it", () => {
  let firstDirty = true
  let secondDirty = true
  const events = []
  const registry = createFormDraftRegistry({ choose: () => "discard" })
  registerDraft(registry, {
    id: "first",
    isDirty: () => firstDirty,
    discard() {
      events.push("discard:first")
      firstDirty = false
      secondDirty = false
    },
  })
  registerDraft(registry, {
    id: "second",
    isDirty: () => secondDirty,
    discard: () => events.push("discard:second"),
  })

  assert.equal(registry.discardAll(), true)
  assert.deepEqual(events, ["discard:first"])
})

test("continue editing and unknown choices keep data and focus the first dirty form", async () => {
  for (const choice of ["continue-editing", "unexpected"]) {
    const events = []
    const registry = createFormDraftRegistry({ choose: () => choice })
    registerDraft(registry, {
      id: "clean",
      dirty: false,
      focus: () => events.push("focus:clean"),
    })
    registerDraft(registry, {
      id: "dirty",
      save: () => events.push("save"),
      discard: () => events.push("discard"),
      focus: () => events.push("focus:dirty"),
    })

    assert.equal(await registry.confirmNavigation(), false, choice)
    assert.deepEqual(events, ["focus:dirty"], choice)
    assert.equal(registry.hasDirtyDrafts(), true, choice)
  }
})

test("unregister is idempotent, removes only its own form, and frees the id", async () => {
  const registry = createFormDraftRegistry({ choose: () => "continue-editing" })
  const first = registerDraft(registry, { id: "shared" })
  const second = registerDraft(registry, { id: "other" })

  assert.equal(first.unregister(), true)
  assert.equal(first.unregister(), false)
  assert.equal(registry.hasDirtyDrafts(), true)
  assert.equal(await registry.confirmNavigation(), false)
  assert.equal(first.state.focused, 0)
  assert.equal(second.state.focused, 1)

  const replacement = registerDraft(registry, { id: "shared" })
  assert.equal(registry.hasDirtyDrafts(), true)
  replacement.unregister()
})

test("concurrent navigation confirmations return the same promise and share one decision", async () => {
  const decision = deferred()
  let chooseCalls = 0
  const registry = createFormDraftRegistry({
    choose() {
      chooseCalls += 1
      return decision.promise
    },
  })
  const draft = registerDraft(registry)

  const first = registry.confirmNavigation()
  const second = registry.confirmNavigation()
  assert.equal(first, second)
  assert.equal(chooseCalls, 1)

  decision.resolve("discard")
  assert.equal(await first, true)
  assert.equal(draft.state.dirty, false)
  assert.equal(chooseCalls, 1)
})

test("a settled confirmation cannot be reused for later dirty data", async () => {
  const choices = ["discard", "continue-editing"]
  let chooseCalls = 0
  const registry = createFormDraftRegistry({
    choose() {
      const choice = choices[chooseCalls]
      chooseCalls += 1
      return choice
    },
  })
  const draft = registerDraft(registry)

  assert.equal(await registry.confirmNavigation(), true)
  draft.state.dirty = true
  assert.equal(await registry.confirmNavigation(), false)
  assert.equal(chooseCalls, 2)
  assert.equal(draft.state.focused, 1)
})

test("a chooser that reenters the same confirmation fails closed instead of self-waiting", async () => {
  let registry
  registry = createFormDraftRegistry({
    choose: () => registry.confirmNavigation(),
  })
  registerDraft(registry)

  const outcome = await Promise.race([
    registry.confirmNavigation(),
    new Promise(resolve => setImmediate(() => resolve("still-pending"))),
  ])

  assert.equal(outcome, false)
  assert.equal(registry.hasDirtyDrafts(), true)
})

test("drafts registered while a prompt is open are not silently acted on", async () => {
  const decision = deferred()
  const registry = createFormDraftRegistry({ choose: () => decision.promise })
  const first = registerDraft(registry, { id: "first" })
  const confirmation = registry.confirmNavigation()
  const late = registerDraft(registry, { id: "late" })

  decision.resolve("discard")
  assert.equal(await confirmation, false)
  assert.equal(first.state.dirty, false)
  assert.equal(late.state.dirty, true)
  assert.equal(late.state.focused, 1)
})

test("an unregistered id replacement is not acted on by the old prompt", async () => {
  const decision = deferred()
  const events = []
  const registry = createFormDraftRegistry({ choose: () => decision.promise })
  const original = registerDraft(registry, {
    id: "shared",
    discard: () => events.push("discard:original"),
  })
  const confirmation = registry.confirmNavigation()

  original.unregister()
  const replacement = registerDraft(registry, {
    id: "shared",
    discard: () => events.push("discard:replacement"),
    focus: () => events.push("focus:replacement"),
  })
  decision.resolve("discard")

  assert.equal(await confirmation, false)
  assert.deepEqual(events, ["focus:replacement"])
  assert.equal(replacement.state.dirty, true)
})

test("unregistering or disposing during a prompt prevents stale callbacks", async () => {
  for (const action of ["unregister", "dispose"]) {
    const decision = deferred()
    const events = []
    const registry = createFormDraftRegistry({ choose: () => decision.promise })
    const draft = registerDraft(registry, {
      save: () => events.push("save"),
      discard: () => events.push("discard"),
      focus: () => events.push("focus"),
    })
    const confirmation = registry.confirmNavigation()

    if (action === "unregister") draft.unregister()
    else registry.dispose()
    decision.resolve("save")

    assert.equal(await confirmation, true, action)
    assert.deepEqual(events, [], action)
  }
})

test("dispose settles an open prompt without waiting for its chooser", async () => {
  const decision = deferred()
  const events = []
  const registry = createFormDraftRegistry({ choose: () => decision.promise })
  registerDraft(registry, {
    save: () => events.push("save"),
    discard: () => events.push("discard"),
    focus: () => events.push("focus"),
  })
  const confirmation = registry.confirmNavigation()

  registry.dispose()
  assert.equal(await confirmation, true)
  assert.deepEqual(events, [])
})

test("invalid or throwing dirty checks fail closed before destructive callbacks", async () => {
  for (const dirtyResult of ["dirty", 1, undefined, new Error("dirty check failed")]) {
    const events = []
    const registry = createFormDraftRegistry({
      choose: () => { events.push("choose"); return "discard" },
    })
    registerDraft(registry, {
      isDirty() {
        if (dirtyResult instanceof Error) throw dirtyResult
        return dirtyResult
      },
      discard: () => events.push("discard"),
      focus: () => events.push("focus"),
    })

    assert.equal(registry.hasDirtyDrafts(), true)
    assert.equal(await registry.confirmNavigation(), false)
    assert.deepEqual(events, ["focus"])
  }
})

test("chooser and validation failures block navigation without clearing drafts", async () => {
  for (const kind of ["choose", "validate"]) {
    const failure = new Error(`${kind} failed`)
    let focusCalls = 0
    const registry = createFormDraftRegistry({
      choose: kind === "choose" ? () => Promise.reject(failure) : () => "save",
    })
    registerDraft(registry, {
      validate: kind === "validate" ? () => { throw failure } : () => true,
      focus: () => { focusCalls += 1 },
    })

    assert.equal(await registry.confirmNavigation(), false, kind)
    assert.equal(registry.hasDirtyDrafts(), true, kind)
    assert.equal(focusCalls, 1, kind)
  }
})

test("invalid construction and duplicate live ids fail synchronously", () => {
  assert.throws(() => createFormDraftRegistry({}), TypeError)
  assert.throws(() => createFormDraftRegistry({ choose: null }), TypeError)

  const registry = createFormDraftRegistry({ choose: () => "save" })
  registerDraft(registry, { id: "same" })
  assert.throws(() => registerDraft(registry, { id: "same" }), /same/)
  assert.throws(() => registry.register({ id: "missing" }), TypeError)

  registry.dispose()
  assert.equal(registry.dispose(), false)
  assert.equal(registry.hasDirtyDrafts(), false)
  assert.throws(() => registerDraft(registry, { id: "later" }), /disposed/i)
})
