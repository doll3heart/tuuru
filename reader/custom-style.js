export const READER_CUSTOM_CSS_MAX_LENGTH = 12_000

const SAFE_SCOPE_PATTERN = /^\.[a-z][a-z0-9_-]*$/i
const SAFE_PROPERTY_PATTERN = /^(?:--[a-z0-9_-]+|-?[a-z][a-z0-9-]*)$/i
const FORBIDDEN_PROPERTIES = new Set([
  "behavior",
  "-moz-binding",
  "pointer-events",
  "z-index",
])
const SAFE_POSITION_VALUES = new Set([
  "absolute",
  "inherit",
  "initial",
  "relative",
  "revert",
  "revert-layer",
  "static",
  "unset",
])

const ERRORS = Object.freeze({
  invalid_scope: "样式作用范围无效。",
  too_long: `CSS 最多可输入 ${READER_CUSTOM_CSS_MAX_LENGTH} 个字符。`,
  malformed: "CSS 结构不完整，请检查花括号、引号和括号。",
  unsupported_at_rule: "暂不支持 @import、@media、@font-face 等 @ 规则。",
  obfuscated_syntax: "暂不支持带转义的选择器或属性写法。",
  invalid_selector: "存在无法识别的选择器。",
  invalid_declaration: "存在无法识别的 CSS 属性，请检查冒号和分号。",
  forbidden_resource: "CSS 不能加载外部地址、图片、字体或其他资源。",
  forbidden_declaration: "该属性可能覆盖页面操作区域，已停止应用。",
})

function failure(errorCode) {
  return {
    ok: false,
    css: "",
    error: ERRORS[errorCode] || ERRORS.malformed,
    errorCode,
    ruleCount: 0,
  }
}

function stripCommentsAndCheckSyntax(source) {
  let output = ""
  let quote = ""

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]

    if (quote) {
      output += character
      if (character === "\\") {
        if (index + 1 < source.length) {
          output += source[index + 1]
          index += 1
        }
      } else if (character === quote) {
        quote = ""
      }
      continue
    }

    if (character === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2)
      if (end === -1) return failure("malformed")
      output += " "
      index = end + 1
      continue
    }
    if (character === "'" || character === '"') {
      quote = character
      output += character
      continue
    }
    if (character === "@") return failure("unsupported_at_rule")
    if (character === "\\") return failure("obfuscated_syntax")
    output += character
  }

  if (quote) return failure("malformed")
  return { ok: true, value: output }
}

function splitTopLevel(source, delimiter) {
  const pieces = []
  let start = 0
  let quote = ""
  let roundDepth = 0
  let squareDepth = 0

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (quote) {
      if (character === "\\") index += 1
      else if (character === quote) quote = ""
      continue
    }
    if (character === "'" || character === '"') {
      quote = character
      continue
    }
    if (character === "(") roundDepth += 1
    else if (character === ")") {
      roundDepth -= 1
      if (roundDepth < 0) return null
    } else if (character === "[") squareDepth += 1
    else if (character === "]") {
      squareDepth -= 1
      if (squareDepth < 0) return null
    } else if (character === delimiter && roundDepth === 0 && squareDepth === 0) {
      pieces.push(source.slice(start, index))
      start = index + 1
    }
  }

  if (quote || roundDepth !== 0 || squareDepth !== 0) return null
  pieces.push(source.slice(start))
  return pieces
}

function firstTopLevelColon(source) {
  let quote = ""
  let roundDepth = 0
  let squareDepth = 0

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (character === "\\") index += 1
      else if (character === quote) quote = ""
      continue
    }
    if (character === "'" || character === '"') quote = character
    else if (character === "(") roundDepth += 1
    else if (character === ")") roundDepth -= 1
    else if (character === "[") squareDepth += 1
    else if (character === "]") squareDepth -= 1
    else if (character === ":" && roundDepth === 0 && squareDepth === 0) return index
  }
  return -1
}

function normalizePositionValue(value) {
  return value
    .replace(/\s*!important\s*$/i, "")
    .trim()
    .toLowerCase()
}

