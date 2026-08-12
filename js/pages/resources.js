import { DEFAULT_PHONE_SKIN, getWorks, uid, updateWork } from "../data.js"
import { downloadBlob } from "../download.js"
import {
  deleteAuthorPlaceholderPreset,
  importAuthorPlaceholderPresetBundle,
  readAuthorPlaceholderPresets,
  saveAuthorPlaceholderPreset,
  serializeAuthorPlaceholderPresetBundle,
} from "../author-placeholder-presets.js"
import { mergeContactBundle, parseContactBundle, serializeContactBundle } from "../contact-bundles.js"
import {
  deleteNpcPack,
  importNpcPackLibrary,
  parseNpcPack,
  readNpcPacks,
  saveNpcPack,
  serializeNpcPack,
  serializeNpcPackLibrary,
} from "../npc-bundles.js"
import { parseForbiddenWords } from "../forbidden-words.js"

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function notify(message, type = "success") {
  if (typeof globalThis.window?.showToast === "function") {
    globalThis.window.showToast(message, type)
  }
}

function contactCount(work) {
  return Array.isArray(work?.phoneData?.contacts) ? work.phoneData.contacts.length : 0
}

function renderWorkOptions(works) {
  if (!works.length) return '<option value="">还没有作品</option>'
  return works.map(work => {
    const kind = work.type === "phone" ? "小手机" : "互动文章"
    return `<option value="${esc(work.id)}">${esc(work.title || "无标题作品")} · ${kind} · ${contactCount(work)} 人</option>`
  }).join("")
}

function renderContactHabits(works) {
  const disabled = works.length ? "" : " disabled"
  return `<section class="habit-section" aria-labelledby="contactHabitTitle">
    <div class="resource-section-heading">
      <div>
        <h2 id="contactHabitTitle">联系人跨作品使用</h2>
        <p>从一篇作品导出联系人包，再合并到另一篇作品。导入只追加联系人，不会覆盖目标作品已有的人物、聊天或论坛内容。</p>
      </div>
      <span class="resource-local-badge">仅本机处理</span>
    </div>
    <div class="resource-control-stack">
      <label class="form-group">
        <span class="form-label">联系人所在作品</span>
        <select class="form-select" data-contact-work${disabled}>${renderWorkOptions(works)}</select>
      </label>
      <label class="form-group">
        <span class="form-label">联系人包名称</span>
        <input class="form-input" data-contact-bundle-name maxlength="80" placeholder="例如：校园主要角色">
      </label>
      <p class="resource-status" data-contact-summary aria-live="polite"></p>
      <div class="resource-actions">
        <button type="button" class="btn btn-outline" data-contact-export${disabled}>导出联系人包</button>
        <label class="btn btn-outline resource-file-button${works.length ? "" : " is-disabled"}">
          选择联系人包
          <input type="file" accept="application/json,.json" data-contact-import-file${disabled}>
        </label>
        <button type="button" class="btn btn-primary" data-contact-merge disabled>合并到所选作品</button>
      </div>
      <p class="resource-status" data-contact-status aria-live="polite">联系人包带版本号；遇到相同 ID 时会为导入项生成新 ID，保留两边联系人。</p>
    </div>
  </section>`
}

function npcCount(work) {
  return Array.isArray(work?.phoneData?.forumNpcs) ? work.phoneData.forumNpcs.length : 0
}

function renderNpcWorkOptions(works) {
  const phoneWorks = works.filter(work => work.type === "phone")
  if (!phoneWorks.length) return '<option value="">还没有小手机作品</option>'
  return phoneWorks.map(work =>
    `<option value="${esc(work.id)}">${esc(work.title || "无标题作品")} · ${npcCount(work)} 位 NPC</option>`,
  ).join("")
}

function renderNpcPack(pack) {
  return `<article class="npc-pack-row" data-npc-pack-id="${esc(pack.id)}">
    <div class="npc-pack-copy">
      <strong>${esc(pack.name)}</strong>
      <span>${pack.npcs.length} 位 NPC${pack.sourceWorkTitle ? ` · 来自《${esc(pack.sourceWorkTitle)}》` : ""}</span>
    </div>
    <div class="npc-pack-actions">
      <button type="button" class="btn btn-sm btn-outline" data-npc-pack-export="${esc(pack.id)}">导出文件</button>
      <button type="button" class="btn btn-sm btn-ghost btn-danger-text" data-npc-pack-delete="${esc(pack.id)}">删除</button>
    </div>
  </article>`
}

function renderNpcPackHabits(works, packs) {
  const phoneWorks = works.filter(work => work.type === "phone")
  const disabled = phoneWorks.length ? "" : " disabled"
  return `<section class="habit-section" aria-labelledby="npcPackHabitTitle">
    <div class="resource-section-heading">
      <div>
        <h2 id="npcPackHabitTitle">论坛 NPC 包</h2>
        <p>把一篇作品里的论坛 NPC 保存为有名称的作者通用包，再到其他作品的论坛 NPC 管理页直接导入。</p>
      </div>
      <span class="resource-local-badge">作者全局资源</span>
    </div>
    <div class="resource-control-stack npc-pack-create">
      <label class="form-group">
        <span class="form-label">NPC 所在作品</span>
        <select class="form-select" data-npc-pack-work${disabled}>${renderNpcWorkOptions(works)}</select>
      </label>
      <label class="form-group">
        <span class="form-label">NPC 包名称</span>
        <input class="form-input" data-npc-pack-name maxlength="80" placeholder="例如：校园论坛路人"${disabled}>
      </label>
      <p class="resource-status" data-npc-pack-summary aria-live="polite"></p>
      <div class="resource-actions">
        <button type="button" class="btn btn-primary" data-npc-pack-save${disabled}>保存到通用 NPC 包</button>
        <button type="button" class="btn btn-outline" data-npc-library-export${packs.length ? "" : " disabled"}>导出全部 NPC 包</button>
        <label class="btn btn-outline resource-file-button">
          导入 NPC 包文件
          <input type="file" accept="application/json,.json" data-npc-library-import>
        </label>
      </div>
      <p class="resource-status" data-npc-pack-status aria-live="polite">同名 NPC 包会更新；作品里的 NPC 不会因通用包更新而自动变化。</p>
    </div>
    <div class="npc-pack-library" data-npc-pack-library>
      ${packs.length ? packs.map(renderNpcPack).join("") : '<div class="resource-empty"><strong>还没有通用 NPC 包</strong><span>从上方选择小手机作品并命名，就能保存第一组论坛 NPC。</span></div>'}
    </div>
  </section>`
}

function modeOptions(selected) {
  const modes = [
    ["each", "全文替换"],
    ["random", "随机替换"],
    ["scene", "场景锁定"],
  ]
  if (selected && !modes.some(([value]) => value === selected)) modes.push([selected, `保留旧模式（${selected}）`])
  return modes.map(([value, label]) => `<option value="${esc(value)}"${selected === value ? " selected" : ""}>${esc(label)}</option>`).join("")
}

function renderPresetField(field = {}) {
  return `<div class="preset-field-row" data-preset-field>
    <label><span>正文标记</span><input class="form-input" data-field-key value="${esc(field.key)}" placeholder="例如：称呼标记"></label>
    <label><span>显示名称</span><input class="form-input" data-field-label value="${esc(field.label)}" placeholder="例如：姓名"></label>
    <label><span>提问文字</span><input class="form-input" data-field-prompt value="${esc(field.prompt)}" placeholder="例如：你的名字？"></label>
    <label><span>替换方式</span><select class="form-select" data-field-mode>${modeOptions(field.mode || "each")}</select></label>
    <div class="preset-forbidden placeholder-forbidden-groups">
      <label class="placeholder-forbidden-group"><span><strong>包含匹配</strong><small>内容中出现即拦截</small></span><input class="form-input" data-field-forbidden value="${esc(Array.isArray(field.forbidden) ? field.forbidden.join("，") : "")}" placeholder="例如：蠢"></label>
      <label class="placeholder-forbidden-group"><span><strong>完全匹配</strong><small>整段完全相同时拦截</small></span><input class="form-input" data-field-exact-forbidden value="${esc(Array.isArray(field.exactForbidden) ? field.exactForbidden.join("，") : "")}" placeholder="例如：哥哥"></label>
    </div>
    <button type="button" class="btn btn-sm btn-ghost preset-field-remove" data-field-remove aria-label="删除这一项">删除</button>
  </div>`
}

function renderPresetEditor(preset = {}) {
  const fields = Array.isArray(preset.fields) && preset.fields.length ? preset.fields : [{}]
  return `<article class="preset-editor" data-preset-editor data-preset-id="${esc(preset.id || "")}">
    <div class="preset-editor-head">
      <label><span class="form-label">习惯名称</span><input class="form-input" data-preset-name value="${esc(preset.name || "")}" placeholder="例如：常用称呼"></label>
      <div class="preset-editor-actions">
        <button type="button" class="btn btn-sm btn-outline" data-field-add>添加占位符</button>
        <button type="button" class="btn btn-sm btn-primary" data-preset-save>保存</button>
        <button type="button" class="btn btn-sm btn-ghost" data-preset-delete>${preset.id ? "删除习惯" : "取消"}</button>
      </div>
    </div>
    <div class="preset-global-forbidden"><span class="form-label">全局违禁词</span><div class="placeholder-forbidden-groups">
      <label class="placeholder-forbidden-group"><span><strong>包含匹配</strong><small>内容中出现即拦截</small></span><textarea class="form-textarea" data-preset-global-forbidden placeholder="例如：蠢">${esc(Array.isArray(preset.globalForbidden) ? preset.globalForbidden.join("\n") : "")}</textarea></label>
      <label class="placeholder-forbidden-group"><span><strong>完全匹配</strong><small>整段完全相同时拦截</small></span><textarea class="form-textarea" data-preset-global-exact-forbidden placeholder="例如：哥哥">${esc(Array.isArray(preset.globalExactForbidden) ? preset.globalExactForbidden.join("\n") : "")}</textarea></label>
    </div></div>
    <div class="preset-fields">${fields.map(renderPresetField).join("")}</div>
    <p class="resource-status" data-preset-status aria-live="polite"></p>
  </article>`
}

function renderPlaceholderHabits(presets) {
  return `<section class="habit-section" aria-labelledby="placeholderHabitTitle">
    <div class="resource-section-heading">
      <div>
        <h2 id="placeholderHabitTitle">作者占位符习惯</h2>
        <p>这些是作者自己的全局模板。套用时会在当前作品中创建独立副本；在这里修改或删除习惯，不会反向改写任何已有作品。</p>
      </div>
      <span class="resource-local-badge">作者全局设置</span>
    </div>
    <div class="resource-actions resource-preset-toolbar">
      <button type="button" class="btn btn-primary" data-preset-new>新建习惯</button>
      <button type="button" class="btn btn-outline" data-preset-export${presets.length ? "" : " disabled"}>导出习惯</button>
      <label class="btn btn-outline resource-file-button">
        导入习惯
        <input type="file" accept="application/json,.json" data-preset-import>
      </label>
    </div>
    <p class="resource-status" data-preset-library-status aria-live="polite">导入时按习惯名称合并；同名习惯更新，不会写入作品数据。</p>
    <div class="preset-library" data-preset-library>
      ${presets.length ? presets.map(renderPresetEditor).join("") : '<div class="resource-empty"><strong>还没有全局习惯</strong><span>可以在这里新建，也可以在作品的占位符设置中保存。</span></div>'}
    </div>
  </section>`
}

function renderHabitsPage() {
  return `<div class="resource-panel" data-resource-panel="habits">
    <div class="resource-intro resource-prose">
      <h1>写作习惯</h1>
      <p>把会跨作品复用的内容放在这里。联系人和论坛 NPC 仍属于具体作品；通用包与占位符习惯属于当前浏览器里的作者设置。</p>
    </div>
    ${renderContactHabits(getWorks())}
    ${renderNpcPackHabits(getWorks(), readNpcPacks())}
    ${renderPlaceholderHabits(readAuthorPlaceholderPresets())}
  </div>`
}

function glossaryItem(title, body) {
  return `<details class="glossary-item"><summary>${title}</summary><div class="resource-prose">${body}</div></details>`
}

function tutorialSteps(steps) {
  return `<ol class="tutorial-steps">${steps.map((step, index) => `<li>
    <span class="tutorial-step-number" aria-hidden="true">${index + 1}</span>
    <div><h3>${step.title}</h3>${step.body}</div>
  </li>`).join("")}</ol>`
}

function tutorialChecklist(items) {
  return `<aside class="tutorial-checkpoint"><h3>检查一下</h3><ul>${items.map(item => `<li>${item}</li>`).join("")}</ul></aside>`
}

function tutorialFaq(items) {
  return `<div class="tutorial-faq"><h3>按需求查找</h3>${items.map(item => glossaryItem(item.title, item.body)).join("")}</div>`
}

function tutorialGuide({ category, title, outcome, intro, steps, checklist, faq }) {
  return `<section class="tutorial-section tutorial-guide resource-prose" id="tutorial-${category}" role="tabpanel" data-tutorial-category="${category}"${category === "start" ? "" : " hidden"}>
    <header class="tutorial-guide-header"><h2>${title}</h2><p>${intro}</p></header>
    <p class="tutorial-outcome"><strong>本节目标：</strong>${outcome}</p>
    ${tutorialSteps(steps)}
    ${tutorialChecklist(checklist)}
    ${tutorialFaq(faq)}
  </section>`
}

