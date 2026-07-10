import { getWork, getReaderState, saveReaderState, clearReaderState, WORK_TYPE, avatarColor, substituteText } from "../data.js"
import { showToast } from "../app.js"

export function renderReader(workId){
  const work = getWork(workId)
  if(!work) return `<div class="empty-state"><div class="icon"></div><h3>作品未找到</h3></div>`
  
  // Password check
  if(work.password && !sessionStorage.getItem("rw_pw_"+workId)){
    return renderPasswordGate(work)
  }
  
  if(work.type===WORK_TYPE.ARTICLE) return renderArticleReader(workId, work)
  if(work.type===WORK_TYPE.PHONE) return renderPhoneReader(workId, work)
  return `<div class="text-muted">未知作品类型</div>`
}

function renderPasswordGate(work){
  return `
    <div class="password-gate">
      <div class="icon">🔒</div>
      <h2>此作品已加密</h2>
      <p>请输入密码后阅读</p>
      <input type="password" id="readerPwInput" placeholder="输入密码" style="padding:10px 14px;border:1px solid var(--c-border2);border-radius:var(--radius);font-size:.95rem;width:220px">
      <button class="btn btn-primary" onclick="checkReaderPw('${work.id}')">验证</button>
    </div>
  `
}

function renderArticleReader(workId, work){
  const state = getReaderState(workId)
  const phs = work.placeholders||[]
  const unfilled = phs.filter(p=>p.prompt&&!state.phValues[p.id])
  
  if(unfilled.length>0){
    return renderPlaceholderForm(work, state)
  }
  
  // Show current node
  const nodeId = state.nodeId || work.startNode
  const node = (work.nodes||[]).find(n=>n.id===nodeId)
  if(!node) return `<div class="empty-state"><div class="icon"></div><h3>节点未找到</h3></div>`
  
  return renderNode(work, node, state)
}

function renderPlaceholderForm(work, state){
  const phs = (work.placeholders||[]).filter(p=>p.prompt&&!state.phValues[p.id])
  return `
    <div class="reader-header">
      <h1 class="reader-title">${escHtml(work.title)}</h1>
      <div class="reader-meta"><span>${escHtml(work.author||"")}</span></div>
    </div>
    <div class="placeholder-form" id="phForm">
      <h3 style="margin-bottom:16px"> 阅读前请填写</h3>
      ${phs.map(ph=>`
        <div class="field">
          <label>${escHtml(ph.label||ph.prompt)}</label>
          <input id="ph_${ph.id}" placeholder="${escAttr(ph.prompt||"")}">
          <div class="hint">多个答案请用逗号分隔，例如：米饭, 饺子, 包子</div>
        </div>
      `).join("")}
      <button class="btn btn-primary" onclick="submitReaderPH('${work.id}')">开始阅读</button>
    </div>
  `
}

function renderNode(work, node, state){
  const phs = work.placeholders||[]
  const phValues = state.phValues||{}
  const mode = work.placeholderMode||"each"
  
  let content = substituteText(node.content||"", phs, mode, "", node.scene, work.scenes, phValues)
  content = content.replace(/\n/g,"<br>")
  
  const allNodes = work.nodes||[]
  const currentIdx = allNodes.findIndex(n=>n.id===node.id)
  
  const choices = (node.choices||[]).map((c,i)=>{
    const label = substituteText(c.text||"", phs, mode, "", node.scene, work.scenes, phValues)
    return `<div class="reader-choice" onclick="readerGoToNode('${work.id}','${c.targetId}')">
      <span class="label">选项 ${i+1}</span>${escHtml(label)}
    </div>`
  }).join("") || `<div class="reader-choice" style="cursor:default;opacity:.6;border-color:var(--c-border)">
    <span class="label">RW</span>故事到这里就结束了
  </div>`
  
  const dots = allNodes.map((n,i)=>{
    let cls="dot"
    if(i===currentIdx) cls+=" current"
    return `<div class="${cls}"></div>`
  }).join("")
  
  return `
    <div class="reader-progress">${dots}</div>
    <div class="reader-header">
      <h1 class="reader-title">${escHtml(work.title)}</h1>
      <div class="reader-meta"><span>${escHtml(work.author||"")}</span></div>
    </div>
    <div class="reader-content">${content}</div>
    <div class="reader-choices">${choices}</div>
  `
}

