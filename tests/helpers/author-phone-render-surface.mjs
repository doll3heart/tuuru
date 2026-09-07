import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'

import {
  authorPhoneExportWork,
  readAuthorPhoneExportSnapshot,
} from '../../js/author-phone-snapshot.js'

export async function bootstrapAuthorPhoneRenderSurface(t, work) {
  const dom=new JSDOM('<iframe></iframe>',{url:'http://localhost/'})
  const iframe=dom.window.document.querySelector('iframe')
  const view=iframe.contentWindow
  view.document.documentElement.setAttribute('data-author-phone-render','')
  view.document.body.innerHTML='<div id="app"></div>'
  const raw=JSON.stringify({works:[work]})
  dom.window.localStorage.setItem('tuuru_works',raw)
  dom.window.localStorage.setItem('moirain_phoneCustom',JSON.stringify({readerId:'PRIVATE_READER',fontSize:20,appSettings:{messages:{bubbleFontSize:30}}}))
  dom.window.localStorage.setItem('moirain_readerLibrary','PRIVATE_PROGRESS')
  const snapshot=readAuthorPhoneExportSnapshot(work.id,{storage:dom.window.localStorage})
  const before=Array.from({length:dom.window.localStorage.length},(_,i)=>{const key=dom.window.localStorage.key(i);return [key,dom.window.localStorage.getItem(key)]})
  const context={work:authorPhoneExportWork(snapshot),assertCurrent:()=>snapshot.assertCurrent()}
  iframe.__tuuruAuthorPhoneRenderContext=context
  for (const key of ['window','document','Element','HTMLElement','Node','Event','MouseEvent','MutationObserver','FileReader']) globalThis[key]=key==='window'?view:view[key]
  globalThis.localStorage={getItem(key){assert.equal(key,'tuuru_works','must not read reader storage');return raw},setItem(){assert.fail('no render writes')}}
  globalThis.sessionStorage={getItem(){assert.fail('no session read')},setItem(){assert.fail('no session write')}}
  globalThis.requestAnimationFrame=callback=>{callback();return 1}
  globalThis.alert=()=>{}
  t.after(()=>dom.window.close())
  const runtime=await import(`../../reader/reader.js?author-surface=${Date.now()}-${Math.random()}`)
  const adapter=runtime.createAuthorPhoneRenderSurface(context)
  return {adapter,view,snapshot,assertUnchanged:()=>assert.deepEqual(Array.from({length:dom.window.localStorage.length},(_,i)=>{const key=dom.window.localStorage.key(i);return [key,dom.window.localStorage.getItem(key)]}),before)}
}
