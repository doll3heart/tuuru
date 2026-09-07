import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { waitForAuthorPhoneLayout } from '../js/author-phone-export.js'
import { capturePhonePanelPages } from '../reader/phone-content-export.js'

function clocks() {
  let ownerCalls=0,parentCalls=0,cancelled=0
  const owner={requestAnimationFrame(){ownerCalls++;return 1},cancelAnimationFrame(){}}
  const parent={requestAnimationFrame(callback){parentCalls++;queueMicrotask(callback);return parentCalls},cancelAnimationFrame(){cancelled++}}
  return {owner,parent,counts:()=>({ownerCalls,parentCalls,cancelled})}
}

test('author pre-capture uses explicit visible-parent clock when hidden child rAF never fires', async()=>{
  const clock=clocks(),controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),50)
  try {
    await waitForAuthorPhoneLayout({ownerDocument:{defaultView:clock.owner}},controller.signal,clock.parent)
    assert.equal(clock.counts().ownerCalls,0)
    assert.equal(clock.counts().parentCalls,2)
  } finally {clearTimeout(timeout)}
})

test('pure capture measures owner DOM but runs both initial/page waits on supplied parent clock',async()=>{
  const dom=new JSDOM('<section class="phone-frame"><div id="panel">content</div></section>')
  const clock=clocks(),controller=new AbortController()
  dom.window.requestAnimationFrame=clock.owner.requestAnimationFrame
  const timeout=setTimeout(()=>controller.abort(),100)
  try {
    const pages=await capturePhonePanelPages(dom.window.document.querySelector('#panel'),{
      signal:controller.signal,layoutScheduler:clock.parent,
      rasterize:async node=>{assert.equal(node.ownerDocument,dom.window.document);return new Blob(['png'])},
    })
    assert.equal(pages.length,1)
    assert.equal(clock.counts().ownerCalls,0)
    assert.equal(clock.counts().parentCalls,4)
    assert.equal(dom.window.document.querySelector('.rd-phone-export-stage'),null)
  } finally {clearTimeout(timeout);dom.window.close()}
})

test('cancelling a pending supplied-clock capture rejects promptly and removes staging/listener',async()=>{
  const dom=new JSDOM('<div id="panel">content</div>')
  const controller=new AbortController()
  let enter,cancelled=0,adds=0,removes=0
  const requested=new Promise(resolve=>{enter=resolve})
  const scheduler={requestAnimationFrame(){enter();return 7},cancelAnimationFrame(id){assert.equal(id,7);cancelled++}}
  const add=controller.signal.addEventListener.bind(controller.signal),remove=controller.signal.removeEventListener.bind(controller.signal)
  controller.signal.addEventListener=(...args)=>{adds++;return add(...args)}
  controller.signal.removeEventListener=(...args)=>{removes++;return remove(...args)}
  const pending=capturePhonePanelPages(dom.window.document.querySelector('#panel'),{
    signal:controller.signal,layoutScheduler:scheduler,rasterize:()=>assert.fail('cancelled capture rasterized'),
  })
  const outcome=pending.then(value=>({value}),error=>({error}))
  const deadline=setTimeout(()=>enter(),100)
  try {
    await requested
    controller.abort()
    assert.equal((await outcome).error?.name,'AbortError')
    assert.equal(cancelled,1)
    assert.equal(adds,removes)
    assert.equal(dom.window.document.querySelector('.rd-phone-export-stage'),null)
  } finally {clearTimeout(deadline);dom.window.close()}
})

test('standalone capture retains owner-window clock when no scheduler is supplied',async()=>{
  const dom=new JSDOM('<div id="panel">content</div>')
  let calls=0
  dom.window.requestAnimationFrame=callback=>{calls++;queueMicrotask(callback);return calls}
  try {
    await capturePhonePanelPages(dom.window.document.querySelector('#panel'),{rasterize:async()=>new Blob(['png'])})
    assert.equal(calls,4)
  } finally {dom.window.close()}
})
