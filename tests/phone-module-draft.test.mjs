import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import {
  createPhoneModuleCloseHandlers,
  createPhoneModuleDraftData,
  hasPhoneModuleContent,
  pickPhoneModuleData,
} from "../js/phone-module-draft.js"

test("building a module draft does not add phoneData to the article", () => {
  const article = { id: "article-1", type: "article" }
  const moduleData = { chats: [{ id: "chat-1", rounds: [] }] }

  const draft = createPhoneModuleDraftData(article, moduleData)
  draft.chats[0].rounds.push({ id: "round-1" })

  assert.equal(Object.hasOwn(article, "phoneData"), false)
  assert.deepEqual(moduleData.chats, [{ id: "chat-1", rounds: [] }])
  assert.deepEqual(draft.contacts, [])
  assert.deepEqual(draft.forumPosts, [])
  assert.deepEqual(draft.shoppingItems, [])
})

test("shared article contacts are copied into a module draft", () => {
  const article = {
    id: "article-1",
    phoneData: { contacts: [{ id: "contact-1", profile: { name: "A" } }] },
  }

  const draft = createPhoneModuleDraftData(article, { memos: [] })
  draft.contacts[0].profile.name = "B"

  assert.equal(article.phoneData.contacts[0].profile.name, "A")
})

test("module payload projection follows the existing schema for every app", () => {
  const phoneData = {
    chats: [{ id: "chat-1" }],
    contacts: [{ id: "contact-1" }],
    forumPosts: [{ id: "post-1" }],
    memos: [{ id: "memo-1" }],
    photos: [{ id: "photo-1" }],
    albums: [{ id: "album-1" }],
    browserHistory: [{ id: "history-1" }],
    shoppingItems: [{ id: "item-1" }],
  }

  assert.deepEqual(pickPhoneModuleData("messages", phoneData), {
    chats: phoneData.chats,
    contacts: phoneData.contacts,
  })
  assert.deepEqual(pickPhoneModuleData("forum", phoneData), {
    forumPosts: phoneData.forumPosts,
  })
  assert.deepEqual(pickPhoneModuleData("memo", phoneData), {
    memos: phoneData.memos,
  })
  assert.deepEqual(pickPhoneModuleData("gallery", phoneData), {
    photos: phoneData.photos,
    albums: phoneData.albums,
  })
  assert.deepEqual(pickPhoneModuleData("browser", phoneData), {
    browserHistory: phoneData.browserHistory,
  })
  assert.deepEqual(pickPhoneModuleData("shopping", phoneData), {
    shoppingItems: phoneData.shoppingItems,
  })
  assert.deepEqual(pickPhoneModuleData("contacts", phoneData), {
    contacts: phoneData.contacts,
  })
})

test("projected payloads cannot mutate the live draft", () => {
  const phoneData = { chats: [{ id: "chat-1", rounds: [] }], contacts: [] }
  const payload = pickPhoneModuleData("messages", phoneData)

  payload.chats[0].rounds.push({ id: "round-1" })

  assert.deepEqual(phoneData.chats[0].rounds, [])
})

test("content detection matches each module primary collection", () => {
  const cases = [
    ["messages", { chats: [] }, false],
    ["messages", { chats: [{ id: "chat-1" }] }, true],
    ["forum", { forumPosts: [{ id: "post-1" }] }, true],
    ["memo", { memos: [] }, false],
    ["gallery", { photos: [], albums: [{ id: "album-1" }] }, true],
    ["browser", { browserHistory: [{ id: "history-1" }] }, true],
    ["shopping", { shoppingItems: [] }, false],
    ["contacts", { contacts: [{ id: "contact-1" }] }, true],
    ["unknown", {}, false],
  ]

  for (const [type, data, expected] of cases) {
    assert.equal(hasPhoneModuleContent(type, data), expected, type)
  }
})

test("a successful formal module commit disposes and reports the draft", () => {
  const committed = []
  const saved = []
  let disposed = 0
  const savedModule = { id: "module-1", type: "messages" }
  const handlers = createPhoneModuleCloseHandlers({
    type: "messages",
    draft: {
      snapshot: () => ({
        phoneData: { chats: [{ id: "chat-1" }], contacts: [] },
      }),
      dispose: () => { disposed += 1 },
    },
    commit: data => { committed.push(data); return savedModule },
    onSaved: module => saved.push(module),
  })

  const result = handlers.beforeClose()
  handlers.afterClose(result)

  assert.deepEqual(committed, [{ chats: [{ id: "chat-1" }], contacts: [] }])
  assert.equal(disposed, 1)
  assert.deepEqual(saved, [savedModule])
})

test("a failed formal module commit keeps the draft available", () => {
  let disposed = 0
  const errors = []
  const handlers = createPhoneModuleCloseHandlers({
    type: "messages",
    draft: {
      snapshot: () => ({
        phoneData: { chats: [{ id: "chat-1" }], contacts: [] },
      }),
      dispose: () => { disposed += 1 },
    },
    commit: () => null,
    onError: error => errors.push(error),
  })

  assert.equal(handlers.beforeClose(), false)
  assert.equal(disposed, 0)
  assert.equal(errors.length, 1)
})

test("a thrown formal module commit keeps the draft available", () => {
  const failure = new Error("quota exceeded")
  let disposed = 0
  const errors = []
  const handlers = createPhoneModuleCloseHandlers({
    type: "messages",
    draft: {
      snapshot: () => ({
        phoneData: { chats: [{ id: "chat-1" }], contacts: [] },
      }),
      dispose: () => { disposed += 1 },
    },
    commit: () => { throw failure },
    onError: error => errors.push(error),
  })

  assert.equal(handlers.beforeClose(), false)
  assert.equal(disposed, 0)
  assert.deepEqual(errors, [failure])
})

test("an empty module closes without a formal module write", () => {
  let commits = 0
  let disposed = 0
  let emptyCalls = 0
  const handlers = createPhoneModuleCloseHandlers({
    type: "messages",
    draft: {
      snapshot: () => ({ phoneData: { chats: [], contacts: [] } }),
      dispose: () => { disposed += 1 },
    },
    commit: () => { commits += 1 },
    onEmpty: () => { emptyCalls += 1 },
  })

  const result = handlers.beforeClose()
  handlers.afterClose(result)

  assert.equal(commits, 0)
  assert.equal(disposed, 1)
  assert.equal(emptyCalls, 1)
})

test("the article editor wires phone cards to a virtual draft session", async () => {
  const source = await readFile(new URL("../js/pages/editor.js", import.meta.url), "utf8")
  const start = source.indexOf("function openPhoneAppModalForCard")
  const end = source.indexOf("\nfunction showPhoneModuleMenu", start)
  const functionSource = source.slice(start, end)

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  assert.match(functionSource, /createPhoneWorkDraft/)
  assert.match(functionSource, /openPhoneAppModal\(draft\.id/)
  assert.doesNotMatch(functionSource, /updateWork\s*\(\s*wid\s*,\s*\{\s*phoneData/)
  assert.doesNotMatch(functionSource, /MutationObserver|setTimeout/)
})
