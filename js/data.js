// Tuuru Works - Data Layer
import { readLocalDatabase, writeLocalDatabase } from "./storage.js"
import { CURRENT_WORK_SCHEMA_VERSION } from "./work-schema.js"
import { substitutePlaceholders } from "./placeholders.js"
import { assertSteganoPayloadSize, readSteganoPayload, writeSteganoPayload } from "./stegano.js"
export const WORK_TYPE = {ARTICLE:"article",PHONE:"phone"}
export const PLACEHOLDER_MODE = {RANDOM_EACH:"each",FIXED_SCENE:"scene",LOCKED:"locked"}
export const PLATFORM = {X:"x",WEIBO:"weibo",DOUBAN:"douban",TIEBA:"tieba"}
export const BUILTIN_FONTS = [
  {name:"默认",value:"var(--font)"},
  {name:"宋体",value:"SimSun, serif"},
  {name:"黑体",value:"SimHei, sans-serif"},
  {name:"楷体",value:"KaiTi, serif"},
  {name:"仿宋",value:"FangSong, serif"},
  {name:"微软雅黑",value:"Microsoft YaHei, sans-serif"},
  {name:"思源宋体",value:"Noto Serif SC, serif"},
  {name:"思源黑体",value:"Noto Sans SC, sans-serif"},
]
export const DEFAULT_EDITOR_SETTINGS = {
  fontFamily:"var(--font)",
  fontSize:16,
  marginTop:24,
  marginBottom:24,
  marginLeft:32,
  marginRight:32,
  letterSpacing:0,
  lineHeight:1.9,
  indentFirstLine:false,
  customFonts:[]
}
export const PH_PRESETS = {
  name: {
    label: "NAME 组",
    fields: [
      {key:"某某",label:"姓名",prompt:"你的名字？",mode:"each",forbidden:[]},
      {key:"小某",label:"昵称",prompt:"你的小名？",mode:"each",forbidden:[]},
      {key:"wm",label:"网名",prompt:"你的网名？",mode:"each",forbidden:[]}
    ]
  }
}
export const PH_MODES = [
  {value:"each",label:"全文替换"},
  {value:"random",label:"随机替换"},
  {value:"scene",label:"场景锁定"}
]

