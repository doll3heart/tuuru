import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { readSteganoPayload } from "../js/stegano.js"
import { validateWorkForImport } from "../js/work-schema.js"
import { decodeRgbaPng } from "../scripts/acceptance-work-assets.mjs"
import {
  SHOWCASE_ARTICLE_FILE,
  SHOWCASE_MODULE_TYPES,
  buildShowcaseArticleWork,
} from "../scripts/showcase-article-fixture.mjs"

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const samplesDirectory = join(projectRoot, "samples", "showcase")
const screenshotsDirectory = join(samplesDirectory, "screenshots")
const decoder = new TextDecoder()

function sorted(values) {
  return [...values].sort()
}

function embeddedPngs(value, matches = []) {
  if (typeof value === "string" && value.startsWith("data:image/png;base64,")) matches.push(value)
  else if (Array.isArray(value)) value.forEach(item => embeddedPngs(item, matches))
  else if (value && typeof value === "object") Object.values(value).forEach(item => embeddedPngs(item, matches))
  return matches
}

function readPngDimensions(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

test("showcase article labels and covers the complete reader feature surface", () => {
  const work = buildShowcaseArticleWork()

  assert.equal(work.type, "article")
  assert.equal(work.title, "《Tuuru 全功能展示》")
  assert.equal(work.password, "2026")
  assert.equal(work.locked, true)
  assert.equal(work.chapters.length, 4)
  assert.ok(work.nodes.length >= 12)
  assert.equal(work.startNode, "showcase-start")
  assert.deepEqual(work.placeholders.map(item => item.key), ["某某", "小某", "wm"])
  assert.match(work.nodes[0].content, /姓名=某某；昵称=小某；网名=wm/)
  assert.ok(work.nodes.some(node => node.content.includes("【这是章节1】")))
  assert.ok(work.nodes.some(node => node.content.includes("【这是一张内嵌图片】")))
  assert.ok(work.nodes.some(node => node.content.includes("【这是选项组1】")))

  const chapterIds = new Set(work.chapters.map(chapter => chapter.id))
  const nodeIds = new Set(work.nodes.map(node => node.id))
  const targets = []
  for (const node of work.nodes) {
    assert.ok(chapterIds.has(node.chapterId), `${node.id} must belong to a chapter`)
    for (const choice of node.choices) {
      assert.ok(nodeIds.has(choice.targetId), `${choice.id} must target a real node`)
      targets.push(choice.targetId)
    }
  }
  assert.ok(work.nodes.some(node => node.choices.some(choice => choice.targetId === "showcase-start")), "showcase must demonstrate a loop")
  assert.ok(targets.filter(target => target === "showcase-merge").length >= 2, "branch routes must merge")

  assert.deepEqual(sorted(work.phoneModules.map(module => module.type)), sorted(SHOWCASE_MODULE_TYPES))
  const collections = {
    messages: "chats",
    forum: "forumPosts",
    memo: "memos",
    gallery: "photos",
    browser: "browserHistory",
    shopping: "shoppingItems",
    contacts: "contacts",
  }
  for (const module of work.phoneModules) {
    const owner = work.nodes.find(node => node.id === module.nodeId)
    assert.ok(owner, `${module.id} must own a node`)
    assert.match(owner.content, new RegExp(`data-pm-id="${module.id}"`))
    assert.ok(module.data[collections[module.type]].length > 0, `${module.type} must contain visible data`)
  }

  const messageTypes = new Set(work.phoneModules
    .find(module => module.type === "messages")
    .data.chats.flatMap(chat => chat.rounds.flatMap(round => round.messages.map(message => message.type))))
  for (const type of ["time", "text", "image", "voice", "transfer", "redpacket", "call"]) {
    assert.ok(messageTypes.has(type), `messages must demonstrate ${type}`)
  }
  assert.ok(work.phoneModules.find(module => module.type === "messages").data.chats
    .some(chat => chat.rounds.some(round => round.messages.some(message => message.choices?.length >= 2))))

  assert.ok(embeddedPngs(work).length >= 10)
  assert.deepEqual(work.watermark, {
    enabled: true,
    kind: "text",
    text: "纯代乙向禁止偷吃 · Tuuru 功能展示",
    image: null,
    opacity: 0.14,
    coverage: "full",
    position: "center",
    pattern: "cross",
    spacing: 118,
  })

  const validation = validateWorkForImport(work)
  assert.equal(validation.ok, true, validation.message)
})

test("generated showcase JSON and PNG are equivalent production imports", async () => {
  const jsonText = await readFile(join(samplesDirectory, `${SHOWCASE_ARTICLE_FILE}.json`), "utf8")
  const pngBuffer = await readFile(join(samplesDirectory, `${SHOWCASE_ARTICLE_FILE}.png`))
  const decoded = decodeRgbaPng(pngBuffer)
  const payload = readSteganoPayload(decoded.rgba)

  assert.ok(payload)
  const jsonWork = JSON.parse(jsonText)
  const pngWork = JSON.parse(decoder.decode(payload))
  assert.deepEqual(jsonWork, buildShowcaseArticleWork())
  assert.deepEqual(pngWork, jsonWork)
  assert.ok(decoded.width <= 4096 && decoded.height <= 4096)
  assert.ok(decoded.width * decoded.height <= 4 * 1024 * 1024)
  assert.equal(validateWorkForImport(jsonWork).ok, true)
  assert.equal(validateWorkForImport(pngWork).ok, true)
})

test("mobile showcase screenshot set is complete and consistently sized", async () => {
  const manifest = JSON.parse(await readFile(join(screenshotsDirectory, "manifest.json"), "utf8"))

  assert.deepEqual(manifest.viewport, { width: 390, height: 844 })
  assert.equal(manifest.screenshots.length, 26)
  assert.equal(new Set(manifest.screenshots.map(item => item.file)).size, 26)

  for (const item of manifest.screenshots) {
    assert.ok(item.feature)
    assert.equal(item.width, manifest.viewport.width)
    assert.equal(item.height, manifest.viewport.height)
    const dimensions = readPngDimensions(await readFile(join(screenshotsDirectory, item.file)))
    assert.deepEqual(dimensions, manifest.viewport, `${item.file} must use the mobile capture viewport`)
  }

  const contactSheet = readPngDimensions(await readFile(join(screenshotsDirectory, "contact-sheet.png")))
  assert.ok(contactSheet.width >= 1200)
  assert.ok(contactSheet.height >= 1000)
})
