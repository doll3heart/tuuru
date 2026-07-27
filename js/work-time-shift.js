const PHONE_TIME_COLLECTIONS = Object.freeze([
  {key:"chats", category:"消息", appType:"messages"},
  {key:"moments", category:"动态", appType:"messages"},
  {key:"forumPosts", category:"论坛", appType:"forum"},
  {key:"forumNpcs", category:"论坛", appType:"forum"},
  {key:"memos", category:"备忘录", appType:"memo"},
  {key:"photos", category:"相册", appType:"gallery"},
  {key:"albums", category:"相册", appType:"gallery"},
  {key:"browserHistory", category:"浏览记录", appType:"browser"},
  {key:"shoppingItems", category:"购物", appType:"shopping"},
])

function items(value) {
  return Array.isArray(value) ? value : []
}

function plainText(value, fallback) {
  const normalized = String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return (normalized || fallback).slice(0, 70)
}

function pathId(path) {
  return path.map(segment => typeof segment === "number" ? `[${segment}]` : String(segment)).join(".")
}

function padLike(value, source, fallbackWidth = 2) {
  const width = String(source ?? "").length > 1 ? String(source).length : fallbackWidth
  return String(value).padStart(width, "0")
}

function validDateParts(date, year, month, day, hour, minute, second) {
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && date.getUTCHours() === hour
    && date.getUTCMinutes() === minute
    && date.getUTCSeconds() === second
}

function shiftedDate(parts, offsetMinutes) {
  const timestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  const original = new Date(timestamp)
  if (!Number.isFinite(timestamp) || !validDateParts(
    original,
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )) return null
  const shifted = new Date(timestamp + offsetMinutes * 60_000)
  if (!Number.isFinite(shifted.getTime())) return null
  return shifted
}

