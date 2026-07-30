import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { validateWorkForImport } from "../js/work-schema.js"
import { encodeSteganoPngBuffer } from "./acceptance-work-assets.mjs"
import {
  SHOWCASE_PHONE_FILE,
  buildShowcasePhoneWork,
} from "./showcase-phone-fixture.mjs"

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const outputDirectory = join(projectRoot, "samples", "showcase")
const work = buildShowcasePhoneWork()
const validation = validateWorkForImport(work)

if (!validation.ok) {
  throw new Error(`showcase phone failed validation: ${validation.code} ${validation.message}`)
}

await mkdir(outputDirectory, { recursive: true })
const json = `${JSON.stringify(work, null, 2)}\n`
await Promise.all([
  writeFile(join(outputDirectory, `${SHOWCASE_PHONE_FILE}.json`), json, "utf8"),
  writeFile(join(outputDirectory, `${SHOWCASE_PHONE_FILE}.png`), encodeSteganoPngBuffer(json, SHOWCASE_PHONE_FILE)),
])

process.stdout.write(`generated ${SHOWCASE_PHONE_FILE}.json and ${SHOWCASE_PHONE_FILE}.png\n`)
