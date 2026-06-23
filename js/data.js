// Tuuru Works - Data Layer
export const WORK_TYPE = {ARTICLE:"article",PHONE:"phone"}
export const PLACEHOLDER_MODE = {RANDOM_EACH:"each",FIXED_SCENE:"scene",LOCKED:"locked"}
export const PLATFORM = {X:"x",WEIBO:"weibo",DOUBAN:"douban",TIEBA:"tieba"}
export const PRESETS = {"basic": {"label": "???", "fields": [{"key": "name", "label": "??", "hint": "??????", "default": ""}, {"key": "nickname", "label": "??", "hint": "??????", "default": ""}]}, "detailed": {"label": "???", "fields": [{"key": "name", "label": "??", "hint": "??????", "default": ""}, {"key": "nickname", "label": "??", "hint": "??????", "default": ""}, {"key": "food", "label": "??????", "hint": "??????", "default": ""}, {"key": "color", "label": "??????", "hint": "??????", "default": ""}]}}
const AC=["#6366f1","#8b5cf6","#a855f7","#d946ef","#ec4899","#f43f5e","#ef4444","#f97316","#f59e0b","#84cc16","#22c55e","#10b981","#14b8a6","#06b6d4","#0ea5e9","#3b82f6","#64748b","#78716c"]
export function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
export function avatarColor(id){if(!id)return"#6366f1";let h=0;for(let i=0;i<id.length;i++)h=((h<<5)-h)+id.charCodeAt(i);return AC[Math.abs(h)%AC.length]}
const SK="tuuru_works"
function rd(){try{return JSON.parse(localStorage.getItem(SK))||{works:[],contacts:[],groups:[]}}catch{return{works:[],contacts:[],groups:[]}}}
function wr(d){localStorage.setItem(SK,JSON.stringify(d))}
export function getWorks(){return rd().works}
export function getWork(id){return rd().works.find(w=>w.id===id)}
export function getWorksByType(t){return rd().works.filter(w=>w.type===t)}
export function createWork(data){
  const db=rd();const w={id:uid(),type:data.type||WORK_TYPE.ARTICLE,title:data.title||"?????",desc:data.desc||"",coverColor:data.coverColor||avatarColor(uid()),author:data.author||"",createdAt:Date.now(),updatedAt:Date.now(),password:data.password||"",locked:data.locked||false,nodes:data.type===WORK_TYPE.ARTICLE?[{id:"start",title:"????",content:"",choices:[],scene:""}]:[],scenes:data.scenes||[],placeholders:data.placeholders||[],placeholderMode:data.placeholderMode||PLACEHOLDER_MODE.RANDOM_EACH,phoneData:data.type===WORK_TYPE.PHONE?{contacts:[],chats:[],moments:[],forumPosts:[],apps:[{id:uid(),name:"备忘录",icon:"",type:"memo",content:{notes:[]}},{id:uid(),name:"相册",icon:"",type:"gallery",content:{images:[]}},{id:uid(),name:"浏览器",icon:"",type:"browser",content:{bookmarks:[],history:[]}},{id:uid(),name:"消息",icon:"",type:"chat",content:{chats:[]}},{id:uid(),name:"论坛",icon:"",type:"forum",content:{posts:[]}}],bgm:""}:undefined,startNode:"start"};db.works.push(w);wr(db);return w}
export function updateWork(id,data){const db=rd();const i=db.works.findIndex(x=>x.id===id);if(i<0)return null;db.works[i]={...db.works[i],...data,updatedAt:Date.now()};wr(db);return db.works[i]}
export function deleteWork(id){const db=rd();db.works=db.works.filter(w=>w.id!==id);wr(db)}
export function duplicateWork(id){const db=rd();const o=db.works.find(w=>w.id===id);if(!o)return null;const c=JSON.parse(JSON.stringify(o));c.id=uid();c.title=o.title+" (??)";c.createdAt=Date.now();c.updatedAt=Date.now();db.works.push(c);wr(db);return c}