function renderLegacyTutorialPage() {
  return `<div class="resource-panel" data-resource-panel="tutorial">
    <div class="tutorial-layout">
      <nav class="tutorial-directory" aria-label="教程目录">
        <strong class="tutorial-directory-title">教程目录</strong>
        <button type="button" class="active" data-tutorial-nav="start" aria-controls="tutorial-start" aria-current="page">第一次使用</button>
        <button type="button" data-tutorial-nav="article" aria-controls="tutorial-article">互动文章</button>
        <button type="button" data-tutorial-nav="phone" aria-controls="tutorial-phone">小手机</button>
        <button type="button" data-tutorial-nav="social" aria-controls="tutorial-social">人物社交</button>
        <button type="button" data-tutorial-nav="placeholders" aria-controls="tutorial-placeholders">占位符</button>
        <button type="button" data-tutorial-nav="files" aria-controls="tutorial-files">文件与备份</button>
      </nav>
      <div class="tutorial-content">
    ${tutorialGuide({
      category:"start",
      title:"第一次使用",
      outcome:"新建作品、完成预览并导出文件。",
      intro:"先做一篇能读完的小作品，再添加复杂内容。",
      steps:[
        { title:"选择类型", body:"<p>看页面顶部，点【新建】。页面会出现【互动文章】和【小手机】两张卡片。写分支故事就点【互动文章】；制作手机界面就点【小手机】。</p>" },
        { title:"填写信息", body:"<p>点卡片后，下方会展开创建表单。填写【作品标题】。需要时再填【作品描述】和【作者署名】。最后点【创建作品】。</p>" },
        { title:"找到刚建的作品", body:"<p>创建完成后会自动打开编辑器。以后回到首页，也能在【我的作品】下面找到它。</p>" },
        { title:"写第一段正文", body:"<p>互动文章先看右侧【节点列表】，点第一个节点名称。中间出现正文编辑区后输入内容。等页面显示【已保存】再离开。</p>" },
        { title:"添加第一个选择", body:"<p>把输入光标放进正文。点编辑器左侧的【◇】；鼠标停在图标上会显示【在正文中插入普通互动】。填写至少两个【选项文本】和对应的【选择后内容】，再点【保存】。</p>" },
        { title:"打开读者画面", body:"<p>点页面顶部【读者端】可以预览当前作品。也可以回到首页，在作品卡片上点【阅读】。</p>" },
        { title:"导出和备份", body:"<p>回到首页，在作品卡片上点【更多 ▾】，再点【导出作品】。可以【下载 .tuuru】或【生成加密 PNG】；之后可从首页【导出中心】查看本机导出记录。需要备份全部创作内容时，点【我的作品】标题下方的【备份全部】。</p>" },
      ],
      checklist:["重新打开作品后正文仍在", "读者能从开头走到至少一个结果", "导出的文件保存在自己能找到的位置", "整库备份没有发送给不可信的人"],
      faq:[
        { title:"新建分支故事", body:"<p>点页面顶部【新建】，再点【互动文章】卡片。填写标题后点【创建作品】。</p>" },
        { title:"查看读者画面", body:"<p>编辑器顶部点【读者端】。从开头实际点击每个选项，并测试返回。</p>" },
        { title:"修改作品信息", body:"<p>回到首页，在作品卡片上点【更多 ▾】，再点【作品信息】。修改后点弹窗底部的保存按钮。</p>" },
        { title:"移动或置顶作品", body:"<p>电脑拖动作品卡右上角抓手调整顺序；打开「更多」可选择置顶或取消置顶。置顶作品会排在普通作品之前。</p>" },
        { title:"确认内容已保存", body:"<p>查看编辑器顶部状态。显示「已保存」后再关闭页面。</p>" },
        { title:"换网址后作品不见了", body:"<p>作品保存在当前浏览器和网址下。请回到原地址，或用备份恢复。</p>" },
        { title:"自动保存后还要点保存吗？", body:"<p>正文会自动保存。导出作品和下载备份仍需手动操作。</p>" },
      ],
    })}
    ${tutorialGuide({
      category:"article",
      title:"制作一篇有分支的互动文章",
      outcome:"从右侧结构树开始，做出一条可以完整读完的分支。",
      intro:"下面直接按界面上能看见的文字写。照着点一遍，就能完成最小作品。",
      steps:[
        { title:"先找到节点列表", body:"<p>电脑看编辑器右侧，确认上方选中【结构】，下面就是【节点列表】。手机先点页面顶部【结构】。章节名称下面的一行行名称是节点，点节点名称会在正文区打开它。</p>" },
        { title:"看懂章节这一行", body:"<p>电脑把鼠标移到目标章节名称这一行，右侧会出现【＋、隐、◎、✎、×】。手机或 iPad 点这一行右侧的【…】按钮，也会展开【＋、隐、◎、✎、×】。</p>" },
        { title:"添加章节或正文节点", body:"<p>在【节点列表】标题右侧点【+章】可以添加章节；点旁边的【+】可以添加正文节点。要加进指定章节，先找到目标章节名称，再按上一步展开按钮，点【＋】。</p>" },
        { title:"给节点换顺序", body:"<p>按住节点左边的【⠿】拖动。拖到同一章的上方或下方可以换顺序，拖进另一个章节可以换章节。想直接换章节时，电脑把鼠标移到节点这一行，手机或 iPad 点这一行右侧【…】，再点【移至…】选择章节。</p>" },
        { title:"新建和选择场景", body:"<p>点一个正文节点，再点编辑器顶部的“场景：…”下拉框。要新增场景，就点“＋ 新建场景…”，输入名称并确定；新场景会自动选到当前节点。场景只给使用“场景锁定”的占位符分组，普通写作可以选“不使用场景”。</p>" },
        { title:"填写正文", body:"<p>点右侧节点名称，然后在中间空白编辑区写正文。插入图片、小手机内容、普通互动和剧情分支，都用正文上方的工具栏。</p>" },
        { title:"插入普通互动", body:"<p>先把输入光标放到正文里想提问的位置，再点“普通互动”。“选项文本”是读者看到的按钮；“选择后内容”是读者点完后出现的文字。一段正文可以放多组。</p>" },
        { title:"插入小游戏", body:"<p>把光标放到正文目标位置。电脑端在正文左侧工具栏找到【互动页】右边的 SVG 骰子图标【小游戏】；它位于第二条分割线前，分割线后的【消息】等按钮属于小手机模块。手机端点【插入】，再点【小游戏】。选择掷骰判定、随机数或对抗骰，设置全部结果区间和对应的后续剧情，再点【插入正文】。</p>" },
        { title:"连接剧情分支", body:"<p>点“剧情分支”，填写按钮文字，再点目标位置选择要跳去的节点。剧情分支会显示在这段正文的最后面。</p>" },
        { title:"添加隐藏节点", body:"<p>在右侧【节点列表】找到目标章节名称。电脑把鼠标移到这一行；手机或 iPad 点这一行右侧的【…】。展开【＋、隐、◎、✎、×】后点【隐】。新节点会出现在本章末尾。点新节点，写好正文，再点编辑器顶部【显示条件】。</p>" },
        { title:"移动隐藏节点", body:"<p>按住隐藏节点左边的“⠿”拖动，把它放到希望正文出现的位置。比如想让它在节点 7 前出现，就把它拖到节点 7 上面。移动不会改掉已经设置的条件。</p>" },
        { title:"测试隐藏节点", body:"<p>进入阅读预览，先选一个能满足条件的选项，确认隐藏正文出现；返回后改选其它选项，确认隐藏正文消失；再改回原选项，确认它重新出现。</p>" },
        { title:"添加互动图片", body:"<p>在右侧【节点列表】找到目标章节名称。电脑把鼠标移到这一行；手机或 iPad 点这一行右侧的【…】。展开按钮后点【◎】。也可以点编辑器左侧【◎】。上传图片、设置热区和台词后，在【后续跳转至（必选）】选择一个普通节点，再点【保存】。</p>" },
        { title:"最后完整读一遍", body:"<p>从作品开头进入阅读预览，把每个选项都点一遍。重点检查：选项有没有目标、隐藏正文会不会随改选消失、互动图片结束后有没有回到正确节点、章节末尾的 NEXT 能不能进入下一章。</p>" },
      ],
      checklist:["最前章节的第一个普通节点就是预期起点", "所有剧情选项都有有效目标", "分支后的汇合节点没有被选项直接指向", "隐藏节点已经移到希望插入正文的位置", "满足条件、改选失效、再次满足三种状态都已预览", "跨章节前进与返回都符合预期"],
      faq:[
        { title:"在指定章节添加节点", body:"<p>在右侧【节点列表】找到目标章节名称。电脑把鼠标移到这一行；手机或 iPad 点这一行右侧的【…】。看到【＋、隐、◎、✎、×】后点【＋】。</p>" },
        { title:"让两个选择走向不同结局", body:"<p>先点要放选项的正文节点，再点编辑器左侧【⇄】。填写两条【选项文本】，分别点【选择目标节点】并选中目标节点，最后点【保存】。</p>" },
        { title:"只互动，不跳转", body:"<p>把光标放进正文，点「普通互动」，填写至少两个选项及各自的选择后内容。它会留在插入位置，不改变剧情路线。</p>" },
        { title:"移动一组普通互动", body:"<p>点正文里的普通互动卡片，再点「移动」；随后点击新的正文位置即可。若卡片位置意外丢失，编辑器会显示待放置提示，可用「放到光标处」恢复。</p>" },
        { title:"移动节点", body:"<p>看右侧“结构”，按住节点左边的“⠿”拖动。上下拖可以换顺序，拖进另一章可以换章节。移动后重新打开阅读预览检查一次。</p>" },
        { title:"移动隐藏节点", body:"<p>新隐藏节点先出现在本章末尾。按住它左边的“⠿”拖到目标节点前面或后面。移动只改变隐藏正文出现的位置，不会改变显示条件或稳定 ID。</p>" },
        { title:"新建场景", body:"<p>先点一个正文节点，再点编辑器顶部的“场景：…”下拉框，点“＋ 新建场景…”，输入名字并确定。建好后，当前节点会自动使用这个场景。</p>" },
        { title:"测试隐藏节点改选", body:"<p>预览中先触发隐藏内容，再返回改选其它选项。系统按当前选择重新判断：不再满足时内容会消失，重新满足时会回到结构树指定的位置；它不会因为曾经显示过就永久保留。</p>" },
        { title:"插入聊天或论坛", body:"<p>先点一个正文节点。编辑器左侧有消息和论坛图标；鼠标停上去会显示【插入消息模块】或【插入论坛模块】。点需要的图标，再编辑内容。</p>" },
        { title:"文章手机卡片怎样打开？", body:"<p>每张文章手机卡片只对应一个 App。作者编辑和读者打开时都会使用独立小手机中同一个 App 的界面与内容交互；返回会退出当前卡片。</p>" },
        { title:"添加可触摸的图片剧情", body:"<p>在右侧【节点列表】找到目标章节名称。电脑把鼠标移到这一行；手机或 iPad 点右侧【…】。展开按钮后点【◎】。保存后，本章会增加一个带【互动】标记的节点。</p>" },
        { title:"撤销修改或换字体", body:"<p>使用正文工具栏的撤销、重做和字体按钮。</p>" },
        { title:"普通互动和剧情分支有什么区别？", body:"<p>普通互动插在正文任意位置，一段正文可有多组，各组独立记录读者选择且不跳转；剧情分支负责跳到目标节点，所以固定在节点末尾。两者可以同时存在，不会互相转换或覆盖。</p>" },
        { title:"节点标题会给读者看吗？", body:"<p>标题主要用于整理结构。请保持清楚且唯一。</p>" },
        { title:"场景和章节有什么区别？", body:"<p>章节决定读者翻到哪一页、正文按什么顺序读。场景只给“场景锁定”占位符使用：几个节点选同一个场景时，会共用同一次随机结果。</p>" },
      ],
    })}
    ${tutorialGuide({
      category:"phone",
      title:"制作一部可阅读的小手机",
      outcome:"添加人物和 App 内容，并安排阅读顺序。",
      intro:"先建人物，再写消息、论坛和其他内容。",
      steps:[
        { title:"新建小手机", body:"<p>点页面顶部【新建】，再点【小手机】卡片。填写【作品标题】，最后点【创建作品】。</p>" },
        { title:"建立联系人", body:"<p>在手机桌面点【联系人】App，再点底部【+ 添加联系人】。输入姓名并点【确定】，然后填写账号、头像等资料，最后点【保存】。</p>" },
        { title:"填写 App 内容", body:"<p>回到手机桌面，点要编辑的 App。消息写在【消息】里，帖子写在【论坛】里，备忘内容写在【备忘录】里。</p>" },
        { title:"设置角色内容", body:"<p>点【消息】、【论坛】、【备忘录】、【相册】、【浏览器】或【购物】后，会先打开角色接入页。选择联系人，再点【保存并编辑内容】。</p>" },
        { title:"调整 App 位置", body:"<p>点手机上方【排列】，再点一个 App。使用方向按钮移动，也可以直接拖动。完成后点【完成】。</p>" },
        { title:"安排阅读顺序", body:"<p>回到手机桌面，点【设置】App。找到【阅读节奏控制】并打开开关，再拖动下面的内容卡片排序，最后点底部【保存】。</p>" },
        { title:"导入测试", body:"<p>导出后到读者端重新导入，逐个打开启用的 App。</p>" },
      ],
      checklist:["每个消息或论坛身份都能解析到角色", "阅读节奏顺序与剧情信息释放顺序一致", "所有启用 App 都有可读内容或明确空状态", "导出后仍能完整打开"],
      faq:[
        { title:"调整桌面 App 位置", body:"<p>回到手机桌面，点手机上方【排列】，再点一个 App。用方向按钮移动，也可以直接拖动。完成后点【完成】。</p>" },
        { title:"创建单聊或群聊", body:"<p>点桌面【消息】App，选择联系人后点【保存并编辑内容】。点联系人名称可以打开单聊；点联系人列表顶部【新建群聊】可以创建群聊。</p>" },
        { title:"添加特殊消息", body:"<p>打开一个会话，点输入框左边的【＋】。在剧情内容面板选择图片、位置、链接、转账、红包等类型。</p>" },
        { title:"添加语音或视频通话", body:"<p>添加通话事件。视频会使用联系人的「视频通话背景」。</p>" },
        { title:"编辑论坛帖子", body:"<p>正文按回车分段。发布后打开帖子并点「编辑」。</p>" },
        { title:"置顶、加精或排序帖子", body:"<p>轻点帖子操作按钮可置顶或加精；长按按钮后拖动可排序。</p>" },
        { title:"安排 App 阅读顺序", body:"<p>点桌面【设置】App，找到【阅读节奏控制】，打开开关并拖动内容卡片。此处只安排阅读提示；桌面图标位置请用手机上方【排列】调整。</p>" },
        { title:"桌面图标顺序就是阅读顺序吗？", body:"<p>两者分开保存。手机上方【排列】控制桌面图标位置；【设置】App 里的【阅读节奏控制】安排内容提示顺序。</p>" },
        { title:"为什么某个角色没有自己的 App 内容？", body:"<p>先确认联系人已建立，再检查角色接入配置。未设置角色专属内容时，读者会看到作品的通用内容或相应兼容状态。</p>" },
      ],
    })}
    ${tutorialGuide({
      category:"social",
      title:"建立角色并编排社交互动",
      outcome:"正确使用联系人、论坛小号和 NPC。",
      intro:"先建立联系人，再按场景选择身份。",
      steps:[
        { title:"建立联系人", body:"<p>填写姓名、账号和通用头像。</p>" },
        { title:"区分别名和小号", body:"<p>别名只是称呼。论坛小号可以有独立名称、头像和 IP。</p>" },
        { title:"设置专用图片", body:"<p>消息头像用于聊天，论坛头像用于帖子，视频通话背景用于视频画面。</p>" },
        { title:"选择发布身份", body:"<p>发帖或回复时，明确选择主号、小号或 NPC。</p>" },
        { title:"添加 @ 和后续回复", body:"<p>在文本框输入 @ 选择身份。每条后续回复都能单独选择发送者。</p>" },
        { title:"复用联系人和 NPC", body:"<p>联系人可在「写作习惯」填写联系人包名称后导出；论坛 NPC 可为 NPC 包命名并保存到通用包，再从目标作品的 NPC 管理页导入。导入只追加，不会覆盖目标作品已有内容。</p>" },
      ],
      checklist:["主号、小号和 NPC 的用途没有混用", "消息头像与论坛头像在各自界面正确", "开启论坛 IP 后只有配置过的作者角色显示属地", "读者本人回复没有被伪造 IP"],
      faq:[
        { title:"聊天和论坛使用不同头像", body:"<p>编辑联系人，分别填写「消息头像」和「论坛头像」。留空时使用通用头像。</p>" },
        { title:"同一人在论坛使用小号", body:"<p>编辑联系人并点「添加小号」，再填写论坛名称、头像和 IP。</p>" },
        { title:"添加或复用论坛路人", body:"<p>点桌面【论坛】App，完成角色接入后点顶部【NPC】。点【新建】可添加 NPC；点【导入 NPC 包】可追加已有包。</p>" },
        { title:"置顶或排列联系人", body:"<p>打开联系人排序设置，选择置顶、A–Z 或自定义排序。</p>" },
        { title:"在小手机里 @ 身份", body:"<p>在文本框输入 @，再选择联系人、NPC、读者称呼或作品占位符。</p>" },
        { title:"让多个角色依次回复", body:"<p>在「回复选项」的后续回复区添加多条消息，并逐条选择发送者。</p>" },
        { title:"修改评论数或楼层", body:"<p>编辑帖子填写「显示评论数」；编辑主评论填写「显示楼层」。留空时自动计算。</p>" },
        { title:"修改动态评论", body:"<p>点桌面【消息】App，进入【动态】。找到目标评论，点评论旁【编辑】，修改正文或显示时间后点【保存】。</p>" },
        { title:"显示论坛 IP", body:"<p>先填写身份的 IP，再打开论坛顶部「IP」开关。读者回复不会显示伪造 IP。</p>" },
        { title:"别名和小号有什么区别？", body:"<p>别名是同一联系人的另一种称呼。小号是联系人名下可单独选择的论坛身份，可以设置自己的论坛 ID、头像和 IP 属地。</p>" },
        { title:"通用头像、消息头像与论坛头像", body:"<p>通用头像用于联系人名片并承担旧数据回退；消息头像只用于聊天；论坛头像只用于帖子和评论。留空时会沿用通用头像。</p>" },
        { title:"视频通话背景（旧称“固定脸”）", body:"<p>【视频通话背景】用于视频通话画面。联系人头像仍在头像字段设置；语音通话不会显示这张背景。</p>" },
        { title:"IP 属地何时显示？", body:"<p>主号、小号和论坛 NPC 可以配置 IP 属地，但只有作者开启论坛 IP 显示后才呈现。读者本人发布的回复不会被伪造一个 IP。</p>" },
      ],
    })}
    ${tutorialGuide({
      category:"placeholders",
      title:"使用占位符",
      outcome:"创建一个占位符并测试替换结果。",
      intro:"作者自定义标记和问题。系统没有固定标记，也不规定读者扮演谁。",
      steps:[
        { title:"打开管理", body:"<p>互动文章：点编辑器左侧【{}】；鼠标停上去会显示【插入占位符】。小手机：点桌面【设置】App，页面顶部就是【占位符管理】。</p>" },
        { title:"填写标记和问题", body:"<p>标记是作者写进内容的文字；问题是读者看到的提示。标记可自由命名。</p>" },
        { title:"选择替换方式", body:"<p>全文替换使用同一个答案；随机替换会变化；场景锁定会在同一场景保持一致。</p>" },
        { title:"选择填写位置", body:"<p>选择【阅读前集中填写】时，读者会在作品开场填写；选择【文中填写】时，先把正文光标放到提问位置，再点【插入正文光标处】。</p>" },
        { title:"写入后续标记", body:"<p>把标记原样写进后续正文、消息或其他支持的内容。读者在文中保存答案后，后文才会展开，并使用刚刚填写的内容替换标记。</p>" },
        { title:"整理与搜索", body:"<p>搜索名称、标记、问题或违禁词；点击「整理全部词库」可按多种分隔符拆词并清除重复项。</p>" },
        { title:"预览测试", body:"<p>在读者预览中填写答案，检查替换范围和违禁词。</p>" },
        { title:"保存作者预设", body:"<p>常用配置可保存为作者预设。套用后，各作品仍可单独修改。</p>" },
      ],
      checklist:["内容中的标记完全一致", "问题文字容易理解", "违禁词已经测试", "修改作者预设不会改变旧作品"],
      faq:[
        { title:"修改显示名称", body:"<p>互动文章先点编辑器左侧【{}】；小手机先点桌面【设置】App。找到目标占位符，在【显示名称】输入框修改后保存。正文中的【标记】不会随显示名称改变。</p>" },
        { title:"让一个答案全文生效", body:"<p>选择「全文替换」，再把自定义标记写进需要替换的位置。</p>" },
        { title:"让读者读到一半再填写", body:"<p>把【填写位置】改为【文中填写】并保存；回到正文，把光标放在横线或提问句后，再打开占位符管理，点【插入正文光标处】。每个文中占位符只能有一个填写位置。</p>" },
        { title:"让结果随机变化", body:"<p>选择「随机替换」，再填写可用值。</p>" },
        { title:"让同一场景保持一致", body:"<p>选择「场景锁定」，再为节点设置场景。</p>" },
        { title:"限制部分输入", body:"<p>当前占位符的词填在「违禁词」；需要所有占位符共用的词填在「全局违禁词」。选【包含匹配】会拦截所有含有该词的内容，选【完全匹配】则只拦截整段相同的内容。支持换行、逗号、顿号、分号、斜杠和竖线分隔。</p>" },
        { title:"带到另一篇作品", body:"<p>保存为作者预设，再到目标作品中套用。</p>" },
        { title:"内容没有替换", body:"<p>检查内容中的文字是否与标记完全一致，并确认占位符已保存到当前作品。</p>" },
        { title:"导出会带走所有作者预设吗？", body:"<p>不会。作品文件只包含当前作品正在使用的占位符。</p>" },
      ],
    })}
    ${tutorialGuide({
      category:"files",
      title:"文件与备份",
      outcome:"正确分享作品，并保存可恢复的备份。",
      intro:"作品保存在当前浏览器。分享文件和备份文件用途不同。",
      steps:[
        { title:"等保存完成", body:"<p>看到「已保存」后再关闭页面。</p>" },
        { title:"导出单篇作品", body:"<p>回到创作端首页，在作品卡片上点【更多 ▾】，再点【导出作品】。选择【下载 .tuuru】或【生成加密 PNG】；分享时请把生成结果作为原文件发送，或上传网盘后分享下载链接。</p>" },
        { title:"管理导出记录", body:"<p>点首页【导出中心】，可按 .tuuru、PNG 和作品集筛选记录，查看作品导出后是否又有修改，并重新下载或生成文件。这里仅保存时间、格式和文件大小等信息，不保存作品文件，也不会上传作品内容。</p>" },
        { title:"创建作品集", body:"<p>手机或 iPad 长按作品；电脑右键作品。选中至少两篇后创建作品集。</p>" },
        { title:"导出作品集", body:"<p>回到创作端首页，在作品集卡片上点【更多 ▾】，再点【导出加密作品集】或【导出加密 PNG】。读者导入后会看到作品目录。</p>" },
        { title:"到读者端测试", body:"<p>重新导入文件，检查密码、占位符、分支和小手机内容。</p>" },
        { title:"备份创作库", body:"<p>点「备份全部」。备份含密码和私密内容，请勿公开分享。</p>" },
        { title:"定期留版本", body:"<p>重大修改前导出作品并备份，文件名保留日期。</p>" },
      ],
      checklist:["读者端成功导入并走通作品", "作品文件与整库备份分别保存", "包含密码和私密内容的备份没有公开分享", "知道原作品所在的浏览器、域名和端口"],
      faq:[
        { title:"分享单篇作品", body:"<p>在作品卡片上点【更多 ▾】，再点【导出作品】，选择【下载 .tuuru】或【生成加密 PNG】。把生成的原文件发给读者；不要从聊天图片预览中另存，也不要发送【备份全部】生成的整库备份。</p>" },
        { title:"分享多篇作品", body:"<p>长按或右键作品进入多选，创建作品集后再导出。</p>" },
        { title:"换浏览器或设备", body:"<p>在旧浏览器点「整机搬家」导出，再到新浏览器导入。</p>" },
        { title:"备份全部创作", body:"<p>首页点「备份全部」。文件含私密内容，请妥善保管。</p>" },
        { title:"复制联系人或 NPC 到另一篇作品", body:"<p>联系人使用「写作习惯」里的有名称联系人包；论坛 NPC 可在作品的 NPC 管理页保存到通用包，再到目标作品导入。</p>" },
        { title:"迁移作者占位符预设", body:"<p>点页面顶部的【?】进入【写作习惯与使用教程】，切换到【写作习惯】。在作者占位符预设区域点【导出习惯】，再到新设备导入。</p>" },
        { title:"导入时遇到相同 ID", body:"<p>系统会给导入项换新 ID，并保留两边内容。</p>" },
        { title:"恢复旧备份前", body:"<p>先备份当前创作库，再点「检查 / 恢复」。</p>" },
        { title:"JSON 和 PNG 有什么区别？", body:"<p>内容相同。JSON 便于管理；PNG 可以使用封面，更适合分享。</p>" },
        { title:"恢复备份会发生什么？", body:"<p>确认后会替换当前创作库。恢复前请先备份。</p>" },
      ],
    })}
      </div>
    </div>
  </div>`
}