function renderPhoneReader(workId, work){
  const state = getReaderState(workId)
  const phs = work.placeholders||[]
  const unfilled = phs.filter(p=>p.prompt&&!state.phValues[p.id])
  
  if(unfilled.length>0){
    return renderPlaceholderForm(work, state)
  }
  
  return renderPhoneViewer(work, state)
}

function renderPhoneViewer(work, state){
  const pd = work.phoneData||{}
  const contacts = pd.contacts||[]
  const apps = pd.apps||[]
  
  return `
    <div class="reader-header">
      <h1 class="reader-title">${escHtml(work.title)}</h1>
      <div class="reader-meta"><span>${escHtml(work.author||"")}</span></div>
    </div>
    <div class="phone-frame" style="margin:24px auto">
      <div class="phone-statusbar">
        <span>${new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})}</span>
        <span style="opacity:0">--</span>
      </div>
      <div id="readerPhoneContent">
        <div class="phone-header"><span class="title">Tuuru Phone</span></div>
        <div class="phone-body" style="display:flex;flex-direction:column;gap:6px;align-items:center;padding-top:40px">
          <div style="width:64px;height:64px;border-radius:50%;background:var(--c-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.5rem;margin-bottom:8px"></div>
          <div style="font-weight:600;font-size:1rem;margin-bottom:4px">${escHtml(work.title)}</div>
          <div style="font-size:.8rem;color:#999;margin-bottom:24px">${escHtml(work.desc||"")}</div>
          <div class="grid-2" style="width:100%;gap:12px" id="readerHomeGrid">
            <div class="card" style="text-align:center;padding:16px;cursor:pointer" onclick="readerPhoneView('${work.id}','chatlist')"><div style="font-size:2rem"></div><div style="font-size:.8rem;margin-top:4px;color:var(--c-text2)">聊天 (${(pd.chats||[]).length})</div></div>
            <div class="card" style="text-align:center;padding:16px;cursor:pointer" onclick="readerPhoneView('${work.id}','moment')"><div style="font-size:2rem"></div><div style="font-size:.8rem;margin-top:4px;color:var(--c-text2)">朋友圈 (${(pd.moments||[]).length})</div></div>
            <div class="card" style="text-align:center;padding:16px;cursor:pointer" onclick="readerPhoneView('${work.id}','forum')"><div style="font-size:2rem"></div><div style="font-size:.8rem;margin-top:4px;color:var(--c-text2)">论坛 (${(pd.forumPosts||[]).length})</div></div>
            <div class="card" style="text-align:center;padding:16px;cursor:pointer"><div style="font-size:2rem"></div><div style="font-size:.8rem;margin-top:4px;color:var(--c-text2)">联系人 (${contacts.length})</div></div>
          </div>
        </div>
      </div>
      <div class="phone-tabbar">
        <div class="phone-tab active" onclick="readerPhoneView('${work.id}','home')"><span class="icon"></span>首页</div>
        <div class="phone-tab" onclick="readerPhoneView('${work.id}','chatlist')"><span class="icon"></span>消息</div>
        <div class="phone-tab" onclick="readerPhoneView('${work.id}','moment')"><span class="icon"></span>动态</div>
      </div>
    </div>
  `
}

function escHtml(s){if(!s)return "";const d=document.createElement("div");d.textContent=s;return d.innerHTML}
function escAttr(s){if(!s)return "";return s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}

