import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"
import { bindPhoneMentionTrigger, insertPhoneMention, isPhoneMentionInput } from "../js/phone-mention-trigger.js"

test("phone mention trigger opens after a typed at sign and cleans up", () => {
  const dom = new JSDOM('<div id="root"><textarea id="text"></textarea></div>')
  const root = dom.window.document.querySelector('#root')
  const input = root.querySelector('#text')
  const opened = []
  const release = bindPhoneMentionTrigger(root, target => opened.push(target))
  input.value = '@'
  input.setSelectionRange(1, 1)
  input.dispatchEvent(new dom.window.InputEvent('input', { bubbles:true, data:'@', inputType:'insertText' }))
  assert.deepEqual(opened, [input])
  release()
  input.value = '@@'
  input.setSelectionRange(2, 2)
  input.dispatchEvent(new dom.window.InputEvent('input', { bubbles:true, data:'@', inputType:'insertText' }))
  assert.equal(opened.length, 1)
  dom.window.close()
})

test("phone mention trigger waits for mobile composition to finish", () => {
  const dom = new JSDOM('<div id="root"><input id="url" type="url"><input id="text"></div>')
  const root = dom.window.document.querySelector('#root')
  const opened = []
  bindPhoneMentionTrigger(root, target => opened.push(target))
  const url = root.querySelector('#url')
  assert.equal(isPhoneMentionInput(url), false)
  const input = root.querySelector('#text')
  input.dispatchEvent(new dom.window.CompositionEvent('compositionstart', { bubbles:true }))
  input.value = '@'
  input.setSelectionRange(1, 1)
  input.dispatchEvent(new dom.window.InputEvent('input', { bubbles:true, data:'@', isComposing:true }))
  assert.equal(opened.length, 0)
  input.dispatchEvent(new dom.window.CompositionEvent('compositionend', { bubbles:true, data:'@' }))
  assert.deepEqual(opened, [input])
  dom.window.close()
})

test("phone mention trigger accepts mobile input events with empty data", () => {
  const dom = new JSDOM('<div id="root"><textarea id="text"></textarea></div>')
  const root = dom.window.document.querySelector('#root')
  const input = root.querySelector('#text')
  const opened = []
  bindPhoneMentionTrigger(root, target => opened.push(target))
  input.value = '@'
  input.setSelectionRange(1, 1)
  input.dispatchEvent(new dom.window.InputEvent('input', { bubbles:true, data:'', inputType:'insertText' }))
  assert.deepEqual(opened, [input])
  dom.window.close()
})

test("phone mention trigger falls back to beforeinput when a browser omits input", async () => {
  const dom = new JSDOM('<div id="root"><textarea id="text"></textarea></div>')
  const root = dom.window.document.querySelector('#root')
  const input = root.querySelector('#text')
  const opened = []
  bindPhoneMentionTrigger(root, target => opened.push(target))
  input.focus()
  input.dispatchEvent(new dom.window.InputEvent('beforeinput', { bubbles:true, data:'@', inputType:'insertText' }))
  input.value = '@'
  input.setSelectionRange(1, 1)
  await new Promise(resolve => dom.window.setTimeout(resolve, 0))
  assert.deepEqual(opened, [input])
  dom.window.close()
})

test("phone mention trigger falls back to keyup after the at sign is committed", () => {
  const dom = new JSDOM('<div id="root"><input id="text"></div>')
  const root = dom.window.document.querySelector('#root')
  const input = root.querySelector('#text')
  const opened = []
  bindPhoneMentionTrigger(root, target => opened.push(target))
  input.value = '@'
  input.setSelectionRange(1, 1)
  input.dispatchEvent(new dom.window.KeyboardEvent('keyup', { bubbles:true, key:'@' }))
  assert.deepEqual(opened, [input])
  dom.window.close()
})

test("phone mention trigger cancels a deferred fallback when its editor closes", async () => {
  const dom = new JSDOM('<div id="root"><textarea id="text"></textarea></div>')
  const root = dom.window.document.querySelector('#root')
  const input = root.querySelector('#text')
  const opened = []
  const release = bindPhoneMentionTrigger(root, target => opened.push(target))
  input.dispatchEvent(new dom.window.InputEvent('beforeinput', { bubbles:true, data:'@', inputType:'insertText' }))
  input.value = '@'
  input.setSelectionRange(1, 1)
  release()
  await new Promise(resolve => dom.window.setTimeout(resolve, 0))
  assert.deepEqual(opened, [])
  dom.window.close()
})

test("selected phone mention is inserted after the authored at sign", () => {
  const dom = new JSDOM('<textarea id="text">你好@</textarea>')
  const input = dom.window.document.querySelector('#text')
  input.setSelectionRange(3, 3)
  insertPhoneMention(input, '林雾')
  assert.equal(input.value, '你好@林雾 ')
  assert.equal(input.selectionStart, input.value.length)
  dom.window.close()
})
