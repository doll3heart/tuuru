import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { stabilizePhoneExportTextBoxes } from '../reader/phone-export-text-layout.js'

function fixture(markup = '<div class="chat-bubble">你好</div>') {
  const dom = new JSDOM(`<div id="source">${markup}</div>`)
  const source = dom.window.document.querySelector('#source')
  const clone = source.cloneNode(true)
  dom.window.document.body.appendChild(clone)
  return { dom, source, clone, bubble:clone.querySelector('.chat-bubble') }
}

test('border-box pixel constraints convert on both axes; max-width rounds up', () => {
  const { clone, bubble } = fixture('<div class="chat-bubble" style="box-sizing:border-box;padding:8px 12px;border:0.8px solid;min-width:40px;max-width:180px;min-height:60px;max-height:200px;width:142.65px;height:80px;font-size:13.333px">你好</div>')
  const writes = [], setProperty = bubble.style.setProperty.bind(bubble.style)
  bubble.style.setProperty = (...args) => { writes.push(args); return setProperty(...args) }
  stabilizePhoneExportTextBoxes(clone)
  assert.equal(bubble.style.boxSizing, 'content-box')
  assert.equal(bubble.style.maxWidth, '155px')
  assert.equal(bubble.style.width, '117.05000000000001px')
  assert.equal(bubble.style.minWidth, '118px')
  assert.equal(bubble.style.minHeight, '42.4px')
  assert.equal(bubble.style.maxHeight, '182.4px')
  assert.equal(bubble.style.height, '62.4px')
  assert.equal(bubble.style.fontSize, '13.333px')
  // jsdom drops priority when the same property is written a second time.
  assert.deepEqual(writes.filter(([property]) => property === 'min-width').at(-1), ['min-width', '118px', 'important'])
  assert.deepEqual(writes[0], ['transition-property', 'none', 'important'])
})

test('normal/content-box text retains constraints and exact font while stabilizing used width', () => {
  for (const boxSizing of ['', 'content-box']) {
    const { clone, bubble } = fixture(`<div class="chat-bubble" style="box-sizing:${boxSizing};width:117.05px;max-width:180px;min-height:60px;font-size:13.333px">Hello</div>`)
    stabilizePhoneExportTextBoxes(clone)
    assert.equal(bubble.style.width, '117.05px')
    assert.equal(bubble.style.minWidth, '118px')
    assert.equal(bubble.style.maxWidth, '180px')
    assert.equal(bubble.style.minHeight, '60px')
    assert.equal(bubble.style.fontSize, '13.333px')
  }
})

test('skin min-height and quote text remain intact without mutating the source DOM', () => {
  const { source, clone, bubble } = fixture('<div class="chat-bubble has-bubble-skin bubble-skin-full" style="box-sizing:border-box;padding:12px;border:1px solid;min-height:72px;max-width:180px"><button class="chat-quote-preview"><span>引用</span><strong>你好</strong></button>短回复</div>')
  const original = source.outerHTML
  stabilizePhoneExportTextBoxes(clone)
  assert.equal(source.outerHTML, original)
  assert.equal(bubble.style.minHeight, '46px')
  assert.equal(bubble.textContent, '引用你好短回复')
  assert.equal(bubble.querySelector('.chat-quote-preview').getAttribute('style'), null)
  assert.equal(bubble.style.height, '')
})

test('all constraint snapshots precede writes and minimum width uses fresh converted layout', () => {
  const { dom, clone } = fixture('<div class="chat-bubble">一</div><div class="chat-bubble">二</div>')
  const bubbles = [...clone.children], read = dom.window.getComputedStyle.bind(dom.window)
  const calls = []
  dom.window.getComputedStyle = bubble => {
    calls.push(bubble)
    if (calls.length <= 2) assert.ok(bubbles.every(node => !node.style.boxSizing), 'mutated before all snapshots')
    const css = read(bubble)
    return new Proxy(css, { get(target, property) {
      if (property === 'boxSizing') return 'border-box'
      if (property === 'width') {
        assert.equal(bubble.style.boxSizing, 'content-box')
        return '117.0001px'
      }
      const value = target[property]
      return typeof value === 'function' ? value.bind(target) : value
    } })
  }
  stabilizePhoneExportTextBoxes(clone)
  assert.deepEqual(calls, [bubbles[0], bubbles[1], bubbles[0], bubbles[1]])
  assert.ok(bubbles.every(node => node.style.minWidth === '118px'))
})

test('nonpixel constraints and invalid/zero widths do not become invalid pixel dimensions', () => {
  for (const width of ['auto', '0px', 'garbage', 'Infinitypx', '-1px', '50%']) {
    const { dom, clone, bubble } = fixture('<div class="chat-bubble" style="box-sizing:border-box;min-width:auto;max-width:none;min-height:auto;max-height:none">你好</div>')
    const read = dom.window.getComputedStyle.bind(dom.window)
    dom.window.getComputedStyle = node => new Proxy(read(node), { get(target, property) {
      if (property === 'width') return width
      const value = target[property]
      return typeof value === 'function' ? value.bind(target) : value
    } })
    stabilizePhoneExportTextBoxes(clone)
    assert.equal(bubble.style.minWidth, 'auto')
    assert.equal(bubble.style.maxWidth, 'none')
    assert.equal(bubble.style.minHeight, 'auto')
    assert.equal(bubble.style.maxHeight, 'none')
  }
  assert.doesNotThrow(() => stabilizePhoneExportTextBoxes(null))
})

test('image, SVG, media, voice and empty bubbles and non-bubble cards are unchanged', () => {
  const markup = ['img', 'svg', 'video', 'audio', 'canvas', 'iframe', 'object', 'embed'].map(tag =>
    `<div class="chat-bubble" style="box-sizing:border-box;width:120px">文字<${tag}></${tag}></div>`).join('')
    + '<div class="chat-bubble rd-voice-message" style="width:120px">voice</div><div class="chat-bubble"> </div><div class="chat-payment-transfer">转账</div>'
  const { clone } = fixture(markup), before = clone.outerHTML
  stabilizePhoneExportTextBoxes(clone)
  assert.equal(clone.outerHTML, before)
})
