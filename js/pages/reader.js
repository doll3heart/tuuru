export function buildReaderPreviewUrl(workId, baseUrl = globalThis.location?.href) {
  const normalizedWorkId = String(workId ?? "").trim()
  if (!normalizedWorkId) throw new TypeError("A work id is required to open the reader preview")
  if (!baseUrl) throw new TypeError("A base URL is required to open the reader preview")

  const previewUrl = new URL("reader/index.html", baseUrl)
  previewUrl.searchParams.set("preview", normalizedWorkId)
  return previewUrl.href
}

export function openReaderPreview(workId, locationObject = globalThis.location) {
  if (!locationObject || typeof locationObject.replace !== "function") {
    throw new TypeError("A replace-capable location is required to open the reader preview")
  }

  const previewUrl = buildReaderPreviewUrl(workId, locationObject.href)
  locationObject.replace(previewUrl)
  return previewUrl
}
