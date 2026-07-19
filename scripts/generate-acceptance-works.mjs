import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { validateWorkForImport } from "../js/work-schema.js"
import { encodeSteganoPngBuffer } from "./acceptance-work-assets.mjs"
import { ACCEPTANCE_FILES, buildAcceptanceWorks } from "./acceptance-work-fixtures.mjs"

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const outputDirectory = join(projectRoot, "samples", "acceptance")

await mkdir(outputDirectory, { recursive: true })

const works = buildAcceptanceWorks()
for (const [kind, work] of Object.entries(works)) {
  const validation = validateWorkForImport(work)
  if (!validation.ok) {
    throw new Error(`${kind} acceptance work failed validation: ${validation.code} ${validation.message}`)
  }

  const basename = ACCEPTANCE_FILES[kind]
  const json = `${JSON.stringify(work, null, 2)}\n`
  await Promise.all([
    writeFile(join(outputDirectory, `${basename}.json`), json, "utf8"),
    writeFile(join(outputDirectory, `${basename}.png`), encodeSteganoPngBuffer(json, basename)),
  ])
  process.stdout.write(`generated ${basename}.json and ${basename}.png\n`)
}
