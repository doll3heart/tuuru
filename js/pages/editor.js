import { getWork, updateWork, addNode, updateNode, deleteNode, addChoice, updateChoice, deleteChoice, addScene, deleteScene, addPlaceholder, updatePlaceholder, deletePlaceholder, addContact, updateContact, deleteContact, addChat, addChatMessage, deleteChat, addMoment, deleteMoment, addForumPost, deleteForumPost, WORK_TYPE, PLACEHOLDER_MODE, PLATFORM, PRESETS, avatarColor, uid, exportWorkAsHTML } from "../data.js"
import { navigate } from "../router.js"
import { showToast } from "../app.js"


export function renderEditor(workId){
  var w = getWork(workId);
  if(!w) return "<div class=\"app-main\"><div class=\"empty-state\"><div class=\"empty-icon\"></div><h3>\u4f5c\u54c1\u672a\u627e\u5230</h3></div></div>";
  var ns = w.nodes || [];
  var ai = sessionStorage.getItem("tn_" + workId);
  if(!ai || !ns.find(function(n){return n.id===ai})) ai = ns[0] ? ns[0].id : "";
  var an = ns.find(function(n){return n.id===ai});

  // Left icon bar - simplified: placeholder, choices, image, audio
  var L = "<div class=\"editor-iconbar\">";
  L += "<button data-c=\"ph\" data-w=\""+workId+"\" title=\"\u5360\u4f4d\u7b26\">{}</button>";
  L += "<button data-c=\"ch\" data-w=\""+workId+"\" title=\"\u9009\u9879\">\u21c4</button>";
  L += "<div class=\"divider\"></div>";
  L += "<button data-c=\"img\" title=\"\u56fe\u7247\">\u25a3</button>";
  L += "<button data-c=\"au\" title=\"\u97f3\u4e50\">\u266a</button>";
  L += "<div class=\"divider\"></div>";
  L += "<button data-c=\"und\" title=\"\u64a4\u56de\">\u21a9</button>";
  L += "<button data-c=\"red\" title=\"\u6062\u590d\">\u21aa</button>";
  L += "<div class=\"divider\"></div>";
  L += "<button data-c=\"settings\" title=\"\u8bbe\u7f6e\" onclick=\"location.hash='#/edit/"+workId+"\">\u2699</button>";
  L += "</div>";

  // Center editor
  var E = "<div class=\"editor-area\">";
  if(an){
    var ct = an.content || "";
    var sc = w.scenes || [];
    E += "<div class=\"editor-header\">";
    E += "<input class=\"node-name\" id=\"nn_"+an.id+"\" value=\""+(an.title||"")+"\" placeholder=\"\u8282\u70b9\u6807\u9898\" data-c=\"st\" data-w=\""+workId+"\" data-n=\""+an.id+"\">";
    E += "<div class=\"editor-actions\">";
    E += "<select data-c=\"scene\" data-w=\""+workId+"\" data-n=\""+an.id+"\" style=\"font-size:.75rem;padding:2px 4px;border:1px solid #cad3e0\"><option value=\"\">\u573a\u666f</option>"+sc.map(function(s){return "<option value=\""+s.id+"\""+(an.scene===s.id?" selected":"")+">"+s.name+"</option>"}).join("")+"</select>";
    E += "<button data-c=\"ss\" data-w=\""+workId+"\" data-n=\""+an.id+"\" class=\"btn btn-sm "+(w.startNode===an.id?"btn-primary":"btn-outline")+"\">"+(w.startNode===an.id?"\u8d77\u59cb\u8282\u70b9":"\u8bbe\u4e3a\u8d77\u59cb")+"</button>";
    E += "</div><div class=\"word-count\"><span id=\"wc_"+an.id+"\">"+ct.length+"</span> \u5b57</div></div>";

    // Toolbar - full from moirain
    E += "<div class=\"editor-toolbar\">";
    E += "<button class=\"bold\" data-c=\"bold\" data-n=\""+an.id+"\"><b>B</b></button>";
    E += "<button class=\"italic\" data-c=\"italic\" data-n=\""+an.id+"\"><i>I</i></button>";
    E += "<button class=\"underline\" data-c=\"uline\" data-n=\""+an.id+"\"><u>U</u></button>";
    E += "<div class=\"tb-divider\"></div>";
    E += "<button data-c=\"h2\" data-n=\""+an.id+"\">H2</button>";
    E += "<button data-c=\"h3\" data-n=\""+an.id+"\">H3</button>";
    E += "<button data-c=\"para\" data-n=\""+an.id+"\">P</button>";
    E += "<div class=\"tb-divider\"></div>";
    E += "<button data-c=\"ul\" data-n=\""+an.id+"\">UL</button>";
    E += "<button data-c=\"ol\" data-n=\""+an.id+"\">OL</button>";
    E += "<button data-c=\"hr\" data-n=\""+an.id+"\">HR</button>";
    E += "<div class=\"tb-divider\"></div>";
    E += "<button data-c=\"alignL\" data-n=\""+an.id+"\">\u5de6</button>";
    E += "<button data-c=\"alignC\" data-n=\""+an.id+"\">\u4e2d</button>";
    E += "<button data-c=\"alignR\" data-n=\""+an.id+"\">\u53f3</button>";
    E += "<div class=\"tb-divider\"></div>";
    E += "<button data-c=\"ph2\" data-n=\""+an.id+"\" data-w=\""+workId+"\">#\u5360</button>";
    E += "<button data-c=\"img2\">IMG</button>";
    E += "</div>";

    // Content area - use contentEditable div like moirain
    E += "<div class=\"editor-content\">";
    E += "<div class=\"content-editable\" id=\"ce_"+an.id+"\" contenteditable=\"true\" data-c=\"content\" data-w=\""+workId+"\" data-n=\""+an.id+"\" data-placeholder=\"\u5728\u6b64\u8f93\u5165\u7ae0\u8282\u5185\u5bb9\u2026\u2026\">"+ct+"</div>";
    // Hidden textarea for the actual content storage
    E += "<textarea id=\"nc_"+an.id+"\" style=\"display:none\">"+ct+"</textarea>";
    E += "</div>";
  } else {
    E += "<div class=\"editor-content\" style=\"display:flex;align-items:center;justify-content:center;padding:80px 20px;text-align:center;color:#7a8ba8\"><p>\u9009\u62e9\u4e00\u4e2a\u8282\u70b9\u5f00\u59cb\u7f16\u8f91</p></div>";
  }
  E += "</div>";

  // World Tree - right panel with chapters and drag-drop
  var W = "<div class=\"world-tree\" id=\"worldTree\">";
  W += "<div class=\"wt-header\"><span>\u8282\u70b9\u5217\u8868</span><div><button data-c=\"addch\" data-w=\""+workId+"\">+\u7ae0</button><button data-c=\"addn\" data-w=\""+workId+"\">+</button></div></div>";
  W += "<div class=\"wt-body\" id=\"wtBody\">";
  if(ns.length==0){
    W += "<div class=\"wt-empty\">\u6682\u65e0\u8282\u70b9</div>";
  } else {
    // Simple flat list (no chapters since Tuuru doesn't have chapter support yet)
    ns.forEach(function(n){
      var ac = n.id === ai ? " active" : "";
      W += "<div class=\"wt-node"+ac+"\" draggable=\"true\" data-c=\"sel\" data-w=\""+workId+"\" data-n=\""+n.id+"\">";
      W += "<span class=\"dot\"></span>";
      W += "<span class=\"node-label\">"+(n.title||"\u8282\u70b9")+"</span>";
      W += "<span class=\"node-actions\">";
      W += "<button data-c=\"rn2\" data-w=\""+workId+"\" data-n=\""+n.id+"\" title=\"\u91cd\u547d\u540d\">N</button>";
      W += "<button data-c=\"dup2\" data-w=\""+workId+"\" data-n=\""+n.id+"\" title=\"\u590d\u5236\">D</button>";
      W += "<button data-c=\"del2\" data-w=\""+workId+"\" data-n=\""+n.id+"\" title=\"\u5220\u9664\" class=\"del\">X</button>";
      W += "</span></div>";
    });
  }
  W += "</div></div>";

  return "<div class=\"editor-page\"><div class=\"editor-body-area\">"+L+E+W+"</div></div>";
}
function renderSidebar(work){
  const isArticle = work.type===WORK_TYPE.ARTICLE
  const isPhone = work.type===WORK_TYPE.PHONE
  let items = [{id:"settings", label:"作品设置"}]
  if(isArticle){items.push({id:"nodes", label:"节点管理"},{id:"scenes", label:"场景管理"},{id:"placeholders", label:"占位符"},{id:"preview", label:"预览"})}
  if(isPhone){items.push({id:"contacts", label:"联系人"},{id:"apps", label:"手机App"},{id:"placeholders", label:"占位符"},{id:"preview_phone", label:"预览"})}
  items.push({id:"export", label:"导出"})
  return items.map((item,i)=>`<div class="editor-sidebar-item ${i===0?"active":""}" data-section="${item.id}" onclick="switchEditorSection('${work.id}','${item.id}',this)">${item.icon} ${item.label}</div>`).join("")
}

