import test from 'node:test'
import assert from 'node:assert/strict'
import {readAuthorPhoneExportSnapshot, assertAuthorPhoneExportSnapshot, authorPhoneExportWork} from '../js/author-phone-snapshot.js'
import {exportAuthorPhoneContentImages, downloadAuthorPhoneContentImages, authorPhoneExportJobs, waitForAuthorPhoneLayout} from '../js/author-phone-export.js'

function fixture() {
  const work = {id:'owned',type:'phone',title:'Original',phoneData:{contacts:[{id:'npc',name:'NPC'}],chats:[{id:'chat',type:'single',contactIds:['npc'],messages:[]}]}}
  let raw = JSON.stringify({works:[work]})
  const storage = {getItem:() => raw,setItem:(_,value) => {raw=value}}
  const snapshot = readAuthorPhoneExportSnapshot(work.id,{storage})
  let disposed = 0
  const adapter = {phoneData:work.phoneData,frame:{querySelector:()=>({})},renderChat(){},renderApp(){},renderForum(){},dispose(){disposed++}}
  const helpers = {placeholderMaskValues:()=>[],maskPhoneExportText:value=>value,phoneExportBaseName:()=> 'page',phoneExportBranchLabel:()=>'',phoneExportArchiveName:()=> 'work.zip',capturePhonePanelPages:async()=>[{name:'page.png',blob:new Blob(['png'])}],createPhoneContentArchive:async()=>new Blob(['zip'])}
  globalThis.requestAnimationFrame = callback=>callback()
  return {work,storage,snapshot,adapter,helpers,disposed:()=>disposed,change:()=>storage.setItem('',JSON.stringify({works:[{...work,title:'changed'}]}))}
}
test('forged sessions cannot render or download', async () => {
  const snapshot={work:{id:'foreign'},assertCurrent(){}}
  await assert.rejects(exportAuthorPhoneContentImages(snapshot),{name:'AuthorPhoneContextError'})
  assert.throws(()=>downloadAuthorPhoneContentImages(snapshot,{}),{name:'AuthorPhoneContextError'})
})
test('public snapshots and assertion results cannot mutate the private export work',()=>{
  const f=fixture()
  f.snapshot.work.title='forged'
  assert.equal(assertAuthorPhoneExportSnapshot(f.snapshot).work,undefined)
  assert.equal(authorPhoneExportWork(f.snapshot).title,'Original')
})
test('changed work during capture discards every file and closes renderer',async()=>{
  const f=fixture()
  f.helpers.capturePhonePanelPages=async()=>{f.change();return [{name:'page.png'}]}
  await assert.rejects(exportAuthorPhoneContentImages(f.snapshot,{helpers:f.helpers,createAdapter:async()=>f.adapter}),{name:'AuthorPhoneContextError'})
  assert.equal(f.disposed(),1)
})
test('changed work during failed capture is fatal, not partial success',async()=>{
  const f=fixture()
  f.helpers.capturePhonePanelPages=async()=>{f.change();throw new Error('asset failed')}
  await assert.rejects(exportAuthorPhoneContentImages(f.snapshot,{helpers:f.helpers,createAdapter:async()=>f.adapter}),{name:'AuthorPhoneContextError'})
})
test('changed work after frame readiness or archive and immediately before download fails',async()=>{
  for (const phase of ['ready','archive','download']) {
    const f=fixture()
    if(phase==='ready') await assert.rejects(exportAuthorPhoneContentImages(f.snapshot,{helpers:f.helpers,createAdapter:async()=>{f.change();return f.adapter}}),{name:'AuthorPhoneContextError'})
    if(phase==='archive') {
      f.helpers.createPhoneContentArchive=async()=>{f.change();return new Blob()}
      await assert.rejects(exportAuthorPhoneContentImages(f.snapshot,{helpers:f.helpers,createAdapter:async()=>f.adapter}),{name:'AuthorPhoneContextError'})
    }
    if(phase==='download') {
      const result=await exportAuthorPhoneContentImages(f.snapshot,{helpers:f.helpers,createAdapter:async()=>f.adapter})
      f.change()
      let downloads=0
      assert.throws(()=>downloadAuthorPhoneContentImages(f.snapshot,result,{download:()=>downloads++}),{name:'AuthorPhoneContextError'})
      assert.equal(downloads,0)
    }
    assert.equal(f.disposed(),1)
  }
})
test('asset failure remains partial; cancellation saves nothing; zero-file failure rejects',async()=>{
  const f=fixture()
  let captures=0
  f.helpers.capturePhonePanelPages=async()=>{if(captures++===0) throw new Error('blocked image');return [{name:'contact.png'}]}
  const result=await exportAuthorPhoneContentImages(f.snapshot,{helpers:f.helpers,createAdapter:async()=>f.adapter})
  assert.equal(result.files.length,1)
  assert.equal(result.failures.length,1)
  const controller=new AbortController()
  controller.abort()
  assert.throws(()=>downloadAuthorPhoneContentImages(f.snapshot,result,{signal:controller.signal,download:()=>assert.fail('download')}),{name:'AbortError'})
  f.helpers.capturePhonePanelPages=async()=>{throw new Error('blocked image')}
  await assert.rejects(exportAuthorPhoneContentImages(f.snapshot,{helpers:f.helpers,createAdapter:async()=>f.adapter}),/blocked image/)
})
test('all-branch planner enforces aggregate 64 chat paths and exports non-chat once',()=>{
  const f=fixture()
  const jobs=authorPhoneExportJobs(f.adapter,f.snapshot,{branchMode:'all'})
  assert.equal(jobs.filter(job=>job.moduleLabel==='消息').length,1)
  assert.equal(jobs.filter(job=>job.moduleLabel==='联系人').length,1)
  f.adapter.phoneData.chats=Array.from({length:65},(_,i)=>({...f.work.phoneData.chats[0],id:'chat-'+i}))
  assert.throws(()=>authorPhoneExportJobs(f.adapter,f.snapshot,{branchMode:'all'}),/64/)
})

