import test from "node:test"
import assert from "node:assert/strict"

import { createPhoneModalCloseController } from "../js/phone-modal-lifecycle.js"

test("a rejected close keeps the modal open and can be retried", () => {
  let allowClose = false
  let removes = 0
  const close = createPhoneModalCloseController({
    beforeClose: () => allowClose ? "saved" : false,
    remove: () => { removes += 1 },
  })

  assert.equal(close("button"), false)
  assert.equal(removes, 0)

  allowClose = true
  assert.equal(close("button"), true)
  assert.equal(removes, 1)
})

test("a successful close removes once and passes its result", () => {
  const events = []
  const close = createPhoneModalCloseController({
    beforeClose: reason => ({ reason, saved: true }),
    remove: () => events.push("remove"),
    afterClose: (result, reason) => events.push({ result, reason }),
  })

  assert.equal(close("backdrop"), true)
  assert.equal(close("button"), false)
  assert.deepEqual(events, [
    "remove",
    {
      result: { reason: "backdrop", saved: true },
      reason: "backdrop",
    },
  ])
})