// Global functions
window.checkReaderPw = function(wid){
  const inp = document.getElementById("readerPwInput")
  const work = getWork(wid)
  if(inp && work && inp.value===work.password){
    sessionStorage.setItem("rw_pw_"+wid, "1")
    document.getElementById("app").querySelector("main").innerHTML = renderReader(wid)
  }else{
    showToast("密码错误","error")
  }
}

window.submitReaderPH = function(wid){
  const work = getWork(wid)
  if(!work) return
  const state = getReaderState(wid)
  const phs = (work.placeholders||[]).filter(p=>p.prompt&&!state.phValues[p.id])
  
  for(const ph of phs){
    const inp = document.getElementById("ph_"+ph.id)
    if(inp){
      const raw = inp.value.trim()
      state.phValues[ph.id] = raw ? raw.split(/[,，\s]+/).filter(Boolean) : [""]
    }
  }
  
  state.nodeId = work.startNode
  state.history = state.history||[]
  state.history.push(work.startNode)
  saveReaderState(wid, state)
  
  const main = document.getElementById("app").querySelector("main")
  if(main) main.innerHTML = renderReader(wid)
}


window.readerOpenApp = function(wid, aid){
  const w=getWork(wid);const a=w?.phoneData?.apps?.find(x=>x.id===aid);if(!a)return
  const container=document.getElementById("readerPhoneContent");if(!container)return
  const contacts=w.phoneData.contacts||[]
  const sub=(t)=>substituteText(t||"",w.placeholders||[],w.placeholderMode||"each","","",w.scenes,w.readerState||{})

  if(a.type==="chat"){
    const chats=a.content.chats||[]
    container.innerHTML='<div class="phone-header"><span style="cursor:pointer" onclick="readerPhoneView(\''+wid+'\',\'home\')">?</span><span class="title">'+escHtml(a.name)+'</span><span></span></div><div class="phone-body" style="min-height:400px">'+
      (chats.map(function(ch){var n=ch.type==="group"?ch.groupName:(contacts.find(function(c){return c.id===ch.contactIds?.[0]})?.name||"??");var l=ch.messages?.[ch.messages.length-1];return'<div class="contact-item" onclick="readerPhoneOpenChat(\''+wid+'\',\''+ch.id+'\')"><div class="contact-avatar" style="background:'+(ch.type==="group"?"#10b981":"#6366f1")+'">'+(ch.type==="group"?"??":(n[0]||"?"))+'</div><div class="contact-info"><div class="contact-name">'+sub(n)+'</div><div class="contact-desc">'+(l?sub(l.text):"")+'</div></div></div>'}).join("")||"<div class=\'text-sm text-muted\' style=\'text-align:center;padding:40px 0\'>????</div>")+'</div>'
  }
  else if(a.type==="forum"){
    const posts=a.content.posts||[]
    container.innerHTML='<div class="phone-header"><span style="cursor:pointer" onclick="readerPhoneView(\''+wid+'\',\'home\')">?</span><span class="title">'+escHtml(a.name)+'</span><span></span></div><div class="phone-body" style="min-height:400px">'+
      (posts.map(function(p){var c=contacts.find(function(x){return x.id===p.contactId});var nm=c?.name||"??";return'<div class="forum-post" style="box-shadow:none;border-bottom:1px solid #eee;border-radius:0;padding:12px 0"><div class="forum-post-header"><div class="forum-avatar" style="background:'+avatarColor(c?.avatarId||p.contactId)+'">'+nm[0]+'</div><div><span class="forum-user">'+sub(nm)+'</span><div class="forum-source">'+(p.time||"")+'</div></div></div><div class="forum-content">'+sub(p.content||"")+'</div><div class="forum-actions"><span>?? '+(p.likes?.length||0)+'</span><span>?? '+(p.comments?.length||0)+'</span></div></div>'}).join("")||"<div class=\'text-sm text-muted\' style=\'text-align:center;padding:40px 0\'>????</div>")+'</div>'
  }
  else if(a.type==="memo"){
    const notes=a.content.notes||[];const nlist=notes.map(function(n){return'<div class="card" style="padding:12px;margin-bottom:6px"><div style="font-weight:600;font-size:.85rem">'+sub(n.title||"")+'</div><div class="text-sm text-muted">'+sub(n.body||"")+'</div></div>'}).join("")||"<div class=\'text-sm text-muted\' style=\'text-align:center;padding:40px 0\'>????</div>"
    container.innerHTML='<div class="phone-header"><span style="cursor:pointer" onclick="readerPhoneView(\''+wid+'\',\'home\')">?</span><span class="title">'+escHtml(a.name)+'</span><span></span></div><div class="phone-body" style="min-height:400px">'+nlist+'</div>'
  }
  else if(a.type==="gallery"){
    const imgs=a.content.images||[];const gl=imgs.map(function(img){return'<img src="'+escAttr(img)+'" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px;background:#eee;margin-bottom:4px" onerror="this.style.display=\'none\'">'}).join("")||"<div class=\'text-sm text-muted\' style=\'text-align:center;padding:40px 0\'>????</div>"
    container.innerHTML='<div class="phone-header"><span style="cursor:pointer" onclick="readerPhoneView(\''+wid+'\',\'home\')">?</span><span class="title">'+escHtml(a.name)+'</span><span></span></div><div class="phone-body" style="min-height:400px"><div class="grid-2" style="gap:4px">'+gl+'</div></div>'
  }
  else if(a.type==="browser"){
    const bk=a.content.bookmarks||[];const hist=a.content.history||[]
    container.innerHTML='<div class="phone-header"><span style="cursor:pointer" onclick="readerPhoneView(\''+wid+'\',\'home\')">?</span><span class="title">'+escHtml(a.name)+'</span><span></span></div><div class="phone-body" style="min-height:400px"><div style="font-weight:600;font-size:.85rem;margin-bottom:8px">?? ??</div>'+
      (bk.length?bk.map(function(b){return'<div class="tag" style="margin-bottom:4px">?? '+sub(b)+'</div>'}).join(""):"<div class=\'text-sm text-muted\'>????</div>")+
      '<div class="divider"></div><div style="font-weight:600;font-size:.85rem;margin-bottom:8px">?? ????</div>'+
      (hist.length?hist.map(function(h){return'<div class="text-sm" style="padding:4px 0;border-bottom:1px solid #f0f0f0">'+sub(h)+'</div>'}).join(""):"<div class=\'text-sm text-muted\'>????</div>")+'</div>'
  }
  else{
    container.innerHTML='<div class="phone-header"><span style="cursor:pointer" onclick="readerPhoneView(\''+wid+'\',\'home\')">?</span><span class="title">'+escHtml(a.name)+'</span><span></span></div><div class="phone-body" style="min-height:400px;display:flex;align-items:center;justify-content:center;color:#999">?? ???App</div>'
  }
}
window.readerGoToNode = function(wid, nid){
  const state = getReaderState(wid)
  state.nodeId = nid
  state.history = state.history||[]
  state.history.push(nid)
  saveReaderState(wid, state)
  
  const main = document.getElementById("app").querySelector("main")
  if(main) main.innerHTML = renderReader(wid)
  window.scrollTo(0,0)
}