const TUTORIAL_FEATURE_SECTIONS = [
  {
    id:"start", title:"作品与书架", features:[
      { title:"新建作品", what:"创建互动文章、Mini文游或小手机作品。", where:"创作端页面顶部的【新建】。", use:"点【新建】，再点【互动文章】【Mini文游】或【小手机】卡片。填写【作品标题】，最后点【创建作品】。", effect:"首页【我的作品】下面会增加一张作品卡片。" },
      { title:"作品信息", what:"管理标题、简介、作者署名、阅读密码和作者水印。", where:"创作端首页的作品卡片。", use:"点卡片上的【更多 ▾】，再点【作品信息】。修改后点弹窗底部的【保存】。", effect:"阅读页和新导出的作品文件使用最新信息。" },
      { title:"阅读密码与作品水印", what:"为导出作品设置进入密码，并添加随作品传播的文字或图片水印。", where:"首页作品卡片点【更多 ▾】，再点【作品信息】。", use:"在【阅读密码（选填）】填写密码；需要水印时打开【作者水印】，选择文字或图片，再设置透明度、大小、显示范围和位置，确认预览后保存。", effect:"新导出的 .tuuru 和加密 PNG 会隐藏密码与正文；作者水印会进入读者页面且不提供关闭入口。离线加密用于防止直接查看，不等同于 DRM。" },
      { title:"发布前体检", what:"在导出前检查缺失内容、路线异常和作品体积。", where:"首页作品卡片点【更多 ▾】，再点【发布前体检】。", use:"查看【需要处理】与【建议检查】，按【去修改】定位问题；互动文章还可运行深度路线检查。确认无阻断项后预览或导出加密作品。", effect:"体检只读取作品，不会自动改文；可提前发现不可达节点、失效引用和过大的内嵌素材。" },
      { title:"全作品查找替换", what:"一次查找并替换作品中的可见文字。", where:"首页作品卡片点【更多 ▾】，再点【全作品查找替换】。", use:"输入查找内容，检查匹配位置，选择需要修改的项目后执行替换。操作结束后如需反悔，立即点同一菜单中的【撤销上次批量操作】。", effect:"只修改选中的可见文字，不改内部 ID、图片链接和结构字段。" },
      { title:"批量顺延时间", what:"统一移动小手机作品中的日期和时间。", where:"含小手机内容的作品卡片点【更多 ▾】，再点【批量顺延时间】。", use:"设置顺延或提前的时长，检查可处理与跳过的项目，选择范围后执行。操作结束后可从【更多 ▾】点【撤销上次批量操作】。", effect:"支持的消息、动态、论坛和其它显示时间会保持原格式一起移动；无法确定的文字不会猜测修改。" },
      { title:"作品排序与置顶", what:"调整作品在书架中的显示位置。", where:"作品卡片右上角的【⠿】和卡片上的【更多 ▾】。", use:"电脑按住【⠿】拖动排序。需要置顶时点【更多 ▾】，再点【置顶作品】或【取消置顶】。", effect:"置顶作品排在普通作品前面；同组作品保留拖动后的顺序。" },
      { title:"自动保存", what:"把编辑内容保存到当前浏览器。", where:"编辑器顶部保存状态。", use:"编辑后等待状态显示“已保存”。", effect:"重新打开作品时保留最新内容。" },
      { title:"阅读预览", what:"查看读者实际看到的作品。", where:"首页作品卡片上的【阅读】，或编辑器顶部的【读者端】。", use:"点入口后从开头阅读，实际点击选项并测试返回。", effect:"可以发现断开的分支和显示问题。" },
      { title:"复制作品", what:"创建一份独立副本。", where:"首页作品卡片上的【更多 ▾】。", use:"点【更多 ▾】，再点【复制作品】。", effect:"首页增加一份副本，原作保持不变。" },
      { title:"删除作品", what:"移除一篇本地作品。", where:"首页作品卡片的【更多 ▾】。", use:"点【更多 ▾】，再点【删除作品】，阅读弹窗后确认。", effect:"作品会从书架和相关作品集目录中移除。" },
      { title:"创建作品集", what:"把多篇作品组成一个可导出的目录。", where:"手机或 iPad 长按作品；电脑右键作品。", use:"选中至少两篇，点“创建作品集”，再填写信息。", effect:"书架新增作品集卡片，原作品继续保留。" },
      { title:"管理作品集", what:"修改作品集信息、顺序和进入方式。", where:"首页的作品集卡片。", use:"点卡片上的【管理】。在弹窗中增删作品或调整顺序，最后点弹窗底部的【保存】。", effect:"下一次导出使用最新目录和作品内容。" },
      { title:"作品集进入方式", what:"控制读者进入作品集时填写信息的次数。", where:"作品集卡片的【管理】弹窗。", use:"点【管理】，找到【进入方式】，选择【各篇独立】或【作品集统一】，最后保存。", effect:"【各篇独立】保留每篇设置；【作品集统一】只填写一次。" },
    ],
  },
  {
    id:"article", title:"互动文章", features:[
      { title:"章节", what:"章节是读者翻阅的一页，用来整理同一页中连续出现的剧情文段。", where:"电脑看编辑器右侧【结构】；手机点页面顶部【结构】。", use:"在【节点列表】标题右侧点【+章】。按住节点左边【⠿】拖动，把需要连续阅读的节点排进同一章。最前章节的第一个普通节点会成为作品起点；换起点时把目标节点拖到最前面。", effect:"当前路线中的同章正文会合并在一页；章节结束后点【NEXT】进入下一章。" },
      { title:"节点", what:"普通节点是章节内的一段正文；互动图片节点是一页独立互动。", where:"电脑看右侧【节点列表】；手机先点顶部【结构】。", use:"直接添加正文节点时点【节点列表】标题右侧的【+】。要加进指定章节，电脑把鼠标移到章节名称这一行；手机点这一行右侧【…】。展开【＋、隐、◎、✎、×】后，点【＋】添加正文节点，点【◎】添加互动图片节点。", effect:"同章普通节点按当前路线合并；互动图片节点会单独打开。" },
      { title:"本节与全文字数", what:"同时查看当前正文节点和整篇文章的文字数量。", where:"打开任意正文节点后，看正文编辑区顶部、节点标题旁的【本节 · 全文】数字。", use:"直接写作即可，数字会随正文输入更新；【本节】统计当前节点，【全文】合计作品内全部文章节点。", effect:"无需导出即可掌握当前段落和整篇作品的篇幅。" },
      { title:"剧情分支", what:"让读者的选择跳转到另一条剧情路线，并记录本次选择。", where:"点正文节点，再看编辑器左侧的【⇄】；鼠标停上去会显示【编辑末尾剧情分支】。", use:"点【⇄】，填写选项文本，再点【选择目标节点】并选择目标节点。剧情分支始终固定在节点正文末尾。被选项直接指向的普通节点会自动进入对应路线。", effect:"读者只会进入当前选择的路线。同组选项指向的其它并行节点不会同时出现。每个选项的稳定 ID 可用于隐藏节点条件。" },
      { title:"普通互动", what:"在正文任意位置提供不跳转的反应选择；同一节点可以放多组。", where:"先把输入光标放进正文，再点编辑器左侧【◇】；鼠标停上去会显示【在正文中插入普通互动】。", use:"每组至少添加两个选项。填写按钮上的【选项文本】和点击后出现的【选择后内容】，再点【保存】。选择后内容可以分行，每一行都会按独立正文段落显示。点正文里的互动卡片可以编辑、删除或移动；进入移动状态后，点击新的正文位置完成放置。位置丢失时用【待放置】提示中的【放到光标处】恢复。", effect:"每组单独记录选择，不改变剧情路线。读者选择当前普通互动后，才会继续看到它后面的正文、下一组互动或后续场景；结果与后续正文会在当前位置下方向下展开，页面不会跳回章节顶部。当前节点里的普通互动全部完成后，末尾剧情分支才会出现；普通互动和末尾剧情分支可以同时存在。普通互动标题、选项文本、选择后内容和末尾剧情分支文字都支持当前作品的占位符。反馈沿用正文的字体、字号、行距、字距、段落间距和首行缩进。" },
      { title:"小游戏", what:"用本地随机判定决定读者进入哪段剧情。", where:"电脑端把光标放进正文，在左侧工具栏找到【互动页】右边、手机模块分割线左边的 SVG 骰子图标；鼠标停上去会显示【小游戏】。手机端点【插入】，再点【小游戏】。", use:"选择【掷骰判定】【随机数】或【对抗骰】。填写按钮文字、连续且不重叠的结果区间、揭晓文案和每个结果的后续节点；可先点【试玩一次】检查配置，再点【插入正文】。", effect:"读者点击后才生成结果，结果与点数保存在当前阅读档案中，刷新不会重掷；后续正文在判定前保持隐藏。结果选项的稳定 ID 也可以用于隐藏节点条件。" },
      { title:"隐藏节点", what:"只在当前选择满足条件时显示的一段补充正文。", where:"在右侧【节点列表】找到目标章节名称。电脑把鼠标移到这一行；手机点这一行右侧【…】。展开【＋、隐、◎、✎、×】后点【隐】。", use:"新隐藏节点会放在本章末尾。点节点名称，在中间写正文，再点编辑器顶部【显示条件】。设置完成后，按住节点左边【⠿】拖到希望出现的位置。", effect:"条件满足时插入正文；条件不满足时跳过。读者返回改选后会重新判断。" },
      { title:"显示条件（或 / 且）", what:"用读者当前选择决定隐藏节点是否显示。", where:"先在【节点列表】点一个隐藏节点，再点编辑器顶部【显示条件】。", use:"搜索选项文本、普通互动组名、节点、章节或稳定 ID，点结果加入条件。同一组中的选项按【或】判断。点【添加附加条件（且）】可建立另一组；不同组按【且】判断。最后点【保存】。", effect:"条件使用稳定 ID。选项改名后仍能关联；选项被删除、ID 重复或引用不明时会显示【条件已失效】。" },
      { title:"章节连续阅读、分支汇合与 NEXT", what:"控制章节内文段合并、选项后的路线汇合以及章节之间的翻页。", where:"读者端的章节正文和页面底部。", use:"普通节点末尾不设置选项时，会沿当前路线继续读取同一章节的后续节点。若节点 1 的 A、B 分别指向节点 2、3，可把无人直接指向的节点 4 排在它们之后作为汇合主线：初次打开只显示节点 1，选择 A 后显示节点 2 再接节点 4，选择 B 后显示节点 3 再接节点 4。当前章节结束后点击 NEXT。", effect:"未选择的并行分支不会提前出现；汇合节点只在当前支线走完后顺延显示。NEXT 会进入下一章节，最后一章结束后显示返回首页。" },
      { title:"作者设定笔记", what:"整理故事总纲、章节规划、伏笔回收、世界规则、地点与组织、人物档案、人物关系和灵感碎片。", where:"电脑点编辑器右侧上方【设定】；手机点顶部【设定】。", use:"点左侧分类名称开始记录。顶部搜索框可搜索分类和内容；分类右侧会显示字数。", effect:"笔记只保存在作者端，不进入作品预览，也不随作品导出。" },
      { title:"场景", what:"让几个节点共用【场景锁定】占位符的同一次随机结果。", where:"先点一个正文节点，再看编辑器顶部的场景下拉框。", use:"点下拉框。新建时点【＋ 新建场景…】，输入名字并确定。再让需要共享结果的其它节点选择同一场景。普通写作选【不使用场景】。", effect:"同一场景中的节点会使用相同的场景锁定结果。" },
      { title:"富文本与图片", what:"设置正文格式、整体阅读排版并插入图片。", where:"先在【节点列表】点正文节点，再看正文上方工具栏和编辑器左侧带图片图案的【+】。", use:"选中文字后可用【B】【I】【U】和【左】【中】【右】设置局部格式。字体、字号、行距、字距、段首缩进与页边距属于作品正文排版；点【边距】可填写上下左右数值。插入图片时点左侧图片按钮，填写信息后保存。", effect:"作者设置的字体、字号、行距、字距、段首缩进和页边距会成为读者端默认排版；读者若主动设置个人阅读外观，则以读者本机选择为准。" },
      { title:"作者正文颜色", what:"调整作者端正文编辑器的文字颜色。", where:"正文上方工具栏里的【字色】。", use:"点【字色】旁的颜色框选择颜色。需要恢复时点【重置字色】。", effect:"颜色只影响本机编辑界面，不随作品导出，也不覆盖读者阅读美化。" },
      { title:"互动图片", what:"制作独立的可触摸图片剧情节点，并分隔同章前后的正文页面。", where:"在右侧【节点列表】找到目标章节名称。电脑把鼠标移到这一行；手机点这一行右侧【…】。", use:"展开【＋、隐、◎、✎、×】后点【◎】。上传背景图或立绘，添加热区并设置触发方式、说话人和台词。最后在【后续跳转至（必选）】选择普通节点，再点【保存】。互动图片内不能添加剧情分支；需要分流时，在后续普通节点添加剧情分支。", effect:"阅读时会依次出现互动图片前正文页、互动图片页、后续普通节点开始的正文页。最后一个画面完成后进入作者选择的普通节点。" },
      { title:"插入小手机内容", what:"在文章节点中展示消息、论坛、备忘录等 App 内容。", where:"先在右侧【节点列表】点一个正文节点，再看编辑器最左边的一列按钮。", use:"把鼠标停在按钮上会看到【插入消息模块】、【插入论坛模块】、【插入备忘录模块】、【插入相册模块】、【插入浏览器模块】或【插入购物模块】。点需要的按钮，编辑内容后保存。每张文章手机卡片对应一个 App。需要调整归属时，点卡片右侧【≡】，再点【移动到其他节点】或【复制到其他节点】，按章节选择目标正文节点。", effect:"作者和读者可打开该 App；返回时退出当前卡片。移动或复制后，模块会完整保留帖子、消息、商品等已编辑内容，并放在目标节点正文末尾；整个过程只在当前浏览器内完成。" },
      { title:"消息模块联系人可见性", what:"控制一个文章消息卡片中可以出现的联系人。", where:"点编辑器左侧消息图标，打开消息模块编辑器，再点【联系人】。", use:"查看【本模块可见】数量。点联系人右侧按钮可切换【读者可见】和【已隐藏】。已被聊天或动态使用的联系人需先删除相关内容。", effect:"设置只影响当前文章消息卡片。后来新增的联系人不会自动进入已有模块。" },
      { title:"移动节点", what:"调整节点所属章节、正文顺序和作品起点。", where:"右侧【节点列表】中，每个节点左边都有【⠿】。", use:"按住【⠿】拖动。上下拖可以换顺序，拖进另一个章节可以换章节。电脑把鼠标移到节点这一行，或在手机点节点右侧【…】，还可以用【移至…】直接换章节。", effect:"最前章节的第一个普通节点会成为起点；隐藏节点会在拖动后的结构位置插入。" },
      { title:"撤销、重做与字体", what:"恢复正文修改并设置编辑字体。", where:"先点正文节点，再看正文上方工具栏。", use:"点【↶】撤销，点【↷】重做。点字体下拉框选择字体；需要本机字体时点【+ 导入字体…】。", effect:"正文恢复到对应版本，字体设置会保存。" },
    ],
  },
  {
    id:"interactive", title:"互动图片与 Mini文游", features:[
      { title:"Mini文游适合做什么", what:"在一个互动场景里安排多个画面和轻量选择分支，制作以图片为主、一次读完的短篇互动体验。", where:"创作端页面顶部【新建】里的【Mini文游】。", use:"适合小段故事、氛围互动、角色特典或绘画展示。每个画面可以放背景、立绘、叠加图层、热区、提示、对话、动作帧和音乐。", effect:"Mini文游不是完整文游引擎；只提供画面选项跳转，不提供条件分支、变量、背包、数值养成、战斗、自定义脚本或小手机 App。需要复杂路线时，请创建互动文章并把互动图片页放进正文路线。" },
      { title:"从零创建 Mini文游", what:"建立一个可以单独导出并导入书架的短篇作品。", where:"创作端页面顶部【新建】里的【Mini文游】。", use:"点【新建】，再点【Mini文游】。填写作品标题、描述和作者署名，最后点【创建作品】。进入专用编辑页后，点【编辑画面与互动】打开已经预建的场景；旧作品尚无场景时，这个按钮会显示【创建第一个互动场景】。", effect:"系统只使用一个互动场景，不提供或使用可编辑的文章章节和普通正文节点；所有内容都在这个场景的多个画面里完成。" },
      { title:"安排画面顺序与完成条件", what:"决定读者按什么顺序探索画面，以及什么时候可以继续。", where:"画面编辑器左侧【画面】列表和列表下方的操作区。", use:"点【＋ 添加画面】增加内容。选中画面后用【上移】或【下移】调整顺序，用【删除】移除误建画面。有热区的画面必须探索完全部热区才会继续；没有热区的画面可以直接继续。", effect:"列表第一项就是读者起点。没有画面选项时按列表顺序推进；设置选项时则由读者选择目标画面。最后一个没有选项的画面完成后进入作品完成页。" },
      { title:"设置轻量画面分支", what:"在当前画面探索完成后，让读者选择接下来进入哪个画面。", where:"独立 Mini文游的画面编辑器右侧【互动】中的【画面选项】。", use:"先建立至少两个画面，再点【＋ 添加画面选项】，填写读者看到的选项文字并选择目标画面。每个画面最多 6 个选项；不需要分支时保持为空即可按左侧顺序继续。", effect:"选项只负责跳转画面，没有变量、条件判断或脚本。可以跳到任意其他画面，但请避免选项彼此循环，导致读者无法到达完成页。互动文章里的互动图片不提供画面选项，仍在完成后跳到指定普通节点。" },
      { title:"设置 Mini文游占位符", what:"让读者填写姓名等内容，并替换画面里可见的文字。", where:"Mini文游专用编辑页的【占位符】卡片。", use:"点【管理占位符】，设置标记、问题、模式和违禁词。Mini文游统一在阅读前填写；把标记直接写进画面提示、说话人、初始台词、叠加对话、热区名称与台词或画面选项文字。", effect:"读者进入作品时先填写，之后可见文字会使用读者的答案；图片、音视频链接、画面 ID 和选项目标 ID 不会替换。" },
      { title:"完成一个最小作品", what:"用最少步骤做出一段可以实际试玩的 Mini文游。", where:"Mini文游编辑页的【画面与互动】和【读者预览】。", use:"先给画面 1 添加背景图或立绘，再创建一个【点击】热区并填写触发台词；接着添加画面 2，填写结束时显示的初始台词。点底部【保存】回到专用编辑页，再点【读者预览】，依次触发热区并走到完成页。", effect:"先验证画面推进、热区命中和对话反馈，再继续增加动作帧、摄像头互动或音乐，比较容易定位问题。" },
      { title:"固定画布与三种预览", what:"让手机和电脑共用同一套构图与热区坐标。", where:"画面编辑器左侧【画布规格】，以及中间画面上方的【手机竖屏】【手机横屏】【电脑】。", use:"画布可选 9:16、16:9、3:4、1:1，或在 320 到 3840 像素范围内自定义；竖屏作品可先用推荐的 1080×1920。切换三种预览检查留白和构图。", effect:"三种按钮只改变编辑器外部预览框，不会改变逻辑画布、图片位置或热区坐标，也不是完整设备模拟器；真实触发与尺寸仍要用【读者预览】在目标设备验收。" },
      { title:"默认 BGM 与画面特殊 BGM", what:"为整个 Mini文游设置持续音乐，并允许某个画面临时切换。", where:"Mini文游编辑页的【默认 BGM】；单画面音乐在【编辑画面与互动】右侧折叠的【本画面特殊 BGM】。", use:"可以填写 HTTPS 音乐链接，也可以选择本地音频，并分别调整音量和循环。本画面设置特殊 BGM 后，读者进入该画面会切歌；离开时恢复默认 BGM 的原播放位置。需要移除时，点【清除音乐】，再点【再次点击确认清除】。", effect:"只有独立 Mini文游提供作品默认 BGM；互动文章里的互动页没有默认音乐，未设置本画面特殊 BGM 时保持安静。本地音频文件随作品导出；远程音频文件不嵌入，只保存 URL，阅读时需要联网。受浏览器自动播放限制，音乐会在读者第一次操作后开始播放。当前没有多轨混音、淡入淡出、交叉淡化或热区音效。" },
      { title:"选择 BGM 播放片段", what:"让一首长音乐只播放指定的起点到终点。", where:"音乐成功读取时长后展开的【播放片段】时间轴。", use:"拖动【开始】与【结束】滑杆，再点【试听片段】。打开【循环播放】后，只循环蓝色选区；点【恢复全曲】可以取消区间。", effect:"能成功读取时长的本地或 HTTPS 音乐可以保存播放区间；远程站点限制、防盗链、媒体响应方式、格式或加载失败都可能让时间轴不可用。只设置区间不会自动缩小原文件。" },
      { title:"裁剪并只保留所选音乐", what:"把本地长音频重新编码成选中的短片段，实际减少导出体积。", where:"本地 BGM 的【播放片段】区域。", use:"先选好至少 0.5 秒的起止区间，再点【裁剪并只保留这段】。处理会按所选时长实时进行，请保持页面开启；成功后会显示裁剪后的新文件和体积。", effect:"裁剪依赖浏览器提供 AudioContext、MediaRecorder 和可用的音频编码格式；不支持时会保留完整音频，只按所选区间播放。支持时目标约为 96 kbps，实际格式和码率由浏览器决定。单次最多裁剪 5 分钟；取消、页面进入后台、编码失败或没有有效节省空间时，也会保留完整音频。" },
      { title:"叠加图层与多立绘", what:"在背景和主立绘上继续放光圈、箭头或额外立绘。", where:"选中画面后，打开右侧【图层】，再看【叠加图层】。", use:"点【＋ 添加叠加图层】，为每层选择本地图片、GIF 或 HTTPS 链接；可以分别设置显示、填充、缩放、横纵偏移和透明度，并用【上移一层】【下移一层】【删除这个图层】管理。", effect:"同一画面最多 24 个叠加图层，达到上限后不能继续添加。叠加图层不支持视频；视频只用于热区的临时动作帧。" },
      { title:"逐画面触摸提示", what:"决定哪一个画面需要告诉读者可以触摸。", where:"选中画面后打开右侧【文字】，查看【在当前画面显示触摸提示】。", use:"每个画面可以单独打开或关闭提示，也可以填写自己的提示文字。展开【提示样式与排版】后，可设置顶部、底部或自由位置、宽度、字体、字号、行距和字距；自由位置也可直接在画布拖动。", effect:"提示的开关、文案、位置和排版都属于当前画面；不同画面可以使用不同的提示位置与字体，也不会通过【同步到作品全部互动页】复制。" },
      { title:"多个可移动对话框", what:"在一个画面里叠放文字，制作重叠或压迫感。", where:"选中画面后打开右侧【文字】，查看【叠加对话框】。", use:"每个画面有一个主对话框；点【＋ 添加叠加对话框】可以继续添加，同一画面最多 12 个叠加对话框。选中叠加框后可修改说话人、台词、位置、宽高、字体、字号、行距、字距和透明度，也可以直接拖动或点【删除这个叠加对话框】。", effect:"有说话人或台词时，叠加框会作为该画面的静态叠加文字显示，不负责推进流程；读者仍然点击主对话框进入下一画面。" },
      { title:"预览、导出与交给读者", what:"检查完整流程，再生成读者可以导入的 Mini文游文件。", where:"专用编辑页右上角【读者预览】；导出入口在创作端首页作品卡片的【更多 ▾】中。", use:"先用画面编辑器的三种外框检查构图，再用【读者预览】走完整流程，确认热区、对话、动作帧、音乐和完成页。返回首页，依次点【更多 ▾】【导出作品】，再选择【下载 .tuuru】或【生成加密 PNG】。读者在书架点【导入作品】，选择收到的原文件。", effect:"本地图片和音乐会随作品一起打包，无需单独导出或导入；远程素材文件不会进入作品，只保存 URL 文字。加密 PNG 必须发送原文件，聊天软件压缩、截图或重新保存都可能破坏其中的作品载荷。" },
      { title:"Mini文游素材与体积", what:"控制图片、动作帧和本地音乐占用的导出空间与运行内存。", where:"作品卡片【更多 ▾】里的【发布前体检】中，查看【作品体积账单】。", use:"本地背景、立绘、叠加图层、动作帧、对话框 PNG 和 BGM 都会计入载荷；完全相同的字节内容按 SHA-256 去重。建议把预计加密载荷控制在 6 MiB 以下，6–9 MiB 谨慎使用，9–10 MiB 属于高风险，超过 10 MiB 无法导出。大型 GIF、视频可改用有权使用的 HTTPS 链接，长 BGM 可裁剪后只保留片段。", effect:"单个作品最多携带 256 个不同的本地素材。最终加密载荷已经包含约 35 字节封装开销，最多 10 MiB；【作品体积账单】显示的就是该数值，超过上限会拒绝导出。PNG 的可见封面还会增加最终文件大小；完整 PNG 最多 25 MiB，超过时导出端会提示更换较小封面或改用 .tuuru，读者端也会拒绝导入。高分辨率图片、GIF、视频和同画面多图层解码后也会占用额外内存，因此无法按分钟承诺作品长度。" },
      { title:"退出与阅读进度", what:"了解 Mini文游目前会保存什么。", where:"【读者预览】或读者书架中打开 Mini文游后。", use:"请把每次试玩当作从第一画面开始的一次完整流程；退出、刷新或重新打开后，需要重新探索。", effect:"当前不会保存画面内的中途探索进度，也没有检查点或画面存档。最后完成页只提供【重新开始】和【返回书架】。" },
      { title:"创建独立互动页", what:"把一组可触摸画面放进互动文章，作为章节路线中的独立互动节点。", where:"在右侧【节点列表】找到目标章节名称。电脑把鼠标移到这一行；手机点这一行右侧【…】。", use:"展开【＋、隐、◎、✎、×】后点【◎】。也可以点编辑器左侧【◎】。编辑完成后点【保存】，节点会出现在所选章节下面。", effect:"这是互动文章里的页面，不是 Mini文游；读者走到该节点时会打开全屏互动页面，完成后进入指定的普通节点。" },
      { title:"管理多个画面", what:"在 Mini文游或文章互动页中安排依次出现的画面。", where:"打开画面编辑器，看左侧【画面】列表。", use:"点【＋ 添加画面】建立画面 2、画面 3，点画面名称切换，用【上移】【下移】调整顺序。读者探索完当前画面的全部互动点后，没有选项时点击对话框进入下一画面；Mini文游设置了画面选项时改为选择目标画面。", effect:"互动文章里的互动图片严格按左侧顺序推进；独立 Mini文游可以在右侧【互动】添加轻量画面选项。Mini文游在最后一个没有选项的画面后结束；文章互动页会继续到指定节点。" },
      { title:"固定后续跳转", what:"为互动文章里的互动页指定结束后进入的普通节点。", where:"文章互动页编辑器左侧画面列表下方的【后续跳转至（必选）】。", use:"点下拉框，按章节选择一个普通节点。选好后才能保存。系统保存稳定节点 ID，所以目标改名或移动后仍然有效；目标被删除时，发布检查会提示修复。需要剧情分流时，把选项组放在选中的后续普通节点。", effect:"文章互动页完成后严格进入作者选择的节点；这项只用于互动文章。Mini文游最后一个画面完成后直接显示作品完成页。" },
      { title:"背景图与立绘", what:"把环境和人物拆成两个可以独立调整的图层。", where:"每个画面的「背景图」和「立绘」设置。", use:"可以填写 HTTPS 图片或 GIF 链接，也可以选择本地图片。背景图建议与逻辑画布使用相同比例，例如竖屏画布可准备 1080×1920；透明立绘可以沿用画布尺寸，并在人物周围保留透明边距，方便不同窗口等比缩放。只需要立绘时可以不填背景；两层同时使用时，立绘显示在背景上方。补充替代文字可以帮助无法查看图片的读者理解画面。", effect:"同一画面可以只显示一层，也可以合成背景与透明立绘。新画面默认完整显示背景；需要画面铺满时再改为【铺满裁切】。" },
      { title:"移动和缩放画面", what:"调整背景图或立绘在互动页面中的构图。", where:"预览上方「背景图 / 立绘」「移动图片」、缩放按钮和「复位」。", use:"先选中要调整的图层，再点「移动图片」；拖动画面平移，滚轮或加减按钮缩放。「完整显示」保留整张图，「铺满裁切」填满画面。", effect:"背景和立绘分别保存自己的位置、缩放与填充方式，互不覆盖。" },
      { title:"矩形、椭圆与手绘热区", what:"指定读者可以触发互动的画面区域。", where:"预览工具栏「＋矩形」「＋椭圆」「手绘热区」。", use:"矩形和椭圆创建后可直接拖动，拉四角调整大小；手绘时沿目标轮廓描一圈。右侧可以修改名称、形状和精确位置。替换图片或大幅改变构图后，应重新检查热区是否仍对准。", effect:"热区在普通阅读状态下保持不可见，可接收点击、长按、滑动和三种摄像头靠近组合触发。" },
      { title:"删除误建热区", what:"移除误触创建或不再需要的互动区域。", where:"右侧【互动】中的热区列表，以及选中热区后的设置底部。", use:"热区列表每一项右侧都有【删除】；也可以先点画布轮廓或列表条目选中，再点【删除这个区域】。选中后，画布会显示轮廓和四角控制点，可先确认目标再删除。", effect:"只删除当前热区，不会删除画面、图片或其他区域。热区删除后，读者不再需要探索它才能继续。" },
      { title:"六种触发方式", what:"控制一个热区需要怎样操作才会触发。", where:"先在互动图片预览或热区列表中点一个热区，再看右侧【触发方式】。", use:"选择点击、长按、滑动、脸部靠近、靠近后点击或靠近后长按。长按可设置等待时间；摄像头方式可设置未授权时的备用互动。", effect:"不同热区可以使用不同操作。" },
      { title:"摄像头靠近互动", what:"用设备前置摄像头判断读者是否完成了明显靠近镜头的动作。识别过程只在当前设备进行。", where:"热区触发方式中的「脸部靠近」「靠近后点击」「靠近后长按」。", use:"作品含摄像头互动时，会在进入作品时统一申请权限。测试时先在普通阅读距离让摄像头看到脸，再明显靠近，直到镜头几乎无法继续识别人脸；组合触发会短暂等待对应的点击或长按，触屏贴近时也允许先触摸再完成靠近。", effect:"未授权时使用作者设置的备用互动；已经授权但浏览器不能识别时不会偷偷降级成普通点击。" },
      { title:"热区动作帧", what:"在热区台词出现时临时覆盖一张反馈图片、GIF 或视频。", where:"先点一个热区，再打开右侧【触发动作帧】。", use:"动作帧建议沿用逻辑画布比例；填写素材链接或选择本地文件后，选择铺满或完整显示，并用缩放、横向偏移和纵向偏移精确构图。本地文件成功嵌入后会显示【已嵌入：文件名】。点【预览动作帧】后还可以在画布上直接拖动动作帧，完成时再点【返回基础画面】。", effect:"作者预览和读者端使用同一逻辑画布与动作帧变换；读者触发热区时会同时看到动作帧、说话人和台词，播放结束后回到原画面。" },
      { title:"动作帧播放与返回", what:"控制临时动作帧何时结束。", where:"热区的动作帧设置。", use:"静态图可设置 0.3 到 30 秒；本地 GIF 会读取首轮动画时长，图床不允许读取时使用备用播放时间；MP4 或 WebM 视频播放一遍。读者也可以提前点击对话框返回。", effect:"静态图计时结束、GIF 播完首轮或视频结束后都会自动回到原画面，不会无限停留或循环播放。" },
      { title:"说话人、台词与文章占位符", what:"为每个画面和热区分别安排角色名与文字反馈。", where:"画面设置中的「说话人、初始台词」；热区设置中的「触发时说话人、触发时台词」；Mini文游专用页的【占位符】。", use:"画面台词负责进入画面时的内容；热区台词负责触发后的反应。互动文章使用文章已有占位符；Mini文游可以在专用页创建占位符，并把标记写入画面可见文字。", effect:"读者端会替换触摸提示、画面名称与替代文字、主对话和叠加对话、热区名称与台词，以及 Mini文游画面选项文字；不会替换图片链接、视频链接或内部 ID。" },
      { title:"对话框与触摸提示美化", what:"调整主对话框与触摸提示的排版和外观。", where:"右侧【文字】中的【提示样式与排版】和【主对话框样式】。", use:"两者都可调整颜色、透明度、圆角、位置、字体、字号、行距和字距；主对话框还可调宽高，并使用透明 PNG 边框向外延伸。勾选【同步到作品全部互动页】时，只同步主对话框外观和 PNG，不覆盖角色名或台词，也不同步触摸提示。", effect:"触摸提示样式只影响当前画面；主对话框同步主要用于互动文章中的多个互动页。Mini文游只有一个互动场景。" },
      { title:"素材体积与保存", what:"避免本地嵌入素材把作品文件和浏览器存储撑得过大。", where:"背景、立绘和动作帧的本地嵌入区域及底部状态提示。", use:"静态 PNG、JPG 和 WebP 会尝试压缩后嵌入；等待状态栏显示嵌入结果再保存。大型 GIF 或视频优先使用 HTTPS 图床。若浏览器存储不足，编辑器会保留当前窗口并提示缩小素材或改用图床。", effect:"静态图更容易稳定保存；本地嵌入仍会计入作品导出体积，链接素材不会写进导出文件本体。" },
      { title:"【互动文章】编辑、删除与移动互动页", what:"修改互动图片内容，或把整个互动图片节点换位置。", where:"先在右侧【节点列表】点带【互动】标记的节点。", use:"中间会出现【编辑互动页】，点它可以修改画面。需要移动时，按住节点左边【⠿】拖到新位置；也可以点这一行右侧【…】，再用【移至…】换章节。需要删除时，点这一行右侧【…】，再点【×】并确认。", effect:"移动和删除的都是整个互动图片节点，节点里的全部画面会一起处理。" },
      { title:"【互动文章】读者端逐页验收", what:"用真实作品检查完整阅读流程。", where:"回到创作端首页，在作品卡片上点【阅读】。", use:"从能到达互动页的路线进入，逐个测试热区、摄像头备用方式、动作帧、对话框推进和返回文章。目标读者会用哪些设备，就在哪些设备上各检查一次。", effect:"可以确认热区对齐、素材加载、占位符、权限提示和画面推进。" },
    ],
  },
  {
    id:"phone", title:"小手机", features:[
      { title:"App 排列", what:"调整桌面 App 的位置。", where:"小手机上方的【排列】。", use:"点【排列】，再点一个 App。用方向按钮移动，也可以直接拖动。完成后点【完成】。", effect:"读者桌面会使用保存后的位置。" },
      { title:"读者剧情桌面组件", what:"把当前作品的消息、照片、日程、线索和阅读进度做成手机桌面入口。", where:"进入【读者端】，点顶部【外观】，打开【手机外观】里的【桌面组件】。", use:"先启用剧情桌面组件，再选择要显示的内容、上下调整顺序，并分别选择半宽或整行以及拍立得、信封、票根、胶片、亚克力等外观。便签内容和组件开关只保存在当前浏览器。", effect:"同一种内容可以自由换外观；点击组件会打开对应 App。未启用时，旧作品仍保持原来的手机桌面。" },
      { title:"联系人", what:"建立消息和论坛使用的人物资料。", where:"小手机桌面的【联系人】App。", use:"点【联系人】，再点底部【+ 添加联系人】。输入姓名并点【确定】，填写资料后点【保存】。", effect:"其它 App 可以选择并显示这个身份。" },
      { title:"好友申请", what:"让新联系人先向读者发送一条需要同意或拒绝的好友申请。", where:"在【联系人】App 新建联系人并填写基础姓名后出现的【创建好友申请】弹窗。", use:"填写可选的验证消息，点【创建申请】，再完成并保存联系人；不需要时点【暂不创建】。", effect:"申请会自动建立对应单聊并加入阅读流程。读者需要选择同意或拒绝后，剧情才会继续，选择会保存在当前阅读档案中。" },
      { title:"单聊与群聊", what:"创建聊天会话。", where:"小手机桌面的【消息】App。", use:"点【消息】，选择联系人后点【保存并编辑内容】。点联系人名称打开单聊；点联系人列表顶部【新建群聊】创建群聊。", effect:"读者可打开完整聊天记录。" },
      { title:"消息发送者", what:"指定每条消息由读者、角色或系统发出。", where:"会话底部的发送者选择区。", use:"先选择发送者，再在同一个输入框里输入文字。选中系统时会生成居中的系统提示。", effect:"普通消息按发送者显示气泡方向、头像和身份；系统提示不显示气泡。" },
      { title:"文字与图片消息", what:"添加普通文字或图片气泡。", where:"先打开一个会话。文字入口在底部输入框；图片入口在输入框左边【＋】。", use:"文字直接输入后点【添加】。图片先点【＋】，再点【图片】，填写图片地址和说明后保存。", effect:"读者按消息顺序看到文字或图片。" },
      { title:"语音、位置与日期时间", what:"添加语音气泡、地点和时间分隔。", where:"语音与位置在输入框左边【＋】；日期时间在消息的右键或长按菜单。", use:"语音和位置从剧情内容面板选择；需要时间分隔时，右键或长按下一条消息并选择【在前插入时间】。", effect:"聊天记录显示对应样式；系统提示直接通过系统发言人输入。" },
      { title:"外部链接卡片", what:"把 HTTP 或 HTTPS 网页做成聊天卡片。", where:"打开会话，点【＋】，再点【链接】。", use:"选择【外部网址】，填写卡片标题和完整网址后保存。", effect:"读者点击后会打开外部页面；无效协议只显示文字。" },
      { title:"作品内论坛链接", what:"把当前作品的一篇论坛帖子放进聊天。", where:"打开会话，点【＋】，再点【链接】。", use:"选择【链接内容】，再从列表选择已有帖子。需要时修改卡片标题，最后保存。", effect:"读者点击后会在聊天内查看帖子。" },
      { title:"红包、转账与亲属卡", what:"添加带金额和备注的互动卡片。", where:"打开会话，点底部输入框左边【＋】。", use:"第一页可点【红包】或【转账】；切到下一页可点【亲属卡】。填写金额、祝福语、备注或亲属关系后保存。", effect:"接收方读者可以领取或收款，状态保存在本地阅读记录中。" },
      { title:"外卖卡片", what:"添加商家、订单、金额和配送状态。", where:"打开会话，点【＋】，切到下一页，再点【外卖卡片】。", use:"填写商家和订单内容后保存。", effect:"读者可领取卡片；点击卡片会打开外卖搜索，设备支持时会尝试打开对应 App。" },
      { title:"消息编辑菜单", what:"修改消息，并安排撤回或发送失败等聊天过程。", where:"手机或 iPad 长按消息；电脑右键消息。", use:"选择编辑、引用、多选、撤回、发送失败、在前插入时间、在前插入消息或添加选项。撤回后可从同一菜单取消撤回。", effect:"发送失败时，读者会先看到消息发出，再看到它迅速消失；撤回时，原消息会替换为可点开查看原文的系统提示。" },
      { title:"消息多选与转发", what:"把已有聊天内容自动整理成合并转发卡片。", where:"手机或 iPad 长按任意消息；电脑右键消息，再点【多选】。", use:"继续点选需要的消息，点底部【转发】，勾选一个或多个其他联系人后确认。", effect:"系统自动保留发送者和内容摘要，并在目标单聊中生成合并转发卡片，不需要手填聊天记录。" },
      { title:"会话置顶与排序", what:"整理单聊和群聊在消息列表中的顺序。", where:"点桌面【消息】App，完成角色接入后进入联系人列表。", use:"点会话旁的置顶按钮。需要排序时，长按排序柄拖动；键盘也可聚焦排序柄后按上下方向键。", effect:"置顶会话排在前面；同一区域会保留自定义顺序。" },
      { title:"消息回复选项", what:"在一条消息后加入读者选择和角色接话。", where:"手机或 iPad 长按目标消息；电脑右键目标消息。", use:"在消息菜单点【添加选项】。填写选项文本和读者回复；在【角色后续消息】中逐条点【添加】，选择接话的群成员并填写内容。每条后续消息都能选择【正常发送】【发送失败】或【发送后撤回】，也能单独设置节奏。多条消息都设置了选项时，读者会按消息顺序逐组选择。", effect:"每条后续消息都会按所选群成员的身份显示。当前一组还未选择时，后面的剧情消息和下一组选择会暂时隐藏，同一段里的系统消息仍会正常显示；重选前面的选项会清除这次选择之后的角色接话和后续选择，再从该处继续。" },
      { title:"回复节奏", what:"控制每个读者选项之后，角色接话出现得有多快。", where:"手机或 iPad 长按拥有回复选项的消息；电脑右键该消息，再点【设置回复节奏】。也可在回复选项编辑器中直接选择。", use:"先为整组选项设置默认节奏，再在某条角色后续消息的【单条节奏】中选择【继承本组选项】或单独覆盖为【直接出现】【很快回复】【正在输入后回复】【稍后回复】。", effect:"非即时节奏会先显示输入状态，再按所选等待时间展示角色后续气泡；同一分支里的不同消息可以使用不同速度。" },
      { title:"聊天轮次", what:"把聊天剧情分成依次开放的多轮内容。", where:"打开一个会话，点右上角菜单。", use:"在【对话操作】弹窗点【结束此轮】，填写下一轮信息后继续添加消息。", effect:"读者会按轮次或单条消息推进。" },
      { title:"语音与视频通话", what:"添加角色通话事件。", where:"打开一个会话，点底部输入框左边【＋】。", use:"在第一页点【语音通话】或【视频通话】。选择通话角色，每行填写一句台词，最后点【添加通话】。", effect:"读者可体验来电和通话流程。" },
      { title:"群聊身份", what:"设置群主、管理员和成员头衔。", where:"打开群聊，点右上角菜单，再点【管理群聊】。", use:"勾选成员并设置群主、管理员和头衔，最后保存。", effect:"群聊消息旁显示对应身份。" },
      { title:"动态", what:"制作角色动态、评论和读者回复。", where:"点桌面【消息】App，再进入【动态】。", use:"添加动态内容、发布身份、评论和回复选项。", effect:"读者可以浏览动态并选择回复。" },
      { title:"论坛", what:"创建帖子和一级评论。", where:"点桌面【论坛】App，完成角色接入后进入帖子列表。", use:"点新建帖子按钮，选择发布身份，填写标题、正文和显示时间，再点【发布】。打开帖子后可继续添加评论。", effect:"读者可浏览帖子并参与评论区互动。" },
      { title:"楼中楼回复关系", what:"让角色回复指定的评论或楼中楼。", where:"点桌面【论坛】App，打开一篇帖子，找到评论区。", use:"轻点目标评论或楼中楼，选择联系人、小号或 NPC，再填写回复内容。", effect:"评论区显示回复双方，多层回复保留各自目标。" },
      { title:"评论操作菜单", what:"编辑或删除一条评论、楼中楼。", where:"评论或楼中楼右侧的 ×。", use:"点 ×，再选择“编辑”或“删除”。", effect:"编辑会更新当前内容；删除会移除当前内容及其下方回复。" },
      { title:"评论点赞数", what:"设置评论和楼中楼显示的点赞数。", where:"评论或楼中楼右侧的爱心和数字。", use:"点爱心或数字，填写非负整数并保存。", effect:"作者端和读者端会显示更新后的点赞数。" },
      { title:"评论显示时间", what:"修改、隐藏单条时间，或统一隐藏本帖全部回复时间。", where:"单条时间在评论或楼中楼下方；整帖开关在主楼时间右侧。", use:"点时间戳，修改后保存；需要隐藏单条时点“隐藏时间”。点“隐藏全部回复时间”可统一隐藏，再点可恢复。", effect:"作者端和读者端按设置显示；整帖开关不会清空各条已保存的时间。" },
      { title:"评论与楼中楼排序", what:"调整评论区内容的显示顺序。", where:"论坛帖子评论区。", use:"手机或 iPad 长按后上下拖动；电脑按住鼠标后上下拖动。一级评论会带着全部楼中楼移动；楼中楼只在当前同级回复中移动。键盘聚焦后可按 Alt + ↑/↓。", effect:"评论顺序会保存，楼中楼层级和回复目标保持不变。" },
      { title:"论坛读者回复选项", what:"为指定评论准备多句读者可选的完整回复。", where:"在帖子评论区轻点目标评论或楼中楼。", use:"在回复人选择器中点【读者】，再打开【编辑读者回复选项】。添加选项文字、读者发出的完整回复和初始点赞数后保存。已设置的选项会显示在评论下方，点击它可再次编辑。", effect:"读者选择后，回复会进入目标评论的楼中楼，不会占用或改写一级评论楼层。" },
      { title:"论坛角色后续回复", what:"为每个读者选项安排角色继续接话。", where:"打开【编辑读者回复选项】，找到【角色后续消息】。", use:"点【添加】，逐条选择联系人、小号或 NPC，填写回复内容与初始点赞数。", effect:"角色消息会在同一楼中楼中明确回复读者；一个选项可连续显示多条后续回复。" },
      { title:"读者论坛账号", what:"让读者用自己的昵称和头像参与论坛互动。", where:"读者打开论坛帖子后，点标题栏右侧的账号入口。", use:"填写昵称，选择本地头像或粘贴头像地址后保存。也可以先在读者首页设置个人资料。", effect:"论坛账号只保存在读者本地，并与读者个人资料同步；未设置时才沿用作者预设的读者身份。" },
      { title:"备忘录", what:"为角色添加带时间的备忘内容。", where:"点桌面【备忘录】App，选择联系人，再点【保存并编辑内容】。", use:"进入备忘录后，点标题栏右上角【+】。在下方填写备忘内容和日期时间。", effect:"读者会在该角色的备忘录中看到内容。" },
      { title:"相册", what:"按相册整理角色照片和说明。", where:"点桌面【相册】App，选择联系人，再点【保存并编辑内容】。", use:"先新建相册，再打开相册添加图片、说明和时间。", effect:"读者可进入相册逐张查看。" },
      { title:"浏览记录", what:"添加角色浏览过的页面记录。", where:"点桌面【浏览器】App，选择联系人，再点【保存并编辑内容】。", use:"进入浏览记录后，点标题栏右上角【+】。填写页面标题、网址和日期时间。", effect:"读者会看到带时间的浏览历史。" },
      { title:"购物", what:"制作购物车、订单和商品记录。", where:"点桌面【购物】App，选择联系人，再点【保存并编辑内容】。", use:"点右上角【+】添加商品。修改已有商品时，手机或 iPad 长按商品卡片，电脑右键商品卡片，再点【编辑】。", effect:"读者可查看角色的购物车和订单。" },
      { title:"角色接入", what:"为不同联系人分配专属 App 内容。", where:"点桌面【消息】、【论坛】、【备忘录】、【相册】、【浏览器】或【购物】App。", use:"入口会先打开角色接入页。选择联系人，再点【保存并编辑内容】。", effect:"切换角色时显示对应数据。" },
      { title:"阅读节奏控制", what:"安排读者查看内容的顺序。", where:"点桌面【设置】App，向下找到【阅读节奏控制】。", use:"打开开关，拖动内容卡片排序，最后点底部【保存】。", effect:"读者会按顺序收到浏览提示。" },
    ],
  },
  {
    id:"social", title:"人物社交", features:[
      { title:"别名", what:"同一联系人的其他称呼。", where:"点桌面【联系人】App，再点目标联系人。", use:"在联系人编辑页找到别名区域，添加一个或多个别名，最后点【保存】。", effect:"作品可在不同位置使用不同称呼。" },
      { title:"论坛小号", what:"联系人名下的独立论坛身份。", where:"点桌面【联系人】App，再点目标联系人。", use:"在联系人编辑页找到【论坛身份】，点【＋ 添加小号】。填写论坛名称、头像、论坛 ID 和 IP 后保存联系人。", effect:"发帖和回复时可以选择这个小号。" },
      { title:"论坛 NPC", what:"只参加论坛内容的独立身份。", where:"点桌面【论坛】App，完成角色接入后点顶部【NPC】。", use:"点【新建】，填写资料后保存。也可以点【导入 NPC 包】追加已有包。", effect:"帖子和评论可以使用该身份。" },
      { title:"专用头像", what:"分别设置聊天头像和论坛头像。", where:"点桌面【联系人】App，再点目标联系人。", use:"在联系人编辑页填写【消息头像】和【论坛头像】，最后点【保存】。留空时沿用名片头像。", effect:"消息和论坛会显示各自的头像。" },
      { title:"视频通话背景", what:"设置视频通话画面。", where:"点桌面【联系人】App，再点目标联系人。", use:"在联系人编辑页填写【视频通话背景图】，最后点【保存】。", effect:"视频通话使用该画面；语音通话不显示它。" },
      { title:"@ 提及", what:"在文本中插入可识别的身份或占位符。", where:"消息、动态或论坛中支持提及的文本框。", use:"输入【@】，等待候选列表出现，再点联系人、NPC、读者称呼或占位符。", effect:"支持的预览和读者页面会显示提及。" },
      { title:"读者回复与后续消息", what:"让读者选择回复，并安排角色继续接话。", where:"消息、动态或论坛的回复选项编辑器。", use:"先添加读者选项，再逐条添加后续回复并选择发送者，最后保存。", effect:"读者选择后会按顺序看到后续内容。" },
      { title:"论坛显示数、楼层与 IP", what:"设置读者看到的论坛数字和属地。", where:"【显示评论数】在帖子编辑页；【显示楼层】在评论编辑页；IP 开关在论坛顶部。", use:"填写显示评论数或楼层并保存。需要显示属地时，先给身份填写 IP，再打开论坛顶部【IP】。", effect:"论坛会按作者设置显示这些信息。" },
    ],
  },
  {
    id:"placeholders", title:"占位符", features:[
      { title:"创建占位符", what:"用读者填写的内容替换作品文字。", where:"互动文章点编辑器左侧【{}】；小手机点桌面【设置】App。", use:"进入【占位符管理】后点【添加占位符】，填写自定义标记、显示名称和问题，再保存。", effect:"默认会在阅读前显示对应问题；互动文章也可以改为文中填写。" },
      { title:"文中填写", what:"让读者读到作者指定的位置时再回答问题。", where:"互动文章的【占位符管理】和正文编辑区。", use:"把【填写位置】改为【文中填写】；先把光标放到正文目标位置，再点【插入正文光标处】。后文仍直接写这个占位符的标记。", effect:"读者保存当前答案后才会看到后面的正文和节点；后续标记会立即替换为这次答案，答案同时保存在当前阅读档案中。" },
      { title:"全文替换", what:"所有标记使用同一个答案。", where:"进入【占位符管理】，找到目标占位符的【替换方式】。", use:"选择【全文替换】，保存后把该占位符的标记原样写进正文、普通互动标题、选项文本、选择后内容或末尾剧情分支文字。", effect:"这些文字位置会使用同一个读者答案。" },
      { title:"随机替换", what:"从可用值中随机选择结果。", where:"进入【占位符管理】，找到目标占位符的【替换方式】。", use:"选择【随机替换】，填写可用值并保存。", effect:"标记出现时可以得到不同结果。" },
      { title:"场景锁定", what:"让同一场景使用同一个随机结果。", where:"进入【占位符管理】选择【场景锁定】；场景在文章节点顶部设置。", use:"保存占位符后，逐个点需要共享结果的正文节点，在顶部场景下拉框选择同一个场景。", effect:"同场景节点会使用同一次随机结果。" },
      { title:"单项违禁词", what:"只限制一个占位符的部分输入。", where:"进入【占位符管理】，找到目标占位符卡片中默认折叠的【违禁词 · N 个】。", use:"点击标题展开。需要拦截所有含有该词的内容时填入【包含匹配】；只想拦截整段相同的答案时填入【完全匹配】。可用换行、逗号、顿号、分号、斜杠或竖线分隔，最后保存；标题旁词数会随两块输入更新。", effect:"例如把“蠢”放进包含匹配会拦截“小蠢蛋”；把“哥哥”放进完全匹配只会拦截“哥哥”，不会拦截含有它的长句。" },
      { title:"全局违禁词", what:"让同一作品的所有占位符共用一份限制词。", where:"进入【占位符管理】，找到顶部默认折叠的【全局违禁词 · N 个】。", use:"点击标题展开，按需要填写【包含匹配】和【完全匹配】，再点【整理全部词库】。小手机还要点设置页底部【保存】。", effect:"任一占位符命中对应规则时都会提示修改；每张占位符卡片可以展开查看继承的全局词及其匹配方式。" },
      { title:"搜索与整理词库", what:"查找占位符和清理重复词语。", where:"进入【占位符管理】，使用顶部搜索框和【整理全部词库】。", use:"在搜索框输入名称、标记、问题或违禁词；搜索命中折叠的全局或单项违禁词时，对应区域会自动展开。需要拆分和去重时点【整理全部词库】。", effect:"可以快速定位项目，并保留每个词第一次出现的写法。" },
      { title:"作者占位符预设", what:"保存可跨作品复用的占位符配置。", where:"文章的【占位符管理】、小手机【设置】App，或页面顶部【?】中的【写作习惯】。", use:"在当前作品中点【保存当前为预设】。到其它作品打开【我的预设】，选择名称后点【套用预设】。", effect:"目标作品获得一份可独立修改的配置。" },
    ],
  },
  {
    id:"files", title:"文件与备份", features:[
      { title:"导出单篇作品", what:"生成可交给读者的作品文件。", where:"创作端首页的作品卡片。", use:"点【更多 ▾】，再点【导出作品】，然后选择【下载 .tuuru】或【生成加密 PNG】。分享时请发送生成的原文件，或上传网盘后分享下载链接。", effect:"文件只在当前设备生成，Tuuru 不会上传；读者端可以导入阅读。" },
      { title:"导出体积上限", what:"控制作品 JSON 与本地嵌入素材的总大小。", where:"作品卡片【更多 ▾】里的【发布前体检】中，查看【作品体积账单】。", use:"尽量把预计加密导出控制在 6 MiB 以下；6–9 MiB 会提示谨慎，9–10 MiB 属于高风险。超过 10 MiB 无法导出。相同本地素材会按内容去重，远程 HTTPS 链接本身不计入素材体积。", effect:".tuuru 与加密 PNG 使用同一份最多 10 MiB 的加密作品载荷；PNG 封面大小另计。单个作品最多携带 256 个不同的本地素材。" },
      { title:"导出中心", what:"查看和管理当前浏览器里的导出记录。", where:"创作端首页顶部【导出中心】；移动端也可从【管理作品库】进入。", use:"按格式筛选，查看【当前版本】或【作品已在导出后修改】，并按需重新下载或生成。也可以移除单条记录或清空全部记录。", effect:"只记录导出时间、格式、大小和状态，不保存作品文件，也不会把内容上传到服务器。" },
      { title:"导出作品集", what:"把多篇作品和目录放进一个文件。", where:"创作端首页的作品集卡片。", use:"点【更多 ▾】，再点【导出加密作品集】或【导出加密 PNG】。", effect:"读者导入后会看到作品集目录。" },
      { title:"读者导入", what:"把作者导出的作品或作品集加入读者端。", where:"点页面顶部【读者端】，再点读者首页的【导入作品】。", use:"选择作品文件；当前入口支持 .tuuru、.json 和 .png，旧 JSON 与旧 PNG 仅用于兼容历史文件。", effect:"作品会加入当前浏览器的读者书架。" },
      { title:"读者美化包", what:"单独导出或导入读者端的阅读外观。", where:"进入【读者端】，点顶部【外观】，再找到【美化包】。", use:"点【导出美化包】保存当前外观；导入时点文件选择入口并选择美化包。美化包可包含壁纸、字体、图标、自定义样式、个人主页顶部图和桌面组件外观。", effect:"导入只更新读者端外观。昵称、头像、读者 ID、阅读记录和作品内容不会写入美化包；组件便签也只留在本机。" },
      { title:"备份全部", what:"保存完整创作库。", where:"创作端首页【我的作品】标题下方的【备份全部】。", use:"点【备份全部】，下载文件并妥善保管。", effect:"文件包含作品、密码、私密内容和设置。" },
      { title:"检查与恢复", what:"查看备份内容并恢复创作库。", where:"创作端首页【我的作品】标题下方的【检查 / 恢复】。", use:"点【检查 / 恢复】，选择备份文件，检查摘要后确认。", effect:"确认恢复后，当前创作库会替换为备份内容。" },
      { title:"整机搬家", what:"迁移作者端和读者端的本地数据。", where:"创作端首页【我的作品】标题下方的【整机搬家】。", use:"旧设备点【整机搬家】并导出；新设备打开同一入口并导入。", effect:"作者端和读者端数据会合并到新浏览器。" },
      { title:"联系人包", what:"在作品之间复用联系人。", where:"点页面顶部【?】，进入【写作习惯与使用教程】，再切换到【写作习惯】。", use:"在【联系人跨作品使用】选择来源作品，填写联系人包名称并导出，再选择目标作品合并。", effect:"导入只追加联系人，不覆盖目标作品已有内容。" },
      { title:"论坛 NPC 包", what:"把论坛路人保存为作者通用资源。", where:"点页面顶部【?】，切换到【写作习惯】，找到【论坛 NPC 包】。也可在小手机【论坛】App 的【NPC】页操作。", use:"为 NPC 包命名并保存，再到目标作品的 NPC 页点【导入 NPC 包】。", effect:"导入只追加 NPC；重复 ID 会自动换新。" },
      { title:"作者预设文件", what:"迁移作者占位符预设。", where:"点页面顶部【?】，切换到【写作习惯】，找到作者占位符预设区域。", use:"点【导出习惯】，再到另一浏览器的同一区域导入。", effect:"作者预设会按名称合并。" },
    ],
  },
  { id:"support", title:"打赏", features:[], support:true },
]