export function addNode(workId,afterId){
  const db=rd();const w=db.works.find(x=>x.id===workId);if(!w||w.type!==WORK_TYPE.ARTICLE)return null
  const n={id:uid(),title:"???",content:"",choices:[],scene:""}
  if(afterId){const i=w.nodes.findIndex(x=>x.id===afterId);w.nodes.splice(i+1,0,n)}else w.nodes.push(n)
  w.updatedAt=Date.now();wr(db);return n
}
export function updateNode(wid,nid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return null;const n=w.nodes.find(x=>x.id===nid);if(!n)return null;Object.assign(n,data);w.updatedAt=Date.now();wr(db);return n}
export function deleteNode(wid,nid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return;w.nodes=w.nodes.filter(x=>x.id!==nid);w.nodes.forEach(x=>{x.choices=x.choices.filter(c=>c.targetId!==nid)});if(w.startNode===nid&&w.nodes.length>0)w.startNode=w.nodes[0].id;w.updatedAt=Date.now();wr(db)}
export function addChoice(wid,nid,tid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return null;const n=w.nodes.find(x=>x.id===nid);if(!n)return null;const c={id:uid(),text:"???",targetId:tid||nid};n.choices.push(c);w.updatedAt=Date.now();wr(db);return c}
export function updateChoice(wid,nid,cid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return null;const n=w.nodes.find(x=>x.id===nid);if(!n)return null;const c=n.choices.find(x=>x.id===cid);if(!c)return null;Object.assign(c,data);w.updatedAt=Date.now();wr(db);return c}
export function deleteChoice(wid,nid,cid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return;const n=w.nodes.find(x=>x.id===nid);if(!n)return;n.choices=n.choices.filter(x=>x.id!==cid);w.updatedAt=Date.now();wr(db)}


export function addScene(wid,name){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return null;const s={id:uid(),name};w.scenes.push(s);w.updatedAt=Date.now();wr(db);return s}
export function deleteScene(wid,sid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return;w.scenes=w.scenes.filter(x=>x.id!==sid);w.nodes.forEach(n=>{if(n.scene===sid)n.scene=""});w.updatedAt=Date.now();wr(db)}
export function addPlaceholder(wid,key,label,prompt,preset){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return null;if(preset&&PRESETS[preset]){w.placeholders=PRESETS[preset].fields.map(f=>({id:uid(),key:f.key,label:f.label,prompt:f.label,mode:PLACEHOLDER_MODE.RANDOM_EACH,values:[],default:""}))}else{w.placeholders.push({id:uid(),key:key||uid(),label:label||"????",prompt:prompt||"???",mode:PLACEHOLDER_MODE.RANDOM_EACH,values:[],default:""})}w.updatedAt=Date.now();wr(db);return w.placeholders}
export function updatePlaceholder(wid,pid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return null;const p=w.placeholders.find(x=>x.id===pid);if(!p)return null;Object.assign(p,data);w.updatedAt=Date.now();wr(db);return p}
export function deletePlaceholder(wid,pid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w)return;w.placeholders=w.placeholders.filter(x=>x.id!==pid);w.updatedAt=Date.now();wr(db)}