function renderSettings(work){
  return `<div class="card"><div class="card-header"><span class="card-title"> 作品设置</span></div>
    <div class="form-group"><label class="form-label">作品标题</label><input class="form-input" id="setTitle" value="${escAttr(work.title)}" onchange="saveWorkSetting('${work.id}','title',this.value)"></div>
    <div class="form-group"><label class="form-label">作品描述</label><textarea class="form-textarea" id="setDesc" onchange="saveWorkSetting('${work.id}','desc',this.value)">${escAttr(work.desc||"")}</textarea></div>
    <div class="form-group"><label class="form-label">作者署名</label><input class="form-input" id="setAuthor" value="${escAttr(work.author||"")}" onchange="saveWorkSetting('${work.id}','author',this.value)"></div>
    <div class="divider"></div>
    <div class="card-title" style="margin-bottom:12px">🔒 访问控制</div>
    <div class="form-group"><label class="form-label">阅读密码（留空则不设密码）</label><input class="form-input" type="password" id="setPassword" value="${escAttr(work.password||"")}" onchange="saveWorkSetting('${work.id}','password',this.value)" placeholder="设置密码后读者需验证"></div>
    <div class="grid-2">
      <div class="form-group"><label class="form-label">锁定状态</label><select class="form-select" onchange="saveWorkSetting('${work.id}','locked',this.value==='true')"><option value="false" ${!work.locked?"selected":""}>未锁定</option><option value="true" ${work.locked?"selected":""}>已锁定</option></select></div>
    </div>
    <div class="form-group" style="${work.type!==WORK_TYPE.ARTICLE?"display:none":""}">
      <label class="form-label">占位符替换模式</label>
      <select class="form-select" onchange="saveWorkSetting('${work.id}','placeholderMode',this.value)">
        <option value="${PLACEHOLDER_MODE.RANDOM_EACH}" ${work.placeholderMode===PLACEHOLDER_MODE.RANDOM_EACH?"selected":""}>全文随机替换</option>
        <option value="${PLACEHOLDER_MODE.FIXED_SCENE}" ${work.placeholderMode===PLACEHOLDER_MODE.FIXED_SCENE?"selected":""}>每个场景内固定替换</option>
        <option value="${PLACEHOLDER_MODE.LOCKED}" ${work.placeholderMode===PLACEHOLDER_MODE.LOCKED?"selected":""}>全文锁定</option>
      </select>
    </div>
  </div>`
}