window.readerPhoneView = function(wid, view){
  const work = getWork(wid)
  const pd = work?.phoneData
  const container = document.getElementById("readerPhoneContent")
  if(!container||!pd) return
  
  const contacts = pd.contacts||[]
  const state = getReaderState(wid)
  const phs = work.placeholders||[]
  const mode = work.placeholderMode||"each"
  
  const sub = (text)=>substituteText(text||"", phs, mode, "", "", work.scenes, state.phValues)
  
  if(view==="chatlist"){
    container.innerHTML = `<div class="phone-header"><span class="title">聊天</span></div>
      <div class="phone-body" style="min-height:400px">${(pd.chats||[]).map(ch=>{
        const n=ch.type==="group"?ch.groupName:contacts.find(c=>c.id===ch.contactIds?.[0])?.name||"未知"
        const l=ch.messages?.[ch.messages.length-1]
        return `<div class="contact-item" onclick="readerPhoneOpenChat('${wid}','${ch.id}')"><div class="contact-avatar" style="background:${ch.type==="group"?"#10b981":"#6366f1"}">${ch.type==="group"?"👥":(n[0])}</div>
          <div class="contact-info"><div class="contact-name">${sub(n)}</div><div class="contact-desc">${l?sub(l.text):""}</div></div></div>`
      }).join("")||"<div class='text-sm text-muted' style='text-align:center;padding:40px 0'>暂无聊天</div>"}</div>`
    document.querySelectorAll('.phone-tab')[1].classList.add('active');document.querySelectorAll('.phone-tab')[0].classList.remove('active')
  }else if(view==="moment"){
    container.innerHTML = `<div class="phone-header"><span class="title">朋友圈</span></div>
      <div class="phone-body" style="min-height:400px">${(pd.moments||[]).map(m=>{
        const c=contacts.find(x=>x.id===m.contactId);const nm=c?.name||"未知"
        return `<div class="moment-card"><div class="moment-header"><div class="moment-avatar" style="background:${avatarColor(c?.avatarId||m.contactId)}">${nm[0]}</div>
          <div><div class="moment-user">${sub(nm)}</div><div class="moment-time">${m.time||""}</div></div></div>
          <div class="moment-content">${sub(m.content||"")}</div>
          ${m.images?.length?`<div class="moment-images ${m.images.length===1?"single":""}">${m.images.map(img=>`<img src="${escAttr(img)}" onerror="this.style.display='none'">`).join("")}</div>`:""}
          <div class="moment-actions"><span> ${m.likes?.length||0}</span><span> ${m.comments?.length||0}</span></div></div>`
      }).join("")||"<div class='text-sm text-muted' style='text-align:center;padding:40px 0'>暂无动态</div>"}</div>`
    document.querySelectorAll('.phone-tab')[2].classList.add('active');document.querySelectorAll('.phone-tab')[0].classList.remove('active')
  }else if(view==="forum"){
    const pL={x:"𝕏",weibo:"微博",douban:"豆瓣",tieba:"贴吧"}
    container.innerHTML = `<div class="phone-header"><span class="title">论坛</span></div>
      <div class="phone-body" style="min-height:400px">${(pd.forumPosts||[]).map(p=>{
        const c=contacts.find(x=>x.id===p.contactId);const nm=c?.name||"未知"
        return `<div class="forum-post" style="box-shadow:none;border-bottom:1px solid #eee;border-radius:0;padding:12px 0"><div class="forum-post-header"><div class="forum-avatar" style="background:${avatarColor(c?.avatarId||p.contactId)}">${nm[0]}</div>
          <div><span class="forum-user">${sub(nm)}</span> <span class="forum-platform ${p.platform}">${pL[p.platform]||p.platform}</span><div class="forum-source">${p.time||""}</div></div></div>
          <div class="forum-content">${sub(p.content||"")}</div>
          <div class="forum-actions"><span> ${p.likes?.length||0}</span><span>🔁 ${p.reposts?.length||0}</span><span> ${p.comments?.length||0}</span></div></div>`
      }).join("")||"<div class='text-sm text-muted' style='text-align:center;padding:40px 0'>暂无帖子</div>"}</div>`
  }else{
    // home
    container.innerHTML = `<div class="phone-header"><span class="title">Tuuru Phone</span></div>
      <div class="phone-body" style="display:flex;flex-direction:column;gap:6px;align-items:center;padding-top:40px">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--c-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.5rem;margin-bottom:8px"></div>
        <div style="font-weight:600;font-size:1rem;margin-bottom:4px">${sub(work.title)}</div>
        <div style="font-size:.8rem;color:#999;margin-bottom:24px">${sub(work.desc||"")}</div>
        <div class="grid-2" style="width:100%;gap:12px">
          <div class="card" style="text-align:center;padding:16px;cursor:pointer" onclick="readerPhoneView('${wid}','chatlist')"><div style="font-size:2rem"></div><div style="font-size:.8rem;margin-top:4px;color:var(--c-text2)">聊天 (${(pd.chats||[]).length})</div></div>
          <div class="card" style="text-align:center;padding:16px;cursor:pointer" onclick="readerPhoneView('${wid}','moment')"><div style="font-size:2rem"></div><div style="font-size:.8rem;margin-top:4px;color:var(--c-text2)">朋友圈 (${(pd.moments||[]).length})</div></div>
          <div class="card" style="text-align:center;padding:16px;cursor:pointer" onclick="readerPhoneView('${wid}','forum')"><div style="font-size:2rem"></div><div style="font-size:.8rem;margin-top:4px;color:var(--c-text2)">论坛 (${(pd.forumPosts||[]).length})</div></div>
          <div class="card" style="text-align:center;padding:16px;cursor:pointer"><div style="font-size:2rem"></div><div style="font-size:.8rem;margin-top:4px;color:var(--c-text2)">联系人 (${(pd.contacts||[]).length})</div></div>
        </div></div>`
    document.querySelectorAll('.phone-tab')[0].classList.add('active');document.querySelectorAll('.phone-tab')[1].classList.remove('active');document.querySelectorAll('.phone-tab')[2].classList.remove('active')
  }
}

