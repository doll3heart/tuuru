import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { resolvePhoneReadingFlowStep } from "../js/phone-reading-flow.js"
import { readSteganoPayload } from "../js/stegano.js"
import { validateWorkForImport } from "../js/work-schema.js"
import {
  SHOWCASE_MESSAGE_TYPES,
  SHOWCASE_PHONE_FILE,
  buildShowcasePhoneWork,
} from "../scripts/showcase-phone-fixture.mjs"
import { decodeRgbaPng } from "../scripts/acceptance-work-assets.mjs"

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const sampleDirectory = join(projectRoot, "samples", "showcase")
const decoder = new TextDecoder()

function allMessages(work) {
  return work.phoneData.chats.flatMap(chat => [
    ...(chat.messages || []),
    ...(chat.rounds || []).flatMap(round => round.messages || []),
  ])
}

function collectStrings(value, strings = []) {
  if (typeof value === "string") strings.push(value)
  else if (Array.isArray(value)) value.forEach(item => collectStrings(item, strings))
  else if (value && typeof value === "object") Object.values(value).forEach(item => collectStrings(item, strings))
  return strings
}

test("phone showcase is importable and covers the complete guided phone chain", () => {
  const work = buildShowcasePhoneWork()
  const validation = validateWorkForImport(work)
  assert.equal(validation.ok, true, validation.message)
  assert.equal(work.type, "phone")
  assert.equal(work.phoneData.readingFlow.enabled, true)

  const appTypes = new Set(work.phoneData.apps.map(app => app.type))
  for (const type of ["messages", "contacts", "forum", "memo", "gallery", "browser", "shopping"]) {
    assert.ok(appTypes.has(type), `missing ${type} app`)
  }

  const guidedTypes = work.phoneData.readingFlow.sequence.map(step => step.type)
  for (const type of ["messages", "forum", "moments", "memo", "gallery", "browser", "shopping"]) {
    assert.ok(guidedTypes.includes(type), `missing ${type} flow step`)
  }
  for (const step of work.phoneData.readingFlow.sequence) {
    assert.ok(resolvePhoneReadingFlowStep(work.phoneData, step), `unresolvable flow step ${step.type}:${step.itemId}`)
    assert.ok(!work.placeholders.some(placeholder => step.label.includes(placeholder.key)), `flow label must not expose raw placeholder: ${step.label}`)
  }
})

test("phone showcase contains every authored message card and interaction variant", () => {
  const work = buildShowcasePhoneWork()
  const messages = allMessages(work)
  const messageTypes = new Set(messages.map(message => message.type))

  for (const type of SHOWCASE_MESSAGE_TYPES) {
    assert.ok(messageTypes.has(type), `missing ${type} message`)
  }
  assert.ok(messages.some(message => message.type === "time" && message.time?.includes("加入旧站夜巡")), "missing system message")
  assert.ok(messages.some(message => message.type === "call" && message.callMode === "voice"), "missing voice call")
  assert.ok(messages.some(message => message.type === "call" && message.callMode === "video"), "missing video call")
  assert.ok(messages.some(message => Array.isArray(message.choices) && message.choices.length >= 2), "missing chat choices")
  assert.ok(messages.some(message => message.choices?.every(choice => choice.replyText && choice.followUpMessages?.length)), "chat choices need complete follow-ups")
  assert.ok(work.phoneData.chats.some(chat => chat.type === "group" && chat.groupAvatarUrl), "missing configured group chat")
  assert.ok(work.phoneData.moments.some(moment => moment.comments?.some(comment => comment.choices?.length)), "missing moment interaction")
  assert.ok(work.phoneData.forumPosts.some(post => post.comments?.some(comment => comment.choices?.length)), "missing forum interaction")
})

test("phone showcase placeholders are configured and used across phone content", () => {
  const work = buildShowcasePhoneWork()
  const content = collectStrings(work).join("\n")
  const keys = work.placeholders.map(placeholder => placeholder.key)

  assert.deepEqual(keys, ["某某", "小某", "wm"])
  for (const placeholder of work.placeholders) {
    assert.ok(placeholder.label)
    assert.ok(placeholder.prompt)
    assert.equal(placeholder.mode, "each")
    assert.ok(content.split(placeholder.key).length > 5, `${placeholder.key} should be used in multiple places`)
  }
})

test("generated phone showcase JSON and PNG carry the canonical work", async () => {
  const expected = buildShowcasePhoneWork()
  const jsonText = await readFile(join(sampleDirectory, `${SHOWCASE_PHONE_FILE}.json`), "utf8")
  const pngBuffer = await readFile(join(sampleDirectory, `${SHOWCASE_PHONE_FILE}.png`))
  const decoded = decodeRgbaPng(pngBuffer)
  const payload = readSteganoPayload(decoded.rgba)

  assert.ok(payload, "PNG must contain a Tuuru work payload")
  assert.deepEqual(JSON.parse(jsonText), expected)
  assert.deepEqual(JSON.parse(decoder.decode(payload)), expected)
})
