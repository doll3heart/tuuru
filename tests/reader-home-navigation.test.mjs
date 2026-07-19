import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

test("reader home tabs keep accessible focus and narrow-screen styles", () => {
  const focusRule = readerCss.match(/\.rd-tab:focus-visible\s*\{([^}]*)\}/)?.[1] ?? ""
  assert.match(focusRule, /outline:\s*2px solid var\(--c-primary-hover\);/)

  const tabRule = readerCss.match(/\.rd-tab\s*\{([^}]*)\}/)?.[1] ?? ""
  assert.match(tabRule, /(?:^|\n)\s*appearance:\s*none;/)
  assert.match(tabRule, /(?:^|\n)\s*-webkit-appearance:\s*none;/)
  assert.match(tabRule, /(?:^|\n)\s*background:\s*transparent;/)
  assert.match(tabRule, /(?:^|\n)\s*font:\s*inherit;/)
  assert.match(tabRule, /(?:^|\n)\s*min-height:\s*44px;/)
  assert.match(tabRule, /(?:^|\n)\s*transition:\s*color \.15s, border-color \.15s;/)

  assert.match(
    readerCss,
    /@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*?\.rd-tab\s*\{[^}]*flex:\s*1 1 0;[^}]*min-width:\s*0;/,
  )
})