window.readerPhoneOpenChat = function(wid, cid){
  const work = getWork(wid); const pd = work?.phoneData; const ch = pd?.chats?.find(x=>x.id===cid)
  if(!ch) return; const container = document.getElementById("readerPhoneContent"); if(!container) return
  const contacts = pd.contacts||[]
  const state = getReaderState(wid)
  const phs = work.placeholders||[]
  const mode = work.placeholderMode||"each"
  const sub = (text)=>substituteText(text||"", phs, mode, "", "", work.scenes, state.phValues)
  const cname = ch.type==="group"?ch.groupName:contacts.find(x=>x.id===ch.contactIds?.[0])?.name||"聊天"
  
  container.innerHTML = `<div class="phone-header"><span style="cursor:pointer" onclick="readerPhoneView('${wid}','chatlist')"></span><span class="title">${sub(cname)}</span><span></span></div>
    <div class="phone-body" style="min-height:400px;max-height:500px;overflow-y:auto">${(ch.messages||[]).map(msg=>{
      const s=contacts.find(x=>x.id===msg.senderId);const isSelf=!msg.senderId
      return `<div class="chat-msg ${isSelf?"self":"other"}">${!isSelf?`<div class="chat-avatar" style="background:${avatarColor(s?.avatarId||msg.senderId)}">${(s?.name||"?")[0]}</div>`:""}<div><div class="chat-bubble">${sub(msg.text||"")}${msg.image?`<br><img src="${escAttr(msg.image)}" style="max-width:160px;border-radius:6px">`:""}</div>${msg.time?`<div class="chat-time">${msg.time}</div>`:""}</div></div>`
    }).join("")||"<div class='text-sm text-muted' style='text-align:center;padding:40px 0'>暂无消息</div>"}</div>
    <div class="chat-input-bar"><input placeholder="输入消息..." style="flex:1;padding:8px 14px;border-radius:20px;border:1px solid #e5e5e5" disabled><button class="btn btn-sm btn-primary" disabled>发送</button></div>`
}
function phsWithValues(phs, phValues){return phs.map(ph=>({...ph, values: (phValues[ph.id]||[])}))}
