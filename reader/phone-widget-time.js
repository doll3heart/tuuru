const MONTH_NAMES = Object.freeze([
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
])

const WEEKDAY_NAMES = Object.freeze([
  "星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六",
])

function pad2(value) {
  return String(value).padStart(2, "0")
}

function validDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime())
}

function localTargetDate(value) {
  if (typeof value !== "string" || !value.trim()) return null
  const source = value.trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(source)
  if (!match) return null
  const target = new Date(
    Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4] || 0), Number(match[5] || 0), 0, 0,
  )
  if (!validDate(target)
    || target.getFullYear() !== Number(match[1])
    || target.getMonth() !== Number(match[2]) - 1
    || target.getDate() !== Number(match[3])) return null
  return target
}

export function phoneWidgetSystemSnapshot(value = new Date(), targetDate = "") {
  const now = validDate(value) ? value : new Date()
  const day = pad2(now.getDate())
  const monthNumber = pad2(now.getMonth() + 1)
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
  const target = localTargetDate(targetDate)
  let countdownDays = ""
  if (target) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
    countdownDays = String(Math.max(0, Math.ceil((targetDay.getTime() - today.getTime()) / 86400000)))
  }
  const weekday = WEEKDAY_NAMES[now.getDay()]
  return {
    day,
    month:MONTH_NAMES[now.getMonth()],
    monthDay:`${monthNumber} · ${day}`,
    weekday,
    time,
    weekdayTime:`${weekday} · ${time}`,
    countdownDays,
  }
}

export function syncPhoneWidgetSystemTime(root, value = new Date()) {
  if (!root?.querySelectorAll) return
  const snapshot = phoneWidgetSystemSnapshot(value)
  const updates = [
    ["[data-v7-system-day]", snapshot.day],
    ["[data-v7-system-month]", snapshot.month],
    ["[data-v7-system-month-day]", snapshot.monthDay],
    ["[data-v7-system-weekday-time]", snapshot.weekdayTime],
    ["[data-v7-system-time]", snapshot.time],
  ]
  for (const [selector, text] of updates) {
    root.querySelectorAll(selector).forEach(node => { node.textContent = text })
  }
  root.querySelectorAll("[data-v7-countdown-days]").forEach(node => {
    const targetDate = node.closest("[data-v7-countdown-target]")?.dataset.v7CountdownTarget || ""
    const days = phoneWidgetSystemSnapshot(value, targetDate).countdownDays
    node.textContent = days
    const label = node.parentElement?.querySelector("[data-v7-countdown-label]")
    if (label) label.textContent = days === "" ? "" : "天"
  })
}
