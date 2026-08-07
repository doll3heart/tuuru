import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

function articleWork(index) {
  return {
    schemaVersion:1,
    id:`library-work-${index}`,
    type:"article",
    title:`作品 ${String(index).padStart(2, "0")}`,
    author:index === 4 ? "特别作者" : `作者 ${index}`,
    nodes:[{
      id:"start",
      chapterId:"chapter-a",
      title:"初见",
      content:"<p>正文</p>",
      choices:[],
    }],
    chapters:[{ id:"chapter-a", name:"第一章" }],
    scenes:[],
    placeholders:[{
      id:"reader-name",
      key:"姓名",
      label:"姓名",
      prompt:"",
      default:"",
    }],
    phoneModules:[],
    startNode:"start",
  }
}

test("reader shelf tools filter, sort, manage storage, and bookmark article scenes", async t => {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url:"http://localhost/reader/",
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
  globalThis.Blob = dom.window.Blob
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  t.after(() => dom.window.close())

  const works = Array.from({ length:7 }, (_, index) => articleWork(index + 1))
  works.forEach((work, index) => {
    localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
    works[index].importedAt = 100 + index
  })
  localStorage.setItem("moirain_recent", JSON.stringify(works.map(work => ({
    id:work.id,
    title:work.title,
    type:work.type,
    importedAt:work.importedAt,
  }))))

  await import(`../reader/reader.js?reader-library-tools=${Date.now()}`)
  document.querySelector('.rd-tab[data-tab="library"]').click()

  const search = document.querySelector("[data-reader-shelf-search]")
  const sort = document.querySelector("[data-reader-shelf-sort]")
  assert.ok(search)
  assert.ok(sort)
  assert.equal(document.querySelectorAll(".rd-book-status").length, 7)
  assert.deepEqual(
    [...document.querySelectorAll(".rd-book-status")].map(node => node.textContent),
    Array(7).fill("未开始"),
  )

  search.value = "特别作者"
  search.dispatchEvent(new dom.window.Event("input", { bubbles:true }))
  assert.equal([...document.querySelectorAll(".rd-book")].filter(book => !book.hidden).length, 1)
  assert.match(
    [...document.querySelectorAll(".rd-book")].find(book => !book.hidden).textContent,
    /作品 04/,
  )

  search.value = ""
  search.dispatchEvent(new dom.window.Event("input", { bubbles:true }))
  sort.value = "title"
  sort.dispatchEvent(new dom.window.Event("change", { bubbles:true }))
  assert.equal(document.querySelector(".rd-book-meta strong").textContent, "作品 01")

  document.querySelector("[data-reader-book-manage]").click()
  assert.ok(document.querySelector("[data-reader-book-completion]"))
  assert.equal(document.querySelector("[data-reader-slot-manage]").getAttribute("aria-expanded"), "false")
  assert.equal(document.querySelector(".rd-reader-slot-manage").hidden, true)
  assert.match(document.querySelector(".rd-book-manager").textContent, /本地数据/)
  assert.equal(document.querySelector(".rd-reader-storage").open, false)
  assert.match(document.querySelector("[data-reader-cache-size]").textContent, /B|KB/)

  document.querySelector("[data-reader-book-clear-cache]").click()
  assert.equal(localStorage.getItem("moirain_work_library-work-1"), null)
  assert.ok(JSON.parse(localStorage.getItem("moirain_readerLibrary")).books.some(book => book.id === "library-work-1"))
  assert.match(document.querySelector(".rd-book-manager-status").textContent, /阅读记录和书签仍在/)
  assert.equal(document.querySelector('[data-reader-book-id="library-work-1"]'), null)
  assert.match(document.querySelector('[data-reader-book-recover="library-work-1"]').textContent, /重新导入《作品 01》/)

  document.querySelector("[data-reader-book-remove]").click()
  assert.equal(document.querySelector(".rd-book-remove-confirm").hidden, false)
  document.querySelector("[data-reader-book-remove-confirm]").click()
  assert.equal(JSON.parse(localStorage.getItem("moirain_readerLibrary")).books.some(book => book.id === "library-work-1"), false)
  assert.equal(document.querySelector("[data-reader-shelf-search]"), null)

  document.querySelector(".rd-book-cover").click()
  document.getElementById("rdStartBtn").click()
  const bookmark = document.querySelector("[data-reader-bookmark-current]")
  assert.ok(bookmark)
  assert.equal(bookmark.getAttribute("aria-pressed"), "false")
  bookmark.click()
  assert.equal(bookmark.getAttribute("aria-pressed"), "true")

  document.querySelector("[data-reader-home]").click()
  document.querySelector('.rd-tab[data-tab="library"]').click()
  document.querySelector("[data-reader-book-manage]").click()
  assert.match(document.querySelector(".rd-book-manager").textContent, /场景书签/)
  assert.match(document.querySelector(".rd-book-manager").textContent, /阅读记录/)
  assert.equal(document.querySelector(".rd-reader-record").open, false)
  assert.equal(document.querySelector(".rd-book-manager-state-label").textContent, "已完成")

  document.querySelector("[data-reader-slot-manage]").click()
  assert.equal(document.querySelector("[data-reader-slot-manage]").getAttribute("aria-expanded"), "true")
  assert.equal(document.querySelector(".rd-reader-slot-manage").hidden, false)
  document.querySelector("[data-reader-slot-create]").click()
  const newSlotName = document.querySelector("[data-reader-slot-new-name]")
  assert.equal(newSlotName.value, "")
  newSlotName.value = "第二周目"
  document.querySelector("[data-reader-slot-create-save]").click()
  assert.equal(document.querySelectorAll("[data-reader-slot-select] option").length, 2)
  assert.match(document.querySelector("[data-reader-slot-select]").selectedOptions[0].textContent, /第二周目/)

  const identitySelectForCreate = document.querySelector("[data-reader-identity-select]")
  identitySelectForCreate.value = "__new__"
  identitySelectForCreate.dispatchEvent(new dom.window.Event("change", { bubbles:true }))
  const identityName = document.querySelector("[data-reader-identity-name]")
  const identityValue = document.querySelector("[data-reader-identity-value]")
  assert.equal(identityName.value, "")
  assert.equal(identityValue.value, "")
  identityName.value = "夜间阅读"
  identityValue.value = "云枝"
  document.querySelector("[data-reader-identity-save]").click()
  assert.equal(document.querySelector("[data-reader-book-placeholder]").value, "云枝")
  assert.match(document.querySelector("[data-reader-identity-select]").textContent, /夜间阅读/)

  const slotSelect = document.querySelector("[data-reader-slot-select]")
  slotSelect.value = "reader-slot-default"
  slotSelect.dispatchEvent(new dom.window.Event("change", { bubbles:true }))
  document.querySelector("[data-reader-book-bookmark-edit]").click()
  const bookmarkEditor = document.querySelector("[data-reader-book-bookmark-editor]")
  assert.equal(bookmarkEditor.hidden, false)
  bookmarkEditor.querySelector("[data-reader-bookmark-label]").value = "伏笔位置"
  bookmarkEditor.querySelector("[data-reader-bookmark-note]").value = "下次从这里继续。"
  bookmarkEditor.querySelector("[data-reader-bookmark-edit-save]").click()
  assert.match(document.querySelector(".rd-book-manager").textContent, /伏笔位置/)
  assert.match(document.querySelector(".rd-book-manager").textContent, /下次从这里继续/)
  const topLevelHeadings = [...document.querySelectorAll(".rd-book-manager-section-head h3")]
    .map(heading => heading.textContent)
  assert.equal(topLevelHeadings.includes("阅读足迹"), false)
  assert.equal(topLevelHeadings.includes("已解锁回忆录"), false)
  assert.equal(topLevelHeadings.includes("周目路线对比"), false)
  assert.match(document.querySelector(".rd-reader-record").textContent, /互动目录/)
  assert.match(document.querySelector(".rd-reader-record").textContent, /路线差异/)
  assert.match(document.querySelector("[data-reader-route-comparison]").textContent, /没有可比较的不同选择/)
})

test("reader library tools keep restrained responsive controls", () => {
  assert.match(readerCss, /\.rd-bookshelf-tools\{[^}]*display:flex;/)
  assert.match(readerCss, /\.rd-book-meta \.rd-book-status\{[^}]*border-radius:999px;/)
  assert.match(readerCss, /\.reader-bookmark-btn:focus-visible\s*\{[^}]*outline:/)
  assert.match(
    readerCss,
    /@media \(max-width: 480px\)\s*\{[\s\S]*?\.rd-bookshelf-tools\{[^}]*flex-direction:column/,
  )
  assert.match(readerCss, /\.rd-reader-slot-toolbar,\.rd-reader-identity-toolbar\{[^}]*display:flex;/)
  assert.match(readerCss, /\.rd-route-compare-controls\{[^}]*grid-template-columns:1fr 1fr;/)
  assert.match(
    readerCss,
    /@media \(max-width: 480px\)\s*\{[\s\S]*?\.rd-route-compare-controls\{[^}]*grid-template-columns:1fr/,
  )
})
