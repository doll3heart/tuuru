import test from "node:test"
import assert from "node:assert/strict"

import { downloadBlob } from "../js/download.js"

function createDownloadEnvironment(clickError) {
  const scheduled = []
  const revoked = []
  const link = {
    style: {},
    removed: false,
    click() {
      if (clickError) throw clickError
    },
    remove() {
      this.removed = true
    },
  }
  const documentObject = {
    body: {
      appended: null,
      appendChild(node) {
        this.appended = node
      },
    },
    createElement(tagName) {
      assert.equal(tagName, "a")
      return link
    },
  }
  const urlApi = {
    createObjectURL() {
      return "blob:tuuru-backup"
    },
    revokeObjectURL(url) {
      revoked.push(url)
    },
  }
  const schedule = (callback, delay) => scheduled.push({ callback, delay })

  return { documentObject, link, revoked, schedule, scheduled, urlApi }
}

test("a local blob download cleans up after the browser accepts it", () => {
  const environment = createDownloadEnvironment()

  downloadBlob({}, "backup.json", environment)

  assert.equal(environment.documentObject.body.appended, environment.link)
  assert.equal(environment.link.href, "blob:tuuru-backup")
  assert.equal(environment.link.download, "backup.json")
  assert.equal(environment.link.removed, true)
  assert.equal(environment.scheduled.length, 1)
  assert.equal(environment.scheduled[0].delay, 1000)

  environment.scheduled[0].callback()
  assert.deepEqual(environment.revoked, ["blob:tuuru-backup"])
})

test("a failed local blob download still cleans up its resources", () => {
  const clickError = new Error("download blocked")
  const environment = createDownloadEnvironment(clickError)

  assert.throws(
    () => downloadBlob({}, "backup.json", environment),
    error => error === clickError,
  )
  assert.equal(environment.link.removed, true)
  assert.equal(environment.scheduled.length, 1)

  environment.scheduled[0].callback()
  assert.deepEqual(environment.revoked, ["blob:tuuru-backup"])
})