export function addContact(wid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return null;const c={id:uid(),name:data.name||"???",avatarId:data.avatarId||uid(),desc:data.desc||""};w.phoneData.contacts.push(c);w.updatedAt=Date.now();wr(db);return c}
export function updateContact(wid,cid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return null;const c=w.phoneData.contacts.find(x=>x.id===cid);if(!c)return null;Object.assign(c,data);w.updatedAt=Date.now();wr(db);return c}
export function deleteContact(wid,cid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return;w.phoneData.contacts=w.phoneData.contacts.filter(x=>x.id!==cid);w.updatedAt=Date.now();wr(db)}
export function addChat(wid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return null;const c={id:uid(),type:data.group?"group":"single",contactIds:data.contactIds||[],groupName:data.groupName||"",messages:data.messages||[]};w.phoneData.chats.push(c);w.updatedAt=Date.now();wr(db);return c}
export function addChatMessage(wid,cid,msg){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return null;const c=w.phoneData.chats.find(x=>x.id===cid);if(!c)return null;c.messages.push({id:uid(),senderId:msg.senderId||"",text:msg.text||"",time:msg.time||"",image:msg.image||""});w.updatedAt=Date.now();wr(db);return c}
export function deleteChat(wid,cid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return;w.phoneData.chats=w.phoneData.chats.filter(x=>x.id!==cid);w.updatedAt=Date.now();wr(db)}
export function addMoment(wid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return null;const m={id:uid(),contactId:data.contactId||"",content:data.content||"",images:data.images||[],time:data.time||"??",likes:[],comments:[]};w.phoneData.moments.push(m);w.updatedAt=Date.now();wr(db);return m}
export function deleteMoment(wid,mid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return;w.phoneData.moments=w.phoneData.moments.filter(x=>x.id!==mid);w.updatedAt=Date.now();wr(db)}
export function addForumPost(wid,data){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return null;const p={id:uid(),platform:data.platform||PLATFORM.X,contactId:data.contactId||"",content:data.content||"",images:data.images||[],time:data.time||"??",likes:[],reposts:[],comments:[]};w.phoneData.forumPosts.push(p);w.updatedAt=Date.now();wr(db);return p}
export function deleteForumPost(wid,pid){const db=rd();const w=db.works.find(x=>x.id===wid);if(!w||!w.phoneData)return;w.phoneData.forumPosts=w.phoneData.forumPosts.filter(x=>x.id!==pid);w.updatedAt=Date.now();wr(db)}


const PM={name:["??","XX","xxx","xxx"],nickname:["??","?X"],food:["??","???"],color:["??","??"]}
export function substituteText(text,phs,mode,scene,nodeScene,scenes,valuesMap){
  if(!text||!phs||!phs.length)return text
  if(valuesMap)phs=phs.map(ph=>({...ph,values:valuesMap[ph.id]||ph.values||[]}))
  let r=text
  for(const ph of phs){
    if(!ph.values||!ph.values.length){const pats=PM[ph.key]||[ph.key];for(const p of pats)r=r.replaceAll(p,ph.default||"");continue}
    const v=rv(ph,mode,scene,nodeScene,scenes);const pats=PM[ph.key]||[ph.key]
    for(const p of pats)r=r.replaceAll(p,v)
  }
  return r
}
function rv(ph,mode,scene,nodeScene,scenes){
  const v=ph.values||[];if(!v.length)return ph.default||"";if(v.length===1)return v[0]
  const m=ph.mode||mode||"each"
  if(m==="locked")return v[0]
  if(m==="scene"){const sid=nodeScene||scene;if(sid&&ph.sceneMap&&ph.sceneMap[sid])return ph.sceneMap[sid];return v[0]}
  return v[Math.floor(Math.random()*v.length)]
}


export function exportWorkAsHTML(wid){
  var w = getWork(wid);
  if (!w) return null;
  return "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>" + w.title + "</title><style>body{font-family:sans-serif;padding:20px;max-width:720px;margin:0 auto;line-height:1.8}h1{font-size:1.5rem;text-align:center}.info{text-align:center;color:#999}</style></head><body><h1>" + w.title + "</h1><p class=\"info\">瀵煎嚭鍔熻兘姝ｅ湪瀹屽杽涓?.....</p></body></html>"
}

function rh(){try{return JSON.parse(sessionStorage.getItem("rh"))||{}}catch{return{}}}
function sh(h){sessionStorage.setItem("rh",JSON.stringify(h))}
export function getReaderState(wid){const h=rh();return h[wid]||{nodeId:null,phValues:{},history:[]}}
export function saveReaderState(wid,s){const h=rh();h[wid]=s;sh(h)}
export function clearReaderState(wid){const h=rh();delete h[wid];sh(h)}



