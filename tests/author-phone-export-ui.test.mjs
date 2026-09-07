import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {openAuthorPhoneExportDialog} from '../js/author-phone-export-ui.js'
import {readFileSync} from 'node:fs'

test('author export keeps header and actions fixed while its body scrolls on short screens',()=>{
  const css=readFileSync(new URL('../css/author-phone-export.css',import.meta.url),'utf8')
  const dialog=css.match(/\.author-phone-export-dialog\s*\{([^}]+)\}/)?.[1] || ''
  const body=css.match(/\.author-phone-export-dialog\s*>\s*\.modal-body\s*\{([^}]+)\}/)?.[1] || ''
  assert.match(dialog,/display:\s*flex/)
  assert.match(dialog,/flex-direction:\s*column/)
  assert.match(dialog,/max-height:\s*calc\(100dvh - 40px\)/)
  assert.match(dialog,/overflow:\s*hidden/)
  assert.match(body,/min-height:\s*0/)
  assert.match(body,/overflow-y:\s*auto/)
  assert.match(css,/\.author-phone-export-dialog\s*>\s*\.modal-header,\s*\.author-phone-export-dialog\s*>\s*\.modal-footer\s*\{\s*flex:\s*0 0 auto/)
})

test('author modal has explicit default/all modes, pending state and error recovery',async t=>{
  const dom=new JSDOM('<body></body>',{url:'http://localhost/'})
  globalThis.window=dom.window
  globalThis.document=dom.window.document
  globalThis.localStorage=dom.window.localStorage
  t.after(()=>dom.window.close())
  localStorage.setItem('tuuru_works',JSON.stringify({works:[{id:'owned',type:'phone',title:'Work',phoneData:{contacts:[],chats:[]}}]}))
  const notices=[]
  const modal=(title,body,footer,onClose)=>{
    const root=document.createElement('div')
    root.innerHTML=`<div class="modal" role="dialog"><h2>${title}</h2>${body}${footer}</div>`
    root.closeModal=()=>{onClose?.();root.remove()}
    document.body.append(root)
    return root
  }
  const root=openAuthorPhoneExportDialog('owned',{modal,showToast:(...args)=>notices.push(args)})
  const start=root.querySelector('[data-author-phone-export-start]')
  const inputs=[...root.querySelectorAll('input[name="authorPhoneExportBranchMode"]')]
  assert.equal(inputs.find(input=>input.value==='current').checked,true)
  assert.equal(start.textContent,'导出默认分支')
  const all=inputs.find(input=>input.value==='all')
  all.checked=true
  all.dispatchEvent(new dom.window.Event('change'))
  assert.equal(start.textContent,'导出全部分支')
  assert.match(root.textContent,/每个聊天.*各自分页/)
  assert.match(root.textContent,/不读取读者书架、回复进度或美化设置/)
  localStorage.setItem('tuuru_works',JSON.stringify({works:[]}))
  const pending=start.onclick()
  assert.equal(start.disabled,true)
  assert.ok(inputs.every(input=>input.disabled))
  await pending
  assert.equal(start.disabled,false)
  assert.ok(inputs.every(input=>!input.disabled))
  assert.equal(root.querySelector('[data-author-phone-export-progress]').dataset.state,'error')
  assert.equal(notices[0][1],'error')
  root.querySelector('[data-author-phone-export-cancel]').click()
  assert.equal(root.isConnected,false)
})

test('author mode choices retain keyboard, disabled and reduced-motion styles',()=>{
  const css=readFileSync(new URL('../css/author-phone-export.css',import.meta.url),'utf8')
  for(const token of [':has(input:checked)',':has(input:focus-visible)',':has(input:disabled)','prefers-reduced-motion']) assert.ok(css.includes(token))
})
