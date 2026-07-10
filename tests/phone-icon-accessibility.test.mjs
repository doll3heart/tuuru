import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const phoneSource = readFileSync(new URL("../js/pages/phone.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "")

function ruleBodiesFor(cssText, selector) {
  const bodies = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match

  while ((match = pattern.exec(cssText))) {
    const selectors = match[1].split(",").map(value => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }

  return bodies.join("\n")
}

test("phone App icons expose a bounded visible keyboard focus contract", () => {
  const icon = ruleBodiesFor(cssWithoutComments, ".phone-app-icon")
  const focusBody = ruleBodiesFor(cssWithoutComments, ".phone-app-icon:focus-visible .phone-icon-body")
  const desktopDescendants = ruleBodiesFor(cssWithoutComments, ".phone-desktop *")
  const dragSection = phoneSource.match(
    /\/\/ ===== Drag-to-reorder =====([\s\S]*?)\/\/ ===== App click handler =====/,
  )
  const clickSection = phoneSource.match(
    /\/\/ ===== App click handler =====([\s\S]*?)\/\/ ===== Customize Panel =====/,
  )

  assert.ok(dragSection)
  assert.ok(clickSection)
  assert.match(icon, /appearance\s*:\s*none/)
  assert.match(icon, /background\s*:\s*transparent/)
  assert.match(icon, /font\s*:\s*inherit/)
  assert.match(focusBody, /outline\s*:\s*2px\s+solid\s+var\(--c-text\)/)
  assert.match(focusBody, /outline-offset\s*:\s*2px/)
  assert.match(focusBody, /box-shadow\s*:\s*0\s+0\s+0\s+4px\s+rgba\(164,198,235/)
  assert.doesNotMatch(desktopDescendants, /outline|focus-ring-color/)
  assert.doesNotMatch(dragSection[1], /\.blur\(\)/)
  assert.doesNotMatch(clickSection[1], /\.blur\(\)/)
})

test("rendered phone App icons are native named controls with native activation", async t => {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: "http://localhost/",
  })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.Event = dom.window.Event
  globalThis.MouseEvent = dom.window.MouseEvent
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }

  t.after(() => dom.window.close())

  const { PHONE_APP_DEFS } = await import("../js/data.js")
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { renderPhoneEditor } = await import("../js/pages/phone.js")
  const specialName = 'Settings "safe" & <demo>'
  const draft = createPhoneWorkDraft({
    id: "phone-icon-accessibility",
    type: "phone",
    phoneData: {
      contacts: [],
      chats: [],
      moments: [],
      forumPosts: [],
      forumNpcs: [],
      memos: [],
      photos: [],
      albums: [],
      browserHistory: [],
      shoppingItems: [],
      skin: { readerId: "Reader", showAppLabels: false },
      apps: [
        {
          id: "settings-special-name",
          type: "settings",
          name: specialName,
          icon: "S",
          color: "#f0f0f0",
          desktopX: 0,
          desktopY: 0,
          enabled: true,
        },
        {
          id: "customize-blank-name",
          type: "customize",
          name: "   ",
          icon: "C",
          color: "#f0f0f0",
          desktopX: 1,
          desktopY: 0,
          enabled: true,
        },
      ],
    },
  })

  const root = document.getElementById("app")
  root.innerHTML = renderPhoneEditor(draft.id)
  await new Promise(resolve => setTimeout(resolve, 70))

  const icons = [...document.querySelectorAll(".phone-app-icon")]
  assert.ok(icons.length > 0)
  for (const icon of icons) {
    assert.equal(icon.tagName, "BUTTON")
    assert.equal(icon.type, "button")
    assert.ok(icon.getAttribute("aria-label")?.trim())
    assert.equal(icon.querySelector(".phone-icon-body")?.tagName, "SPAN")
    assert.equal(icon.style.getPropertyPriority("outline"), "")
  }

  const settings = document.querySelector('[data-app-type="settings"]')
  const customize = document.querySelector('[data-app-type="customize"]')
  assert.equal(settings.getAttribute("aria-label"), specialName)
  assert.equal(customize.getAttribute("aria-label"), PHONE_APP_DEFS.customize.label)
  assert.equal(settings.querySelector(".phone-icon-label"), null)
  settings.focus()
  assert.equal(document.activeElement, settings)

  settings.click()
  assert.ok(document.getElementById("settingsPanel"))

  draft.dispose()
  await new Promise(resolve => setTimeout(resolve, 60))
})