test("reader home controls navigate without relying on module globals", async t => {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: "http://localhost/reader/",
  })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage
  globalThis.sessionStorage = dom.window.sessionStorage
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.Event = dom.window.Event
  globalThis.MouseEvent = dom.window.MouseEvent
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.FileReader = dom.window.FileReader
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  t.after(() => dom.window.close())

  const baseWork = title => ({
    schemaVersion: 1,
    type: "article",
    title,
    nodes: [{ id: "node-a", title: "Start", content: "<p>Safe</p>", choices: [] }],
    chapters: [],
    scenes: [],
    placeholders: [],
    phoneModules: [],
    startNode: "node-a",
  })
  const hostileId = `recent');window.__readerInjected=true;//`
  const cachedWorks = [
    { ...baseWork("Hostile ID, safe content"), id: hostileId },
    { ...baseWork("Null ID"), id: null },
    baseWork("Missing ID"),
    { ...baseWork("Control character ID"), id: "nul\u0000line\rbreak" },
  ]
  const recents = cachedWorks.map(work => {
    const recent = { title: work.title, type: work.type, importedAt: Date.now() }
    if (Object.hasOwn(work, "id")) recent.id = work.id
    localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
    return recent
  })
  localStorage.setItem("moirain_recent", JSON.stringify(recents))

  await import(`../reader/reader.js?reader-home-navigation=${Date.now()}`)
  assert.ok(document.querySelector(".rd-home"))

  const productHeader = document.querySelector(".rd-product-header")
  assert.ok(productHeader)
  const modeSwitch = productHeader.querySelector(".rd-mode-switch")
  assert.equal(modeSwitch.getAttribute("aria-label"), "应用模式")
  const authorEntry = modeSwitch.querySelector("a")
  assert.equal(authorEntry.textContent, "创作端")
  assert.equal(authorEntry.href, "http://localhost/index.html")
  assert.equal(modeSwitch.querySelector('[aria-current="page"]').textContent, "读者端")
  assert.match(readerCss, /\.rd-mode-link\s*\{[^}]*min-height:\s*44px;/s)
  assert.match(readerCss, /\.rd-mode-link:focus-visible\s*\{[^}]*outline:/s)

  const tabList = document.querySelector(".rd-tabs")
  assert.equal(tabList.getAttribute("role"), "tablist")
  assert.match(tabList.getAttribute("aria-label") ?? "", /[\u3400-\u9fff]/)

  const tabs = [...tabList.querySelectorAll(".rd-tab")]
  assert.equal(tabs.length, 3)
  assert.equal(new Set(tabs.map(tab => tab.id)).size, tabs.length)

  tabs.forEach(tab => {
    assert.equal(tab.tagName, "BUTTON")
    assert.equal(tab.type, "button")
    assert.equal(tab.getAttribute("role"), "tab")
    assert.ok(tab.id)
    assert.ok(tab.getAttribute("aria-controls"))
    assert.ok(["true", "false"].includes(tab.getAttribute("aria-selected")))
    assert.ok(["0", "-1"].includes(tab.getAttribute("tabindex")))

    const panel = document.getElementById(tab.getAttribute("aria-controls"))
    assert.ok(panel)
    assert.equal(panel.getAttribute("role"), "tabpanel")
    assert.equal(panel.getAttribute("aria-labelledby"), tab.id)
    assert.equal(panel.hidden, tab.getAttribute("aria-selected") !== "true")
  })

  const assertActiveTab = activeIndex => {
    const currentTabs = [...document.querySelectorAll(".rd-tabs .rd-tab")]
    currentTabs.forEach((tab, index) => {
      const active = index === activeIndex
      const panel = document.getElementById(tab.getAttribute("aria-controls"))
      assert.equal(tab.getAttribute("aria-selected"), String(active))
      assert.equal(tab.getAttribute("tabindex"), active ? "0" : "-1")
      assert.equal(panel.hidden, !active)
    })
  }

  assertActiveTab(0)
  tabs[0].focus()
  tabs[0].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
  assert.equal(document.activeElement, tabs[1])
  assertActiveTab(1)

  tabs[1].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "End", bubbles: true }))
  assert.equal(document.activeElement, tabs[2])
  assertActiveTab(2)

  tabs[2].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
  assert.equal(document.activeElement, tabs[0])
  assertActiveTab(0)

  tabs[0].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }))
  assert.equal(document.activeElement, tabs[2])
  assertActiveTab(2)

  tabs[2].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Home", bubbles: true }))
  assert.equal(document.activeElement, tabs[0])
  assertActiveTab(0)

  assert.equal(window.renderHome, undefined)
  assert.doesNotMatch(readerSource, /onclick=["']renderHome\(\)["']/)
  assert.match(readerSource, /data-reader-home/)
  assert.doesNotMatch(readerSource, /onclick=["']reimportRecent\(/)
  assert.doesNotMatch(readerSource, /data-reader-recent-id/)
  assert.match(readerSource, /data-reader-recent-index/)

  const recentButtons = [...document.querySelectorAll(".rd-recent-item")]
  assert.equal(recentButtons.length, cachedWorks.length)
  for (const [index, recent] of recentButtons.entries()) {
    assert.equal(recent.tagName, "BUTTON")
    assert.equal(recent.type, "button")
    assert.equal(recent.getAttribute("onclick"), null)
    assert.equal(recent.dataset.readerRecentIndex, String(index))
    recent.click()
    assert.equal(window.__readerInjected, undefined)
    assert.equal(document.querySelector(".rd-landing-title").textContent, cachedWorks[index].title)
    document.querySelector(".modal-overlay").remove()
  }

  document.getElementById("app").innerHTML = `
    <div class="drop-zone">
      <button type="button" class="drop-btn" data-reader-home>返回首页</button>
    </div>`
  document.querySelector("[data-reader-home]").click()

  assert.ok(document.querySelector(".rd-home"))
  assert.ok(document.querySelector("#tabImport"))

  for (let index = 0; index < 2; index += 1) {
    document.getElementById("app").innerHTML = `
      <button type="button" data-reader-home>再次返回</button>`
    document.querySelector("[data-reader-home]").click()
  }

  let reads = 0
  globalThis.FileReader = class {
    readAsText() { reads += 1 }
    readAsDataURL() { reads += 1 }
  }
  const outsideDrop = new dom.window.Event("drop", { bubbles: true, cancelable: true })
  Object.defineProperty(outsideDrop, "dataTransfer", {
    value: { files: [{ name: "work.json", size: 1 }] },
  })
  document.dispatchEvent(outsideDrop)

  assert.equal(outsideDrop.defaultPrevented, false)
  assert.equal(reads, 0)

  document.querySelector('.rd-tabs .rd-tab[data-tab="import"]').click()
  assert.equal(document.getElementById("tabImport").style.display, "block")
  assertActiveTab(2)
  const importDrop = new dom.window.Event("drop", { bubbles: true, cancelable: true })
  Object.defineProperty(importDrop, "dataTransfer", {
    value: { files: [{ name: "work.json", size: 1 }] },
  })
  document.getElementById("dropInner").dispatchEvent(importDrop)

  assert.equal(importDrop.defaultPrevented, true)
  assert.equal(reads, 1)
})
