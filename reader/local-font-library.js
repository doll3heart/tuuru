function cleanFontName(value) {
  return String(value || "")
    .replace(/["'\\;{}<>]/g, "")
    .trim()
    .slice(0, 64)
}

function assertFontName(fonts, name, currentIndex = -1) {
  var cleaned = cleanFontName(name)
  if (!cleaned) throw new Error("请输入字体名称")
  var duplicate = (Array.isArray(fonts) ? fonts : []).some(function(font, index) {
    return index !== currentIndex && cleanFontName(font?.name).toLocaleLowerCase() === cleaned.toLocaleLowerCase()
  })
  if (duplicate) throw new Error("已存在同名字体，请改名或替换原字体文件")
  return cleaned
}

export function readerLocalFontFamily(name) {
  return '"' + cleanFontName(name).replace(/"/g, '\\"') + '"'
}

export function addReaderLocalFont(fonts, font) {
  var list = Array.isArray(fonts) ? fonts.slice() : []
  var name = assertFontName(list, font?.name)
  if (typeof font?.data !== "string" || !font.data) throw new Error("字体文件读取失败")
  return list.concat([{name:name, data:font.data}])
}

export function renameReaderLocalFont(fonts, index, nextName) {
  var list = Array.isArray(fonts) ? fonts.slice() : []
  if (!list[index]) return list
  var name = assertFontName(list, nextName, index)
  list[index] = Object.assign({}, list[index], {name:name})
  return list
}

export function replaceReaderLocalFont(fonts, index, data) {
  var list = Array.isArray(fonts) ? fonts.slice() : []
  if (!list[index]) return list
  if (typeof data !== "string" || !data) throw new Error("字体文件读取失败")
  list[index] = Object.assign({}, list[index], {data:data})
  return list
}

export function deleteReaderLocalFont(fonts, index) {
  return (Array.isArray(fonts) ? fonts : []).filter(function(_, fontIndex) {
    return fontIndex !== index
  })
}