const TUTORIAL_FAQ_SECTIONS = {
  start:[
    { question:"编辑后可以直接关闭页面吗？", answer:"先看编辑器顶部的保存状态。显示“已保存”后再关闭页面。" },
    { question:"换浏览器或换网址后找不到作品怎么办？", answer:"回到原浏览器和原网址查找；也可以使用完整备份或搬家文件恢复。" },
    { question:"删除作品集会删除原作品吗？", answer:"不会。作品集保存的是作品引用，删除作品集后，书架里的原作品继续保留。" },
    { question:"作品怎样移动或置顶？", answer:"电脑拖动作品卡右上角抓手调整顺序；打开“更多”可选择置顶或取消置顶。" },
  ],
  article:[
    { question:"本节和全文字数在哪里看？", answer:"打开任意正文节点，看节点标题旁的“本节 · 全文”数字；写作时会自动更新。本节只计算当前节点正文，全文合计作品内全部文章节点。" },
    { question:"选项点击后没有跳转怎么办？", answer:"如果是节点末尾的剧情分支，请检查目标章节和目标节点，再从阅读预览重新点击；正文中间的普通互动本来就不会跳转。" },
    { question:"为什么同一章节的下一个节点没有显示？", answer:"普通节点会沿当前阅读路线按结构顺序合并。请检查它是否仍在同一章节、是否是另一个选项指向的并行分支、是否为隐藏节点，以及显示条件是否满足；互动图片节点会在阅读到对应位置时单独打开。" },
    { question:"只想显示选择结果，不想换节点怎么设置？", answer:"把光标放在正文中希望出现的位置，点工具栏的“普通互动”。在“选项文本”填写按钮文字，在“选择后内容”填写点击后出现的正文；内容可以换行，每一行会按照独立正文段落排版。" },
    { question:"一个节点里可以放多组普通互动吗？", answer:"可以。每组都能放在正文里的不同位置，并独立记录读者选择。点互动卡片可编辑或移动；剧情分支仍固定在节点末尾，不会与这些互动组混排。" },
    { question:"小游戏刷新后会重新随机吗？", answer:"不会。读者第一次完成判定后，点数、结果和剧情路线会保存在当前阅读档案中；返回同一位置仍显示原结果。作者可以在小游戏面板用【试玩一次】反复检查配置，试玩不会写入作品。" },
    { question:"普通互动卡片不见了怎么办？", answer:"如果互动组数据仍在但正文位置丢失，编辑器会显示待放置提示。先把光标放到目标段落，再点“放到光标处”即可恢复。" },
    { question:"为什么刚创建的隐藏节点看起来总在章节末尾？", answer:"新隐藏节点会先放在本章最后，方便你找到。看右侧“结构”，按住隐藏节点左边的“⠿”拖动；把它拖到节点 7 上面，条件满足时就会在节点 7 前插入。" },
    { question:"读者改选后，已经出现的隐藏节点会怎样？", answer:"系统以当前选择为准立即重新计算。新选择不再满足条件时，隐藏正文会从当前页面消失，但后面已经到达的普通路线不会因此被清空；再次选择满足条件的选项时，隐藏正文会在结构树指定的位置恢复。曾经显示过不会使它永久解锁。" },
    { question:"隐藏节点是在什么时候判断的？", answer:"进入阅读路线、点击剧情分支、选择或改选普通互动以及返回重选时都会按当前选择重新判断。只有当前路线已经记录的选择参与计算，尚未点击的选项不会提前满足条件。" },
    { question:"隐藏节点的多个条件怎样计算？", answer:"同一条件组内是“或”：当前选中过其中任意一项即可；不同条件组之间是“且”：每一组都必须满足。例如第一组是“A 或 C”，附加组是“D”，最终含义就是“（A 或 C）且 D”。条件编辑器中的分组摘要会同步显示这套关系。" },
    { question:"条件看起来满足，隐藏节点为什么仍没显示？", answer:"依次检查：隐藏节点是否已经移动到当前路线会读到的位置；需要的每一组“且”条件是否都有一项满足；选择是否发生在当前路线而不是已经返回并改掉的旧路线；条件编辑器是否提示选项已删除、ID 重复或条件失效。修复后从阅读预览重新走一遍该路线。" },
    { question:"移动隐藏节点会改变触发条件吗？", answer:"不会。看右侧“结构”，按住隐藏节点左边的“⠿”拖到新位置。条件仍通过选项的稳定 ID 读取；你把它放在某个普通节点前面或后面，它就会在读到该位置时出现。" },
    { question:"修改或删除选项会影响隐藏节点吗？", answer:"修改选项文本不会影响关联，因为条件使用稳定 ID。删除选项后，引用它的条件会显示“条件已失效”；请在显示条件中移除失效项或改选仍然存在的选项。" },
    { question:"场景在哪里添加？", answer:"先点右侧任意一个正文节点，再点编辑器顶部的“场景：…”下拉框，点“＋ 新建场景…”，输入名字并确定。新建后当前节点会自动选中这个场景。普通写作不使用场景时，选择“不使用场景”即可。" },
    { question:"章节和场景分别控制什么？", answer:"章节决定读者翻到哪一页、正文按什么顺序读。场景只给“场景锁定”占位符使用：几个节点选同一个场景时，会共用同一次随机结果。" },
    { question:"文章里的手机卡片为什么只打开一个 App？", answer:"文章手机模块是一张卡片对应一个 App。它复用独立小手机中该 App 的界面与交互，返回时直接退出当前卡片。" },
    { question:"怎样避免新联系人提前在文章消息里剧透？", answer:"打开该文章的消息卡片，进入“联系人”，用右侧按钮设置本模块可见名单。后来新增的联系人会在已有模块中保持隐藏；这个设置只影响当前消息卡片。已经被聊天或动态使用的联系人不能直接隐藏，请先删除相关内容。" },
  ],
  interactive:[
    { question:"Mini文游和互动图片的画面能力一样吗？", answer:"两者共用同一套画面编辑与播放能力，包括固定画布、背景、立绘、叠加图层、热区、提示、对话、动作帧和画面特殊 BGM；同样的素材组合在播放时需要相近的解码内存。Mini文游是可单独导入书架的短篇外壳，只有一个互动场景，还可设置作品默认 BGM、专用占位符和轻量画面选项，最后进入完成页；互动图片位于互动文章路线中，一篇文章可以放置多个，结束后进入作者指定的普通节点，并使用文章占位符。使用 HTTPS 链接只会减小导出包和本地存储，不会降低读者播放时的图片、GIF 或视频解码内存。" },
    { question:"Mini文游可以导出 ZIP 压缩包吗？", answer:"目前不能。作者端只支持导出 .tuuru 或加密 PNG，读者端不能直接导入 ZIP。把 .tuuru 再套一层 ZIP 不会增加作品的 10 MiB 加密载荷上限；需要腾出空间时，请优先压缩图片、裁剪本地 BGM，或把有权长期使用的素材改成稳定的 HTTPS 链接。" },
    { question:"Mini文游是不是完整文游引擎？", answer:"不是。Mini文游定位为由图片、热区、对话、动作帧、BGM 和轻量画面选项组成的短篇互动体验。它不提供条件分支、变量、背包、数值养成、战斗或自定义脚本；需要复杂多路线长剧情时，请使用互动文章。" },
    { question:"Mini文游可以在画面中分支吗？", answer:"可以设置轻量画面分支。先建立目标画面，再打开起始画面的右侧【互动】，在【画面选项】里填写选项文字并选择目标画面。读者探索完该画面的全部热区后会看到选项；没有选项时仍按左侧列表顺序推进。每个画面最多 6 个选项，只支持直接跳转，不支持变量、条件判断或脚本。" },
    { question:"Mini文游适合做多长？", answer:"系统不按阅读分钟数设置硬上限，但它面向一次读完的短篇体验。实际长度会受到 10 MiB 导出上限、最多 256 个本地素材、手机解码能力和维护成本影响；建议先完成少量画面并在目标手机上走通，再逐步增加内容。" },
    { question:"Mini文游最后一个画面之后会怎样？", answer:"读者完成最后一个画面的全部热区并点击对话框后，会进入作品完成页，可以选择【重新开始】或【返回书架】。Mini文游没有文章节点可继续跳转。" },
    { question:"退出后会记住探索到哪一画面吗？", answer:"目前不会。Mini文游没有画面检查点或中途探索存档；退出、刷新或重新打开后，会从列表第一画面重新开始。它更适合一次读完的短篇流程。" },
    { question:"三种外框预览和读者预览有什么不同？", answer:"【手机竖屏】【手机横屏】【电脑】只改变画面编辑器里的外部展示比例，方便检查留白，不会改动固定逻辑画布和热区坐标。右上角【读者预览】才会运行真实的热区触发、画面推进、摄像头权限与 BGM 切换；发布前还应在读者实际使用的设备上验收。" },
    { question:"一个画面能放多少叠加内容？", answer:"背景和主立绘之外，最多可添加 24 个叠加图层；主对话框之外，最多可添加 12 个叠加对话框。达到上限后添加按钮会停用。高分辨率素材即使没有达到数量上限，也可能在手机解码时占用很多内存。" },
    { question:"怎样把 Mini文游交给读者？", answer:"先用专用编辑页右上角【读者预览】走完整流程，再回创作端首页，依次点作品卡片【更多 ▾】【导出作品】，选择【下载 .tuuru】或【生成加密 PNG】。发送原文件或网盘下载链接；读者在书架点【导入作品】选择该文件。" },
    { question:"【互动文章】为什么互动图片出现在节点列表里？", answer:"互动图片会占用一个完整阅读页面。读者走到这个节点时会直接打开全屏互动页。作者需要移动时，按住节点左边【⠿】拖动；需要编辑时，点节点后再点中间【编辑互动页】；需要删除时，点节点这一行右侧【…】，再点【×】。" },
    { question:"为什么点击对话框还不能进入下一画面？", answer:"先探索当前画面的全部互动点。页面会提示还有几个位置未探索；全部完成后，再点击对话框进入左侧列表中的下一画面。" },
    { question:"画面没有互动点时怎样进入下一张？", answer:"没有互动点的画面会直接视为探索完成。只要后面还有画面，点击对话框即可继续。" },
    { question:"热区在读者端为什么看不见？", answer:"这是正常设计。普通阅读时热区保持透明，避免轮廓破坏画面；键盘聚焦时仍会保留必要的焦点提示。" },
    { question:"热区和人物位置对不上怎么办？", answer:"先确认作者端选中的背景或立绘、填充方式、平移和缩放都已保存。替换素材或重新构图后，在预览中重新拖动、缩放或手绘热区，再到真实读者端复测。" },
    { question:"靠近后点击或靠近后长按没有触发怎么办？", answer:"先确认在进入作品时允许了摄像头，并使用 HTTPS 页面或本机 localhost。测试时先让镜头在普通距离看到脸，再明显靠近到几乎无法识别人脸，随后在短暂等待时间内点击或长按目标区域。普通坐在镜头前直接点击不会算成功。" },
    { question:"读者拒绝摄像头权限还能继续吗？", answer:"可以。作者应为摄像头热区选择点击或长按备用互动；读者拒绝权限时会使用该备用方式。已经授权但浏览器本身不能识别靠近时，不会自动把普通点击当作成功。" },
    { question:"动作帧播放结束后会发生什么？", answer:"静态图达到作者设置的时间、GIF 播完首轮或视频播放结束后，会回到触发前的背景和立绘。读者也可以提前点击对话框返回。" },
    { question:"为什么图床 GIF 使用了备用播放时间？", answer:"部分图床不允许浏览器读取 GIF 文件内容，因此无法计算首轮时长。此时会使用作者填写的 GIF 备用播放时间；需要精确结束时可改用允许跨域读取的图床或 MP4、WebM。" },
    { question:"本地图片太大导致保存失败怎么办？", answer:"静态图片会先尝试压缩；请等待底部显示压缩和嵌入结果后再保存。大型 GIF 或视频建议改用 HTTPS 图床。如果仍提示浏览器存储空间不足，请缩小素材、清理不需要的本地大图，并先导出作品备份。" },
    { question:"三分钟 BGM 只想用十几秒怎么办？", answer:"导入本地音乐后，在【播放片段】拖动开始和结束位置，先点【试听片段】确认，再点【裁剪并只保留这段】。成功后作品只打包新片段；如果只是设置区间而没有裁剪，完整原文件仍会计入包体。" },
    { question:"为什么远程 BGM 没有裁剪按钮？", answer:"远程链接受网站跨域权限和文件可用性影响，编辑器只保存播放起止位置，不会下载或改写对方文件。需要缩小包体时，请先把有权使用的音乐保存为本地文件，再通过本地音频入口导入和裁剪。" },
    { question:"裁剪音乐为什么需要等待十几秒？", answer:"浏览器会按所选片段时长实时处理并重新编码，以避免引入体积很大的视频处理组件，也避免一次把整首歌展开成庞大的未压缩音频。选择 15 秒通常就需要约 15 秒；处理中请保持页面开启，也可以点【取消裁剪】。取消或切到后台时会保留完整音频，并继续按所选区间播放。" },
    { question:"互动图片和 Mini文游的占位符可以写在哪里？", answer:"两者的触摸提示、画面名称与替代文字、主对话和叠加对话、热区名称、热区说话人和热区台词都支持占位符；Mini文游的画面选项文字也支持。互动图片使用所属文章的占位符，Mini文游在专用编辑页【占位符】卡片中创建并统一在阅读前填写。图片或视频链接、画面 ID 和选项目标 ID 不会被替换。" },
    { question:"【互动文章】普通互动和剧情选项支持占位符吗？", answer:"支持。普通互动标题、选项文本、选择后内容，以及节点末尾的剧情分支文字都会替换为读者填写的值。" },
    { question:"怎样让全部互动页共用同一套对话框？", answer:"在任一互动页的【主对话框样式】中调整完成后，勾选【同步到作品全部互动页】再保存。只会同步主对话框外观和透明 PNG 素材，不会覆盖各页说话人与台词，也不会同步触摸提示。Mini文游只有一个互动场景，这项主要用于互动文章里的多个互动页。" },
  ],
  phone:[
    { question:"联系人已经建好了，还能补好友申请吗？", answer:"自动好友申请入口会在新建联系人时出现；需要为已有联系人补充时，可在对应会话中通过剧情事件添加“好友申请”。读者必须同意或拒绝后，阅读流程才会继续。" },
    { question:"链接怎样打开作品里的论坛帖子？", answer:"添加链接时，在“链接内容”中选择已有帖子。读者点击卡片后会在聊天内打开画中画。" },
    { question:"链接怎样打开外部网页？", answer:"添加链接时保留“外部网址”，填写以 http:// 或 https:// 开头的完整地址。" },
    { question:"外卖卡片点击后会去哪里？", answer:"卡片会按商家和订单内容打开外卖搜索；支持的 Android 环境会先尝试打开对应 App，并保留网页入口。" },
    { question:"红包、转账和亲属卡会改变作者数据吗？", answer:"领取与收款状态只记录在读者当前设备的阅读进度中。" },
    { question:"怎样修改或撤回已经添加的消息？", answer:"手机或 iPad 长按消息，电脑右键消息，再从菜单选择编辑、引用、撤回、发送失败或插入内容。撤回后可再次打开菜单取消撤回。" },
    { question:"怎样修改已经添加的商品？", answer:"手机或 iPad 长按商品卡片，电脑右键商品卡片，再从菜单选择“编辑”。购物车和订单里的已有商品都可以重新修改，包括显示时间。" },
    { question:"角色后续回复怎样分成多个气泡？", answer:"在消息的“添加选项”中填写后续回复，每行文字会生成一个气泡。" },
    { question:"怎样让角色先显示正在输入再回复？", answer:"手机或 iPad 长按拥有回复选项的消息，电脑右键该消息，点“设置回复节奏”。可以先设置整组选项的默认速度，再打开回复选项编辑器，让某条角色消息继承本组选项或单独选择“很快回复”“正在输入后回复”“稍后回复”；不需要等待时选“直接出现”。" },
    { question:"怎样回复指定的论坛评论或楼中楼？", answer:"轻点目标评论或楼中楼，选择联系人、小号或 NPC，再填写内容。发布后会显示回复双方的名字。" },
    { question:"为什么没有看到论坛回复选项？", answer:"轻点目标评论或楼中楼，在回复人选择器中选择“读者”，再打开“编辑读者回复选项”。" },
    { question:"已经设置的论坛回复选项怎样修改？", answer:"点评论下方的选项文字，修改选项、读者完整回复、初始点赞数或角色后续消息，再保存。" },
    { question:"读者怎样设置自己的论坛账号？", answer:"在读者端打开任意论坛帖子，点标题栏右侧的账号入口，设置昵称和头像后保存。论坛会优先使用读者本地资料；没有本地资料时才沿用作者预设。" },
    { question:"论坛评论和楼中楼怎样排序？", answer:"手机或 iPad 长按内容后拖动；电脑按住鼠标后拖动。一级评论会带着楼中楼一起移动，楼中楼会在当前同级回复中移动。" },
    { question:"论坛评论怎样修改点赞数？", answer:"在创作端点评论右侧的爱心或数字，填写点赞数并保存。" },
    { question:"论坛评论时间怎样修改或隐藏？", answer:"点评论或楼中楼下方的时间戳可修改或隐藏。点主楼时间右侧的“隐藏全部回复时间”，可统一隐藏本帖全部评论和楼中楼时间；再次点击会恢复。" },
    { question:"论坛评论怎样编辑或删除？", answer:"点评论右侧的 ×，再选择“编辑”或“删除”。" },
  ],
  social:[
    { question:"联系人小号和论坛 NPC 怎样选择？", answer:"发布帖子、评论或楼中楼时打开身份选择器，再选择联系人、小号或 NPC。" },
    { question:"怎样把论坛 NPC 带到其他作品？", answer:"在论坛 NPC 管理页把当前 NPC 保存到有名称的通用包，或到“写作习惯”选择作品并为 NPC 包命名；再到目标作品导入。导入只追加，不会覆盖已有 NPC。" },
    { question:"@ 提及没有高亮怎么办？", answer:"输入 @ 后从候选列表选择身份或占位符，保存后再到预览中检查。" },
  ],
  placeholders:[
    { question:"正文里的标记需要固定格式吗？", answer:"不需要固定括号。作者填写什么标记，正文中就使用完全相同的文字。" },
    { question:"阅读前填写和文中填写有什么区别？", answer:"阅读前填写会在作品开场集中询问；文中填写只在读者走到插入位置时出现，保存答案后才展开后文。两种方式都写入同一套占位符阅读档案。" },
    { question:"同一个文中占位符可以插入多次吗？", answer:"不可以。每个文中占位符只有一个填写位置；需要多次提问时请新建其它占位符。答案保存后，后文可重复写该标记并自动替换。" },
    { question:"修改作者预设会影响已套用的作品吗？", answer:"不会。套用时会在作品中建立独立副本，之后可以分别修改。" },
    { question:"随机结果怎样在几个节点中保持一致？", answer:"选择“场景锁定”，再给这些节点设置同一个场景。" },
    { question:"为什么打开占位符管理看不到违禁词输入框？", answer:"全局违禁词和每张卡片的单项违禁词默认折叠。点击“全局违禁词 · N 个”或“违禁词 · N 个”标题即可展开；搜索命中其中的词时也会自动展开。" },
    { question:"包含匹配和完全匹配有什么区别？", answer:"包含匹配会在答案中出现该词时拦截，适合单字或恶意词根；完全匹配只在去掉首尾空格后的整段答案相同时拦截，并忽略大小写。例如完全匹配“哥哥”会允许“不算依赖哥哥算长大吗”和“哥哥！”。" },
  ],
  files:[
    { question:"分享作品应该使用哪种文件？", answer:"优先分享作者端生成的 .tuuru 或加密 PNG。读者入口仍支持 .json 和旧 PNG，但它们主要用于兼容历史文件；不要把“备份全部”生成的整库备份交给读者。" },
    { question:"导出中心会保存或上传作品吗？", answer:"不会。导出中心只在当前浏览器记录导出时间、格式、大小和作品状态，不保存已经生成的文件，也不会上传作品内容。" },
    { question:"完整备份适合发给读者吗？", answer:"不适合。完整备份包含创作库、密码、私密内容和设置，请只用于本人恢复。" },
    { question:"恢复备份会发生什么？", answer:"确认恢复后，当前创作库会替换为备份内容。操作前先查看恢复摘要并保存现有备份。" },
  ],
}

