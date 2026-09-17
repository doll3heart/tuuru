const NON_TEXT_CONTENT = "img, svg, video, audio, canvas, iframe, object, embed"
const CONSTRAINTS = ["min-width", "max-width", "min-height", "max-height"]

function pixelValue(value) {
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)px$/u.test(String(value).trim())) return null
  const number = Number.parseFloat(value)
  return Number.isFinite(number) ? number : null
}

// Only call on the disposable export tree, after its assets and layout settle.
export function stabilizePhoneExportTextBoxes(root) {
  const ownerWindow = root?.ownerDocument?.defaultView
  if (typeof root?.querySelectorAll !== "function" || typeof ownerWindow?.getComputedStyle !== "function") return
  const bubbles = [...root.querySelectorAll(".chat-bubble")].filter(bubble =>
    !bubble.matches(".rd-voice-message") && !bubble.querySelector(NON_TEXT_CONTENT) && bubble.textContent.trim())

  // Snapshot constraints before any mutation. Skin minimum heights include
  // padding/borders too; changing box-sizing without converting them inflates it.
  const snapshots = bubbles.map(bubble => {
    const style = ownerWindow.getComputedStyle(bubble)
    const inset = axis => axis.reduce((sum, property) => sum + (pixelValue(style.getPropertyValue(property)) || 0), 0)
    return { bubble, borderBox:style.boxSizing === "border-box",
      inlineInset:inset(["padding-left", "padding-right", "border-left-width", "border-right-width"]),
      blockInset:inset(["padding-top", "padding-bottom", "border-top-width", "border-bottom-width"]),
      constraints:CONSTRAINTS.map(property => [property, style.getPropertyValue(property)]),
      // Auto-sized text must reflow. Preserve explicit pixel dimensions, without
      // mistaking computed used width/height for a specified fixed dimension.
      dimensions:["width", "height"].map(property => [property, bubble.style.getPropertyValue(property)]),
    }
  })
  for (const { bubble, borderBox, inlineInset, blockInset, constraints, dimensions } of snapshots) {
    // Even reduced-motion CSS can give every property a tiny transition. Do
    // not measure an interpolated border-box constraint as a content width.
    bubble.style.setProperty("transition-property", "none", "important")
    if (!borderBox) continue
    for (const [property, value] of [...constraints, ...dimensions]) {
      const pixels = pixelValue(value)
      if (pixels === null) continue
      const inset = property.endsWith("width") ? inlineInset : blockInset
      const converted = Math.max(0, pixels - inset)
      bubble.style.setProperty(property, `${property === "max-width" ? Math.ceil(converted) : converted}px`, "important")
    }
    bubble.style.setProperty("box-sizing", "content-box", "important")
  }

  // A fresh layout read after conversion is essential. html-to-image copies
  // quantized used widths; an integer specified min-width survives that copy
  // and prevents a last glyph gaining a line inside the copied fixed height.
  const widths = bubbles.map(bubble => [bubble, pixelValue(ownerWindow.getComputedStyle(bubble).width)])
  for (const [bubble, width] of widths) {
    if (width !== null && width > 0) bubble.style.setProperty("min-width", `${Math.ceil(width)}px`, "important")
  }
}
