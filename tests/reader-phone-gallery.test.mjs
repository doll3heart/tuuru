import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const readerCss = readFileSync(new URL("../reader/reader.css", import.meta.url), "utf8")

function ruleBodiesFor(selector) {
  const bodies = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match
  while ((match = pattern.exec(readerCss))) {
    const selectors = match[1].split(",").map(value => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }
  return bodies.join("\n")
}

function installDom(t) {
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
  globalThis.alert = () => {}
  t.after(() => dom.window.close())
  return dom
}

function seedRecentWork(work) {
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id,
    title: work.title,
    type: work.type,
    importedAt: Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
}

function galleryPhoneWork(id) {
  return {
    schemaVersion: 1,
    id,
    type: "phone",
    title: "Styled gallery",
    placeholders: [],
    scenes: [],
    phoneData: {
      contacts: [],
      chats: [],
      moments: [],
      forumPosts: [],
      forumNpcs: [],
      memos: [],
      photos: [{ id: "photo-a", albumId: null, caption: "Styled photo", imageUrl: "" }],
      albums: [],
      browserHistory: [],
      shoppingItems: [],
      skin: { readerId: "Reader", showDynamicIsland: false, showHomeIndicator: false },
      apps: [{
        id: "gallery-app",
        type: "gallery",
        name: "Gallery",
        icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>',
        color: "#f0f0f0",
        desktopX: 0,
        desktopY: 0,
        enabled: true,
      }],
    },
  }
}

test("reader gallery applies bounded runtime style settings", async t => {
  installDom(t)
  const work = galleryPhoneWork("reader-gallery-runtime-style")
  seedRecentWork(work)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    appSettings: { gallery: { columns: 2, imageRadius: 0, gap: 14 } },
  }))

  await import(`../reader/reader.js?reader-gallery-runtime-style=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="gallery"]').click()

  let grid = document.querySelector(".rd-gallery-grid")
  assert.equal(grid.style.getPropertyValue("--rd-gallery-columns"), "2")
  assert.equal(grid.style.getPropertyValue("--rd-gallery-radius"), "0px")
  assert.equal(grid.style.getPropertyValue("--rd-gallery-gap"), "14px")

  document.querySelector(".rd-back-btn").click()
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    appSettings: {
      gallery: {
        columns: '4";outline:999px solid red" data-forged="yes',
        imageRadius: null,
        gap: -999,
      },
    },
  }))
  document.querySelector('[data-app-type="gallery"]').click()

  grid = document.querySelector(".rd-gallery-grid")
  assert.equal(grid.style.getPropertyValue("--rd-gallery-columns"), "3")
  assert.equal(grid.style.getPropertyValue("--rd-gallery-radius"), "4px")
  assert.equal(grid.style.getPropertyValue("--rd-gallery-gap"), "6px")
  assert.deepEqual(
    Array.from({ length: grid.style.length }, (_, index) => grid.style.item(index)).sort(),
    ["--rd-gallery-columns", "--rd-gallery-gap", "--rd-gallery-radius"].sort(),
  )
  assert.equal(document.querySelector("[data-forged]"), null)
})

test("gallery styling preserves zero radius through preview and save", async t => {
  installDom(t)

  await import(`../reader/reader.js?reader-gallery-zero-style=${Date.now()}`)
  document.querySelector('[data-tab="custom"]').click()
  document.querySelector('.rd-app-icon[data-app="gallery"]').click()

  const radius = document.getElementById("cuImgRadius")
  radius.value = "0"
  radius.dispatchEvent(new Event("input", { bubbles: true }))

  const previewGrid = document.querySelector(".reader-app-preview-scope .rd-gallery-grid")
  assert.equal(previewGrid.style.getPropertyValue("--rd-gallery-radius"), "0px")
  assert.ok(previewGrid.querySelector(".rd-gallery-photo"))

  document.getElementById("cuModalSave").click()
  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.equal(saved.appSettings.gallery.imageRadius, 0)
})

test("gallery settings normalize corrupted values before rendering controls", async t => {
  installDom(t)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    appSettings: {
      gallery: {
        columns: 9,
        imageRadius: '0" data-forged="yes',
        gap: -1,
      },
    },
  }))

  await import(`../reader/reader.js?reader-gallery-corrupt-style=${Date.now()}`)
  document.querySelector('[data-tab="custom"]').click()
  document.querySelector('.rd-app-icon[data-app="gallery"]').click()

  assert.equal(document.querySelector("[data-forged]"), null)
  assert.equal(document.getElementById("cuImgRadius").value, "4")
  assert.equal(document.getElementById("cuGap").value, "6")
  assert.equal(
    document.querySelector('.cu-style-btn.active[data-cu-gallery-cols]')?.dataset.cuGalleryCols,
    "3",
  )

  document.getElementById("cuModalSave").click()
  const saved = JSON.parse(localStorage.getItem("moirain_phoneCustom"))
  assert.deepEqual(saved.appSettings.gallery, { columns: 3, imageRadius: 4, gap: 6, customCss: "" })
})

test("reader gallery CSS consumes runtime style variables", () => {
  const grid = ruleBodiesFor(".rd-gallery-grid")
  const photo = ruleBodiesFor(".rd-gallery-photo")

  assert.match(grid, /repeat\(var\(--rd-gallery-columns,\s*3\),\s*minmax\(0,\s*1fr\)\)/)
  assert.match(grid, /gap\s*:\s*var\(--rd-gallery-gap,\s*6px\)/)
  assert.match(photo, /border-radius\s*:\s*var\(--rd-gallery-radius,\s*4px\)/)
})

test("article gallery modules preserve their authored character connection in the reader overlay", async t => {
  installDom(t)
  const work = {
    schemaVersion: 1,
    id: "article-gallery-albums",
    type: "article",
    title: "Gallery article",
    author: "Author",
    nodes: [{
      id: "node-a",
      title: "Start",
      content: '<div class="pm-inline-card" data-pm-id="gallery-module" data-pm-type="gallery"><span>Gallery</span></div>',
      choices: [],
    }],
    chapters: [],
    scenes: [],
    placeholders: [],
    phoneModules: [{
      id: "gallery-module",
      type: "gallery",
      nodeId: "node-a",
      data: {
        contacts: [
          { id: "contact-a", name: "Alice" },
          { id: "contact-b", name: "Bob" },
        ],
        photos: [],
        albums: [
          { id: "album-a", contactId: "contact-a", name: "Alice album" },
          { id: "album-b", contactId: "contact-b", name: "Bob summer album" },
        ],
        appConnections: {
          gallery: { contactId: "contact-b", prompt: "Bob wants to show you this album." },
        },
      },
    }],
    startNode: "node-a",
  }
  seedRecentWork(work)

  await import(`../reader/reader.js?reader-gallery-albums=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector(".rd-pm-trigger").click()

  const gate = document.querySelector(".rd-connection-gate")
  assert.ok(gate)
  assert.equal(document.querySelector('.phone-app-icon'), null)
  assert.match(gate.textContent, /Bob/)
  assert.match(gate.textContent, /Bob wants to show you this album\./)
  assert.doesNotMatch(gate.textContent, /Bob summer album/)
  gate.querySelector('[data-connection-action="confirm"]').click()

  const album = document.querySelector(".rd-album")
  assert.ok(album)
  assert.match(album.textContent, /Bob summer album/)
  assert.doesNotMatch(document.querySelector(".phone-frame").textContent, /Alice album/)
  assert.match(document.querySelector(".rd-phone-app-header").textContent, /Bob ·/)
  assert.equal(document.querySelector(".rd-contact-source"), null)
})

