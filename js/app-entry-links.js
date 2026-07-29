function requireLocationHref(value) {
  if (
    typeof value !== "string"
    || value.trim() === ""
  ) {
    throw new TypeError("A location URL is required")
  }
  return value
}

export function buildReaderHomeUrl(currentHref = globalThis.location?.href) {
  return new URL("reader/index.html", requireLocationHref(currentHref)).href
}

export function buildAuthorHomeUrl(currentHref = globalThis.location?.href) {
  return new URL("../index.html", requireLocationHref(currentHref)).href
}

export function buildAuthorReturnUrl(currentHref = globalThis.location?.href) {
  const href = requireLocationHref(currentHref)
  const readerUrl = new URL(href)
  const authorUrl = new URL("../index.html", href)
  const returnTo = String(readerUrl.searchParams.get("returnTo") || "")
  if (returnTo === "#/" || /^#\/(?:edit|phone)\/[^?#]+$/.test(returnTo)) {
    authorUrl.hash = returnTo
  }
  return authorUrl.href
}