test('cancellation settles pending frame layout without waiting for its animation frame',async()=>{
  const controller=new AbortController()
  let requested=0, cancelled=0
  const frame={ownerDocument:{defaultView:{requestAnimationFrame(){requested++;return 1},cancelAnimationFrame(){cancelled++}}}}
  const pending=waitForAuthorPhoneLayout(frame,controller.signal,frame.ownerDocument.defaultView)
  controller.abort()
  await assert.rejects(pending,{name:'AbortError'})
  assert.equal(requested,1)
  assert.ok(cancelled>=1)
})

test('cancellation during capture disposes only after the capture settles',async()=>{
  const f=fixture()
  const controller=new AbortController()
  f.helpers.capturePhonePanelPages=async()=>{
    controller.abort()
    assert.equal(f.disposed(),0)
    return [{name:'discard.png'}]
  }
  await assert.rejects(exportAuthorPhoneContentImages(f.snapshot,{helpers:f.helpers,createAdapter:async()=>f.adapter,signal:controller.signal}),{name:'AbortError'})
  assert.equal(f.disposed(),1)
})

test('author orchestration forwards parent layout clock to pure capture without using hidden child clock',async()=>{
  const f=fixture()
  f.adapter.frame.ownerDocument={defaultView:{requestAnimationFrame(){assert.fail('hidden child clock used')}}}
  let captures=0
  f.helpers.capturePhonePanelPages=async(_,options)=>{
    assert.equal(options.layoutScheduler,globalThis.window||globalThis)
    captures++
    return [{name:'page.png',blob:new Blob(['png'])}]
  }
  await exportAuthorPhoneContentImages(f.snapshot,{helpers:f.helpers,createAdapter:async()=>f.adapter})
  assert.equal(captures,2)
})
