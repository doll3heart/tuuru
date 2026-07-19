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