// Phone app definitions
export const DEFAULT_PHONE_APP_COLORS = {
  settings: '#d7cfd1', customize: '#e3bdc7', messages: '#c9a2ac',
  forum: '#b7a8b9', memo: '#efe5d4', gallery: '#d5b8c7',
  browser: '#c2c8cf', shopping: '#d7aaaf', profile: '#d7bec5', contacts: '#c6b3b7'
}
export const PHONE_APP_DEFS = {
  settings:  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>', label: '设置',     color: '#f0f0f0', visible: 'author' },
  customize: { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>', label: '美化',     color: '#f0f0f0', visible: 'both' },
  messages:  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', label: '消息',     color: '#f0f0f0', visible: 'both' },
  forum:     { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="12" y2="13"/></svg>', label: '论坛',     color: '#f0f0f0', visible: 'both' },
  memo:      { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>', label: '备忘录',   color: '#f0f0f0', visible: 'both' },
  gallery:   { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>', label: '相册',     color: '#f0f0f0', visible: 'both' },
  browser:   { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>', label: '浏览器',   color: '#f0f0f0', visible: 'both' },
  shopping:  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>', label: '购物',     color: '#f0f0f0', visible: 'both' },
  profile:   { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', label: '个人主页', color: '#f0f0f0', visible: 'reader' },
  contacts:  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>', label: '联系人', color: '#f0f0f0', visible: 'both' },
}

// Reader-owned controls live in the reader shell, never on the in-world phone desktop.
export const PHONE_READER_OWNED_CONTROL_TYPES = Object.freeze(['customize', 'profile'])

export const DEFAULT_PHONE_SKIN = {
  wallpaper: '#eee6e7',
  wallpaperType: 'color',
  wallpaperImage: null,
  frameColor: '#8f7b81',
  borderRadius: 18,
  fontFamily: "'Noto Sans SC', sans-serif",
  fontSize: 12,
  readerId: '读者',
  readerAvatar: null,
  showDynamicIsland: true,
  iconStyle: 'mixed',
  showIconShadow: true,
  iconBorderRadius: 6,
  showGlassEffect: true,
  iconColumns: 4,
  showAppLabels: true,
  timeColor: '#ffffff',
  showHomeIndicator: true,
  materialType: 'glass',
  materialOpacity: 65,
  topBgImage: null,
}

function makePhoneApps(phoneAppIds) {
  var grid = [
    [0,0],[1,0],[2,0],[3,0],
    [0,1],[1,1],[2,1],[3,1],
    [0,2]
  ]
  var keys = Object.keys(PHONE_APP_DEFS).filter(function(k) {
    return !PHONE_READER_OWNED_CONTROL_TYPES.includes(k)
  })
  return keys.map(function(k, i) {
    var def = PHONE_APP_DEFS[k]
    var pos = grid[i] || [i % 4, Math.floor(i / 4)]
    return { id: phoneAppIds[i], type: k, name: def.label, icon: def.icon, color: DEFAULT_PHONE_APP_COLORS[k] || def.color, desktopX: pos[0], desktopY: pos[1], enabled: true }
  })
}
const AC=["#6366f1","#8b5cf6","#a855f7","#d946ef","#ec4899","#f43f5e","#ef4444","#f97316","#f59e0b","#84cc16","#22c55e","#10b981","#14b8a6","#06b6d4","#0ea5e9","#3b82f6","#64748b","#78716c"]

export var MOMO_AVATARS = [
  "https://pic1.imgdb.cn/item/6a3e9ae999bccaf16ccf04d8.jpg",
  "https://pic1.imgdb.cn/item/6a3e9ae999bccaf16ccf04d9.jpg",
  "https://pic1.imgdb.cn/item/6a3e9ae999bccaf16ccf04d7.jpg",
  "https://pic1.imgdb.cn/item/6a3e9ae999bccaf16ccf04db.jpg",
  "https://pic1.imgdb.cn/item/6a3e9ae999bccaf16ccf04da.jpg",
  "https://pic1.imgdb.cn/item/6a3e9ae999bccaf16ccf04dc.jpg"
]
export var USERXX_AVATARS = [
  "https://pic1.imgdb.cn/item/6a3e9b3d99bccaf16ccf04fc.jpg",
  "https://pic1.imgdb.cn/item/6a3e9b3d99bccaf16ccf04fe.jpg",
  "https://pic1.imgdb.cn/item/6a3e9b3d99bccaf16ccf04fd.jpg",
  "https://pic1.imgdb.cn/item/6a3e9b3d99bccaf16ccf04fa.jpg",
  "https://pic1.imgdb.cn/item/6a3e9b3d99bccaf16ccf04fb.jpg",
  "https://pic1.imgdb.cn/item/6a3e9b3d99bccaf16ccf04f9.jpg",
  "https://pic1.imgdb.cn/item/6a3e9b8299bccaf16ccf051f.jpg",
  "https://pic1.imgdb.cn/item/6a3e9b8299bccaf16ccf051d.jpg",
  "https://pic1.imgdb.cn/item/6a3e9b8299bccaf16ccf051e.jpg",
  "https://pic1.imgdb.cn/item/6a3e9b8299bccaf16ccf051c.jpg",
  "https://pic1.imgdb.cn/item/6a3e9b8299bccaf16ccf051b.jpg",
  "https://pic1.imgdb.cn/item/6a3e9b8299bccaf16ccf051a.jpg"
]
export var MOMO_NAMES = ["momo","MOMO","Momo"]
export function randomMomoName(){ return MOMO_NAMES[Math.floor(Math.random()*MOMO_NAMES.length)] }
export function randomUserXXName(){ return "用户"+Math.floor(10000+Math.random()*90000) }
export function randomAvatar(pool){ return pool[Math.floor(Math.random()*pool.length)] }
export function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
export function avatarColor(id){if(!id)return"#6366f1";let h=0;for(let i=0;i<id.length;i++)h=((h<<5)-h)+id.charCodeAt(i);return AC[Math.abs(h)%AC.length]}
function rd(){return readLocalDatabase()}
function wr(d){writeLocalDatabase(d)}
export function getWorks(){return rd().works}
export function getWork(id){return rd().works.find(w=>w.id===id)}
export function getWorksByType(t){return rd().works.filter(w=>w.type===t)}

export function createWorkRecord(data, {
  workId,
  firstChapterId,
  firstNodeId,
  firstSceneId,
  colorSeedId,
  phoneAppIds,
  now,
  updatedAt = now,
}) {
  var rawType=data.type
  var w={
    id:workId,
    schemaVersion:CURRENT_WORK_SCHEMA_VERSION,
    type:data.type||WORK_TYPE.ARTICLE,
    title:data.title||"无标题作品",
    desc:data.desc||"",
    coverColor:data.coverColor||avatarColor(colorSeedId),
    author:data.author||"",
    authorNote:data.authorNote||"",
    createdAt:now,
    updatedAt:updatedAt,
    password:data.password||"",
    locked:data.locked||false,
    nodes:rawType===WORK_TYPE.ARTICLE?[{id:firstNodeId,title:"开始",content:"",choices:[],scene:"",chapterId:""}]:[],
    chapters:rawType===WORK_TYPE.ARTICLE?[{id:firstChapterId,name:"第一章"}]:[],
    scenes:data.scenes||[],
    placeholders:data.placeholders||[],
    placeholderMode:data.placeholderMode||PLACEHOLDER_MODE.RANDOM_EACH,
   phoneModules:rawType===WORK_TYPE.ARTICLE?[]:undefined,
   phoneData:rawType===WORK_TYPE.PHONE?{
      contacts:[],
      chats:[],
      moments:[],
      forumPosts:[],
      forumNpcs:[],
      forumSettings:{showIpLocation:false},
      contactSortMode:"custom",
      apps:makePhoneApps(phoneAppIds),
      skin:JSON.parse(JSON.stringify(DEFAULT_PHONE_SKIN)),
      memos:[],
      photos:[],
      albums:[],
      browserHistory:[],
      shoppingItems:[]
    }:undefined,
    startNode:firstNodeId
  }
  if(w.type===WORK_TYPE.ARTICLE&&(!w.scenes||!w.scenes.length)){
    var $s=firstSceneId
    w.scenes=[{id:$s,name:"第一章"}]
    if(w.nodes.length) w.nodes[0].scene=$s
  }
  if(typeof w.chapters==="undefined"||!w.chapters.length){
    w.chapters=[{id:firstChapterId,name:"第一章"}]
    w.nodes.forEach(function(n){if(!n.chapterId)n.chapterId=w.chapters[0].id})
  }
  return w
}

export function createWork(data){
  var db=rd()
  var workId=uid()
  var colorSeedId=data.coverColor?"":uid()
  var now=Date.now()
  var updatedAt=Date.now()
  var firstNodeId="start"
  var firstChapterId
  var firstSceneId
  var phoneAppIds=[]
  if(data.type===WORK_TYPE.ARTICLE){
    firstChapterId=uid()
    if(!data.scenes||!data.scenes.length) firstSceneId=uid()
  }else if(data.type===WORK_TYPE.PHONE){
    phoneAppIds=Object.keys(PHONE_APP_DEFS)
      .filter(function(k){return !PHONE_READER_OWNED_CONTROL_TYPES.includes(k)})
      .map(function(){return uid()})
    firstChapterId=uid()
  }else{
    if(!data.type) firstSceneId=uid()
    firstChapterId=uid()
  }
  var w=createWorkRecord(data,{
    workId:workId,
    firstChapterId:firstChapterId,
    firstNodeId:firstNodeId,
    firstSceneId:firstSceneId,
    colorSeedId:colorSeedId,
    phoneAppIds:phoneAppIds,
    now:now,
    updatedAt:updatedAt
  })
  db.works.push(w)
  wr(db)
  return w
}

export function updateWork(id,data){const db=rd();const i=db.works.findIndex(x=>x.id===id);if(i<0)return null;db.works[i]={...db.works[i],...data,updatedAt:Date.now()};wr(db);return db.works[i]}
export function deleteWork(id){const db=rd();db.works=db.works.filter(w=>w.id!==id);wr(db)}
export function duplicateWork(id){const db=rd();const o=db.works.find(w=>w.id===id);if(!o)return null;const c=JSON.parse(JSON.stringify(o));c.id=uid();c.title=o.title+" (副本)";c.createdAt=Date.now();c.updatedAt=Date.now();db.works.push(c);wr(db);return c}

export function addNode(workId,afterId,chapterId){
  const db=rd();const w=db.works.find(x=>x.id===workId);if(!w||w.type!==WORK_TYPE.ARTICLE)return null
  const targetChapterId=w.chapters&&w.chapters.some(ch=>ch.id===chapterId)?chapterId:(w.chapters&&w.chapters[0]?w.chapters[0].id:"")
  const n={id:uid(),title:"新节点",content:"",choices:[],scene:"",chapterId:targetChapterId}
  if(afterId){const i=w.nodes.findIndex(x=>x.id===afterId);w.nodes.splice(i+1,0,n)}else w.nodes.push(n)
  if(!w.startNode||!w.nodes.some(x=>x.id===w.startNode))w.startNode=w.nodes[0]?.id||""
  w.updatedAt=Date.now();wr(db);return n
}
export function updateNode(wid,nid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return null;const n=w.nodes.find(x=>x.id===nid);if(!n)return null;Object.assign(n,data);w.updatedAt=Date.now();wr(db);return n}
export function deleteNode(wid,nid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return;w.nodes=w.nodes.filter(x=>x.id!==nid);w.nodes.forEach(x=>{x.choices=x.choices.filter(c=>c.targetId!==nid)});if(!w.nodes.some(x=>x.id===w.startNode))w.startNode=w.nodes[0]?.id||"";w.updatedAt=Date.now();wr(db)}
export function addChoice(wid,nid,tid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return null;const n=w.nodes.find(x=>x.id===nid);if(!n)return null;const c={id:uid(),text:"",targetId:tid||""};n.choices.push(c);w.updatedAt=Date.now();wr(db);return c}
export function updateChoice(wid,nid,cid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return null;const n=w.nodes.find(x=>x.id===nid);if(!n)return null;const c=n.choices.find(x=>x.id===cid);if(!c)return null;Object.assign(c,data);w.updatedAt=Date.now();wr(db);return c}
export function deleteChoice(wid,nid,cid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return;const n=w.nodes.find(x=>x.id===nid);if(!n)return;n.choices=n.choices.filter(x=>x.id!==cid);w.updatedAt=Date.now();wr(db)}

export function addScene(wid,name){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return null;const s={id:uid(),name};w.scenes.push(s);w.updatedAt=Date.now();wr(db);return s}
export function deleteScene(wid,sid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return;w.scenes=w.scenes.filter(x=>x.id!==sid);w.nodes.forEach(n=>{if(n.scene===sid)n.scene=""});w.updatedAt=Date.now();wr(db)}
export function addPlaceholder(wid,key,label,prompt,preset,extra){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return null;if(preset&&PH_PRESETS[preset]){var nps=PH_PRESETS[preset].fields.map(function(f){return {id:uid(),key:f.key,label:f.label,prompt:f.prompt,mode:f.mode,forbidden:f.forbidden||[],values:[],default:""}});w.placeholders=w.placeholders.concat(nps);w.updatedAt=Date.now();wr(db);return nps}else{var ph={id:uid(),key:key||uid(),label:label||"占位符",prompt:prompt||"请填写",mode:extra&&extra.mode||"each",forbidden:extra&&extra.forbidden||[],values:[],default:""};w.placeholders.push(ph);w.updatedAt=Date.now();wr(db);return [ph]}}
export function updatePlaceholder(wid,pid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return null;const p=w.placeholders.find(x=>x.id===pid);if(!p)return null;Object.assign(p,data);w.updatedAt=Date.now();wr(db);return p}
export function deletePlaceholder(wid,pid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return;w.placeholders=w.placeholders.filter(x=>x.id!==pid);w.updatedAt=Date.now();wr(db)}

export function addContact(wid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return null;const c={id:uid(),name:data.name||"未命名",alias:data.alias||"",aliases:Array.isArray(data.aliases)?data.aliases:[],avatarUrl:data.avatarUrl||"",messageAvatarUrl:data.messageAvatarUrl||"",forumAvatarUrl:data.forumAvatarUrl||"",forumIpLocation:data.forumIpLocation||"",pinned:data.pinned===true,note:data.note||"",faceUrl:data.faceUrl||"",msgId:data.msgId||"",forumId:data.forumId||""};w.phoneData.contacts.push(c);w.updatedAt=Date.now();wr(db);return c}
export function updateContact(wid,cid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return null;const c=w.phoneData.contacts.find(x=>x.id===cid);if(!c)return null;Object.assign(c,data);w.updatedAt=Date.now();wr(db);return c}
export function deleteContact(wid,cid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return;w.phoneData.contacts=w.phoneData.contacts.filter(x=>x.id!==cid);w.updatedAt=Date.now();wr(db)}
export function addChat(wid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return null;const c={id:uid(),type:data.group?"group":"single",contactIds:data.contactIds||[],groupName:data.groupName||"",groupAvatarUrl:data.groupAvatarUrl||"",groupOwnerId:data.groupOwnerId||"self",groupAdminIds:data.groupAdminIds||[],groupTitles:data.groupTitles||{},messages:data.messages||[]};w.phoneData.chats.push(c);w.updatedAt=Date.now();wr(db);return c}
export function addChatMessage(wid,cid,msg){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return null;const c=w.phoneData.chats.find(x=>x.id===cid);if(!c)return null;const next={id:uid(),senderId:msg.senderId||"",text:msg.text||"",time:msg.time||"",image:msg.image||""};if(Array.isArray(c.rounds)&&c.rounds.length){const round=c.rounds[c.rounds.length-1];round.messages=Array.isArray(round.messages)?round.messages:[];round.messages.push(next)}else{c.messages=Array.isArray(c.messages)?c.messages:[];c.messages.push(next)}w.updatedAt=Date.now();wr(db);return c}
export function deleteChat(wid,cid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return;w.phoneData.chats=w.phoneData.chats.filter(x=>x.id!==cid);w.updatedAt=Date.now();wr(db)}
export function addMoment(wid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return null;const m={id:uid(),contactId:data.contactId||"",content:data.content||"",images:data.images||[],time:data.time||"刚刚",likes:[],comments:[]};w.phoneData.moments.push(m);w.updatedAt=Date.now();wr(db);return m}
export function deleteMoment(wid,mid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return;w.phoneData.moments=w.phoneData.moments.filter(x=>x.id!==mid);w.updatedAt=Date.now();wr(db)}
export function addForumPost(wid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return null;const p={id:uid(),platform:data.platform||PLATFORM.X,contactId:data.contactId||"",content:data.content||"",images:data.images||[],time:data.time||"",likes:[],reposts:[],comments:[]};w.phoneData.forumPosts.push(p);w.updatedAt=Date.now();wr(db);return p}
export function deleteForumPost(wid,pid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return;w.phoneData.forumPosts=w.phoneData.forumPosts.filter(x=>x.id!==pid);w.updatedAt=Date.now();wr(db)}

const PM={name:["某某","XX","xxx","xxx"],nickname:["小某","某X"],food:["螺蛳粉","烤肉"],color:["白色","紫色","蓝色"]}
export function substituteText(text,phs,mode,scene,nodeScene,scenes,valuesMap){
  return substitutePlaceholders(text,phs,{
    valuesMap:valuesMap,
    defaultMode:mode,
    sceneId:nodeScene||scene,
    patternsFor:function(ph){return PM[ph.key]||[ph.key]}
  })
}

export function addPhoneModule(wid, data) {
  var db = rd()
  var w = db.works.find(function(x) { return x.id === wid })
  if (!w) return null
  w.phoneModules = w.phoneModules || []
  var pm = {
    id: uid(),
    type: data.type || 'messages',
    nodeId: data.nodeId || '',
    data: data.data || {}
  }
  w.phoneModules.push(pm)
  w.updatedAt = Date.now()
  wr(db)
  return pm
}
export function updatePhoneModule(wid, pmid, data) {
  var db = rd()
  var w = db.works.find(function(x) { return x.id === wid })
  if (!w) return null
  var pm = (w.phoneModules || []).find(function(x) { return x.id === pmid })
  if (!pm) return null
  Object.assign(pm, data)
  w.updatedAt = Date.now()
  wr(db)
  return pm
}
export function deletePhoneModule(wid, pmid) {
  var db = rd()
  var w = db.works.find(function(x) { return x.id === wid })
  if (!w) return
  w.phoneModules = (w.phoneModules || []).filter(function(x) { return x.id !== pmid })
  w.updatedAt = Date.now()
  wr(db)
}
export function getPhoneModulesByNode(wid, nid) {
  var w = rd().works.find(function(x) { return x.id === wid })
  if (!w) return []
  return (w.phoneModules || []).filter(function(x) { return x.nodeId === nid })
}
export function getPhoneModulesByType(wid, nid, type) {
  var w = rd().works.find(function(x) { return x.id === wid })
  if (!w) return []
  return (w.phoneModules || []).filter(function(x) { return x.nodeId === nid && x.type === type })
}
export function getPhoneModule(wid, pmid) {
  var w = rd().works.find(function(x) { return x.id === wid })
  if (!w) return null
  return (w.phoneModules || []).find(function(x) { return x.id === pmid })
}

export function exportWorkAsJSON(wid) {
  var w = getWork(wid)
  if (!w) return null
  // Deep clone to avoid mutating original
  var copy = JSON.parse(JSON.stringify(w))
  copy.schemaVersion = CURRENT_WORK_SCHEMA_VERSION
  // Remove editor-specific fields
  delete copy.editorSettings
  delete copy.updatedAt
  if (copy.phoneData) {
    // Remove author-only apps
    if (copy.phoneData.apps) {
      copy.phoneData.apps = copy.phoneData.apps
        .filter(function(a) {
          return a.type !== 'settings' && !PHONE_READER_OWNED_CONTROL_TYPES.includes(a.type)
        })
        .sort(function(a, b) {
          var aIndex = (Number(a.desktopY) || 0) * 4 + (Number(a.desktopX) || 0)
          var bIndex = (Number(b.desktopY) || 0) * 4 + (Number(b.desktopX) || 0)
          return aIndex - bIndex
        })
        .map(function(app, index) {
          app.desktopX = index % 4
          app.desktopY = Math.floor(index / 4)
          return app
        })
    }
  }
  return JSON.stringify(copy, null, 2)
}

export function encodeSteganoPNG(jsonStr, coverImageUrl, callback, errorCallback) {
  // jsonStr: JSON string to hide
  // coverImageUrl: optional cover image data URL
  // callback: function(dataUrl) called with the result PNG data URL
  // errorCallback: optional function(error) for asynchronous encoding failures
  
  var encoder = new TextEncoder()
  var data = encoder.encode(jsonStr)
  assertSteganoPayloadSize(data.length)
  var totalBytes = 4 + data.length
  var pixelCount = Math.ceil(totalBytes / 3)
  var size = Math.max(240, Math.ceil(Math.sqrt(pixelCount)))
  
  // Ensure enough pixels
  while (size * size < pixelCount) size++
  
  var canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  var ctx = canvas.getContext('2d')
  var settled = false

  function reportError(error) {
    if (settled) return
    settled = true
    var normalizedError = error instanceof Error ? error : new Error('PNG 编码失败')
    if (typeof errorCallback === 'function') {
      errorCallback(normalizedError)
      return
    }
    throw normalizedError
  }
  
  function encodeOnCanvas() {
    if (settled) return
    // Get pixel data
    var imageData = ctx.getImageData(0, 0, size, size)
    var pixels = imageData.data
    
    // Write the length header and payload into RGB channels (skip alpha)
    writeSteganoPayload(pixels, data)
    
    ctx.putImageData(imageData, 0, 0)
    callback(canvas.toDataURL('image/png'))
    settled = true
  }

  function drawAndEncode(drawBackground) {
    if (settled) return
    try {
      drawBackground()
      encodeOnCanvas()
    } catch (error) {
      reportError(error)
    }
  }
  
  if (coverImageUrl) {
    var img
    try {
      img = new Image()
    } catch (error) {
      reportError(error)
      return
    }
    img.onload = function() {
      drawAndEncode(function() {
        // Draw cover image scaled to fill
        var scale = Math.max(size / img.width, size / img.height)
        var sw = img.width * scale
        var sh = img.height * scale
        var sx = (size - sw) / 2
        var sy = (size - sh) / 2
        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(0, 0, size, size)
        ctx.drawImage(img, sx, sy, sw, sh)
      })
    }
    img.onerror = function() {
      // Fallback to gradient
      drawAndEncode(function() { drawDefaultBg(ctx, size) })
    }
    try {
      img.src = coverImageUrl
    } catch (error) {
      reportError(error)
    }
  } else {
    drawAndEncode(function() { drawDefaultBg(ctx, size) })
  }
}

function drawDefaultBg(ctx, size) {
  var grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#667eea')
  grad.addColorStop(0.5, '#764ba2')
  grad.addColorStop(1, '#f093fb')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.font = 'bold ' + (size / 8) + 'px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Tuuru', size / 2, size / 2 - size / 20)
  ctx.font = (size / 18) + 'px sans-serif'
  ctx.fillText('隐写作品', size / 2, size / 2 + size / 12)
}

export function decodeSteganoPNG(pngDataUrl) {
  // Returns the hidden JSON string, or null
  return new Promise(function(resolve, reject) {
    var img = new Image()
    img.onload = function() {
      var canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      var ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      var imageData = ctx.getImageData(0, 0, img.width, img.height)
      var pixels = imageData.data
      
      var bytes = readSteganoPayload(pixels)
      if (!bytes) {
        resolve(null)
        return
      }
      
      try {
        var decoder = new TextDecoder()
        var json = decoder.decode(bytes)
        // Verify it's valid JSON
        JSON.parse(json)
        resolve(json)
      } catch(e) {
        resolve(null)
      }
    }
    img.onerror = function() { resolve(null) }
    img.src = pngDataUrl
  })
}

export function exportWorkAsHTML(wid){
  var w = getWork(wid);
  if (!w) return null;
  return "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>" + w.title + "</title><style>body{font-family:sans-serif;padding:20px;max-width:720px;margin:0 auto;line-height:1.8}h1{font-size:1.5rem;text-align:center}.info{text-align:center;color:#999}</style></head><body><h1>" + w.title + "</h1><p class=\"info\">导出功能正在完善中.....</p></body></html>"
}

function rh(){try{return JSON.parse(sessionStorage.getItem("rh"))||{}}catch{return{}}}
function sh(h){sessionStorage.setItem("rh",JSON.stringify(h))}
export function getReaderState(wid){const h=rh();return h[wid]||{nodeId:null,phValues:{},history:[]}}
export function saveReaderState(wid,s){const h=rh();h[wid]=s;sh(h)}
export function clearReaderState(wid){const h=rh();delete h[wid];sh(h)}