function renderTutorialFeature(feature, sectionId, index) {
  return `<article class="tutorial-feature" data-tutorial-feature data-tutorial-search-item data-tutorial-feature-id="${sectionId}-${index}">
    <h3>${feature.title}</h3>
    <dl>
      <div><dt>是什么</dt><dd>${feature.what}</dd></div>
      <div><dt>在哪里</dt><dd>${feature.where}</dd></div>
      <div><dt>怎么用</dt><dd>${feature.use}</dd></div>
      <div><dt>使用效果</dt><dd>${feature.effect}</dd></div>
    </dl>
  </article>`
}

function renderTutorialFaq(sectionId) {
  const items = TUTORIAL_FAQ_SECTIONS[sectionId] || []
  if (!items.length) return ""
  return `<div class="tutorial-faq" data-tutorial-faq-list><h3>答疑</h3>${items.map((item, index) => `<details class="glossary-item" data-tutorial-faq data-tutorial-search-item data-tutorial-faq-id="${sectionId}-${index}"><summary>${item.question}</summary><div class="resource-prose"><p>${item.answer}</p></div></details>`).join("")}</div>`
}

function renderTutorialSupport() {
  return `<div class="tutorial-support" data-tutorial-search-item>
    <div class="tutorial-support-copy" aria-label="感谢投喂，助力站长继续开发">
      <strong class="tutorial-support-lead">感谢投喂，助力站长继续开发</strong>
      <span class="tutorial-support-mascot" aria-hidden="true">
        <span class="tutorial-support-ears">(&#92;⑅(&#92;</span>
        <strong class="tutorial-support-face">໒꒰ྀི˶´˘&#96;˵꒱ྀི১</strong>
      </span>
    </div>
    <img src="./zsm.png" alt="打赏收款码">
  </div>`
}

