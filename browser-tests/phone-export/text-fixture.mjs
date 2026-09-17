import { buildFixture } from './fixture.mjs'

export const SHORT_TEXTS = ['……？', '是不小心按错了吗？', '你真的考虑清楚了吗？', '我在资料室里等你', '还是说...要我过去找你？', '你好', '你好。', 'Hello world', '🙂👍']

export function buildTextFixture(scenario) {
  const fixture = buildFixture({ group:false, skin:scenario.skin })
  const { work } = fixture
  const image = work.phoneData.chats[0].rounds[0].messages.find(message => message.type === 'image')
  work.phoneData.apps = work.phoneData.apps.filter(app => app.type === 'messages')
  const messages = []
  for (const senderId of ['npc', 'self']) {
    SHORT_TEXTS.forEach((text, index) => {
      messages.push({ id:`${senderId}-${index}`, type:'text', senderId, text })
      if (index === 2) messages.push({ id:`${senderId}-multiline`, type:'text', senderId,
        text:'多行文字与短句交替。Mixed Latin 123，需要保持原来的行数。\n第二行文字也必须留在气泡里。' })
      if (index === 4) messages.push({ ...image, id:`${senderId}-image`, senderId })
      if (index === 6) messages.push({ id:`${senderId}-quote`, type:'text', senderId, text:'引用之后的短回复。',
        quoteId:`${senderId}-0`, quoteText:SHORT_TEXTS[0], quoteSenderName:'引用消息' })
    })
  }
  work.phoneData.chats[0].rounds = [{ id:'short-text', messages }]
  if (scenario.fractional) fixture.rendererStress.customCss = '.chat-bubble:not(.rd-voice-message) { font-size:13.333px!important; letter-spacing:0.125px; }'
  return { ...fixture, expected:messages.filter(message => message.type === 'text').map(({ id, text }) => ({ id, text })) }
}

// Executed in the source iframe and in the clean serialized-clone document.
export function measureTextBoxes() {
  const viewport = document.querySelector('.rd-phone-export-viewport')
  const origin = viewport.getBoundingClientRect()
  const relative = rect => ({ x:rect.left - origin.left, y:rect.top - origin.top, width:rect.width, height:rect.height })
  return { width:origin.width, height:origin.height, bubbles:[...viewport.querySelectorAll('.chat-bubble')]
    .filter(node => !node.matches('.rd-voice-message') && !node.querySelector('img, svg, video, audio, canvas, iframe, object, embed'))
    .map(node => {
      const lines = [], walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(walker.currentNode)
        for (const rect of range.getClientRects()) if (rect.width && rect.height) lines.push(relative(rect))
      }
      const css = getComputedStyle(node)
      return { id:node.closest('[data-message-id]').dataset.messageId, text:node.textContent, ...relative(node.getBoundingClientRect()),
        lines, fontSize:css.fontSize, minHeight:css.minHeight, boxSizing:css.boxSizing, skin:node.classList.contains('has-bubble-skin') }
    }) }
}
