// Local packaging only. Neither this module nor the starter is in normal builds.
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile, readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'vite'
import { CASES, buildFixture, authorFixtureSeed } from './fixture.mjs'
import { previewStarterHtml } from './preview-starter.mjs'
import { validateWorkForImport } from '../../js/work-schema.js'

const root = fileURLToPath(new URL('../..', import.meta.url))
const parent = path.join(root, 'artifacts/phone-export-browser')
await mkdir(parent, { recursive:true })
const output = await mkdtemp(path.join(parent, 'preview-author-'))
const { work } = buildFixture(CASES.find(scenario => scenario.name === 'narrow-all'))
work.id = 'phone-export-author-preview'
work.title = 'iPad 作者图片导出测试'
assert.equal(validateWorkForImport(work).ok, true, 'preview work must be import-valid')
const seed = authorFixtureSeed(work)
await build({ configFile:path.join(root, 'vite.config.ts'), build:{ outDir:output, emptyOutDir:false } })
const files = await readdir(output)
assert.ok(files.includes('index.html'))
assert.ok(files.includes('author-phone-render.html'), 'production author render entry is missing')
for(const filename of await readdir(path.join(output,'assets'))) {
  if(!filename.endsWith('.js'))continue
  assert.doesNotMatch(await readFile(path.join(output,'assets',filename),'utf8'),/__phoneExportRendererStress|__phoneExportBeforeRaster/,'test-only instrumentation leaked into static build')
}
await writeFile(path.join(output, 'phone-export-sample.json'), JSON.stringify(seed), 'utf8')
await writeFile(path.join(output, 'phone-export-test.html'), previewStarterHtml(), 'utf8')
console.log(`PREVIEW_OUTPUT=${output}`)