function validateDeclarations(block) {
  const rawDeclarations = splitTopLevel(block, ";")
  if (!rawDeclarations) return failure("malformed")

  const declarations = []
  for (const rawDeclaration of rawDeclarations) {
    const declaration = rawDeclaration.trim()
    if (!declaration) continue
    const colonIndex = firstTopLevelColon(declaration)
    if (colonIndex <= 0) return failure("invalid_declaration")

    const property = declaration.slice(0, colonIndex).trim()
    const value = declaration.slice(colonIndex + 1).trim()
    const normalizedProperty = property.toLowerCase()
    const normalizedValue = value.toLowerCase()
    if (!SAFE_PROPERTY_PATTERN.test(property) || !value) return failure("invalid_declaration")

    if (
      FORBIDDEN_PROPERTIES.has(normalizedProperty)
      || (normalizedProperty === "position" && !SAFE_POSITION_VALUES.has(normalizePositionValue(value)))
    ) {
      return failure("forbidden_declaration")
    }
    if (
      /\b(?:expression|url|-webkit-image-set|image-set)\s*\(/i.test(value)
      || /(?:javascript|vbscript|data|blob|file):/i.test(value)
      || /(?:https?:)?\/\//i.test(value)
      || normalizedValue.includes("</style")
    ) {
      return failure("forbidden_resource")
    }

    declarations.push(`${property}: ${value};`)
  }

  if (!declarations.length) return failure("invalid_declaration")
  return { ok: true, declarations }
}

function scopeSelectors(selectorText, scopeSelector) {
  const selectors = splitTopLevel(selectorText, ",")
  if (!selectors || !selectors.length) return failure("invalid_selector")
  const scoped = []

  for (const rawSelector of selectors) {
    const selector = rawSelector.trim()
    if (
      !selector
      || /[{};]/.test(selector)
      || /[\u0000-\u001f\u007f]/.test(selector)
    ) {
      return failure("invalid_selector")
    }
    scoped.push(
      selector.includes(":scope")
        ? selector.replace(/:scope\b/g, scopeSelector)
        : `${scopeSelector} ${selector}`,
    )
  }

  return { ok: true, selectors: scoped }
}

function parseRules(source, scopeSelector) {
  const rules = []
  let index = 0

  while (index < source.length) {
    while (index < source.length && /\s/.test(source[index])) index += 1
    if (index >= source.length) break

    const selectorStart = index
    let quote = ""
    let roundDepth = 0
    let squareDepth = 0
    let openingBrace = -1

    for (; index < source.length; index += 1) {
      const character = source[index]
      if (quote) {
        if (character === "\\") index += 1
        else if (character === quote) quote = ""
        continue
      }
      if (character === "'" || character === '"') quote = character
      else if (character === "(") roundDepth += 1
      else if (character === ")") roundDepth -= 1
      else if (character === "[") squareDepth += 1
      else if (character === "]") squareDepth -= 1
      else if (character === "}" || roundDepth < 0 || squareDepth < 0) return failure("malformed")
      else if (character === "{" && roundDepth === 0 && squareDepth === 0) {
        openingBrace = index
        break
      }
    }

    if (openingBrace === -1 || quote || roundDepth !== 0 || squareDepth !== 0) return failure("malformed")
    const selectorText = source.slice(selectorStart, openingBrace).trim()
    index = openingBrace + 1

    const blockStart = index
    quote = ""
    roundDepth = 0
    squareDepth = 0
    let closingBrace = -1

    for (; index < source.length; index += 1) {
      const character = source[index]
      if (quote) {
        if (character === "\\") index += 1
        else if (character === quote) quote = ""
        continue
      }
      if (character === "'" || character === '"') quote = character
      else if (character === "(") roundDepth += 1
      else if (character === ")") roundDepth -= 1
      else if (character === "[") squareDepth += 1
      else if (character === "]") squareDepth -= 1
      else if (character === "{") return failure("malformed")
      else if (character === "}" && roundDepth === 0 && squareDepth === 0) {
        closingBrace = index
        break
      }
      if (roundDepth < 0 || squareDepth < 0) return failure("malformed")
    }

    if (closingBrace === -1 || quote || roundDepth !== 0 || squareDepth !== 0) return failure("malformed")

    const scoped = scopeSelectors(selectorText, scopeSelector)
    if (!scoped.ok) return scoped
    const validated = validateDeclarations(source.slice(blockStart, closingBrace))
    if (!validated.ok) return validated
    rules.push(`${scoped.selectors.join(", ")} {\n  ${validated.declarations.join("\n  ")}\n}`)
    index = closingBrace + 1
  }

  if (!rules.length) return failure("malformed")
  return { ok: true, rules }
}

export function compileScopedReaderCss(input, scopeSelector) {
  if (!SAFE_SCOPE_PATTERN.test(scopeSelector || "")) return failure("invalid_scope")
  const rawSource = typeof input === "string" ? input : ""
  if (rawSource.length > READER_CUSTOM_CSS_MAX_LENGTH) return failure("too_long")
  const source = rawSource.trim()
  if (!source) {
    return {
      ok: true,
      css: "",
      error: "",
      errorCode: "",
      ruleCount: 0,
    }
  }
  const checked = stripCommentsAndCheckSyntax(source)
  if (!checked.ok) return checked
  const parsed = parseRules(checked.value, scopeSelector)
  if (!parsed.ok) return parsed

  return {
    ok: true,
    css: parsed.rules.join("\n\n"),
    error: "",
    errorCode: "",
    ruleCount: parsed.rules.length,
  }
}