test("standalone gallery albums support drill-down, recovery, and focus continuity", async t => {
  installDom(t)
  const albumId = 'album-1" autofocus data-forged="yes'
  const work = {
    schemaVersion: 1,
    id: "standalone-gallery-albums",
    type: "phone",
    title: "Gallery phone",
    placeholders: [],
    scenes: [],
    phoneData: {
      contacts: [{ id: "contact-a", name: "Alice" }],
      chats: [],
      moments: [],
      forumPosts: [],
      forumNpcs: [],
      memos: [],
      photos: [
        { id: "photo-loose", contactId: "contact-a", albumId: null, caption: "Loose photo", imageUrl: "" },
        { id: "photo-grouped", contactId: "contact-a", albumId, caption: "Grouped photo", imageUrl: "" },
        { id: "photo-orphan", contactId: "contact-a", albumId: "missing-album", caption: "Recovered orphan", imageUrl: "" },
      ],
      albums: [
        { id: albumId, contactId: "contact-a", name: "Trip album" },
        { id: "empty-album", contactId: "contact-a", name: "Empty album" },
      ],
      browserHistory: [],
      shoppingItems: [],
      skin: { readerId: "Reader", showDynamicIsland: false, showHomeIndicator: false },
      apps: [{
        id: "gallery-app",
        type: "gallery",
        name: "Gallery",
        icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>',
        color: "#f0f0f0",
        desktopX: 0,
        desktopY: 0,
        enabled: true,
      }],
    },
  }
  seedRecentWork(work)

  await import(`../reader/reader.js?reader-gallery-navigation=${Date.now()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="gallery"]').click()
  document.querySelector('[data-connection-action="confirm"]').click()

  const album = document.querySelector(".rd-album")
  assert.equal(album.tagName, "BUTTON")
  assert.equal(album.type, "button")
  assert.equal(album.dataset.albumIndex, "0")
  assert.equal(album.getAttribute("data-album-id"), null)
  assert.ok(album.getAttribute("aria-label")?.includes("Trip album"))
  assert.equal(document.querySelector("[data-forged]"), null)
  assert.match(document.querySelector(".cu-body").textContent, /Loose photo/)
  assert.match(document.querySelector(".cu-body").textContent, /Recovered orphan/)
  assert.doesNotMatch(document.querySelector(".cu-body").textContent, /Grouped photo/)

  album.focus()
  album.click()

  const albumBack = document.querySelector(".rd-gallery-album-back")
  assert.equal(albumBack?.tagName, "BUTTON")
  assert.equal(document.activeElement, albumBack)
  assert.match(document.querySelector(".cu-body").textContent, /Grouped photo/)
  assert.doesNotMatch(document.querySelector(".cu-body").textContent, /Loose photo|Recovered orphan/)

  albumBack.click()
  const restoredAlbum = document.querySelector('.rd-album[data-album-index="0"]')
  assert.equal(document.activeElement, restoredAlbum)
  assert.match(document.querySelector(".cu-body").textContent, /Empty album/)

  document.querySelector('.rd-album[data-album-index="1"]').click()
  assert.match(document.querySelector(".cu-body").textContent, /还没有照片/)
  assert.equal(document.activeElement, document.querySelector(".rd-gallery-album-back"))

  document.querySelector(".rd-back-btn").click()
  assert.ok(document.getElementById("phoneDesktopReader"))
  assert.equal(document.activeElement?.dataset.appType, "gallery")
})

test("reader gallery navigation exposes touch-sized controls and visible focus", () => {
  const album = ruleBodiesFor(".rd-album")
  const albumFocus = ruleBodiesFor(".rd-album:focus-visible")
  const back = ruleBodiesFor(".rd-gallery-album-back")
  const backFocus = ruleBodiesFor(".rd-gallery-album-back:focus-visible")

  assert.match(album, /min-height\s*:\s*(?:44|[5-9]\d|[1-9]\d{2,})px/)
  assert.match(album, /appearance\s*:\s*none/)
  assert.match(albumFocus, /outline\s*:/)
  assert.match(back, /min-height\s*:\s*44px/)
  assert.match(backFocus, /outline\s*:/)
})
