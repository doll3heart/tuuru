import { activateEditorCustomFonts } from './editor-custom-fonts.js'

async function startAuthorPhoneRender() {
const context = window.frameElement?.__tuuruAuthorPhoneRenderContext
if (context && window.parent !== window && typeof context.assertCurrent === 'function') {
  try {
    context.assertCurrent()
    const {createAuthorPhoneRenderSurface} = await import('../reader/reader.js')
    context.assertCurrent()
    const adapter = createAuthorPhoneRenderSurface(context)
    await activateEditorCustomFonts(document, context.fonts)
    context.assertCurrent()
    context.ready(adapter)
  } catch (error) {
    context.fail(error)
  } finally {
    delete window.frameElement?.__tuuruAuthorPhoneRenderContext
  }
}
}
void startAuthorPhoneRender()