function renderTutorialSection(section, index) {
  const content = section.support
    ? renderTutorialSupport()
    : `<header class="tutorial-guide-header"><h2>${section.title}</h2><p>共 ${section.features.length} 项功能</p></header><div class="tutorial-feature-list">${section.features.map((feature, featureIndex) => renderTutorialFeature(feature, section.id, featureIndex)).join("")}</div>${renderTutorialFaq(section.id)}`
  return `<section class="tutorial-section tutorial-guide resource-prose${section.support ? " tutorial-support-section" : ""}" id="tutorial-${section.id}" role="tabpanel" data-tutorial-category="${section.id}"${index === 0 ? "" : " hidden"}>${content}</section>`
}

function renderTutorialPage() {
  return `<div class="resource-panel" data-resource-panel="tutorial">
    <div class="tutorial-search"><label for="tutorialSearch">搜索教程</label><input class="form-input" id="tutorialSearch" data-tutorial-search type="search" placeholder="输入功能、位置或问题"><p data-tutorial-search-status role="status" aria-live="polite"></p></div>
    <div class="tutorial-layout">
      <nav class="tutorial-directory" aria-label="功能分类"><strong class="tutorial-directory-title">功能分类</strong>
        ${TUTORIAL_FEATURE_SECTIONS.map((section, index) => `<button type="button" class="${index === 0 ? "active" : ""}" data-tutorial-nav="${section.id}" aria-controls="tutorial-${section.id}"${index === 0 ? ' aria-current="page"' : ""}>${section.title}</button>`).join("")}
      </nav>
      <div class="tutorial-content">
        ${TUTORIAL_FEATURE_SECTIONS.map(renderTutorialSection).join("")}
      </div>
    </div>
  </div>`
}

