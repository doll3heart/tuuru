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

test("App arrangement uses an icon-scoped Pointer Events contract", () => {
  const iconRules = ruleBodiesFor(cssWithoutComments, ".phone-app-icon")
  const desktopRules = ruleBodiesFor(cssWithoutComments, ".phone-desktop")
  const dragSection = phoneSource.match(
    /\/\/ ===== Drag-to-reorder =====([\s\S]*?)\/\/ ===== App click handler =====/,
  )
  assert.ok(dragSection)
  const dragSource = dragSection[1]

  assert.match(dragSource, /rememberPhoneIconDragHandler\(icon,\s*['"]pointerdown['"]/)
  assert.match(dragSource, /setPointerCapture/)
  assert.match(dragSource, /releasePointerCapture/)
  assert.match(dragSource, /pointercancel/)
  assert.match(dragSource, /lostpointercapture/)
  assert.doesNotMatch(dragSource, /addEventListener\(['"]mousedown['"]/)
  assert.doesNotMatch(dragSource, /document\.addEventListener\(['"]mousemove['"]/)
  assert.doesNotMatch(dragSource, /document\.addEventListener\(['"]mouseup['"]/)
  assert.match(iconRules, /touch-action\s*:\s*none/)
  assert.doesNotMatch(desktopRules, /touch-action\s*:\s*none/)
})

test("phone icon pointer gestures preserve tap, drag, cancel, and cleanup semantics", async t => {
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

  const originalNow = Date.now
  let clock = 1_000
  let phoneWorkUpdateCalls = 0
  Date.now = () => {
    clock += 1
    if (new Error().stack?.includes("updatePhoneWork")) phoneWorkUpdateCalls += 1
    return clock
  }
  t.after(() => {
    Date.now = originalNow
    dom.window.close()
  })

  const { PHONE_APP_DEFS, DEFAULT_PHONE_SKIN } = await import("../js/data.js")
  const { createPhoneWorkDraft } = await import("../js/phone-work-access.js")
  const { getPhoneGridPosition } = await import("../js/phone-grid.js")
  const { renderPhoneEditor } = await import("../js/pages/phone.js")

  const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

  function makeWork(id) {
    const positions = [
      [0, 0], [1, 0], [2, 0], [3, 0],
      [0, 1], [1, 1], [2, 1], [3, 1],
    ]
    const apps = Object.entries(PHONE_APP_DEFS)
      .filter(([type]) => !["customize", "profile"].includes(type))
      .map(([type, definition], index) => ({
        id: `${id}-${type}`,
        type,
        name: definition.label,
        icon: definition.icon,
        color: definition.color,
        desktopX: positions[index][0],
        desktopY: positions[index][1],
        enabled: true,
      }))

    return {
      id,
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
        skin: { ...DEFAULT_PHONE_SKIN },
        apps,
      },
    }
  }

  function pointerEvent(type, {
    pointerId = 1,
    isPrimary = true,
    pointerType = "touch",
    clientX = 0,
    clientY = 0,
    button = 0,
    buttons = type === "pointerup" ? 0 : 1,
  } = {}) {
    const event = new dom.window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      button,
      buttons,
    })
    Object.defineProperties(event, {
      pointerId: { value: pointerId },
      isPrimary: { value: isPrimary },
      pointerType: { value: pointerType },
    })
    return event
  }

  function installPointerCapture(icon) {
    let capturedPointer = null
    icon.setPointerCapture = pointerId => { capturedPointer = pointerId }
    icon.hasPointerCapture = pointerId => capturedPointer === pointerId
    icon.releasePointerCapture = pointerId => {
      if (capturedPointer !== pointerId) return
      capturedPointer = null
      icon.dispatchEvent(pointerEvent("lostpointercapture", { pointerId }))
    }
    return () => capturedPointer
  }

  async function mount(id) {
    const draft = createPhoneWorkDraft(makeWork(id))
    const root = document.getElementById("app")
    root.innerHTML = renderPhoneEditor(draft.id)
    await delay(70)

    const desktop = document.getElementById("phoneDesktop")
    desktop.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 314, bottom: 500,
      width: 314, height: 500,
    })

    const captures = new Map()
    desktop.querySelectorAll(".phone-app-icon").forEach(icon => {
      icon.getBoundingClientRect = () => {
        const position = getPhoneGridPosition(
          314,
          Number(icon.dataset.desktopX),
          Number(icon.dataset.desktopY),
        )
        return {
          x: position.left,
          y: position.top,
          left: position.left,
          top: position.top,
          right: position.left + 72,
          bottom: position.top + 72,
          width: 72,
          height: 72,
        }
      }
      captures.set(icon, installPointerCapture(icon))
    })

    return { draft, root, desktop, captures }
  }

  function dispatchGesture(icon, events) {
    for (const [type, options] of events) {
      icon.dispatchEvent(pointerEvent(type, options))
    }
  }

  await t.test("a tap and below-threshold movement open the App without writing", async () => {
    const { draft, desktop, captures } = await mount("pointer-tap")
    const icon = desktop.querySelector('[data-app-type="settings"]')
    const before = draft.snapshot()
    const updatesBefore = phoneWorkUpdateCalls

    dispatchGesture(icon, [
      ["pointerdown", { clientX: 11, clientY: 46 }],
      ["pointermove", { clientX: 15, clientY: 50 }],
      ["pointerup", { clientX: 15, clientY: 50 }],
    ])

    assert.equal(captures.get(icon)(), null)
    assert.deepEqual(draft.snapshot(), before)
    assert.equal(phoneWorkUpdateCalls, updatesBefore)

    icon.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }))
    assert.ok(document.getElementById("settingsPanel"))
    draft.dispose()
  })

  await t.test("a drag swaps a collision once and suppresses only its own click", async () => {
    const { draft, desktop } = await mount("pointer-drag")
    const dragged = desktop.querySelector('[data-app-type="settings"]')
    const other = desktop.querySelector('[data-app-type="messages"]')
    const updatesBefore = phoneWorkUpdateCalls

    dispatchGesture(dragged, [
      ["pointerdown", { pointerId: 7, clientX: 11, clientY: 46 }],
      ["pointermove", { pointerId: 7, clientX: 91, clientY: 46 }],
      ["pointerup", { pointerId: 7, clientX: 91, clientY: 46 }],
    ])

    const snapshot = draft.snapshot()
    const settings = snapshot.phoneData.apps.find(app => app.type === "settings")
    const messages = snapshot.phoneData.apps.find(app => app.type === "messages")
    assert.deepEqual([settings.desktopX, settings.desktopY], [1, 0])
    assert.deepEqual([messages.desktopX, messages.desktopY], [0, 0])
    assert.equal(phoneWorkUpdateCalls, updatesBefore + 1)
    assert.equal(dragged.style.left, "")
    assert.equal(dragged.style.top, "")
    assert.equal(dragged.style.getPropertyValue("--phone-grid-x"), "80px")

    await delay(10)
    dragged.dispatchEvent(new dom.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      detail: 1,
    }))
    assert.equal(document.getElementById("settingsPanel"), null)

    other.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }))
    assert.ok(document.getElementById("msgPanel"))
    draft.dispose()
  })

  await t.test("dragging inside a scrolled desktop preserves content coordinates", async () => {
    const { draft, desktop } = await mount("pointer-scroll-drag")
    const dragged = desktop.querySelector('[data-app-type="gallery"]')
    desktop.scrollTop = 95

    dragged.getBoundingClientRect = () => {
      const position = getPhoneGridPosition(
        314,
        Number(dragged.dataset.desktopX),
        Number(dragged.dataset.desktopY),
      )
      const top = position.top - desktop.scrollTop
      return {
        x: position.left,
        y: top,
        left: position.left,
        top,
        right: position.left + 72,
        bottom: top + 72,
        width: 72,
        height: 72,
      }
    }

    dispatchGesture(dragged, [
      ["pointerdown", { pointerId: 8, clientX: 11, clientY: 46 }],
      ["pointermove", { pointerId: 8, clientX: 11, clientY: 141 }],
      ["pointerup", { pointerId: 8, clientX: 11, clientY: 141 }],
    ])

    const snapshot = draft.snapshot()
    const gallery = snapshot.phoneData.apps.find(app => app.type === "gallery")
    const settings = snapshot.phoneData.apps.find(app => app.type === "settings")
    assert.deepEqual([gallery.desktopX, gallery.desktopY], [0, 2])
    assert.deepEqual([settings.desktopX, settings.desktopY], [0, 0])
    assert.equal(snapshot.phoneData.apps.some(app => app.desktopX === 0 && app.desktopY === 1), false)
    draft.dispose()
  })

  await t.test("dragging follows scroll changes that happen after pointerdown", async () => {
    const { draft, desktop } = await mount("pointer-live-scroll-drag")
    const dragged = desktop.querySelector('[data-app-type="gallery"]')

    dispatchGesture(dragged, [
      ["pointerdown", { pointerId: 18, clientX: 11, clientY: 141 }],
      ["pointermove", { pointerId: 18, clientX: 11, clientY: 151 }],
    ])
    desktop.scrollTop = 95
    dispatchGesture(dragged, [
      ["pointermove", { pointerId: 18, clientX: 11, clientY: 151 }],
      ["pointerup", { pointerId: 18, clientX: 11, clientY: 151 }],
    ])

    const snapshot = draft.snapshot()
    const gallery = snapshot.phoneData.apps.find(app => app.type === "gallery")
    const settings = snapshot.phoneData.apps.find(app => app.type === "settings")
    assert.deepEqual([gallery.desktopX, gallery.desktopY], [0, 2])
    assert.deepEqual([settings.desktopX, settings.desktopY], [0, 0])
    assert.equal(snapshot.phoneData.apps.some(app => app.desktopX === 0 && app.desktopY === 1), false)
    draft.dispose()
  })

  await t.test("bounded touch layouts scroll normally until arrangement mode is enabled", async () => {
    const previousMatchMedia = window.matchMedia
    const mediaListeners = new Set()
    const boundedMedia = {
      matches: true,
      media: "(max-width: 480px), (max-height: 480px) and (pointer: coarse)",
      addEventListener(type, listener) { if (type === "change") mediaListeners.add(listener) },
      removeEventListener(type, listener) { if (type === "change") mediaListeners.delete(listener) },
      emit() {
        for (const listener of [...mediaListeners]) listener({ matches: this.matches, media: this.media })
      },
    }
    window.matchMedia = query => {
      assert.equal(query, boundedMedia.media)
      return boundedMedia
    }

    try {
      const { draft, desktop, captures } = await mount("pointer-arrange-mode")
      const toggle = document.querySelector(".phone-arrange-toggle")
      const dragged = desktop.querySelector('[data-app-type="settings"]')
      const other = desktop.querySelector('[data-app-type="forum"]')
      const before = draft.snapshot()
      const updatesBefore = phoneWorkUpdateCalls

      for (const [index, pointerType] of ["touch", "pen", "mouse"].entries()) {
        const pointerId = 28 + index
        dispatchGesture(dragged, [
          ["pointerdown", { pointerId, pointerType, clientX: 11, clientY: 46 }],
          ["pointermove", { pointerId, pointerType, clientX: 91, clientY: 46 }],
          ["pointerup", { pointerId, pointerType, clientX: 91, clientY: 46 }],
        ])
        assert.equal(captures.get(dragged)(), null, pointerType)
      }
      assert.deepEqual(draft.snapshot(), before)
      assert.equal(phoneWorkUpdateCalls, updatesBefore)

      toggle.click()
      assert.equal(toggle.getAttribute("aria-pressed"), "true")
      assert.equal(toggle.closest(".phone-editor-wrap").dataset.phoneArrangeMode, "true")

      dispatchGesture(dragged, [
        ["pointerdown", { pointerId: 39, clientX: 11, clientY: 46 }],
        ["pointermove", { pointerId: 39, clientX: 91, clientY: 46 }],
        ["pointerup", { pointerId: 39, clientX: 91, clientY: 46 }],
      ])
      const arranged = draft.snapshot().phoneData.apps.find(app => app.type === "settings")
      assert.deepEqual([arranged.desktopX, arranged.desktopY], [1, 0])
      assert.equal(phoneWorkUpdateCalls, updatesBefore + 1)

      other.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }))
      assert.equal(document.getElementById("forumPanel"), null)

      toggle.click()
      assert.equal(toggle.getAttribute("aria-pressed"), "false")
      assert.equal(toggle.closest(".phone-editor-wrap").dataset.phoneArrangeMode, "false")

      toggle.click()
      assert.equal(toggle.getAttribute("aria-pressed"), "true")
      boundedMedia.matches = false
      boundedMedia.emit()
      assert.equal(toggle.getAttribute("aria-pressed"), "false")
      assert.equal(toggle.closest(".phone-editor-wrap").dataset.phoneArrangeMode, "false")

      dragged.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }))
      assert.ok(document.getElementById("settingsPanel"))
      draft.dispose()
    } finally {
      window.matchMedia = previousMatchMedia
    }
  })

  await t.test("arrangement mode supports keyboard grid moves and Escape", async () => {
    const { draft, desktop } = await mount("keyboard-arrange-mode")
    const toggle = document.querySelector(".phone-arrange-toggle")
    const instructions = document.querySelector(".phone-arrange-instructions")
    const status = document.querySelector(".phone-arrange-status")
    const icon = desktop.querySelector('[data-app-type="settings"]')
    const other = desktop.querySelector('[data-app-type="messages"]')
    const updatesBefore = phoneWorkUpdateCalls

    toggle.click()
    assert.equal(icon.getAttribute("aria-describedby"), "phoneArrangeInstructions")
    assert.match(instructions.textContent, /方向键/)

    const toggleEscape = new dom.window.KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
    toggle.dispatchEvent(toggleEscape)
    assert.equal(toggleEscape.defaultPrevented, true)
    assert.equal(toggle.getAttribute("aria-pressed"), "false")
    assert.equal(document.activeElement, toggle)

    toggle.click()
    icon.focus()
    const move = new dom.window.KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    })
    icon.dispatchEvent(move)

    const snapshot = draft.snapshot()
    const settings = snapshot.phoneData.apps.find(app => app.type === "settings")
    const messages = snapshot.phoneData.apps.find(app => app.type === "messages")
    assert.equal(move.defaultPrevented, true)
    assert.deepEqual([settings.desktopX, settings.desktopY], [1, 0])
    assert.deepEqual([messages.desktopX, messages.desktopY], [0, 0])
    assert.equal(phoneWorkUpdateCalls, updatesBefore + 1)
    assert.match(status.textContent, /第1行第2列/)
    assert.match(status.textContent, /交换位置/)
    assert.match(instructions.textContent, /方向键/)
    assert.doesNotMatch(instructions.textContent, /第1行第2列/)
    assert.equal(other.getAttribute("aria-describedby"), "phoneArrangeInstructions")
    assert.equal(document.activeElement, icon)

    const boundary = new dom.window.KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    })
    icon.dispatchEvent(boundary)
    assert.equal(boundary.defaultPrevented, true)
    assert.equal(phoneWorkUpdateCalls, updatesBefore + 1)

    const escape = new dom.window.KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
    icon.dispatchEvent(escape)
    assert.equal(escape.defaultPrevented, true)
    assert.equal(toggle.getAttribute("aria-pressed"), "false")
    assert.equal(document.activeElement, toggle)
    draft.dispose()
  })

  await t.test("arrangement mode offers touch-sized non-drag movement controls", async () => {
    const { draft, desktop } = await mount("touch-arrange-controls")
    const toggle = document.querySelector(".phone-arrange-toggle")
    const status = document.querySelector(".phone-arrange-status")
    const icon = desktop.querySelector('[data-app-type="settings"]')
    const other = desktop.querySelector('[data-app-type="messages"]')
    const left = document.querySelector('[data-phone-move="left"]')
    const right = document.querySelector('[data-phone-move="right"]')
    const up = document.querySelector('[data-phone-move="up"]')
    const down = document.querySelector('[data-phone-move="down"]')
    const updatesBefore = phoneWorkUpdateCalls

    assert.equal(left.disabled, true)
    assert.equal(right.disabled, true)
    toggle.click()
    icon.click()

    assert.equal(icon.getAttribute("aria-pressed"), "true")
    assert.equal(other.getAttribute("aria-pressed"), "false")
    assert.equal(left.disabled, true)
    assert.equal(up.disabled, true)
    assert.equal(right.disabled, false)
    assert.equal(down.disabled, false)

    right.click()
    const snapshot = draft.snapshot()
    const settings = snapshot.phoneData.apps.find(app => app.type === "settings")
    const messages = snapshot.phoneData.apps.find(app => app.type === "messages")
    assert.deepEqual([settings.desktopX, settings.desktopY], [1, 0])
    assert.deepEqual([messages.desktopX, messages.desktopY], [0, 0])
    assert.equal(phoneWorkUpdateCalls, updatesBefore + 1)
    assert.match(status.textContent, /第1行第2列/)
    assert.equal(icon.getAttribute("aria-pressed"), "true")
    assert.equal(left.disabled, false)

    const scrollCalls = []
    icon.scrollIntoView = options => scrollCalls.push(options)
    down.click()
    down.click()
    down.click()
    down.click()
    const movedToLastRow = draft.snapshot().phoneData.apps.find(app => app.type === "settings")
    assert.deepEqual([movedToLastRow.desktopX, movedToLastRow.desktopY], [1, 3])
    assert.equal(phoneWorkUpdateCalls, updatesBefore + 4)
    assert.equal(down.disabled, true)
    assert.deepEqual(scrollCalls, [
      { block: "nearest", inline: "nearest" },
      { block: "nearest", inline: "nearest" },
      { block: "nearest", inline: "nearest" },
    ])

    other.click()
    assert.equal(icon.getAttribute("aria-pressed"), "false")
    assert.equal(other.getAttribute("aria-pressed"), "true")
    draft.dispose()
  })

  await t.test("pointer rearrangement refreshes controls for selected and displaced Apps", async () => {
    const { draft, desktop } = await mount("arrange-controls-after-drag")
    const toggle = document.querySelector(".phone-arrange-toggle")
    const selected = desktop.querySelector('[data-app-type="settings"]')
    const dragged = desktop.querySelector('[data-app-type="gallery"]')
    const left = document.querySelector('[data-phone-move="left"]')
    const right = document.querySelector('[data-phone-move="right"]')
    const up = document.querySelector('[data-phone-move="up"]')
    const down = document.querySelector('[data-phone-move="down"]')
    const status = document.querySelector(".phone-arrange-status")
    const updatesBefore = phoneWorkUpdateCalls

    toggle.click()
    selected.click()
    dispatchGesture(selected, [
      ["pointerdown", { pointerId: 49, clientX: 11, clientY: 46 }],
      ["pointermove", { pointerId: 49, clientX: 251, clientY: 331 }],
      ["pointerup", { pointerId: 49, clientX: 251, clientY: 331 }],
    ])
    assert.equal(left.disabled, false)
    assert.equal(up.disabled, false)
    assert.equal(right.disabled, true)
    assert.equal(down.disabled, true)

    dispatchGesture(dragged, [
      ["pointerdown", { pointerId: 50, clientX: 11, clientY: 141 }],
      ["pointermove", { pointerId: 50, clientX: 251, clientY: 331 }],
      ["pointerup", { pointerId: 50, clientX: 251, clientY: 331 }],
    ])
    const settings = draft.snapshot().phoneData.apps.find(app => app.type === "settings")
    assert.deepEqual([settings.desktopX, settings.desktopY], [0, 1])
    assert.equal(left.disabled, true)
    assert.equal(up.disabled, false)
    assert.equal(right.disabled, false)
    assert.equal(down.disabled, false)
    assert.match(status.textContent, /第2行第1列/)
    assert.match(status.textContent, /交换位置/)
    assert.equal(phoneWorkUpdateCalls, updatesBefore + 2)
    draft.dispose()
  })

  await t.test("pointerup consumes a coalesced final position before deciding tap or drag", async () => {
    const { draft, desktop } = await mount("pointer-fast-release")
    const icon = desktop.querySelector('[data-app-type="settings"]')
    const updatesBefore = phoneWorkUpdateCalls

    dispatchGesture(icon, [
      ["pointerdown", { pointerId: 9, clientX: 11, clientY: 46 }],
      ["pointerup", { pointerId: 9, clientX: 91, clientY: 46 }],
    ])

    const snapshot = draft.snapshot()
    const settings = snapshot.phoneData.apps.find(app => app.type === "settings")
    const messages = snapshot.phoneData.apps.find(app => app.type === "messages")
    assert.deepEqual([settings.desktopX, settings.desktopY], [1, 0])
    assert.deepEqual([messages.desktopX, messages.desktopY], [0, 0])
    assert.equal(phoneWorkUpdateCalls, updatesBefore + 1)

    await delay(10)
    icon.dispatchEvent(new dom.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      detail: 1,
    }))
    assert.equal(document.getElementById("settingsPanel"), null)
    draft.dispose()
  })

  await t.test("a keyboard-style click bypasses a stale pointer suppression token", async () => {
    const { draft, desktop } = await mount("pointer-keyboard-click")
    const icon = desktop.querySelector('[data-app-type="settings"]')

    dispatchGesture(icon, [
      ["pointerdown", { pointerId: 10, clientX: 11, clientY: 46 }],
      ["pointermove", { pointerId: 10, clientX: 91, clientY: 46 }],
      ["pointerup", { pointerId: 10, clientX: 91, clientY: 46 }],
    ])

    await delay(10)
    icon.dispatchEvent(new dom.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      detail: 0,
    }))

    assert.ok(document.getElementById("settingsPanel"))
    draft.dispose()
  })

  await t.test("pointer cancellation and capture loss restore the original position without writing", async () => {
    for (const terminalEvent of ["pointercancel", "lostpointercapture"]) {
      const { draft, desktop } = await mount(`pointer-${terminalEvent}`)
      const icon = desktop.querySelector('[data-app-type="settings"]')
      const before = draft.snapshot()
      const updatesBefore = phoneWorkUpdateCalls

      dispatchGesture(icon, [
        ["pointerdown", { pointerId: 11, clientX: 11, clientY: 46 }],
        ["pointermove", { pointerId: 11, clientX: 91, clientY: 46 }],
        [terminalEvent, { pointerId: 11, clientX: 91, clientY: 46 }],
      ])

      assert.deepEqual(draft.snapshot(), before)
      assert.equal(phoneWorkUpdateCalls, updatesBefore)
      assert.equal(icon.style.left, "")
      assert.equal(icon.style.top, "")
      assert.equal(icon.style.getPropertyValue("--phone-grid-x"), "0px")
      assert.equal(icon.style.getPropertyValue("--phone-grid-y"), "36px")
      assert.equal(icon.classList.contains("dragging"), false)
      draft.dispose()
    }
  })

  await t.test("window blur cancels a drag and a late pointerup cannot commit it", async () => {
    const { draft, desktop } = await mount("pointer-blur")
    const icon = desktop.querySelector('[data-app-type="settings"]')
    const before = draft.snapshot()
    const updatesBefore = phoneWorkUpdateCalls

    dispatchGesture(icon, [
      ["pointerdown", { pointerId: 17, clientX: 11, clientY: 46 }],
      ["pointermove", { pointerId: 17, clientX: 91, clientY: 46 }],
    ])
    window.dispatchEvent(new dom.window.Event("blur"))
    icon.dispatchEvent(pointerEvent("pointerup", {
      pointerId: 17,
      clientX: 91,
      clientY: 46,
    }))

    assert.deepEqual(draft.snapshot(), before)
    assert.equal(phoneWorkUpdateCalls, updatesBefore)
    assert.equal(icon.style.left, "")
    assert.equal(icon.style.top, "")
    assert.equal(icon.classList.contains("dragging"), false)
    draft.dispose()
  })

  await t.test("a previous snap timer cannot clear a new drag", async () => {
    const { draft, desktop } = await mount("pointer-repeat")
    const icon = desktop.querySelector('[data-app-type="settings"]')

    dispatchGesture(icon, [
      ["pointerdown", { pointerId: 31, clientX: 11, clientY: 46 }],
      ["pointermove", { pointerId: 31, clientX: 91, clientY: 46 }],
      ["pointerup", { pointerId: 31, clientX: 91, clientY: 46 }],
      ["pointerdown", { pointerId: 32, clientX: 91, clientY: 46 }],
      ["pointermove", { pointerId: 32, clientX: 171, clientY: 46 }],
    ])

    await delay(230)
    assert.equal(icon.classList.contains("dragging"), true)
    assert.equal(icon.style.zIndex, "100")
    assert.equal(icon.style.transition, "none")

    icon.dispatchEvent(pointerEvent("pointercancel", { pointerId: 32 }))
    draft.dispose()
  })

  await t.test("a fresh tap clears an unconsumed drag click token", async () => {
    const { draft, desktop } = await mount("pointer-fresh-tap")
    const icon = desktop.querySelector('[data-app-type="settings"]')
    const updatesBefore = phoneWorkUpdateCalls

    dispatchGesture(icon, [
      ["pointerdown", { pointerId: 35, clientX: 11, clientY: 46 }],
      ["pointermove", { pointerId: 35, clientX: 91, clientY: 46 }],
      ["pointerup", { pointerId: 35, clientX: 91, clientY: 46 }],
    ])
    assert.equal(phoneWorkUpdateCalls, updatesBefore + 1)

    dispatchGesture(icon, [
      ["pointerdown", { pointerId: 36, clientX: 91, clientY: 46 }],
      ["pointerup", { pointerId: 36, clientX: 91, clientY: 46 }],
    ])
    icon.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }))

    assert.ok(document.getElementById("settingsPanel"))
    assert.equal(phoneWorkUpdateCalls, updatesBefore + 1)
    draft.dispose()
  })

  await t.test("failed pointer capture cannot leave a gesture blocking another icon", async () => {
    for (const captureFailure of ["throw", "no-op"]) {
      const { draft, desktop, captures } = await mount(`pointer-capture-${captureFailure}`)
      const icon = desktop.querySelector('[data-app-type="settings"]')
      const other = desktop.querySelector('[data-app-type="messages"]')
      const before = draft.snapshot()
      const updatesBefore = phoneWorkUpdateCalls

      if (captureFailure === "throw") {
        icon.setPointerCapture = () => { throw new Error("capture unavailable") }
      } else {
        icon.setPointerCapture = () => {}
        icon.hasPointerCapture = () => false
      }

      icon.dispatchEvent(pointerEvent("pointerdown", {
        pointerId: 41,
        clientX: 11,
        clientY: 46,
      }))
      other.dispatchEvent(pointerEvent("pointerdown", {
        pointerId: 42,
        clientX: 91,
        clientY: 46,
      }))

      assert.equal(captures.get(other)(), 42)
      other.dispatchEvent(pointerEvent("pointercancel", { pointerId: 42 }))
      assert.deepEqual(draft.snapshot(), before)
      assert.equal(phoneWorkUpdateCalls, updatesBefore)
      draft.dispose()
    }
  })

  await t.test("non-primary input is ignored and re-render cleanup cancels an active drag", async () => {
    const { draft, root, desktop, captures } = await mount("pointer-cleanup")
    const icon = desktop.querySelector('[data-app-type="settings"]')
    const other = desktop.querySelector('[data-app-type="messages"]')
    const before = draft.snapshot()
    const updatesBefore = phoneWorkUpdateCalls

    icon.dispatchEvent(pointerEvent("pointerdown", {
      pointerId: 21,
      pointerType: "mouse",
      button: 2,
      buttons: 2,
      clientX: 11,
      clientY: 46,
    }))
    other.dispatchEvent(pointerEvent("pointerdown", {
      pointerId: 22,
      isPrimary: false,
      clientX: 91,
      clientY: 46,
    }))
    assert.equal(captures.get(icon)(), null)
    assert.equal(captures.get(other)(), null)

    dispatchGesture(icon, [
      ["pointerdown", { pointerId: 23, clientX: 11, clientY: 46 }],
      ["pointermove", { pointerId: 23, clientX: 91, clientY: 46 }],
    ])
    assert.equal(icon.classList.contains("dragging"), true)

    root.innerHTML = renderPhoneEditor(draft.id)
    await delay(70)

    assert.deepEqual(draft.snapshot(), before)
    assert.equal(phoneWorkUpdateCalls, updatesBefore)
    assert.equal(icon.style.left, "")
    assert.equal(icon.style.top, "")
    assert.equal(icon.classList.contains("dragging"), false)
    draft.dispose()
  })

})
