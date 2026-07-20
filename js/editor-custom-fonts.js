const STYLE_ID = "editor-custom-fonts-style"

function cssString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n\f]/g, " ")
}

function cssSingleString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/[\r\n\f]/g, " ")
}

export function editorFontValue(name) {
  return "'" + cssSingleString(name) + "', sans-serif"
}

export function editorFontFormat(filename) {
  var ext = String(filename || "").split(".").pop().toLowerCase()
  if (ext === "ttf") return "truetype"
  if (ext === "otf") return "opentype"
  if (ext === "woff") return "woff"
  if (ext === "woff2") return "woff2"
  return "opentype"
}

export function upsertEditorCustomFont(fonts, nextFont) {
  var list = Array.isArray(fonts) ? fonts.slice() : []
  var index = list.findIndex(function(font) { return font?.name === nextFont?.name })
  if (index >= 0) list[index] = nextFont
  else list.push(nextFont)
  return list
}

export function installEditorCustomFonts(doc, fonts) {
  if (!doc?.head) return
  doc.getElementById(STYLE_ID)?.remove()
  var usable = (Array.isArray(fonts) ? fonts : []).filter(function(font) {
    return font?.name && typeof font.data === "string" && /^data:[^,]+;base64,/i.test(font.data)
  })
  if (!usable.length) return

  var style = doc.createElement("style")
  style.id = STYLE_ID
  style.textContent = usable.map(function(font) {
    var format = /^(truetype|opentype|woff2?|embedded-opentype)$/.test(font.format || "") ? font.format : "opentype"
    return '@font-face{font-family:"' + cssString(font.name) + '";src:url("' + cssString(font.data) + '") format("' + format + '");font-display:swap;}'
  }).join("\n")
  doc.head.appendChild(style)
}