export function renderResourcesPage(options = {}) {
  const initialTab = options.initialTab === "tutorial" ? "tutorial" : "habits"
  return `<main class="app-main resources-page" id="resourcesRoot">
    <div class="resources-tabs" role="navigation" aria-label="写作资源">
      <a href="#/resources" class="resources-tab${initialTab === "habits" ? " active" : ""}"${initialTab === "habits" ? ' aria-current="page"' : ""}>写作习惯</a>
      <a href="#/resources/tutorial" class="resources-tab${initialTab === "tutorial" ? " active" : ""}"${initialTab === "tutorial" ? ' aria-current="page"' : ""}>使用教程</a>
    </div>
    ${initialTab === "tutorial" ? renderTutorialPage() : renderHabitsPage()}
  </main>`
}

function clonePhoneData(phoneData) {
  if (phoneData && typeof phoneData === "object") return JSON.parse(JSON.stringify(phoneData))
  return {
    contacts: [],
    contactSortMode: "custom",
    chats: [],
    moments: [],
    forumPosts: [],
    forumNpcs: [],
    forumSettings: { showIpLocation:false },
    apps: [],
    skin: JSON.parse(JSON.stringify(DEFAULT_PHONE_SKIN)),
    memos: [],
    photos: [],
    albums: [],
    browserHistory: [],
    shoppingItems: [],
  }
}

