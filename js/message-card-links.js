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

export function buildTakeawayOpenTarget(shop, order, userAgent) {
  var webUrl = buildTakeawaySearchUrl(shop, order)
  if (!webUrl) return { href: "", opensApp: false }

  var browserUserAgent = userAgent
  if (browserUserAgent === undefined && typeof navigator !== "undefined") {
    browserUserAgent = navigator.userAgent
  }
  if (!/Android/i.test(String(browserUserAgent || ""))) {
    return { href: webUrl, opensApp: false }
  }

  return {
    href: "intent://" + webUrl.replace(/^https:\/\//, "")
      + "#Intent;scheme=https;package=com.sankuai.meituan;S.browser_fallback_url="
      + encodeURIComponent(webUrl)
      + ";end",
    opensApp: true,
  }
}
