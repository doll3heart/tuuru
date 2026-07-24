import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom() {
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
  return dom
}

function makePhoneData() {
  return {
    contacts: [{ id: "contact-1", name: "林澈", avatarUrl: "" }],
    chats: [],
    moments: [],
    forumPosts: [],
    forumNpcs: [],
    memos: [],
    photos: [{
      id: "photo-1",
      contactId: "contact-1",
      albumId: "album-1",
      caption: "旧照片",
      description: "旧照片",
      imageUrl: "https://example.com/old.png",
      time: "2026/7/23 08:00",
      customMetadata: { keep: true },
    }],
    albums: [{
      id: "album-1",
      contactId: "contact-1",
      name: "旧相册",
      coverPhotoId: null,
      time: "2026/7/23 07:50",
      customMetadata: { keep: true },
    }],
    browserHistory: [],
    shoppingItems: [],
    appConnections: {
      gallery: { contactId: "contact-1", prompt: "" },
    },
    skin: { readerId: "Reader" },
    apps: [{ id: "gallery-app", type: "gallery", name: "相册", enabled: true }],
  }
}

async function openGallery(id) {
  const dom = installDom()
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { openPhoneAppModal } = await import("../js/pages/phone.js")
  const draft = createPhoneWorkDraft({ id, type: "article", phoneData: makePhoneData() })
  const overlay = openPhoneAppModal(draft.id, "gallery")
  const continueButton = overlay.querySelector("#characterAccessContinue")
  assert.ok(continueButton)
  continueButton.click()
  return { dom, draft, overlay }
}

function closeFixture({ dom, draft }) {
  draft.dispose()
  dom.window.close()
}

test("existing photos reopen the photo form and keep stable data", async () => {
  const fixture = await openGallery("gallery-photo-reedit")
  const { draft, overlay } = fixture

  try {
    overlay.querySelector('[data-album-id="album-1"]').click()
    const edit = overlay.querySelector('[data-photo-edit="photo-1"]')
    assert.ok(edit, "existing photos need an edit affordance")
    edit.click()

    const editor = document.querySelector("#gpSave").closest(".modal-overlay")
    assert.equal(editor.querySelector("#gpDesc").value, "旧照片")
    assert.equal(editor.querySelector("#gpUrl").value, "https://example.com/old.png")
    assert.equal(editor.querySelector("#gpAlbum").value, "album-1")
    assert.equal(editor.querySelector("#gpTime").value, "2026/7/23 08:00")
    editor.querySelector("#gpDesc").value = "车站夜景"
    editor.querySelector("#gpUrl").value = "https://example.com/night.png"
    editor.querySelector("#gpTime").value = ""
    editor.querySelector("#gpSave").click()

    const photos = draft.snapshot().phoneData.photos
    assert.equal(photos.length, 1)
    assert.deepEqual(photos[0], {
      ...photos[0],
      id: "photo-1",
      caption: "车站夜景",
      description: "车站夜景",
      imageUrl: "https://example.com/night.png",
      albumId: "album-1",
      time: "",
      customMetadata: { keep: true },
    })
  } finally {
    closeFixture(fixture)
  }
})

test("existing albums can be renamed without recreating them", async () => {
  const fixture = await openGallery("gallery-album-reedit")
  const { draft, overlay } = fixture

  try {
    overlay.querySelector('[data-album-id="album-1"]').click()
    const edit = overlay.querySelector('[data-album-edit="album-1"]')
    assert.ok(edit, "album detail needs a rename affordance")
    edit.click()

    const editor = document.querySelector("#gaSave").closest(".modal-overlay")
    assert.equal(editor.querySelector("#gaName").value, "旧相册")
    editor.querySelector("#gaName").value = "夏日旅行"
    editor.querySelector("#gaSave").click()

    const albums = draft.snapshot().phoneData.albums
    assert.equal(albums.length, 1)
    assert.deepEqual(albums[0], {
      ...albums[0],
      id: "album-1",
      name: "夏日旅行",
      customMetadata: { keep: true },
    })
  } finally {
    closeFixture(fixture)
  }
})
