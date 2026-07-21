export function safeMessageCardUrl(raw) {
  try {
    var value = String(raw || "").trim()
    if (!value) return ""
    var url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : ""
  } catch {
    return ""
  }
}

export function buildTakeawaySearchUrl(shop, order) {
  var query = [shop, order].map(function(value) { return String(value || "").trim() }).filter(Boolean).join(" ")
  return query ? "https://www.meituan.com/s/" + encodeURIComponent(query) : ""
}
