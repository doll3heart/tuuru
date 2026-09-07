import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {bootstrapAuthorPhoneRenderSurface as surface} from './helpers/author-phone-render-surface.mjs'

function authoredWork(group=false) {
  return {id:'owned',type:'phone',title:'Story',placeholders:[],phoneData:{
    skin:{fontSize:13,fontFamily:'serif'},contacts:[{id:'npc',name:'OLD_NAME'}],
    chats:[{id:'chat',type:group?'group':'single',groupName:'BASE_GROUP',contactIds:['npc'],messages:[],rounds:[{id:'round',messages:[
      {id:'current',type:'text',senderId:'npc',text:'CURRENT',revealMode:'instant'},
      group?{id:'future',type:'system-event',eventKind:'group-rename',newName:'FUTURE_GROUP'}:{id:'future',type:'contact-event',eventKind:'contact-update',targetContactId:'npc',newName:'FUTURE_NAME'},
    ]}]}],
    readingFlow:{enabled:true,sequence:[{type:'messages',itemId:'current',chatId:'chat',roundId:'round'},{type:'messages',itemId:'future',chatId:'chat',roundId:'round'}]},
  }}
}
test('author renderer uses authored appearance and never reads or writes private reader state',async t=>{
  const f=await surface(t,authoredWork())
  assert.equal(f.adapter.frame.style.getPropertyValue('--phone-fontsize'),'13px')
  f.adapter.renderChat(f.adapter.phoneData.chats[0],0)
  assert.match(f.adapter.frame.querySelector('.chat-round-title strong').textContent,/OLD_NAME/)
  assert.doesNotMatch(f.adapter.frame.textContent,/PRIVATE_READER/)
  f.adapter.renderApp('contacts')
  f.assertUnchanged()
})
test('author snapshot rendering cannot leak a future group rename into its captured header',async t=>{
  const f=await surface(t,authoredWork(true))
  f.adapter.renderChat(f.adapter.phoneData.chats[0],0)
  assert.equal(f.adapter.frame.querySelector('.chat-round-title strong').textContent,'BASE_GROUP')
  f.assertUnchanged()
})
test('author render URL alone provides neither a surface nor a delivery bridge',async t=>{
  const dom=new JSDOM('<html data-author-phone-render><body><div id="app"></div></body></html>',{url:'http://localhost/author-phone-render.html?preview=owned'})
  globalThis.window=dom.window
  globalThis.document=dom.window.document
  t.after(()=>dom.window.close())
  const runtime=await import(`../reader/reader.js?unauthorized-surface=${Date.now()}`)
  assert.equal(document.getElementById('app').children.length,0)
  assert.throws(()=>runtime.createAuthorPhoneRenderSurface({work:authoredWork(),assertCurrent(){}}),/作者上下文/)
  assert.equal(runtime.exportReaderPhoneContentImages,undefined)
})
