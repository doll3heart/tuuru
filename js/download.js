export function downloadBlob(blob, filename, options = {}) {
  const documentObject = options.documentObject || document
  const urlApi = options.urlApi || URL
  const schedule = options.schedule || setTimeout
  const revokeDelay = options.revokeDelay ?? 1000
  const url = urlApi.createObjectURL(blob)
  let link

  try {
    link = documentObject.createElement("a")
    link.href = url
    link.download = filename
    link.style.display = "none"
    documentObject.body.appendChild(link)
    link.click()
  } finally {
    link?.remove()
    schedule(() => urlApi.revokeObjectURL(url), revokeDelay)
  }
}