function safeFilename(value) {
  return String(value || "作品").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "作品"
}

function collectPresetFields(editor) {
  return Array.from(editor.querySelectorAll("[data-preset-field]")).map(row => ({
    key: row.querySelector("[data-field-key]")?.value?.trim() || "",
    label: row.querySelector("[data-field-label]")?.value?.trim() || "",
    prompt: row.querySelector("[data-field-prompt]")?.value?.trim() || "",
    mode: row.querySelector("[data-field-mode]")?.value || "each",
    forbidden: parseForbiddenWords(row.querySelector("[data-field-forbidden]")?.value),
    exactForbidden: parseForbiddenWords(row.querySelector("[data-field-exact-forbidden]")?.value),
  })).filter(field => field.key || field.label || field.prompt)
}

function bindContactTransfer(root) {
  const selector = root.querySelector("[data-contact-work]")
  const exportButton = root.querySelector("[data-contact-export]")
  const fileInput = root.querySelector("[data-contact-import-file]")
  const mergeButton = root.querySelector("[data-contact-merge]")
  const summary = root.querySelector("[data-contact-summary]")
  const status = root.querySelector("[data-contact-status]")
  const bundleName = root.querySelector("[data-contact-bundle-name]")
  if (!selector) return
  let pendingBundle = null

  function selectedWork() {
    return getWorks().find(work => work.id === selector.value)
  }

  function updateSummary() {
    const work = selectedWork()
    const count = contactCount(work)
    if (summary) summary.textContent = work ? `当前作品有 ${count} 位联系人。` : "请先创建作品。"
    if (exportButton) exportButton.disabled = !work || count === 0
  }

  selector.addEventListener("change", updateSummary)
  updateSummary()

  exportButton?.addEventListener("click", () => {
    const work = selectedWork()
    const contacts = work?.phoneData?.contacts
    if (!work || !Array.isArray(contacts) || !contacts.length) return
    const name = bundleName?.value?.trim() || `${work.title || "作品"}联系人`
    const blob = new Blob([serializeContactBundle(contacts, { name })], { type:"application/json;charset=utf-8" })
    downloadBlob(blob, `${safeFilename(name)}-联系人包.json`)
    if (status) status.textContent = `已准备导出 ${contacts.length} 位联系人。文件只包含联系人资料。`
    notify("联系人包已导出")
  })

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0]
    pendingBundle = null
    if (mergeButton) mergeButton.disabled = true
    if (!file) return
    try {
      pendingBundle = parseContactBundle(await file.text())
      if (status) status.textContent = `已读取${pendingBundle.name ? `“${pendingBundle.name}”` : `“${file.name}”`}：${pendingBundle.contacts.length} 位联系人。请选择目标作品并确认合并。`
      if (mergeButton) mergeButton.disabled = pendingBundle.contacts.length === 0
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "联系人包读取失败"
      notify("联系人包读取失败", "error")
    }
  })

  mergeButton?.addEventListener("click", () => {
    const work = selectedWork()
    if (!work || !pendingBundle) return
    const phoneData = clonePhoneData(work.phoneData)
    const merged = mergeContactBundle(phoneData.contacts || [], pendingBundle, { idFactory:uid })
    phoneData.contacts = merged.contacts
    phoneData.contactSortMode = phoneData.contactSortMode || "custom"
    const updated = updateWork(work.id, { phoneData:phoneData })
    if (!updated) {
      if (status) status.textContent = "目标作品已经不存在，请刷新后重试。"
      return
    }
    if (status) status.textContent = `已合并 ${merged.added} 位联系人；${merged.reassignedIds} 个冲突 ID 已自动换新。目标作品原有内容未被覆盖。`
    pendingBundle = null
    mergeButton.disabled = true
    if (fileInput) fileInput.value = ""
    updateSummary()
    notify("联系人已合并到所选作品")
  })
}

function bindNpcPackLibrary(root) {
  const selector = root.querySelector("[data-npc-pack-work]")
  const nameInput = root.querySelector("[data-npc-pack-name]")
  const saveButton = root.querySelector("[data-npc-pack-save]")
  const summary = root.querySelector("[data-npc-pack-summary]")
  const status = root.querySelector("[data-npc-pack-status]")
  const importInput = root.querySelector("[data-npc-library-import]")
  if (!root.querySelector("[data-npc-pack-library]")) return

  function selectedWork() {
    return getWorks().find(work => work.id === selector?.value)
  }

  function refresh() {
    const liveRoot = document.getElementById("resourcesRoot")
    if (!liveRoot) return
    liveRoot.outerHTML = renderResourcesPage({ initialTab:"habits" })
    bindResourcesPage()
  }

  function updateSummary() {
    const work = selectedWork()
    const count = npcCount(work)
    if (summary) summary.textContent = work ? `当前作品有 ${count} 位论坛 NPC。` : "请先创建小手机作品。"
    if (saveButton) saveButton.disabled = !work || count === 0
  }

  selector?.addEventListener("change", updateSummary)
  updateSummary()

  saveButton?.addEventListener("click", () => {
    const work = selectedWork()
    const name = nameInput?.value?.trim() || ""
    const npcs = work?.phoneData?.forumNpcs
    if (!work || !Array.isArray(npcs) || !npcs.length) return
    if (!name) {
      if (status) status.textContent = "请先填写 NPC 包名称。"
      nameInput?.focus()
      return
    }
    saveNpcPack({ name, sourceWorkTitle:work.title || "", npcs }, { idFactory:uid })
    notify(`NPC 包“${name}”已保存`)
    refresh()
  })

  root.querySelector("[data-npc-library-export]")?.addEventListener("click", () => {
    const packs = readNpcPacks()
    if (!packs.length) return
    downloadBlob(
      new Blob([serializeNpcPackLibrary(packs)], { type:"application/json;charset=utf-8" }),
      "tuuru-论坛NPC包合集.json",
    )
    notify("全部 NPC 包已导出")
  })

  importInput?.addEventListener("change", async () => {
    const file = importInput.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      try {
        const pack = parseNpcPack(text)
        saveNpcPack(pack, { idFactory:uid })
        notify(`NPC 包“${pack.name}”已导入`)
      } catch {
        const result = importNpcPackLibrary(text, { idFactory:uid })
        notify(`NPC 包已导入：新增 ${result.added}，更新 ${result.updated}`)
      }
      refresh()
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "NPC 包导入失败"
      notify("NPC 包导入失败", "error")
    }
  })

  root.querySelectorAll("[data-npc-pack-export]").forEach(button => {
    button.addEventListener("click", () => {
      const pack = readNpcPacks().find(candidate => candidate.id === button.dataset.npcPackExport)
      if (!pack) return
      downloadBlob(
        new Blob([serializeNpcPack(pack)], { type:"application/json;charset=utf-8" }),
        `${safeFilename(pack.name)}-NPC包.json`,
      )
      notify(`NPC 包“${pack.name}”已导出`)
    })
  })

  root.querySelectorAll("[data-npc-pack-delete]").forEach(button => {
    button.addEventListener("click", () => {
      const pack = readNpcPacks().find(candidate => candidate.id === button.dataset.npcPackDelete)
      if (!pack || !confirm(`删除 NPC 包“${pack.name}”？各作品中已导入的 NPC 不会受影响。`)) return
      deleteNpcPack(pack.id)
      notify("NPC 包已删除", "info")
      refresh()
    })
  })
}

function bindPlaceholderLibrary(root) {
  const library = root.querySelector("[data-preset-library]")
  const libraryStatus = root.querySelector("[data-preset-library-status]")
  if (!library) return

  function refresh() {
    const liveRoot = document.getElementById("resourcesRoot")
    if (!liveRoot) return
    liveRoot.outerHTML = renderResourcesPage({ initialTab:"habits" })
    bindResourcesPage()
  }

  root.querySelector("[data-preset-new]")?.addEventListener("click", () => {
    library.querySelector(".resource-empty")?.remove()
    library.insertAdjacentHTML("afterbegin", renderPresetEditor({ id:"", name:"", fields:[{}] }))
    library.querySelector("[data-preset-editor]")?.querySelector("[data-preset-name]")?.focus()
  })

  library.addEventListener("click", event => {
    const editor = event.target.closest("[data-preset-editor]")
    if (!editor) return
    if (event.target.closest("[data-field-add]")) {
      editor.querySelector(".preset-fields")?.insertAdjacentHTML("beforeend", renderPresetField())
      const rows = editor.querySelectorAll("[data-preset-field]")
      rows[rows.length - 1]?.querySelector("input")?.focus()
      return
    }
    if (event.target.closest("[data-field-remove]")) {
      const row = event.target.closest("[data-preset-field]")
      if (editor.querySelectorAll("[data-preset-field]").length === 1) {
        row.querySelectorAll("input").forEach(input => { input.value = "" })
      } else {
        row.remove()
      }
      return
    }
    if (event.target.closest("[data-preset-save]")) {
      const name = editor.querySelector("[data-preset-name]")?.value?.trim() || ""
      const fields = collectPresetFields(editor)
      const status = editor.querySelector("[data-preset-status]")
      if (!name || !fields.length) {
        if (status) status.textContent = "请填写习惯名称，并至少保留一项占位符。"
        return
      }
      const previousId = editor.dataset.presetId
      const saved = saveAuthorPlaceholderPreset(name, fields, {
        globalForbidden:parseForbiddenWords(editor.querySelector("[data-preset-global-forbidden]")?.value),
        globalExactForbidden:parseForbiddenWords(editor.querySelector("[data-preset-global-exact-forbidden]")?.value),
      })
      if (!saved) {
        if (status) status.textContent = "保存失败，浏览器无法写入作者全局设置。"
        return
      }
      if (previousId && saved.id !== previousId) deleteAuthorPlaceholderPreset(previousId)
      notify("占位符习惯已保存")
      refresh()
      return
    }
    if (event.target.closest("[data-preset-delete]")) {
      const presetId = editor.dataset.presetId
      if (!presetId) {
        editor.remove()
        return
      }
      if (!confirm("删除这项全局习惯吗？已有作品中的占位符不会改变。")) return
      deleteAuthorPlaceholderPreset(presetId)
      notify("全局习惯已删除", "info")
      refresh()
    }
  })

  root.querySelector("[data-preset-export]")?.addEventListener("click", () => {
    const presets = readAuthorPlaceholderPresets()
    if (!presets.length) return
    const blob = new Blob([serializeAuthorPlaceholderPresetBundle(presets)], { type:"application/json;charset=utf-8" })
    downloadBlob(blob, "tuuru-作者占位符习惯.json")
    if (libraryStatus) libraryStatus.textContent = `已导出 ${presets.length} 项作者全局习惯。`
    notify("占位符习惯已导出")
  })

  root.querySelector("[data-preset-import]")?.addEventListener("change", async event => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const result = importAuthorPlaceholderPresetBundle(await file.text())
      notify(`已导入，占位符习惯共 ${result.length} 项`)
      refresh()
    } catch (error) {
      if (libraryStatus) libraryStatus.textContent = error instanceof Error ? error.message : "占位符习惯导入失败"
      notify("占位符习惯导入失败", "error")
    }
  })
}

function bindTutorialDirectory(root) {
  const sections = Array.from(root.querySelectorAll("[data-tutorial-category]"))
  const navigation = Array.from(root.querySelectorAll("[data-tutorial-nav]"))
  const search = root.querySelector("[data-tutorial-search]")
  const searchStatus = root.querySelector("[data-tutorial-search-status]")
  if (!sections.length || !navigation.length) return
  let activeCategory = navigation.find(button => button.classList.contains("active"))?.dataset.tutorialNav || "start"

  function showTutorial(category) {
    activeCategory = category
    navigation.forEach(button => {
      const active = button.dataset.tutorialNav === category
      button.hidden = false
      button.classList.toggle("active", active)
      if (active) button.setAttribute("aria-current", "page")
      else button.removeAttribute("aria-current")
    })
    sections.forEach(section => {
      const active = section.dataset.tutorialCategory === category
      section.hidden = !active
      section.querySelectorAll("[data-tutorial-search-item]").forEach(item => { item.hidden = false })
      section.querySelector(".tutorial-feature-list")?.removeAttribute("hidden")
      section.querySelector("[data-tutorial-faq-list]")?.removeAttribute("hidden")
    })
    if (searchStatus) searchStatus.textContent = ""
  }

  function applySearch() {
    const query = String(search?.value || "").trim().toLocaleLowerCase()
    if (!query) {
      showTutorial(activeCategory)
      return
    }
    let matches = 0
    sections.forEach(section => {
      let sectionMatches = 0
      section.querySelectorAll("[data-tutorial-search-item]").forEach(item => {
        const matched = item.textContent.toLocaleLowerCase().includes(query)
        item.hidden = !matched
        if (matched && item.matches("details")) item.open = true
        if (matched) sectionMatches += 1
      })
      const featureList = section.querySelector(".tutorial-feature-list")
      const faqList = section.querySelector("[data-tutorial-faq-list]")
      if (featureList) featureList.hidden = !featureList.querySelector("[data-tutorial-feature]:not([hidden])")
      if (faqList) faqList.hidden = !faqList.querySelector("[data-tutorial-faq]:not([hidden])")
      section.hidden = sectionMatches === 0
      matches += sectionMatches
      const button = navigation.find(item => item.dataset.tutorialNav === section.dataset.tutorialCategory)
      if (button) {
        button.hidden = sectionMatches === 0
        button.classList.remove("active")
        button.removeAttribute("aria-current")
      }
    })
    if (searchStatus) searchStatus.textContent = matches ? `找到 ${matches} 项结果` : "没有找到相关内容"
  }

  navigation.forEach(button => {
    button.addEventListener("click", () => {
      if (search) search.value = ""
      showTutorial(button.dataset.tutorialNav || "start")
    })
  })
  search?.addEventListener("input", applySearch)
  showTutorial(activeCategory)
}

export function bindResourcesPage() {
  const root = document.getElementById("resourcesRoot")
  if (!root || root.dataset.resourceBound === "true") return
  root.dataset.resourceBound = "true"
  bindContactTransfer(root)
  bindNpcPackLibrary(root)
  bindPlaceholderLibrary(root)
  bindTutorialDirectory(root)
}
