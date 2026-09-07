import { PNG } from 'pngjs'
import { createIllustrationDataUrl } from '../../scripts/acceptance-work-assets.mjs'
import { CURRENT_WORK_SCHEMA_VERSION } from '../../js/work-schema.js'
import { PHONE_APP_DEFS } from '../../js/data.js'
import { CURRENT_RELEASE_ANNOUNCEMENT, RELEASE_ANNOUNCEMENT_STORAGE_KEY } from '../../js/release-announcement.js'

export function authorFixtureSeed(work) {
  return {
    [RELEASE_ANNOUNCEMENT_STORAGE_KEY]:CURRENT_RELEASE_ANNOUNCEMENT.id,
    tuuru_works:JSON.stringify({version:1,works:[work],contacts:[],groups:[],collections:[]}),
  }
}

export function readerPoisonWork(work) {
  // A distinct, tiny private reader payload avoids duplicating large authored
  // font bytes into the poison control (WebKit has a 5 MiB storage quota).
  return {id:work.id,type:'phone',title:'PRIVATE_READER_WORK',placeholders:[],phoneData:{
    contacts:[{id:'private-npc',name:'PRIVATE_READER_CONTACT'}],
    chats:[{id:'private-chat',type:'single',contactIds:['private-npc'],messages:[{id:'private-message',type:'text',senderId:'private-npc',text:'PRIVATE_READER_CONTENT'}]}],
  }}
}

export const CASES = [
  { name:'desktop-current', width:1200, mode:'current', group:false },
  { name:'narrow-all', width:390, mode:'all', group:true },
  { name:'full-skin', width:390, mode:'current', group:false, skin:'full' },
  { name:'slice-skin', width:1200, mode:'all', group:true, skin:'slice' },
]

function bubbleImage() {
  const png = new PNG({ width:120, height:72 })
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const offset = (y * png.width + x) * 4
    const border = x < 5 || x >= 115 || y < 5 || y >= 67
    png.data.set(border ? [92, 70, 123, 255] : [229, 218, 241, 255], offset)
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString('base64')}`
}

export function buildFixture(scenario) {
  const asset = createIllustrationDataUrl('phone-export-regression', { width:120, height:84 })
  const message = (id, type, fields = {}) => ({ id, type, senderId:'npc', ...fields })
  const longText = '中英文长消息：雨停之后再出发，先确认转账和行程。Layout 123，标点与换行都应留在气泡里面。\n'.repeat(3)
  const common = [
    message('time', 'time', { time:'09:07' }),
    message('system', 'system', { text:'固定验收对话开始' }),
    message('long-self', 'text', { senderId:'self', text:longText }),
    message('transfer', 'transfer', { transferAmount:300, transferNote:'定金：请核对下一条消息的位置' }),
    message('long-other', 'text', { text:longText }),
    message('redpacket', 'redpacket', { redpacketAmount:8.88, redpacketMsg:'红包与长消息交替出现' }),
    message('image', 'image', { image:asset }),
    message('voice', 'voice', { duration:12, text:'固定语音转写' }),
    message('link', 'link', { linkTitle:'资料链接', linkUrl:'https://example.com/reference' }),
    message('familycard', 'familycard', { fcRelation:'家人', fcAmount:200 }),
    message('takeaway', 'takeaway', { takeawayShop:'雨天食堂', takeawayOrder:'热汤面一份', takeawayAmount:18, takeawayStatus:'已送达' }),
    message('location', 'location', { locationName:'旧站候车厅', locationAddress:'北门第二个入口', locationImage:asset }),
    message('contact-card', 'contact-card', { targetContactId:'npc', contactName:'林澈', contactNote:'联系人卡片' }),
    message('file', 'file', { fileName:'行程说明.pdf', fileType:'PDF', fileSize:'12 KB', fileContent:'固定文档内容' }),
    message('music', 'music', { musicTitle:'雨停以后', musicArtist:'测试音乐人', musicCover:asset }),
    message('forward', 'forward', { forwardTitle:'群聊记录', forwardItems:[{ sender:'林澈', text:'稍后见面' }] }),
    message('schedule', 'schedule', { scheduleTitle:'旧站见面', scheduleTime:'明天 18:00', scheduleLocation:'北门' }),
    message('call', 'call', { callMode:'voice', callStatus:'missed', text:'未接听' }),
    message('video', 'call', { callMode:'video', callStatus:'completed', callLines:['确认行程'], text:'确认行程' }),
    message('event', 'system-event', { eventKind:'notice', text:'系统事件：记录已同步' }),
    message('contact-event', 'contact-event', { eventKind:'relationship', text:'关系状态更新', relationshipState:'朋友' }),
  ]
  const choices = (prefix, end = false) => ({
    id:prefix, text:`选择${prefix}`, replyText:`REPLY_${prefix}`, replyPace:'instant', endRound:end,
    followUpMessages:[message(`follow-${prefix}`, 'text', { text:`ROUTE_${prefix} 完整回复` })],
  })
  const owner = message('owner', 'text', { text:'请选择调查路线', choices:[choices('A'), choices('B', true)] })
  const second = message('owner-2', 'text', {
    text:'请选择下一步', visibleAfterChoiceId:'A', choices:[choices('A1'), choices('A2')],
  })
  const work = {
    schemaVersion:CURRENT_WORK_SCHEMA_VERSION, id:'phone-export-browser-fixture', type:'phone',
    title:'图片回归验收', createdAt:1788739200000, updatedAt:1788739200000, placeholders:[], scenes:[],
    phoneData:{
      contacts:[{ id:'npc', name:'林澈', msgId:'林澈' }],
      chats:[{ id:'regression-chat', type:scenario.group ? 'group' : 'single', contactIds:['npc'],
        groupName:'固定验收群聊', groupOwnerId:'npc', messages:[],
        rounds:[{ id:'cards', label:'消息类型', messages:common },
          { id:'choices', label:'选择路线', messages:[owner, second] },
          { id:'ending', label:'下一轮', messages:[message('ending', 'text', { text:'END_OF_CHAT 下一轮完整结束' })] }],
      }],
      moments:[], forumPosts:[], forumNpcs:[], memos:[], photos:[], albums:[], browserHistory:[], shoppingItems:[],
      apps:['messages', 'contacts'].map((type, index) => ({ id:`app-${type}`, type, name:type === 'messages' ? '消息' : '联系人', icon:PHONE_APP_DEFS[type].icon, enabled:true, desktopX:index, desktopY:0 })),
      skin:{ readerId:'验收读者', showDynamicIsland:false, showHomeIndicator:false },
    },
  }
  // These legacy reader options exercise raster markup only. They are not
  // authored capabilities and never enter work data, storage or static builds.
  const rendererStress = {}
  if (scenario.skin) rendererStress.appSettings = { messages:{bubbleFontSize:16} }
  if (scenario.skin === 'full') rendererStress.customCss = '.chat-bubble::before { content:"DECOR_LABEL"; display:block; font-size:8px; line-height:12px; }'
  if (scenario.skin) for (const side of ['self', 'other']) Object.assign(rendererStress.appSettings.messages, {
    [`${side}BubbleSkinImage`]:bubbleImage(), [`${side}BubbleSkinMode`]:scenario.skin,
    [`${side}BubbleSkinSize`]:100, [`${side}BubbleSkinSlice`]:8, [`${side}BubbleSkinPadding`]:12,
  })
  return { work, rendererStress, commonIds:common.map(item => item.id) }
}