function escHtml(s){if(!s)return "";const d=document.createElement("div");d.textContent=s;return d.innerHTML}
function escAttr(s){if(!s)return "";return s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
// New three-column editor layout: iconbar | editor | worldtree
function renderNodes(work){
var ns=work.nodes||[];var ai=sessionStorage.getItem("tn_"+work.id);
if(!ai||!ns.find(function(n){return n.id===ai}))ai=ns[0]?ns[0].id:"";
var an=ns.find(function(n){return n.id===ai});
var R='<div class="editor-iconbar">';
R+='<button data-c="ph" data-w="'+work.id+'">#</button>';
R+='<button data-c="ch" data-w="'+work.id+'">\u21c4</button>';
R+='<div class="divider"></div>';
R+='<button data-c="img">\u25a3</button>';
R+='<button data-c="au">\u266a</button>';
R+='<div class="divider"></div>';
R+='<button data-c="und">\u21a9</button>';
R+='<button data-c="red">\u21aa</button>';
R+='</div>';
R+='<div class="editor-area">';
if(an){
var sc=work.scenes||[];var ct=an.content||"";
R+='<div class="editor-header">';
R+='<input class="node-name" id="nn_'+an.id+'" value="'+an.title+'" placeholder="\u8282\u70b9\u6807\u9898" data-c="st" data-w="'+work.id+'" data-n="'+an.id+'">';
R+='<div class="editor-actions"><select data-c="scene" data-w="'+work.id+'" data-n="'+an.id+'" style="font-size:.75rem;padding:2px 4px;border:1px solid #cad3e0"><option value="">\u573a\u666f</option>'+sc.map(function(s){return '<option value="'+s.id+'"'+(an.scene===s.id?' selected':'')+'>'+s.name+'</option>'}).join('')+'</select>';
R+='<button data-c="ss" data-w="'+work.id+'" data-n="'+an.id+'" class="btn btn-sm '+(work.startNode===an.id?'btn-primary':'btn-outline')+'">'+(work.startNode===an.id?'\u8d77\u59cb\u8282\u70b9':'\u8bbe\u4e3a\u8d77\u59cb')+'</button>';
R+='</div><div class="word-count"><span id="wc_'+an.id+'">'+ct.length+'</span> \u5b57</div></div>';
R+='<div class="editor-toolbar"><button class="bold" data-c="bold" data-n="'+an.id+'"><b>B</b></button><button class="italic" data-c="italic" data-n="'+an.id+'"><i>I</i></button><div class="tb-divider"></div><button data-c="wrap" data-n="'+an.id+'">\u300c\u300d</button><div class="tb-divider"></div><button data-c="ph2" data-n="'+an.id+'" data-w="'+work.id+'">#\u5360\u4f4d\u7b26</button><button data-c="img2">IMG</button></div>';
R+='<div class="editor-content"><textarea class="content-area" id="nc_'+an.id+'" placeholder="\u5728\u6b64\u8f93\u5165\u7ae0\u8282\u5185\u5bb9" oninput="ccu(\''+an.id+'\');snc(\''+work.id+'\',\''+an.id+'\')">'+ct+'</textarea></div>';
}else{R+='<div class="editor-content" style="display:flex;align-items:center;justify-content:center;padding:80px 20px;text-align:center;color:#7a8ba8"><p>\u9009\u62e9\u4e00\u4e2a\u8282\u70b9\u5f00\u59cb\u7f16\u8f91</p></div>';}
R+='</div>';
R+='<div class="world-tree"><div class="wt-header"><span>\u8282\u70b9</span><button data-c="addn" data-w="'+work.id+'">+</button></div><div style="flex:1;overflow-y:auto;padding:4px 0">';
if(ns.length==0){R+='<div style="text-align:center;padding:20px;font-size:.75rem;color:#7a8ba8">\u6682\u65e0\u8282\u70b9</div>';}else{ns.forEach(function(n){
var ac=n.id===ai?' active':'';
R+='<div class="wt-node'+ac+'" data-c="sel" data-w="'+work.id+'" data-n="'+n.id+'">';
R+='<span class="dot"></span><span class="node-label">'+(n.title||'\u8282\u70b9')+'</span>';
R+='<span class="node-actions"><button data-c="up" data-w="'+work.id+'" data-n="'+n.id+'">\u2191</button><button data-c="dn" data-w="'+work.id+'" data-n="'+n.id+'">\u2193</button><button data-c="del" data-w="'+work.id+'" data-n="'+n.id+'" class="del">\u2715</button></span></div>';
});}
R+='</div></div>';
R+='<div class="ctx-menu" id="ctxMenu" style="display:none"><div class="ctx-item" data-c="rn">\u91cd\u547d\u540d</div><div class="ctx-item" data-c="dup">\u590d\u5236</div><div class="ctx-item danger" data-c="del2">\u5220\u9664</div></div>';
return R;
}function renderScenes(work){
  return `<div class="card"><div class="card-header"><span class="card-title"> 场景管理</span></div>
    <p class="text-sm text-muted mb-4">场景用于占位符的「每个场景内固定替换」模式。每个节点可以归属一个场景。</p>
    <div class="flex-row mb-4"><input class="form-input" id="newSceneName" style="width:200px" placeholder="场景名称"><button class="btn btn-sm btn-primary" onclick="addSceneToWork('${work.id}')">+ 添加场景</button></div>
    ${(work.scenes||[]).length===0?`<div class="text-sm text-muted">暂无场景</div>`:`<div class="flex-row">${(work.scenes||[]).map(s=>`<div class="tag">${escHtml(s.name)} <span class="remove" onclick="if(confirm('确定删除？'))deleteSceneFromWork('${work.id}','${s.id}')">&times;</span></div>`).join("")}</div>`}
  </div>`
}
function renderPlaceholders(work){
  const phs = work.placeholders||[]
  return `<div class="card"><div class="card-header"><span class="card-title"> 占位符管理</span></div>
    <p class="text-sm text-muted mb-4">占位符可以让读者在阅读前填写信息，自动替换文中的占位标记。</p>
    <div class="flex-row mb-4">
      <button class="btn btn-sm btn-outline" onclick="addPreset('${work.id}','basic')"> 基础预设</button>
      <button class="btn btn-sm btn-outline" onclick="addPreset('${work.id}','detailed')"> 详细预设</button>
      <button class="btn btn-sm btn-primary" onclick="addCustomPH('${work.id}')">+ 自定义</button>
    </div>
    ${!phs.length?`<div class="text-sm text-muted">暂无占位符</div>`:phs.map(ph=>`
      <div class="card" style="padding:12px;margin-bottom:8px">
        <div class="flex-row gap-sm mb-2">
          <div style="font-weight:600;font-size:.9rem;flex:1">${escHtml(ph.label)}</div>
          <select class="form-select" style="width:auto;font-size:.8rem;padding:2px 8px" onchange="updatePH('${work.id}','${ph.id}','mode',this.value)">
            <option value="${PLACEHOLDER_MODE.RANDOM_EACH}" ${ph.mode===PLACEHOLDER_MODE.RANDOM_EACH?"selected":""}>随机</option>
            <option value="${PLACEHOLDER_MODE.FIXED_SCENE}" ${ph.mode===PLACEHOLDER_MODE.FIXED_SCENE?"selected":""}>场景固定</option>
            <option value="${PLACEHOLDER_MODE.LOCKED}" ${ph.mode===PLACEHOLDER_MODE.LOCKED?"selected":""}>锁定</option>
          </select>
          <button class="btn btn-sm btn-ghost" onclick="deletePH('${work.id}','${ph.id}')"></button>
        </div>
        <div class="form-group" style="margin-bottom:4px">
          <div class="flex-row gap-sm">
            <input class="form-input" style="flex:1;font-size:.8rem;padding:4px 8px" value="${escAttr(ph.prompt||"")}" placeholder="读者提示" onchange="updatePH('${work.id}','${ph.id}','prompt',this.value)">
            <input class="form-input" style="width:80px;font-size:.8rem;padding:4px 8px" value="${escAttr(ph.key)}" placeholder="键名" onchange="updatePH('${work.id}','${ph.id}','key',this.value)">
          </div>
        </div>
        <div class="text-xs text-muted">替换文中：${getPHPatterns(ph.key)}</div>
      </div>
    `).join("")}
  </div>`
}
function getPHPatterns(k){const m={name:"某某/XX",nickname:"小某/小X",food:"食物/好吃的",color:"颜色/彩色"};return m[k]||k}
function renderContacts(work){
  const contacts = work.phoneData?.contacts||[]
  return `<div class="card"><div class="card-header"><span class="card-title"> 联系人 (${contacts.length})</span><button class="btn btn-sm btn-primary" onclick="openContactEditor('${work.id}')">+ 新建</button></div>
    ${!contacts.length?`<div class="text-sm text-muted">暂无联系人</div>`:contacts.map(c=>`
      <div class="contact-item">
        <div class="contact-avatar" style="background:${avatarColor(c.avatarId||c.id)}">${(c.name||"?")[0]}</div>
        <div class="contact-info"><div class="contact-name">${escHtml(c.name)}</div><div class="contact-desc">${escHtml(c.desc||"")}</div></div>
        <button class="btn btn-sm btn-ghost" onclick="editContact('${work.id}','${c.id}')"></button>
        <button class="btn btn-sm btn-ghost" onclick="if(confirm('删除？'))deleteContactFromWork('${work.id}','${c.id}')"></button>
      </div>
    `).join("")}
  </div>`
}
function renderChats(work){
  const chats = work.phoneData?.chats||[]; const contacts = work.phoneData?.contacts||[]
  return `<div class="card"><div class="card-header"><span class="card-title"> 聊天 (${chats.length})</span><div class="flex-row gap-sm"><button class="btn btn-sm btn-outline" onclick="openChatEditor('${work.id}','single')">+ 单人</button><button class="btn btn-sm btn-outline" onclick="openChatEditor('${work.id}','group')">+ 群聊</button></div></div>
    ${!chats.length?`<div class="text-sm text-muted">暂无聊天</div>`:chats.map(ch=>{
      const isG=ch.type==="group"; const name=isG?ch.groupName:contacts.find(c=>c.id===ch.contactIds?.[0])?.name||"未知"; const prev=ch.messages?.length?ch.messages[ch.messages.length-1].text:""
      return `<div class="contact-item" onclick="openChatDetailEditor('${work.id}','${ch.id}')">
        <div class="contact-avatar" style="background:${isG?"#10b981":"#6366f1"}">${isG?"👥":(name[0]||"?")}</div>
        <div class="contact-info"><div class="contact-name">${escHtml(name)} ${isG?'<span class="badge badge-success">群聊</span>':''}</div><div class="contact-desc">${escHtml(prev||"")}</div></div>
        <span class="contact-time">${ch.messages?.length||0}条</span>
        <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();if(confirm('删除？'))deleteChatFromWork('${work.id}','${ch.id}')"></button>
      </div>`
    }).join("")}
  </div>`
}
function renderMoments(work){
  const moments=work.phoneData?.moments||[]; const contacts=work.phoneData?.contacts||[]
  return `<div class="card"><div class="card-header"><span class="card-title"> 朋友圈 (${moments.length})</span><button class="btn btn-sm btn-primary" onclick="openMomentEditor('${work.id}')">+ 新建</button></div>
    ${!moments.length?`<div class="text-sm text-muted">暂无动态</div>`:moments.map(m=>{
      const c=contacts.find(x=>x.id===m.contactId);const name=c?.name||"未知"
      return `<div class="moment-card"><div class="moment-header"><div class="moment-avatar" style="background:${avatarColor(c?.avatarId||m.contactId)}">${name[0]}</div><div><div class="moment-user">${escHtml(name)}</div><div class="moment-time">${escHtml(m.time||"")}</div></div></div>
        <div class="moment-content">${escHtml(m.content||"")}</div>
        ${m.images?.length?`<div class="moment-images ${m.images.length===1?"single":""}">${m.images.map(img=>`<img src="${escAttr(img)}" onerror="this.style.display='none'">`).join("")}</div>`:""}
        <div class="moment-actions"><span> ${m.likes?.length||0}</span><span> ${m.comments?.length||0}</span></div>
        <div class="flex-row" style="margin-top:8px"><button class="btn btn-sm btn-ghost" onclick="editMoment('${work.id}','${m.id}')"></button><button class="btn btn-sm btn-ghost" onclick="if(confirm('删除？'))deleteMomentFromWork('${work.id}','${m.id}')"></button></div>
      </div>`
    }).join("")}
  </div>`
}
function renderForum(work){
  const posts=work.phoneData?.forumPosts||[]; const contacts=work.phoneData?.contacts||[]
  const pLabels={x:"𝕏",weibo:"微博",douban:"豆瓣",tieba:"贴吧"}
  return `<div class="card"><div class="card-header"><span class="card-title"> 论坛 (${posts.length})</span><button class="btn btn-sm btn-primary" onclick="openForumEditor('${work.id}')">+ 新建</button></div>
    ${!posts.length?`<div class="text-sm text-muted">暂无帖子</div>`:posts.map(p=>{
      const c=contacts.find(x=>x.id===p.contactId);const name=c?.name||"未知"
      return `<div class="forum-post"><div class="forum-post-header"><div class="forum-avatar" style="background:${avatarColor(c?.avatarId||p.contactId)}">${name[0]}</div><div><span class="forum-user">${escHtml(name)}</span> <span class="forum-platform ${p.platform}">${pLabels[p.platform]||p.platform}</span><div class="forum-source">${escHtml(p.time||"")}</div></div></div>
        <div class="forum-content">${escHtml(p.content||"")}</div>
        ${p.images?.length?`<div class="forum-images">${p.images.map(img=>`<img src="${escAttr(img)}" onerror="this.style.display='none'">`).join("")}</div>`:""}
        <div class="forum-actions"><span> ${p.likes?.length||0}</span><span>🔁 ${p.reposts?.length||0}</span><span> ${p.comments?.length||0}</span></div>
        <div class="flex-row" style="margin-top:8px"><button class="btn btn-sm btn-ghost" onclick="editForumPost('${work.id}','${p.id}')"></button><button class="btn btn-sm btn-ghost" onclick="if(confirm('删除？'))deleteForumPostFromWork('${work.id}','${p.id}')"></button></div>
      </div>`
    }).join("")}
  </div>`
}
function renderExport(work){
  return `<div class="card"><div class="card-header"><span class="card-title"> 导出与部署</span></div>
    <div class="mb-4"><p class="text-sm text-muted mb-2">将作品导出为独立的 HTML 文件，可以部署到 GitHub Pages 或其他静态托管服务。</p><button class="btn btn-primary" onclick="exportAsHTML('${work.id}')">📥 导出 HTML 文件</button></div>
    <div class="divider"></div>
    <div class="card" style="background:var(--c-surface2)">
      <div class="card-title" style="font-size:.95rem;margin-bottom:12px">🚀 GitHub Pages 部署教程</div>
      <div style="font-size:.85rem;line-height:1.8">
        <p><b>方法一：GitHub Pages</b></p>
        <ol style="list-style:decimal;padding-left:20px;margin:8px 0">
          <li>在 GitHub 上新建一个仓库</li><li>将导出的 HTML 文件上传到仓库</li>
          <li>进入 Settings  Pages，选择 main 分支</li>
          <li>等待几分钟，作品就会在 https://你的用户名.github.io/仓库名 上线</li>
        </ol>
        <p><b>方法二：Vercel / Netlify</b></p>
        <ol style="list-style:decimal;padding-left:20px;margin:8px 0">
          <li>注册 Vercel 或 Netlify 账号</li><li>拖拽 HTML 文件到部署区域即可自动上线</li>
        </ol>
        <p class="text-xs text-muted mt-2"> 导出的 HTML 为纯静态文件，包含所有样式和脚本，无需服务器支持。</p>
      </div>
    </div>
  </div>`
}
function renderPreviewArticle(work){
  const nodes=work.nodes||[]; const start=nodes.find(n=>n.id===work.startNode)||nodes[0]
  return `<div style="text-align:center;margin-bottom:20px"><h3 style="font-size:1.2rem">${escHtml(work.title)}</h3><p class="text-sm text-muted">预览模式 - 共 ${nodes.length} 个节点</p></div><div id="previewContainer">${start?renderPreviewNode(work,start):"<div class='text-muted'>暂无可预览的内容</div>"}</div>`
}
function renderPreviewNode(work, node){
  if(!node) return "<div class='text-muted'>节点不存在</div>"
  const choices=node.choices||[]
  return `<div class="reader-container" style="padding:0"><div class="reader-content">${node.content||"<p class='text-muted'>（空内容）</p>"}</div>
    ${choices.length?`<div class="reader-choices">${choices.map((c,i)=>`<div class="reader-choice" onclick="previewGoTo('${work.id}','${c.targetId}')"><span class="label">选项 ${i+1}</span>${escHtml(c.text||"继续")}</div>`).join("")}</div>`
    :`<div class="reader-choice" style="cursor:default;border-color:var(--c-border);opacity:.6"><span class="label">RW</span>故事结束</div>`}
  </div>`
}
function renderPreviewPhone(work){
  const pd=work.phoneData
  if(!pd) return "<div class='text-muted'>暂无手机数据</div>"
  return `<div id="phonePreviewContainer">${renderPhonePreview(work)}</div>`
}
function renderPhonePreview(work){
  return `<div class="phone-frame" style="margin:0;border-radius:24px">
    <div class="phone-statusbar"><span>${new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})}</span><span style="opacity:0">--</span></div>
    <div id="phoneAppContent">${renderPhoneHomeView(work)}</div></div>`
}
function renderPhoneHomeView(work){
  const pd=work.phoneData||{}
  return `<div class="phone-header"><span class="title">Tuuru Phone</span></div>
    <div class="phone-body" style="display:flex;flex-direction:column;gap:6px;align-items:center;padding-top:40px">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--c-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.5rem;margin-bottom:8px"></div>
      <div style="font-weight:600;font-size:1rem;margin-bottom:4px">${escHtml(work.title)}</div>
      <div style="font-size:.8rem;color:#999;margin-bottom:24px">${escHtml(work.desc||"")}</div>
      <div class="grid-2" style="width:100%;gap:12px">
        <div class="card" style="text-align:center;padding:16px;cursor:pointer" onclick="phoneSwitchView('${work.id}','chatlist')"><div style="font-size:2rem"></div><div style="font-size:.8rem;margin-top:4px;color:var(--c-text2)">聊天 (${(pd.chats||[]).length})</div></div>
        <div class="card" style="text-align:center;padding:16px;cursor:pointer" onclick="phoneSwitchView('${work.id}','moment')"><div style="font-size:2rem"></div><div style="font-size:.8rem;margin-top:4px;color:var(--c-text2)">朋友圈 (${(pd.moments||[]).length})</div></div>
        <div class="card" style="text-align:center;padding:16px;cursor:pointer" onclick="phoneSwitchView('${work.id}','forum')"><div style="font-size:2rem"></div><div style="font-size:.8rem;margin-top:4px;color:var(--c-text2)">论坛 (${(pd.forumPosts||[]).length})</div></div>
        <div class="card" style="text-align:center;padding:16px;cursor:pointer"><div style="font-size:2rem"></div><div style="font-size:.8rem;margin-top:4px;color:var(--c-text2)">联系人 (${(pd.contacts||[]).length})</div></div>
      </div>
    </div>`
}

function renderApps(work){
  const apps = work.phoneData?.apps||[]
  return `<div class="card"><div class="card-header"><span class="card-title">?? ??App (${apps.length})</span><button class="btn btn-sm btn-primary" onclick="addAppToPhone('${work.id}')">+ ??App</button></div>
    <div class="grid-3" style="gap:12px">${apps.map(a=>`
      <div class="card" style="text-align:center;padding:20px 12px;cursor:pointer" onclick="editPhoneApp('${work.id}','${a.id}')">
        <div style="font-size:2.5rem;margin-bottom:8px">${a.icon}</div>
        <div style="font-weight:600;font-size:.9rem">${escHtml(a.name)}</div>
        <div style="font-size:.75rem;color:var(--c-text2);margin-top:4px">${a.type}</div>
      </div>
    `).join("")||"<div class='text-sm text-muted' style='grid-column:1/-1;text-align:center;padding:20px'>??App?????</div>"}
    </div></div>`
}



window.switchEditorSection = function(workId, section, el){
  document.querySelectorAll(".editor-sidebar-item").forEach(function(e){e.classList.remove("active")});
  if(el) el.classList.add("active");
  var w = getWork(workId); if(!w) return;
  var main = document.getElementById("editorMain"); if(!main) return;
  if(!section || section === "nodes"){
    main.innerHTML = renderEditor(workId);
    return;
  }
  var sections = {settings:renderSettings,scenes:renderScenes,placeholders:renderPlaceholders,contacts:renderContacts,chats:renderChats,moments:renderMoments,forum:renderForum,export:renderExport,preview:renderPreviewArticle,preview_phone:renderPreviewPhone};
  main.innerHTML = (sections[section] && sections[section](w)) || "<div class=\"text-muted\">\u52a0\u8f7d\u4e2d...</div>";
}
window.saveWorkSetting = function(id,k,v){updateWork(id,{[k]:v});showToast("已保存","info")}
window.addNodeToWork = function(id){addNode(id);showToast("已添加新节点");refreshEditorSection(id,"nodes")}
window.deleteWorkNode = function(wid,nid){if(!confirm("删除此节点？"))return;deleteNode(wid,nid);showToast("已删除");refreshEditorSection(wid,"nodes")}
window.saveNodeContent = function(wid,nid){const ta=document.getElementById("nodeContent_"+nid);if(ta)updateNode(wid,nid,{content:ta.value})}
window.saveNodeField = function(wid,nid,k,v){updateNode(wid,nid,{[k]:v});showToast("已保存","info")}
window.setStartNode = function(wid,nid){updateWork(wid,{startNode:nid});showToast("已设为起始节点");refreshEditorSection(wid,"nodes")}
window.deleteChoiceFrom = function(wid,nid,cid){if(!confirm("删除？"))return;deleteChoice(wid,nid,cid);showToast("已删除");refreshEditorSection(wid,"nodes")}
window.addSceneToWork = function(wid){const n=document.getElementById("newSceneName")?.value?.trim();if(!n){showToast("请输入名称","error");return}addScene(wid,n);document.getElementById("newSceneName").value="";showToast("已添加");refreshEditorSection(wid,"scenes")}
window.deleteSceneFromWork = function(wid,sid){deleteScene(wid,sid);showToast("已删除");refreshEditorSection(wid,"scenes")}
window.addPreset = function(wid,p){addPlaceholder(wid,"","","",p);showToast("预设已添加");refreshEditorSection(wid,"placeholders")}
window.addCustomPH = function(wid){addPlaceholder(wid);showToast("已添加");refreshEditorSection(wid,"placeholders")}
window.updatePH = function(wid,pid,k,v){updatePlaceholder(wid,pid,{[k]:v})}
window.deletePH = function(wid,pid){if(!confirm("删除？"))return;deletePlaceholder(wid,pid);showToast("已删除");refreshEditorSection(wid,"placeholders")}
window.previewGoTo = function(wid,nid){const w=getWork(wid);const n=(w.nodes||[]).find(x=>x.id===nid);const c=document.getElementById("previewContainer");if(c&&n)c.innerHTML=renderPreviewNode(w,n)}
function refreshEditorSection(wid,s){const el=document.querySelector(`.editor-sidebar-item[data-section="${s}"]`);if(el)el.click()}
window.openChoiceEditor = function(wid,nid){
  const w=getWork(wid);const n=(w.nodes||[]).find(x=>x.id===nid);if(!n)return
  const nodes=w.nodes||[];const others=nodes.filter(x=>x.id!==nid)
  showModal("添加选项",`<div class="form-group"><label class="form-label">选项文字</label><input class="form-input" id="choiceText" placeholder="读者看到的文字"></div>
    <div class="form-group"><label class="form-label">跳转到</label><select class="form-select" id="choiceTarget">${others.map(x=>`<option value="${x.id}">${escHtml(x.title||x.id)}</option>`).join("")}<option value="${nid}">（自身）</option></select></div>`,
    [{text:"取消",cls:"btn-secondary"},{text:"添加",cls:"btn-primary",primary:true}],(btns,close)=>{
      btns[1].onclick=()=>{const t=document.getElementById("choiceText")?.value?.trim()||"继续";const tg=document.getElementById("choiceTarget")?.value||nid;const c=addChoice(wid,nid,tg);updateChoice(wid,nid,c.id,{text:t});close();showToast("已添加");refreshEditorSection(wid,"nodes")}
    })
}
window.editChoice = function(wid,nid,cid){
  const w=getWork(wid);const n=(w.nodes||[]).find(x=>x.id===nid);const c=n?.choices?.find(x=>x.id===cid);if(!c)return
  const nodes=w.nodes||[]
  showModal("编辑选项",`<div class="form-group"><label class="form-label">选项文字</label><input class="form-input" id="choiceText" value="${escAttr(c.text)}"></div><div class="form-group"><label class="form-label">跳转到</label><select class="form-select" id="choiceTarget">${nodes.map(x=>`<option value="${x.id}" ${x.id===c.targetId?"selected":""}>${escHtml(x.title||x.id)}</option>`).join("")}</select></div>`,
    [{text:"取消",cls:"btn-secondary"},{text:"保存",cls:"btn-primary",primary:true}],(btns,close)=>{
      btns[1].onclick=()=>{const t=document.getElementById("choiceText")?.value?.trim()||c.text;const tg=document.getElementById("choiceTarget")?.value||c.targetId;updateChoice(wid,nid,cid,{text:t,targetId:tg});close();showToast("已保存");refreshEditorSection(wid,"nodes")}
    })
}
window.openContactEditor = function(wid,cid){
  const w=getWork(wid);const ex=cid?w?.phoneData?.contacts?.find(x=>x.id===cid):null
  showModal(ex?"编辑联系人":"新建联系人",`<div class="form-group"><label class="form-label">名称</label><input class="form-input" id="contactName" value="${escAttr(ex?.name||"")}"></div><div class="form-group"><label class="form-label">备注</label><input class="form-input" id="contactDesc" value="${escAttr(ex?.desc||"")}"></div>`,
    [{text:"取消",cls:"btn-secondary"},{text:ex?"保存":"创建",cls:"btn-primary",primary:true}],(btns,close)=>{
      btns[1].onclick=()=>{const n=document.getElementById("contactName")?.value?.trim();if(!n){showToast("请输入名称","error");return}const d=document.getElementById("contactDesc")?.value?.trim()||"";if(ex){updateContact(wid,cid,{name:n,desc:d});showToast("已保存")}else{addContact(wid,{name:n,desc:d});showToast("已创建")}close();refreshEditorSection(wid,"contacts")}
    })
}
window.editContact = function(wid,cid){window.openContactEditor(wid,cid)}
window.deleteContactFromWork = function(wid,cid){deleteContact(wid,cid);showToast("已删除");refreshEditorSection(wid,"contacts")}

window.openChatEditor = function(wid,type){
  const w=getWork(wid);const contacts=w?.phoneData?.contacts||[]
  const fields=type==="group"?`<div class="form-group"><label class="form-label">群聊名称</label><input class="form-input" id="chatGroupName" placeholder="名称"></div>`:""
  showModal("新建聊天",fields+`<div class="form-group"><label class="form-label">选择联系人</label><select class="form-select" id="chatContact">${contacts.map(c=>`<option value="${c.id}">${escHtml(c.name)}</option>`).join("")}</select></div>`,
    [{text:"取消",cls:"btn-secondary"},{text:"创建",cls:"btn-primary",primary:true}],(btns,close)=>{
      btns[1].onclick=()=>{const ci=document.getElementById("chatContact")?.value;if(!ci){showToast("请选择联系人","error");return}const gn=document.getElementById("chatGroupName")?.value?.trim();const ch=addChat(wid,{type:type==="group"?"group":"single",contactIds:[ci],groupName:gn||""});close();showToast("已创建");openChatDetailEditor(wid,ch.id)}
    })
}
window.openChatDetailEditor = function(wid,cid){
  const w=getWork(wid);const ch=w?.phoneData?.chats?.find(x=>x.id===cid);if(!ch)return;const contacts=w?.phoneData?.contacts||[]
  const isG=ch.type==="group";const cname=isG?ch.groupName:contacts.find(x=>x.id===ch.contactIds?.[0])?.name||"聊天"
  const main=document.getElementById("editorMain");if(!main)return
  const msgs=(ch.messages||[]).map(msg=>{
    const s=contacts.find(x=>x.id===msg.senderId);const isSelf=!msg.senderId
    return `<div class="chat-msg ${isSelf?"self":"other"}">${!isSelf?`<div class="chat-avatar" style="background:${avatarColor(s?.avatarId||msg.senderId)}">${(s?.name||"?")[0]}</div>`:""}
      <div><div class="chat-bubble">${msg.text||""}${msg.image?`<br><img src="${escAttr(msg.image)}" style="max-width:160px;border-radius:6px;margin-top:4px">`:""}</div>${msg.time?`<div class="chat-time">${escHtml(msg.time)}</div>`:""}
      <button class="btn btn-sm btn-ghost" style="font-size:.7rem;padding:2px 6px" onclick="deleteChatMsg('${wid}','${cid}','${msg.id}')">删除</button></div></div>`
  }).join("")||"<div class='text-sm text-muted' style='text-align:center;padding:40px 0'>暂无消息</div>"
  
  main.innerHTML=`<div style="max-width:400px;margin:0 auto">
    <div class="flex-row mb-4"><button class="btn btn-sm btn-ghost" onclick="switchEditorSection('${wid}','chats',document.querySelector('[data-section=chats]'))"> 返回</button><span style="font-weight:600;flex:1;text-align:center">${escHtml(cname)}</span></div>
    <div class="phone-frame" style="border-radius:24px;margin:0">
      <div class="phone-statusbar"><span>${new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})}</span><span style="opacity:0">--</span></div>
      <div class="phone-header"><span style="cursor:pointer" onclick="phoneSwitchView('${wid}','chatlist')"></span><span class="title">${escHtml(cname)}</span><span></span></div>
      <div class="phone-body" id="chatMsgsContainer" style="min-height:400px;max-height:500px;overflow-y:auto">${msgs}</div>
      <div class="chat-input-bar"><input id="newMsgInput" placeholder="输入消息" style="flex:1"><button class="btn btn-sm btn-primary" onclick="addMessageToChat('${wid}','${cid}')">发送</button></div>
    </div>
    <div class="card mt-2"><div class="card-title" style="font-size:.9rem;margin-bottom:8px">添加消息</div>
      <div class="form-group"><label class="form-label">发送者（留空=主角）</label><select class="form-select" id="msgSender"><option value="">（主角自己）</option>${contacts.map(c=>`<option value="${c.id}">${escHtml(c.name)}</option>`).join("")}</select></div>
      <div class="form-group"><label class="form-label">内容</label><textarea class="form-textarea" id="msgText" rows="2" placeholder="消息文本"></textarea></div>
      <div class="form-group"><label class="form-label">图片链接（可选）</label><input class="form-input" id="msgImage" placeholder="https://..."></div>
      <div class="form-group"><label class="form-label">时间</label><input class="form-input" id="msgTime" placeholder="例如：上午9:30"></div>
      <button class="btn btn-sm btn-primary" onclick="addMessageToChat('${wid}','${cid}')">+ 添加消息</button>
    </div></div>`
}
window.addMessageToChat = function(wid,cid){
  const si=document.getElementById("msgSender")?.value||"";const tx=document.getElementById("msgText")?.value?.trim()||""
  const im=document.getElementById("msgImage")?.value?.trim()||"";const ti=document.getElementById("msgTime")?.value?.trim()||""
  if(!tx&&!im){showToast("请输入内容","error");return}
  addChatMessage(wid,cid,{senderId:si,text:tx,image:im,time:ti});showToast("已添加")
  const fields=["msgText","msgImage","msgTime"];fields.forEach(f=>{const el=document.getElementById(f);if(el)el.value=""})
  openChatDetailEditor(wid,cid)
}
window.deleteChatMsg = function(wid,cid,mid){
  const w=getWork(wid);const ch=w?.phoneData?.chats?.find(x=>x.id===cid);if(!ch)return
  ch.messages=ch.messages.filter(m=>m.id!==mid);updateWork(wid,{phoneData:w.phoneData});openChatDetailEditor(wid,cid)
}
window.deleteChatFromWork = function(wid,cid){deleteChat(wid,cid);showToast("已删除");refreshEditorSection(wid,"chats")}
window.openMomentEditor = function(wid,mid){
  const w=getWork(wid);const contacts=w?.phoneData?.contacts||[];const ex=mid?w?.phoneData?.moments?.find(x=>x.id===mid):null
  showModal(ex?"编辑动态":"新建动态",`<div class="form-group"><label class="form-label">发布者</label><select class="form-select" id="momentContact"><option value="">选择</option>${contacts.map(c=>`<option value="${c.id}" ${ex?.contactId===c.id?"selected":""}>${escHtml(c.name)}</option>`).join("")}</select></div>
    <div class="form-group"><label class="form-label">内容</label><textarea class="form-textarea" id="momentContent" rows="3">${escAttr(ex?.content||"")}</textarea></div>
    <div class="form-group"><label class="form-label">图片（每行一张链接）</label><textarea class="form-textarea" id="momentImages" rows="2">${escAttr(ex?.images?.join("\n")||"")}</textarea></div>
    <div class="form-group"><label class="form-label">时间</label><input class="form-input" id="momentTime" value="${escAttr(ex?.time||"")}" placeholder="2小时前"></div>`,
    [{text:"取消",cls:"btn-secondary"},{text:ex?"保存":"发布",cls:"btn-primary",primary:true}],(btns,close)=>{
      btns[1].onclick=()=>{const ci=document.getElementById("momentContact")?.value;if(!ci){showToast("请选择发布者","error");return}const ct=document.getElementById("momentContent")?.value?.trim()||"";const im=(document.getElementById("momentImages")?.value||"").split("\n").map(s=>s.trim()).filter(Boolean);const ti=document.getElementById("momentTime")?.value?.trim()||"刚刚"
        if(ex){const w=getWork(wid);const m=w?.phoneData?.moments?.find(x=>x.id===mid);if(m){m.contactId=ci;m.content=ct;m.images=im;m.time=ti}updateWork(wid,{phoneData:w.phoneData});showToast("已保存")}else{addMoment(wid,{contactId:ci,content:ct,images:im,time:ti});showToast("已发布")}close();refreshEditorSection(wid,"moments")}
    })
}
window.editMoment = function(wid,mid){window.openMomentEditor(wid,mid)}
window.deleteMomentFromWork = function(wid,mid){deleteMoment(wid,mid);showToast("已删除");refreshEditorSection(wid,"moments")}

window.openForumEditor = function(wid,pid){
  const w=getWork(wid);const contacts=w?.phoneData?.contacts||[];const ex=pid?w?.phoneData?.forumPosts?.find(x=>x.id===pid):null
  showModal(ex?"编辑帖子":"新建帖子",`<div class="form-group"><label class="form-label">发布者</label><select class="form-select" id="forumContact"><option value="">选择</option>${contacts.map(c=>`<option value="${c.id}" ${ex?.contactId===c.id?"selected":""}>${escHtml(c.name)}</option>`).join("")}</select></div>
    <div class="form-group"><label class="form-label">平台</label><select class="form-select" id="forumPlatform"><option value="x" ${ex?.platform==="x"?"selected":""}>𝕏</option><option value="weibo" ${ex?.platform==="weibo"?"selected":""}>微博</option><option value="douban" ${ex?.platform==="douban"?"selected":""}>豆瓣</option><option value="tieba" ${ex?.platform==="tieba"?"selected":""}>贴吧</option></select></div>
    <div class="form-group"><label class="form-label">内容</label><textarea class="form-textarea" id="forumContent" rows="3">${escAttr(ex?.content||"")}</textarea></div>
    <div class="form-group"><label class="form-label">图片（每行一张链接）</label><textarea class="form-textarea" id="forumImages" rows="2">${escAttr(ex?.images?.join("\n")||"")}</textarea></div>
    <div class="form-group"><label class="form-label">时间</label><input class="form-input" id="forumTime" value="${escAttr(ex?.time||"")}" placeholder="3分钟前"></div>`,
    [{text:"取消",cls:"btn-secondary"},{text:ex?"保存":"发布",cls:"btn-primary",primary:true}],(btns,close)=>{
      btns[1].onclick=()=>{const ci=document.getElementById("forumContact")?.value;if(!ci){showToast("请选择发布者","error");return}const pf=document.getElementById("forumPlatform")?.value||"x";const ct=document.getElementById("forumContent")?.value?.trim()||"";const im=(document.getElementById("forumImages")?.value||"").split("\n").map(s=>s.trim()).filter(Boolean);const ti=document.getElementById("forumTime")?.value?.trim()||"刚刚"
        if(ex){const w=getWork(wid);const p=w?.phoneData?.forumPosts?.find(x=>x.id===pid);if(p){p.contactId=ci;p.platform=pf;p.content=ct;p.images=im;p.time=ti}updateWork(wid,{phoneData:w.phoneData});showToast("已保存")}else{addForumPost(wid,{contactId:ci,platform:pf,content:ct,images:im,time:ti});showToast("已发布")}close();refreshEditorSection(wid,"forum")}
    })
}
window.editForumPost = function(wid,pid){window.openForumEditor(wid,pid)}
window.deleteForumPostFromWork = function(wid,pid){deleteForumPost(wid,pid);showToast("已删除");refreshEditorSection(wid,"forum")}
let viewData = {}
window.phoneSwitchView = function(wid,view){
  const c=document.getElementById("phoneAppContent");const w=getWork(wid);const pd=w?.phoneData;if(!c||!pd)return
  if(view==="chatlist"){
    c.innerHTML=`<div class="phone-header"><span class="title">聊天</span></div><div class="phone-body" style="min-height:400px">${(pd.chats||[]).map(ch=>{const ct=pd.contacts||[];const n=ch.type==="group"?ch.groupName:ct.find(x=>x.id===ch.contactIds?.[0])?.name||"未知";const l=ch.messages?.[ch.messages.length-1];return `<div class="contact-item" onclick="phoneOpenChat('${wid}','${ch.id}')"><div class="contact-avatar" style="background:${ch.type==="group"?"#10b981":"#6366f1"}">${ch.type==="group"?"👥":(n[0])}</div><div class="contact-info"><div class="contact-name">${escHtml(n)}</div><div class="contact-desc">${l?escHtml(l.text):""}</div></div></div>`}).join("")||"<div class='text-sm text-muted' style='text-align:center;padding:40px 0'>暂无聊天</div>"}</div>`
  }else if(view==="moment"){
    c.innerHTML=`<div class="phone-header"><span class="title">朋友圈</span></div><div class="phone-body" style="min-height:400px">${(pd.moments||[]).map(m=>{const ct=pd.contacts||[];const cn=ct.find(x=>x.id===m.contactId);const nm=cn?.name||"未知";return `<div class="moment-card"><div class="moment-header"><div class="moment-avatar" style="background:${avatarColor(cn?.avatarId||m.contactId)}">${nm[0]}</div><div><div class="moment-user">${escHtml(nm)}</div><div class="moment-time">${escHtml(m.time||"")}</div></div></div><div class="moment-content">${escHtml(m.content||"")}</div>${m.images?.length?`<div class="moment-images ${m.images.length===1?"single":""}">${m.images.map(img=>`<img src="${escAttr(img)}" onerror="this.style.display='none'">`).join("")}</div>`:""}<div class="moment-actions"><span> ${m.likes?.length||0}</span><span> ${m.comments?.length||0}</span></div></div>`}).join("")||"<div class='text-sm text-muted' style='text-align:center;padding:40px 0'>暂无动态</div>"}</div>`
  }else if(view==="forum"){
    const pL={x:"𝕏",weibo:"微博",douban:"豆瓣",tieba:"贴吧"}
    c.innerHTML=`<div class="phone-header"><span class="title">论坛</span></div><div class="phone-body" style="min-height:400px">${(pd.forumPosts||[]).map(p=>{const ct=pd.contacts||[];const cn=ct.find(x=>x.id===p.contactId);const nm=cn?.name||"未知";return `<div class="forum-post" style="box-shadow:none;border-bottom:1px solid #eee;border-radius:0;padding:12px 0"><div class="forum-post-header"><div class="forum-avatar" style="background:${avatarColor(cn?.avatarId||p.contactId)}">${nm[0]}</div><div><span class="forum-user">${escHtml(nm)}</span> <span class="forum-platform ${p.platform}">${pL[p.platform]||p.platform}</span><div class="forum-source">${escHtml(p.time||"")}</div></div></div><div class="forum-content">${escHtml(p.content||"")}</div><div class="forum-actions"><span> ${p.likes?.length||0}</span><span>🔁 ${p.reposts?.length||0}</span><span> ${p.comments?.length||0}</span></div></div>`}).join("")||"<div class='text-sm text-muted' style='text-align:center;padding:40px 0'>暂无帖子</div>"}</div>`
  }else{c.innerHTML=renderPhoneHomeView(w)}
}
window.phoneOpenChat = function(wid,cid){
  viewData.chatId=cid;const w=getWork(wid);const pd=w?.phoneData;const ch=pd?.chats?.find(x=>x.id===cid);if(!ch)return
  const c=document.getElementById("phoneAppContent");if(!c)return;const ct=pd.contacts||[];const cname=ch.type==="group"?ch.groupName:ct.find(x=>x.id===ch.contactIds?.[0])?.name||"聊天"
  c.innerHTML=`<div class="phone-header"><span style="cursor:pointer" onclick="phoneSwitchView('${wid}','chatlist')"></span><span class="title">${escHtml(cname)}</span><span></span></div>
    <div class="phone-body" style="min-height:400px;max-height:500px;overflow-y:auto">${(ch.messages||[]).map(msg=>{const s=ct.find(x=>x.id===msg.senderId);const isSelf=!msg.senderId;return `<div class="chat-msg ${isSelf?"self":"other"}">${!isSelf?`<div class="chat-avatar" style="background:${avatarColor(s?.avatarId||msg.senderId)}">${(s?.name||"?")[0]}</div>`:""}<div><div class="chat-bubble">${msg.text||""}${msg.image?`<br><img src="${escAttr(msg.image)}" style="max-width:160px;border-radius:6px;margin-top:4px">`:""}</div>${msg.time?`<div class="chat-time">${escHtml(msg.time)}</div>`:""}</div></div>`}).join("")||"<div class='text-sm text-muted' style='text-align:center;padding:40px 0'>暂无消息</div>"}</div>
    <div class="chat-input-bar"><input placeholder="输入消息..." style="flex:1;padding:8px 14px;border-radius:20px;border:1px solid #e5e5e5" disabled><button class="btn btn-sm btn-primary" disabled>发送</button></div>`
}
window.exportAsHTML = function(wid){
  const html=exportWorkAsHTML(wid);if(!html){showToast("导出失败","error");return}
  const w=getWork(wid);const blob=new Blob([html],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(blob)
  const a=document.createElement("a");a.href=url;a.download=(w?.title||"作品")+".html";a.click();URL.revokeObjectURL(url);showToast("导出成功！")
}
window.execNodeFormat = function(nid,cmd){
  const ta=document.getElementById("nodeContent_"+nid);if(!ta)return;const s=ta.selectionStart,e=ta.selectionEnd,sel=ta.value.substring(s,e);let r=sel
  if(cmd==="bold")r="<b>"+sel+"</b>";else if(cmd==="italic")r="<i>"+sel+"</i>"
  ta.setRangeText(r,s,e,"end");ta.dispatchEvent(new Event("change"))
}
window.wrapNodeText = function(nid,o,c){
  const ta=document.getElementById("nodeContent_"+nid);if(!ta)return;const s=ta.selectionStart,e=ta.selectionEnd,sel=ta.value.substring(s,e)
  ta.setRangeText(o+sel+c,s,e,"end");ta.dispatchEvent(new Event("change"))
}
window.insertPlaceholderTag = function(nid,wid){
  const w=getWork(wid);const phs=w?.placeholders||[];if(!phs.length){showToast("请先添加占位符","error");return}
  showModal("插入占位符",`<div class="form-group"><label class="form-label">选择占位符</label><select class="form-select" id="phSelect">${phs.map(p=>`<option value="${p.key}">${escHtml(p.label)}</option>`).join("")}</select></div>`,
    [{text:"取消",cls:"btn-secondary"},{text:"插入",cls:"btn-primary",primary:true}],(btns,close)=>{
      btns[1].onclick=()=>{const k=document.getElementById("phSelect")?.value;if(!k)return;const ta=document.getElementById("nodeContent_"+nid);if(ta){const s=ta.selectionStart;ta.setRangeText(k,s,s,"end");ta.dispatchEvent(new Event("change"))}close()}
    })
}
window.insertImageTag = function(nid){
  showModal("插入图片",`<div class="form-group"><label class="form-label">图片链接</label><input class="form-input" id="imgUrl" placeholder="https://..."></div><div class="form-group"><label class="form-label">alt 文字</label><input class="form-input" id="imgAlt" placeholder="描述"></div>`,
    [{text:"取消",cls:"btn-secondary"},{text:"插入",cls:"btn-primary",primary:true}],(btns,close)=>{
      btns[1].onclick=()=>{const u=document.getElementById("imgUrl")?.value?.trim();if(!u){showToast("请输入链接","error");return}const a=document.getElementById("imgAlt")?.value?.trim()||"图片";const ta=document.getElementById("nodeContent_"+nid);if(ta){const s=ta.selectionStart;ta.setRangeText('<img src="'+u+'" alt="'+a+'">',s,s,"end");ta.dispatchEvent(new Event("change"))}close()}
    })
}

function showModal(title, bodyHtml, buttons, setup){
  const overlay=document.createElement("div");overlay.className="modal-overlay"
  overlay.innerHTML=`<div class="modal" style="max-width:460px"><div class="modal-header"><span class="modal-title">${title}</span><span class="btn-ghost btn-icon" style="cursor:pointer;font-size:1.2rem" id="mClose">&times;</span></div><div class="modal-body">${bodyHtml}</div><div class="modal-footer">${buttons.map((b,i)=>`<button class="btn ${b.cls}" id="mBtn${i}">${b.text}</button>`).join("")}</div></div>`
  document.body.appendChild(overlay)
  const close=()=>{overlay.remove()}
  overlay.querySelector("#mClose").onclick=close
  overlay.addEventListener("click",e=>{if(e.target===overlay)close()})
  const btnEls = buttons.map((b,i)=>overlay.querySelector("#mBtn"+i))
  btnEls[0]?.addEventListener("click",close)
  if(setup)setup(btnEls,close)

window.selectNode=function(wid,nid){sessionStorage.setItem("tn_"+wid,nid);var el=document.querySelector("[data-section=nodes]");if(el)el.click()}
window.ccu=function(nid){var ta=document.getElementById("nc_"+nid);var cc=document.getElementById("cc_"+nid);if(ta&&cc)cc.textContent=ta.value.length}
window.snc=function(wid,nid){var ta=document.getElementById("nc_"+nid);if(ta)updateNode(wid,nid,{content:ta.value})}
window.sf=function(wid,nid,k,v){updateNode(wid,nid,{[k]:v})}
window.ssn=function(wid,nid){updateWork(wid,{startNode:nid});document.querySelector("[data-section=nodes]").click()}
window.ef=function(nid,c){var ta=document.getElementById("nc_"+nid);if(!ta)return;var s=ta.selectionStart,e=ta.selectionEnd,sel=ta.value.substring(s,e);var r=sel;if(c==="bold")r="<b>"+sel+"</b>";else if(c==="italic")r="<i>"+sel+"</i>";ta.setRangeText(r,s,e,"end");ta.dispatchEvent(new Event("change"))}
window.wt=function(nid,o,c){var ta=document.getElementById("nc_"+nid);if(!ta)return;var s=ta.selectionStart,e=ta.selectionEnd,sel=ta.value.substring(s,e);ta.setRangeText(o+sel+c,s,e,"end");ta.dispatchEvent(new Event("change"))}
window.iit=function(nid){var u=prompt("请输入图片链接:");if(!u)return;var ta=document.getElementById("nc_"+nid);if(ta){var s=ta.selectionStart;ta.setRangeText("<img src=\""+u+"\" alt=\"图片\">",s,s,"end");ta.dispatchEvent(new Event("change"))}}

window.moveNodeUp=function(wid,nid){var w=getWork(wid);if(!w||!w.nodes)return;var i=w.nodes.findIndex(function(n){return n.id===nid});if(i<=0)return;var t=w.nodes[i-1];w.nodes[i-1]=w.nodes[i];w.nodes[i]=t;updateWork(wid,{nodes:w.nodes});document.querySelector('[data-section=nodes]').click()}
window.moveNodeDown=function(wid,nid){var w=getWork(wid);if(!w||!w.nodes)return;var i=w.nodes.findIndex(function(n){return n.id===nid});if(i<0||i>=w.nodes.length-1)return;var t=w.nodes[i+1];w.nodes[i+1]=w.nodes[i];w.nodes[i]=t;updateWork(wid,{nodes:w.nodes});document.querySelector('[data-section=nodes]').click()}

window.editorClick=function(e){
var b=e.target.closest('[data-c]');if(!b)return
var c=b.dataset.c;var w=b.dataset.w;var n=b.dataset.n
if(c==="ph"){var el=document.querySelector("[data-section=placeholders]");if(el)el.click()}
if(c==="ch"&&n){if(typeof window.openChoiceEditor==="function")window.openChoiceEditor(w,n)}
if(c==="addn"){window.addNodeToWork(w)}
if(c==="sel"&&n){sessionStorage.setItem("tn_"+w,n);refreshEditorSection(w,"nodes")}
if(c==="up"&&n){window.moveNodeUp(w,n)}
if(c==="dn"&&n){window.moveNodeDown(w,n)}
if(c==="del"&&n){window.deleteWorkNode(w,n)}
if(c==="ss"&&n){updateWork(w,{startNode:n});refreshEditorSection(w,"nodes")}
if(c==="rn"){var nid=sessionStorage.getItem("tn_"+w);if(nid){var nn=prompt("\u65b0\u540d\u79f0:");if(nn)updateNode(w,nid,{title:nn});refreshEditorSection(w,"nodes")}}
if(c==="del2"){var nid=sessionStorage.getItem("tn_"+w);if(nid)window.deleteWorkNode(w,nid)}
if(c==="dup"){window.addNodeToWork(w);showToast("\u5df2\u590d\u5236")}
if(c==="bold"&&n){window.ef(n,"bold")}
if(c==="italic"&&n){window.ef(n,"italic")}
if(c==="wrap"&&n){window.wt(n,"\u300c","\u300d")}
if(c==="ph2"&&n){window.ipt(n,w)}
if(c==="scene"&&n){updateNode(w,n,{scene:b.value})}
if(c==="st"&&n){updateNode(w,n,{title:b.value})}
if(c==="img"||c==="img2"||c==="au"||c==="und"||c==="red"){showToast("\u5f85\u5f00\u53d1")}
}
document.addEventListener("click",window.editorClick)

window.editorClick=function(e){
  var b=e.target.closest("[data-c]");if(!b)return
  var act=b.dataset.c;var w=b.dataset.w;var n=b.dataset.n
  if(act==="ph"){var el=document.querySelector("[data-section=placeholders]");if(el)el.click()}
  if(act==="ch"&&n){if(typeof window.openChoiceEditor==="function")window.openChoiceEditor(w,n)}
  if(act==="addn"){addNode(w);var w2=getWork(w);if(w2&&w2.nodes.length){sessionStorage.setItem("tn_"+w,w2.nodes[w2.nodes.length-1].id);switchEditorSection(w,"nodes",null)}}
  if(act==="sel"&&n){sessionStorage.setItem("tn_"+w,n);switchEditorSection(w,"nodes",null)}
  if(act==="ss"&&n){updateWork(w,{startNode:n});switchEditorSection(w,"nodes",null)}
  if(act==="rn2"&&n){var nn=prompt("\u65b0\u540d\u79f0:");if(nn){updateNode(w,n,{title:nn});switchEditorSection(w,"nodes",null)}}
  if(act==="dup2"&&n){var src=getWork(w).nodes.find(function(x){return x.id===n});if(src){var c=addNode(w);if(c){updateNode(w,c.id,{content:src.content,title:src.title+"(\u526f\u672c)"});switchEditorSection(w,"nodes",null)}}
  }
  if(act==="del2"&&n){if(confirm("\u786e\u5b9a\u5220\u9664?")){deleteNode(w,n);switchEditorSection(w,"nodes",null)}}
  if(act==="scene"&&n){updateNode(w,n,{scene:b.value})}
  if(act==="st"&&n){updateNode(w,n,{title:b.value})}
  if(act==="content"){var ta=document.getElementById("nc_"+n);if(ta)ta.value=b.innerHTML;ccu(n);snc(w,n)}
  // Toolbar - use execCommand
  if(act==="bold"){document.execCommand("bold")}
  if(act==="italic"){document.execCommand("italic")}
  if(act==="uline"){document.execCommand("underline")}
  if(act==="h2"){document.execCommand("formatBlock",false,"<h2>")}
  if(act==="h3"){document.execCommand("formatBlock",false,"<h3>")}
  if(act==="para"){document.execCommand("formatBlock",false,"<p>")}
  if(act==="ul"){document.execCommand("insertUnorderedList")}
  if(act==="ol"){document.execCommand("insertOrderedList")}
  if(act==="hr"){document.execCommand("insertHorizontalRule")}
  if(act==="alignL"){document.execCommand("justifyLeft")}
  if(act==="alignC"){document.execCommand("justifyCenter")}
  if(act==="alignR"){document.execCommand("justifyRight")}
  if(act==="ph2"&&n){window.ipt(n,w)}
  if(act==="img"||act==="img2"){showToast("\u56fe\u7247\u529f\u80fd\u5f85\u5f00\u53d1")}
  if(act==="au"){showToast("\u97f3\u4e50\u529f\u80fd\u5f85\u5f00\u53d1")}
  if(act==="und"){showToast("\u64a4\u56de\u529f\u80fd\u5f85\u5f00\u53d1")}
  if(act==="red"){showToast("\u6062\u590d\u529f\u80fd\u5f85\u5f00\u53d1")}
}
document.addEventListener("click",window.editorClick)

// Drag-and-drop for world tree nodes (fixed)
var dragSrcId = null;
function wtDragStart(e){dragSrcId=e.target.closest("[data-n]")?.dataset.n}
function wtDragOver(e){e.preventDefault();var t=e.target.closest("[data-n]");if(t)t.style.opacity="0.5"}
function wtDragLeave(e){var t=e.target.closest("[data-n]");if(t)t.style.opacity="1"}
function wtDrop(e){
  e.preventDefault();var t=e.target.closest("[data-n]");if(!t||!dragSrcId||dragSrcId===t.dataset.n)return
  t.style.opacity="1"
  var w=t.dataset.w;var wid=w;var nid=t.dataset.n
  var wObj=getWork(wid);if(!wObj||!wObj.nodes)return
  var ids=wObj.nodes.map(function(x){return x.id})
  var fi=ids.indexOf(dragSrcId);var ti=ids.indexOf(nid)
  if(fi===-1||ti===-1)return
  ids.splice(fi,1);ids.splice(ti,0,dragSrcId)
  var reordered=[]
  for(var i=0;i<ids.length;i++){var nd=wObj.nodes.find(function(x){return x.id===ids[i]});if(nd)reordered.push(nd)}
  wObj.nodes=reordered;updateWork(wid,{nodes:wObj.nodes});dragSrcId=null;switchEditorSection(wid,"nodes",null)
}
document.addEventListener("dragstart",wtDragStart)
document.addEventListener("dragover",wtDragOver)
document.addEventListener("dragleave",wtDragLeave)
document.addEventListener("drop",wtDrop)

// ContentEditable change tracking
window.ccu=function(nid){var ce=document.getElementById("ce_"+nid);var wc=document.getElementById("wc_"+nid);if(ce&&wc)wc.textContent=ce.innerText.length}
window.snc=function(wid,nid){var ce=document.getElementById("ce_"+nid);var ta=document.getElementById("nc_"+nid);if(ce&&ta){ta.value=ce.innerHTML;updateNode(wid,nid,{content:ce.innerHTML})}}
}







