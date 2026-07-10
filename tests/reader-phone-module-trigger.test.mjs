import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")

function ruleBodiesFor(selector) {
  const bodies = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match

  while ((match = pattern.exec(cssWithoutComments))) {
    const selectors = match[1].split(",").map(value => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }

  return bodies.join("\n")
}

test("reader phone module triggers render as native named buttons", async () => {
  const {
    buildReaderPhoneModuleTrigger,
    markReaderPhoneModuleTriggerRead,
  } = await import("../reader/reader-phone-module-trigger.js")
  const html = buildReaderPhoneModuleTrigger({
    pmid: "module-1",
    type: "memo",
    label: "备忘录",
    trustedIconHtml: '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>',
    hasUnread: true,
  })
  const document = new JSDOM(`<main>${html}</main>`).window.document
  const trigger = document.querySelector(".rd-pm-trigger")

  assert.equal(trigger?.tagName, "BUTTON")
  assert.equal(trigger?.type, "button")
  assert.equal(trigger?.tabIndex, 0)
  assert.equal(trigger?.getAttribute("aria-label"), "查看备忘录，未读")
  assert.equal(trigger?.dataset.readLabel, "查看备忘录")
  assert.equal(trigger?.dataset.pmId, "module-1")
  assert.equal(trigger?.dataset.pmType, "memo")
  assert.equal(trigger?.querySelector(".rd-pm-dot")?.getAttribute("aria-hidden"), "true")
  assert.equal(trigger?.querySelector(".rd-pm-trigger-icon")?.getAttribute("aria-hidden"), "true")
  assert.ok(trigger?.querySelector(".rd-pm-trigger-icon svg"))

  let activations = 0
  trigger.addEventListener("click", () => { activations += 1 })
  trigger.click()
  assert.equal(activations, 1)

  assert.equal(markReaderPhoneModuleTriggerRead(trigger), true)
  assert.equal(trigger.querySelector(".rd-pm-dot")?.classList.contains("has-unread"), false)
  assert.equal(trigger.getAttribute("aria-label"), "查看备忘录")

  const readDocument = new JSDOM(`<main>${buildReaderPhoneModuleTrigger({
    pmid: 'module-2',
    type: 'memo',
    label: '备忘录',
    hasUnread: false,
  })}</main>`).window.document
  assert.equal(readDocument.querySelector(".rd-pm-trigger")?.getAttribute("aria-label"), "查看备忘录")
})

test("reader module trigger metadata cannot break out of its markup", async () => {
  const { buildReaderPhoneModuleTrigger } = await import("../reader/reader-phone-module-trigger.js")
  const pmid = 'module-1" autofocus data-forged="yes'
  const type = 'memo"><script>window.pwned=true</script>'
  const label = '<img src=x onerror=window.pwned=true>'
  const document = new JSDOM(`<main>${buildReaderPhoneModuleTrigger({ pmid, type, label })}</main>`).window.document
  const trigger = document.querySelector(".rd-pm-trigger")

  assert.equal(document.querySelectorAll(".rd-pm-trigger").length, 1)
  assert.equal(document.querySelector("script"), null)
  assert.equal(document.querySelector("img"), null)
  assert.equal(trigger?.dataset.pmId, pmid)
  assert.equal(trigger?.dataset.pmType, type)
  assert.equal(trigger?.getAttribute("aria-label"), "查看" + label)
})

test("the article reader uses the native trigger builder and existing click path", () => {
  const start = readerSource.indexOf("var triggerIndex = 0")
  const end = readerSource.indexOf("// Bind phone module triggers", start)
  const source = readerSource.slice(start, end)

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  assert.match(source, /buildReaderPhoneModuleTrigger\(\{/)
  assert.doesNotMatch(source, /<div class=["']rd-pm-trigger/)
  assert.match(readerSource.slice(end), /trig\.onclick\s*=\s*function/)
  assert.match(readerSource.slice(end), /markReaderPhoneModuleTriggerRead\(trig\)/)
})

test("native reader module buttons preserve the card layout and visible focus", () => {
  const trigger = ruleBodiesFor(".rd-pm-trigger")
  const focus = ruleBodiesFor(".rd-pm-trigger:focus-visible")

  assert.match(trigger, /appearance\s*:\s*none/)
  assert.match(trigger, /width\s*:\s*100%/)
  assert.match(trigger, /min-height\s*:\s*44px/)
  assert.match(trigger, /font\s*:\s*inherit/)
  assert.match(trigger, /text-align\s*:\s*left/)
  assert.match(focus, /outline\s*:\s*2px\s+solid\s+var\(--c-text\)/)
})
