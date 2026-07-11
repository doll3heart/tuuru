import { sanitizeImportedWork } from "./sanitize.js"
import { validateWorkForImport } from "./work-schema.js"

export function prepareImportedWork(input, windowObject = window) {
  const result = validateWorkForImport(input)
  if (!result.ok) return result
  return {
    ...result,
    work: sanitizeImportedWork(result.work, windowObject),
  }
}