function parseDelimited(value) {
  const match = String(value).match(
    /^(\d{4})([/-])(\d{1,2})\2(\d{1,2})(?:,\s*|\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  )
  if (!match) return null
  const [, yearText, separator, monthText, dayText, hourText, minuteText, secondText] = match
  const parts = {
    year:Number(yearText),
    month:Number(monthText),
    day:Number(dayText),
    hour:Number(hourText),
    minute:Number(minuteText),
    second:secondText === undefined ? 0 : Number(secondText),
  }
  if (parts.hour > 23 || parts.minute > 59 || parts.second > 59) return null
  return {
    parts,
    format(date) {
      const dateText = [
        String(date.getUTCFullYear()).padStart(4, "0"),
        padLike(date.getUTCMonth() + 1, monthText, 1),
        padLike(date.getUTCDate(), dayText, 1),
      ].join(separator)
      const timeText = `${padLike(date.getUTCHours(), hourText)}:${padLike(date.getUTCMinutes(), minuteText)}`
      return secondText === undefined
        ? `${dateText} ${timeText}`
        : `${dateText} ${timeText}:${padLike(date.getUTCSeconds(), secondText)}`
    },
  }
}

function parseChinese(value) {
  const match = String(value).match(
    /^(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  )
  if (!match) return null
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match
  const parts = {
    year:Number(yearText),
    month:Number(monthText),
    day:Number(dayText),
    hour:Number(hourText),
    minute:Number(minuteText),
    second:secondText === undefined ? 0 : Number(secondText),
  }
  if (parts.hour > 23 || parts.minute > 59 || parts.second > 59) return null
  return {
    parts,
    format(date) {
      const dateText = `${date.getUTCFullYear()}年${padLike(date.getUTCMonth() + 1, monthText, 1)}月${padLike(date.getUTCDate(), dayText, 1)}日`
      const timeText = `${padLike(date.getUTCHours(), hourText)}:${padLike(date.getUTCMinutes(), minuteText)}`
      return secondText === undefined
        ? `${dateText} ${timeText}`
        : `${dateText} ${timeText}:${padLike(date.getUTCSeconds(), secondText)}`
    },
  }
}

function shiftClock(value, offsetMinutes) {
  const match = String(value).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null
  const [, hourText, minuteText, secondText] = match
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = secondText === undefined ? 0 : Number(secondText)
  if (hour > 23 || minute > 59 || second > 59) return null
  const dayMinutes = 24 * 60
  const total = ((hour * 60 + minute + offsetMinutes) % dayMinutes + dayMinutes) % dayMinutes
  const shiftedHour = Math.floor(total / 60)
  const shiftedMinute = total % 60
  const timeText = `${padLike(shiftedHour, hourText)}:${padLike(shiftedMinute, minuteText)}`
  return secondText === undefined ? timeText : `${timeText}:${padLike(second, secondText)}`
}

export function shiftPhoneTimeValue(value, offsetMinutes) {
  if (!Number.isSafeInteger(offsetMinutes)) return null
  const source = String(value ?? "").trim()
  if (!source) return null
  const clock = shiftClock(source, offsetMinutes)
  if (clock !== null) return clock
  const parsed = parseDelimited(source) || parseChinese(source)
  if (!parsed) return null
  const shifted = shiftedDate(parsed.parts, offsetMinutes)
  return shifted ? parsed.format(shifted) : null
}

function topRecordLabel(record, category, index) {
  return plainText(
    record?.groupName
      || record?.title
      || record?.content
      || record?.caption
      || record?.name,
    `${category}第 ${index + 1} 项`,
  )
}

function collectRecordTimes({
  record,
  path,
  category,
  appType,
  location,
  matches,
  skipped,
}) {
  if (!record || typeof record !== "object") return
  const stack = [{value:record, path, depth:0}]
  while (stack.length) {
    const current = stack.pop()
    if (!current.value || typeof current.value !== "object") continue
    const entries = Array.isArray(current.value)
      ? current.value.map((value, index) => [index, value])
      : Object.entries(current.value)
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const [key, value] = entries[index]
      const childPath = [...current.path, key]
      if (key === "time" && typeof value === "string" && value.trim()) {
        const entry = Object.freeze({
          id:pathId(childPath),
          path:Object.freeze(childPath),
          category,
          appType,
          location,
          value:value.trim(),
        })
        if (shiftPhoneTimeValue(value, 0) === null) skipped.push(entry)
        else matches.push(entry)
      } else if (value && typeof value === "object") {
        stack.push({value, path:childPath, depth:current.depth + 1})
      }
    }
  }
}

export function findPhoneTimeEntries(work) {
  const matches = []
  const skipped = []
  const phoneData = work?.phoneData
  if (!phoneData || typeof phoneData !== "object") {
    return Object.freeze({matches:Object.freeze([]), skipped:Object.freeze([])})
  }
  for (const config of PHONE_TIME_COLLECTIONS) {
    for (const [index, record] of items(phoneData[config.key]).entries()) {
      collectRecordTimes({
        record,
        path:["phoneData", config.key, index],
        category:config.category,
        appType:config.appType,
        location:`小手机 · ${config.category} · ${topRecordLabel(record, config.category, index)}`,
        matches,
        skipped,
      })
    }
  }
  return Object.freeze({
    matches:Object.freeze(matches),
    skipped:Object.freeze(skipped),
  })
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function setPath(target, path, value) {
  let cursor = target
  for (let index = 0; index < path.length - 1; index += 1) cursor = cursor[path[index]]
  cursor[path[path.length - 1]] = value
}

export function shiftPhoneTimes(work, options = {}) {
  const offsetMinutes = Number(options.offsetMinutes)
  const report = findPhoneTimeEntries(work)
  if (!Number.isSafeInteger(offsetMinutes) || offsetMinutes === 0) {
    return {work, changed:false, changedCount:0, matches:report.matches, skipped:report.skipped}
  }
  const selected = options.selectedMatchIds === undefined
    ? null
    : new Set(items(options.selectedMatchIds).map(String))
  const changes = []
  for (const match of report.matches) {
    if (selected !== null && !selected.has(match.id)) continue
    const value = shiftPhoneTimeValue(match.value, offsetMinutes)
    if (value === null || value === match.value) continue
    changes.push({path:match.path, value})
  }
  if (!changes.length) {
    return {work, changed:false, changedCount:0, matches:report.matches, skipped:report.skipped}
  }
  const updated = clone(work)
  for (const change of changes) setPath(updated, change.path, change.value)
  return {
    work:updated,
    changed:true,
    changedCount:changes.length,
    matches:report.matches,
    skipped:report.skipped,
  }
}
