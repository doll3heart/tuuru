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
    <label class="preset-forbidden"><span>单项违禁词</span><input class="form-input" data-field-forbidden value="${esc(Array.isArray(field.forbidden) ? field.forbidden.join("，") : "")}" placeholder="可用换行、逗号、顿号、分号或斜杠分隔"></label>
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
    <label class="preset-global-forbidden"><span class="form-label">全局违禁词</span><textarea class="form-textarea" data-preset-global-forbidden placeholder="套用后对作品内所有占位符生效">${esc(Array.isArray(preset.globalForbidden) ? preset.globalForbidden.join("\n") : "")}</textarea></label>
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
        { title:"导出和备份", body:"<p>回到首页，在作品卡片上点【更多 ▾】，再点【导出 JSON】或【导出 PNG】。需要备份全部创作内容时，点【我的作品】标题下方的【备份全部】。</p>" },
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
        { title:"写入标记", body:"<p>把标记原样写进正文、消息或其他支持的内容。</p>" },
        { title:"整理与搜索", body:"<p>搜索名称、标记、问题或违禁词；点击「整理全部词库」可按多种分隔符拆词并清除重复项。</p>" },
        { title:"预览测试", body:"<p>在读者预览中填写答案，检查替换范围和违禁词。</p>" },
        { title:"保存作者预设", body:"<p>常用配置可保存为作者预设。套用后，各作品仍可单独修改。</p>" },
      ],
      checklist:["内容中的标记完全一致", "问题文字容易理解", "违禁词已经测试", "修改作者预设不会改变旧作品"],
      faq:[
        { title:"修改显示名称", body:"<p>互动文章先点编辑器左侧【{}】；小手机先点桌面【设置】App。找到目标占位符，在【显示名称】输入框修改后保存。正文中的【标记】不会随显示名称改变。</p>" },
        { title:"让一个答案全文生效", body:"<p>选择「全文替换」，再把自定义标记写进需要替换的位置。</p>" },
        { title:"让结果随机变化", body:"<p>选择「随机替换」，再填写可用值。</p>" },
        { title:"让同一场景保持一致", body:"<p>选择「场景锁定」，再为节点设置场景。</p>" },
        { title:"限制部分输入", body:"<p>当前占位符的词填在「违禁词」；需要所有占位符共用的词填在「全局违禁词」。支持换行、逗号、顿号、分号、斜杠和竖线分隔。</p>" },
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
        { title:"导出单篇作品", body:"<p>回到创作端首页，在作品卡片上点【更多 ▾】，再点【导出 JSON】或【导出 PNG】。两种格式包含相同的作品内容。</p>" },
        { title:"创建作品集", body:"<p>手机或 iPad 长按作品；电脑右键作品。选中至少两篇后创建作品集。</p>" },
        { title:"导出作品集", body:"<p>回到创作端首页，在作品集卡片上点【更多 ▾】，再点【导出 JSON】或【导出 PNG】。读者导入后会看到作品目录。</p>" },
        { title:"到读者端测试", body:"<p>重新导入文件，检查密码、占位符、分支和小手机内容。</p>" },
        { title:"备份创作库", body:"<p>点「备份全部」。备份含密码和私密内容，请勿公开分享。</p>" },
        { title:"定期留版本", body:"<p>重大修改前导出作品并备份，文件名保留日期。</p>" },
      ],
      checklist:["读者端成功导入并走通作品", "作品文件与整库备份分别保存", "包含密码和私密内容的备份没有公开分享", "知道原作品所在的浏览器、域名和端口"],
      faq:[
        { title:"分享单篇作品", body:"<p>在作品卡片上点【更多 ▾】，再点【导出 JSON】或【导出 PNG】。把这个作品文件发给读者。不要发送【备份全部】生成的整库备份。</p>" },
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
      { title:"新建作品", what:"创建互动文章或小手机作品。", where:"创作端页面顶部的【新建】。", use:"点【新建】，再点【互动文章】或【小手机】卡片。填写【作品标题】，最后点【创建作品】。", effect:"首页【我的作品】下面会增加一张作品卡片。" },
      { title:"作品信息", what:"管理标题、简介、作者署名和展示设置。", where:"创作端首页的作品卡片。", use:"点卡片上的【更多 ▾】，再点【作品信息】。修改后点弹窗底部的【保存】。", effect:"阅读页和导出文件使用新信息。" },
      { title:"作品排序与置顶", what:"调整作品在书架中的显示位置。", where:"作品卡片右上角的【⠿】和卡片上的【更多 ▾】。", use:"电脑按住【⠿】拖动排序。需要置顶时点【更多 ▾】，再点【置顶作品】或【取消置顶】。", effect:"置顶作品排在普通作品前面；同组作品保留拖动后的顺序。" },
      { title:"自动保存", what:"把编辑内容保存到当前浏览器。", where:"编辑器顶部保存状态。", use:"编辑后等待状态显示“已保存”。", effect:"重新打开作品时保留最新内容。" },
      { title:"阅读预览", what:"查看读者实际看到的作品。", where:"首页作品卡片上的【阅读】，或编辑器顶部的【读者端】。", use:"点入口后从开头阅读，实际点击选项并测试返回。", effect:"可以发现断开的分支和显示问题。" },
      { title:"复制作品", what:"创建一份独立副本。", where:"首页作品卡片上的【更多 ▾】。", use:"点【更多 ▾】，再点【复制作品】。", effect:"首页增加一份副本，原作保持不变。" },
      { title:"删除作品", what:"移除一篇本地作品。", where:"首页作品卡片上的【删除】。", use:"点【删除】，阅读弹窗后确认。", effect:"作品会从书架和相关作品集目录中移除。" },
      { title:"创建作品集", what:"把多篇作品组成一个可导出的目录。", where:"手机或 iPad 长按作品；电脑右键作品。", use:"选中至少两篇，点“创建作品集”，再填写信息。", effect:"书架新增作品集卡片，原作品继续保留。" },
      { title:"管理作品集", what:"修改作品集信息、顺序和进入方式。", where:"首页的作品集卡片。", use:"点卡片上的【管理】。在弹窗中增删作品或调整顺序，最后点弹窗底部的【保存】。", effect:"下一次导出使用最新目录和作品内容。" },
      { title:"作品集进入方式", what:"控制读者进入作品集时填写信息的次数。", where:"作品集卡片的【管理】弹窗。", use:"点【管理】，找到【进入方式】，选择【各篇独立】或【作品集统一】，最后保存。", effect:"【各篇独立】保留每篇设置；【作品集统一】只填写一次。" },
    ],
  },
  {
    id:"article", title:"互动文章", features:[
      { title:"章节", what:"章节是读者翻阅的一页，用来整理同一页中连续出现的剧情文段。", where:"电脑看编辑器右侧【结构】；手机点页面顶部【结构】。", use:"在【节点列表】标题右侧点【+章】。按住节点左边【⠿】拖动，把需要连续阅读的节点排进同一章。最前章节的第一个普通节点会成为作品起点；换起点时把目标节点拖到最前面。", effect:"当前路线中的同章正文会合并在一页；章节结束后点【NEXT】进入下一章。" },
      { title:"节点", what:"普通节点是章节内的一段正文；互动图片节点是一页独立互动。", where:"电脑看右侧【节点列表】；手机先点顶部【结构】。", use:"直接添加正文节点时点【节点列表】标题右侧的【+】。要加进指定章节，电脑把鼠标移到章节名称这一行；手机点这一行右侧【…】。展开【＋、隐、◎、✎、×】后，点【＋】添加正文节点，点【◎】添加互动图片节点。", effect:"同章普通节点按当前路线合并；互动图片节点会单独打开。" },
      { title:"剧情分支", what:"让读者的选择跳转到另一条剧情路线，并记录本次选择。", where:"点正文节点，再看编辑器左侧的【⇄】；鼠标停上去会显示【编辑末尾剧情分支】。", use:"点【⇄】，填写选项文本，再点【选择目标节点】并选择目标节点。剧情分支始终固定在节点正文末尾。被选项直接指向的普通节点会自动进入对应路线。", effect:"读者只会进入当前选择的路线。同组选项指向的其它并行节点不会同时出现。每个选项的稳定 ID 可用于隐藏节点条件。" },
      { title:"普通互动", what:"在正文任意位置提供不跳转的反应选择；同一节点可以放多组。", where:"先把输入光标放进正文，再点编辑器左侧【◇】；鼠标停上去会显示【在正文中插入普通互动】。", use:"每组至少添加两个选项。填写按钮上的【选项文本】和点击后出现的【选择后内容】，再点【保存】。选择后内容可以分行，每一行都会按独立正文段落显示。点正文里的互动卡片可以编辑、删除或移动；进入移动状态后，点击新的正文位置完成放置。位置丢失时用【待放置】提示中的【放到光标处】恢复。", effect:"每组单独记录选择，不改变剧情路线。普通互动和末尾剧情分支可以同时存在。反馈沿用正文的字体、字号、行距、字距、段落间距和首行缩进。" },
      { title:"隐藏节点", what:"只在当前选择满足条件时显示的一段补充正文。", where:"在右侧【节点列表】找到目标章节名称。电脑把鼠标移到这一行；手机点这一行右侧【…】。展开【＋、隐、◎、✎、×】后点【隐】。", use:"新隐藏节点会放在本章末尾。点节点名称，在中间写正文，再点编辑器顶部【显示条件】。设置完成后，按住节点左边【⠿】拖到希望出现的位置。", effect:"条件满足时插入正文；条件不满足时跳过。读者返回改选后会重新判断。" },
      { title:"显示条件（或 / 且）", what:"用读者当前选择决定隐藏节点是否显示。", where:"先在【节点列表】点一个隐藏节点，再点编辑器顶部【显示条件】。", use:"搜索选项文本、普通互动组名、节点、章节或稳定 ID，点结果加入条件。同一组中的选项按【或】判断。点【添加附加条件（且）】可建立另一组；不同组按【且】判断。最后点【保存】。", effect:"条件使用稳定 ID。选项改名后仍能关联；选项被删除、ID 重复或引用不明时会显示【条件已失效】。" },
      { title:"章节连续阅读、分支汇合与 NEXT", what:"控制章节内文段合并、选项后的路线汇合以及章节之间的翻页。", where:"读者端的章节正文和页面底部。", use:"普通节点末尾不设置选项时，会沿当前路线继续读取同一章节的后续节点。若节点 1 的 A、B 分别指向节点 2、3，可把无人直接指向的节点 4 排在它们之后作为汇合主线：初次打开只显示节点 1，选择 A 后显示节点 2 再接节点 4，选择 B 后显示节点 3 再接节点 4。当前章节结束后点击 NEXT。", effect:"未选择的并行分支不会提前出现；汇合节点只在当前支线走完后顺延显示。NEXT 会进入下一章节，最后一章结束后显示返回首页。" },
      { title:"作者设定笔记", what:"整理故事总纲、章节规划、伏笔回收、世界规则、地点与组织、人物档案、人物关系和灵感碎片。", where:"电脑点编辑器右侧上方【设定】；手机点顶部【设定】。", use:"点左侧分类名称开始记录。顶部搜索框可搜索分类和内容；分类右侧会显示字数。", effect:"笔记只保存在作者端，不进入作品预览，也不随作品导出。" },
      { title:"场景", what:"让几个节点共用【场景锁定】占位符的同一次随机结果。", where:"先点一个正文节点，再看编辑器顶部的场景下拉框。", use:"点下拉框。新建时点【＋ 新建场景…】，输入名字并确定。再让需要共享结果的其它节点选择同一场景。普通写作选【不使用场景】。", effect:"同一场景中的节点会使用相同的场景锁定结果。" },
      { title:"富文本与图片", what:"设置正文格式并插入图片。", where:"先在【节点列表】点正文节点，再看正文上方工具栏和编辑器左侧带图片图案的【+】。", use:"先选中文字，再点【B】加粗、【I】斜体、【U】下划线，或点【左】【中】【右】调整对齐。字体、字号和行距用旁边的下拉框。插入图片时点左侧带图片图案的【+】，填写图片信息后保存。", effect:"阅读页显示保存后的排版和图片。" },
      { title:"作者正文颜色", what:"调整作者端正文编辑器的文字颜色。", where:"正文上方工具栏里的【字色】。", use:"点【字色】旁的颜色框选择颜色。需要恢复时点【重置字色】。", effect:"颜色只影响本机编辑界面，不随作品导出，也不覆盖读者阅读美化。" },
      { title:"互动图片", what:"制作独立的可触摸图片剧情节点，并分隔同章前后的正文页面。", where:"在右侧【节点列表】找到目标章节名称。电脑把鼠标移到这一行；手机点这一行右侧【…】。", use:"展开【＋、隐、◎、✎、×】后点【◎】。上传背景图或立绘，添加热区并设置触发方式、说话人和台词。最后在【后续跳转至（必选）】选择普通节点，再点【保存】。互动图片内不能添加剧情分支；需要分流时，在后续普通节点添加剧情分支。", effect:"阅读时会依次出现互动图片前正文页、互动图片页、后续普通节点开始的正文页。最后一个画面完成后进入作者选择的普通节点。" },
      { title:"插入小手机内容", what:"在文章节点中展示消息、论坛、备忘录等 App 内容。", where:"先在右侧【节点列表】点一个正文节点，再看编辑器最左边的一列按钮。", use:"把鼠标停在按钮上会看到【插入消息模块】、【插入论坛模块】、【插入备忘录模块】、【插入相册模块】、【插入浏览器模块】或【插入购物模块】。点需要的按钮，编辑内容后保存。每张文章手机卡片对应一个 App。", effect:"作者和读者可打开该 App；返回时退出当前卡片。" },
      { title:"消息模块联系人可见性", what:"控制一个文章消息卡片中可以出现的联系人。", where:"点编辑器左侧消息图标，打开消息模块编辑器，再点【联系人】。", use:"查看【本模块可见】数量。点联系人右侧按钮可切换【读者可见】和【已隐藏】。已被聊天或动态使用的联系人需先删除相关内容。", effect:"设置只影响当前文章消息卡片。后来新增的联系人不会自动进入已有模块。" },
      { title:"移动节点", what:"调整节点所属章节、正文顺序和作品起点。", where:"右侧【节点列表】中，每个节点左边都有【⠿】。", use:"按住【⠿】拖动。上下拖可以换顺序，拖进另一个章节可以换章节。电脑把鼠标移到节点这一行，或在手机点节点右侧【…】，还可以用【移至…】直接换章节。", effect:"最前章节的第一个普通节点会成为起点；隐藏节点会在拖动后的结构位置插入。" },
      { title:"撤销、重做与字体", what:"恢复正文修改并设置编辑字体。", where:"先点正文节点，再看正文上方工具栏。", use:"点【↶】撤销，点【↷】重做。点字体下拉框选择字体；需要本机字体时点【+ 导入字体…】。", effect:"正文恢复到对应版本，字体设置会保存。" },
    ],
  },
  {
    id:"interactive", title:"互动图片", features:[
      { title:"创建独立互动页", what:"把一组可触摸画面做成章节里的独立互动节点。", where:"在右侧【节点列表】找到目标章节名称。电脑把鼠标移到这一行；手机点这一行右侧【…】。", use:"展开【＋、隐、◎、✎、×】后点【◎】。也可以点编辑器左侧【◎】。编辑完成后点【保存】，节点会出现在所选章节下面。", effect:"读者走到该节点时会打开全屏互动页面；完成后进入指定的后续节点。" },
      { title:"管理多个画面", what:"在同一个互动页内安排依次出现的画面。", where:"打开互动图片编辑器，看左侧【画面】列表。", use:"点列表下方【＋ 添加画面】建立画面 2、画面 3。点画面名称可以切换。需要删除时先点目标画面，再点左侧下方【删除当前画面】。读者探索完当前画面的全部互动点后，点击对话框进入下一画面；没有互动点时可直接点击。最后一个画面完成后，同样点击对话框，并跳到【后续跳转至（必选）】选定的普通节点。", effect:"画面严格按左侧顺序推进，不需要在每个热区中重复指定下一张图，也不会在互动图片内部产生剧情分支。" },
      { title:"固定后续跳转", what:"指定最后一个画面完成后进入的普通节点。", where:"互动图片编辑器左侧画面列表下方的【后续跳转至（必选）】。", use:"点下拉框，按章节选择一个普通节点。选好后才能保存。系统保存稳定节点 ID，所以目标改名或移动后仍然有效；目标被删除时，发布检查会提示修复。需要剧情分流时，把选项组放在选中的后续普通节点。", effect:"最后一个画面完成后会严格进入作者选择的节点，也可以越过中间节点。" },
      { title:"背景图与立绘", what:"把环境和人物拆成两个可以独立调整的图层。", where:"每个画面的「背景图」和「立绘」设置。", use:"可以填写 HTTPS 图片或 GIF 链接，也可以选择本地图片。只需要立绘时可以不填背景；两层同时使用时，立绘显示在背景上方。补充替代文字可以帮助无法查看图片的读者理解画面。", effect:"同一画面可以只显示一层，也可以合成背景与透明立绘。" },
      { title:"移动和缩放画面", what:"调整背景图或立绘在互动页面中的构图。", where:"预览上方「背景图 / 立绘」「移动图片」、缩放按钮和「复位」。", use:"先选中要调整的图层，再点「移动图片」；拖动画面平移，滚轮或加减按钮缩放。「完整显示」保留整张图，「铺满裁切」填满画面。", effect:"背景和立绘分别保存自己的位置、缩放与填充方式，互不覆盖。" },
      { title:"矩形、椭圆与手绘热区", what:"指定读者可以触发互动的画面区域。", where:"预览工具栏「＋矩形」「＋椭圆」「手绘热区」。", use:"矩形和椭圆创建后可直接拖动，拉四角调整大小；手绘时沿目标轮廓描一圈。右侧可以修改名称、形状和精确位置。替换图片或大幅改变构图后，应重新检查热区是否仍对准。", effect:"热区在普通阅读状态下保持不可见，只负责接收点击、长按或滑动。" },
      { title:"六种触发方式", what:"控制一个热区需要怎样操作才会触发。", where:"先在互动图片预览或热区列表中点一个热区，再看右侧【触发方式】。", use:"选择点击、长按、滑动、脸部靠近、靠近后点击或靠近后长按。长按可设置等待时间；摄像头方式可设置未授权时的备用互动。", effect:"不同热区可以使用不同操作。" },
      { title:"摄像头靠近互动", what:"用设备前置摄像头判断读者是否完成了明显靠近镜头的动作。识别过程只在当前设备进行。", where:"热区触发方式中的「脸部靠近」「靠近后点击」「靠近后长按」。", use:"作品含摄像头互动时，会在进入作品时统一申请权限。测试时先在普通阅读距离让摄像头看到脸，再明显靠近，直到镜头几乎无法继续识别人脸；组合触发会短暂等待对应的点击或长按，触屏贴近时也允许先触摸再完成靠近。", effect:"未授权时使用作者设置的备用互动；已经授权但浏览器不能识别时不会偷偷降级成普通点击。" },
      { title:"热区动作帧", what:"在热区台词出现时临时覆盖一张反馈图片、GIF 或视频。", where:"先点一个热区，再打开右侧【触发动作帧】。", use:"填写素材链接或选择本地文件，再选择铺满或完整显示。本地文件成功嵌入后会显示【已嵌入：文件名】。点【预览动作帧】可检查效果。", effect:"读者触发热区时会同时看到动作帧、说话人和台词；播放结束后回到原画面。" },
      { title:"动作帧播放与返回", what:"控制临时动作帧何时结束。", where:"热区的动作帧设置。", use:"静态图可设置 0.3 到 30 秒；本地 GIF 会读取首轮动画时长，图床不允许读取时使用备用播放时间；MP4 或 WebM 视频播放一遍。读者也可以提前点击对话框返回。", effect:"静态图计时结束、GIF 播完首轮或视频结束后都会自动回到原画面，不会无限停留或循环播放。" },
      { title:"说话人、台词与占位符", what:"为每个画面和热区分别安排角色名与文字反馈。", where:"画面设置中的「说话人、初始台词」；热区设置中的「触发时说话人、触发时台词」。", use:"画面台词负责进入画面时的内容；热区台词负责触发后的反应。可以直接写入当前作品的占位符标记。", effect:"读者端会替换触摸提示、说话人、初始台词和热区台词中的占位符；不会替换图片链接、视频链接或内部 ID。" },
      { title:"对话框与触摸提示美化", what:"统一调整互动提示和剧情对话框的外观。", where:"画面设置中的「触摸提示样式」和「对话框样式」。", use:"可调整颜色、透明度、圆角、位置、对话框宽度和高度。透明 PNG 可以作为对话框装饰并向外延伸；需要统一时勾选「同步到作品全部互动页」，只同步样式，不覆盖角色名和台词。", effect:"作者预览与读者端使用同一个互动组件，保存后的样式会直接用于实际阅读页面。" },
      { title:"素材体积与保存", what:"避免本地嵌入素材把作品文件和浏览器存储撑得过大。", where:"背景、立绘和动作帧的本地嵌入区域及底部状态提示。", use:"静态 PNG、JPG 和 WebP 会尝试压缩后嵌入；等待状态栏显示嵌入结果再保存。大型 GIF 或视频优先使用 HTTPS 图床。若浏览器存储不足，编辑器会保留当前窗口并提示缩小素材或改用图床。", effect:"静态图更容易稳定保存；本地嵌入仍会计入作品导出体积，链接素材不会写进导出文件本体。" },
      { title:"编辑、删除与移动互动页", what:"修改互动图片内容，或把整个互动图片节点换位置。", where:"先在右侧【节点列表】点带【互动】标记的节点。", use:"中间会出现【编辑互动页】，点它可以修改画面。需要移动时，按住节点左边【⠿】拖到新位置；也可以点这一行右侧【…】，再用【移至…】换章节。需要删除时，点这一行右侧【…】，再点【×】并确认。", effect:"移动和删除的都是整个互动图片节点，节点里的全部画面会一起处理。" },
      { title:"读者端逐页验收", what:"用真实作品检查完整阅读流程。", where:"回到创作端首页，在作品卡片上点【阅读】。", use:"从能到达互动页的路线进入，逐个测试热区、摄像头备用方式、动作帧、对话框推进和返回文章。目标读者会用哪些设备，就在哪些设备上各检查一次。", effect:"可以确认热区对齐、素材加载、占位符、权限提示和画面推进。" },
    ],
  },
  {
    id:"phone", title:"小手机", features:[
      { title:"App 排列", what:"调整桌面 App 的位置。", where:"小手机上方的【排列】。", use:"点【排列】，再点一个 App。用方向按钮移动，也可以直接拖动。完成后点【完成】。", effect:"读者桌面会使用保存后的位置。" },
      { title:"联系人", what:"建立消息和论坛使用的人物资料。", where:"小手机桌面的【联系人】App。", use:"点【联系人】，再点底部【+ 添加联系人】。输入姓名并点【确定】，填写资料后点【保存】。", effect:"其它 App 可以选择并显示这个身份。" },
      { title:"单聊与群聊", what:"创建聊天会话。", where:"小手机桌面的【消息】App。", use:"点【消息】，选择联系人后点【保存并编辑内容】。点联系人名称打开单聊；点联系人列表顶部【新建群聊】创建群聊。", effect:"读者可打开完整聊天记录。" },
      { title:"消息发送者", what:"指定每条消息由读者、角色或系统发出。", where:"会话底部的发送者选择区。", use:"先选择发送者，再输入消息或添加剧情内容。", effect:"气泡方向、头像和身份按发送者显示。" },
      { title:"文字与图片消息", what:"添加普通文字或图片气泡。", where:"先打开一个会话。文字入口在底部输入框；图片入口在输入框左边【＋】。", use:"文字直接输入后点【添加】。图片先点【＋】，再点【图片】，填写图片地址和说明后保存。", effect:"读者按消息顺序看到文字或图片。" },
      { title:"语音、位置、日期与系统消息", what:"添加语音气泡、地点、时间分隔和系统提示。", where:"打开会话，点底部输入框左边【＋】。", use:"在剧情内容面板第一页选择类型，再填写时长、地点、时间或提示文字。", effect:"聊天记录显示对应样式和剧情信息。" },
      { title:"外部链接卡片", what:"把 HTTP 或 HTTPS 网页做成聊天卡片。", where:"打开会话，点【＋】，切到下一页，再点【链接】。", use:"选择【外部网址】，填写卡片标题和完整网址后保存。", effect:"读者点击后会打开外部页面；无效协议只显示文字。" },
      { title:"作品内论坛链接", what:"把当前作品的一篇论坛帖子放进聊天。", where:"打开会话，点【＋】，切到下一页，再点【链接】。", use:"选择【链接内容】，再从列表选择已有帖子。需要时修改卡片标题，最后保存。", effect:"读者点击后会在聊天内查看帖子。" },
      { title:"红包、转账与亲属卡", what:"添加带金额和备注的互动卡片。", where:"打开会话，点底部输入框左边【＋】。", use:"第一页可点【转账】；切到下一页可点【红包】或【亲属卡】。填写金额、祝福语、备注或亲属关系后保存。", effect:"接收方读者可以领取或收款，状态保存在本地阅读记录中。" },
      { title:"外卖卡片", what:"添加商家、订单、金额和配送状态。", where:"打开会话，点【＋】，切到下一页，再点【外卖卡片】。", use:"填写商家和订单内容后保存。", effect:"读者可领取卡片；点击卡片会打开外卖搜索，设备支持时会尝试打开对应 App。" },
      { title:"消息编辑菜单", what:"修改消息并在指定位置补充剧情。", where:"手机或 iPad 长按消息；电脑右键消息。", use:"选择编辑、引用、在前插入时间、在前插入消息或添加选项。", effect:"可以修正文案、补充上下文和设置读者回复。" },
      { title:"会话置顶与排序", what:"整理单聊和群聊在消息列表中的顺序。", where:"点桌面【消息】App，完成角色接入后进入联系人列表。", use:"点会话旁的置顶按钮。需要排序时，长按排序柄拖动；键盘也可聚焦排序柄后按上下方向键。", effect:"置顶会话排在前面；同一区域会保留自定义顺序。" },
      { title:"消息回复选项", what:"在一条消息后加入读者选择和角色接话。", where:"手机或 iPad 长按目标消息；电脑右键目标消息。", use:"在消息菜单点【添加选项】。填写选项文本、读者回复和角色后续回复，再保存。每行后续文字会生成一个气泡。", effect:"读者选择后会按顺序显示对应回复。" },
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
      { title:"论坛读者回复选项", what:"为指定评论准备多句读者可选的完整回复。", where:"在帖子评论区轻点目标评论或楼中楼。", use:"在回复人选择器中点【读者】，再打开【编辑读者回复选项】。添加选项文字和读者发出的完整回复后保存。已设置的选项会显示在评论下方，点击它可再次编辑。", effect:"读者可选择一条完整回复，评论区会按该选项继续显示内容。" },
      { title:"论坛角色后续回复", what:"为每个读者选项安排角色继续接话。", where:"打开【编辑读者回复选项】，找到【角色后续消息】。", use:"点【添加】，逐条选择联系人、小号或 NPC，再填写回复内容。", effect:"一个选项可连续显示多条角色回复，不同选项可进入不同走向。" },
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
      { title:"创建占位符", what:"用读者填写的内容替换作品文字。", where:"互动文章点编辑器左侧【{}】；小手机点桌面【设置】App。", use:"进入【占位符管理】后点【添加占位符】，填写自定义标记、显示名称和问题，再保存。", effect:"阅读前会显示对应问题。" },
      { title:"全文替换", what:"所有标记使用同一个答案。", where:"进入【占位符管理】，找到目标占位符的【替换方式】。", use:"选择【全文替换】，保存后把该占位符的标记原样写进内容。", effect:"支持的文字位置会使用同一个答案。" },
      { title:"随机替换", what:"从可用值中随机选择结果。", where:"进入【占位符管理】，找到目标占位符的【替换方式】。", use:"选择【随机替换】，填写可用值并保存。", effect:"标记出现时可以得到不同结果。" },
      { title:"场景锁定", what:"让同一场景使用同一个随机结果。", where:"进入【占位符管理】选择【场景锁定】；场景在文章节点顶部设置。", use:"保存占位符后，逐个点需要共享结果的正文节点，在顶部场景下拉框选择同一个场景。", effect:"同场景节点会使用同一次随机结果。" },
      { title:"单项违禁词", what:"只限制一个占位符的部分输入。", where:"进入【占位符管理】，找到目标占位符卡片中的【违禁词】。", use:"输入词语，可用换行、逗号、顿号、分号、斜杠或竖线分隔，最后保存。", effect:"该占位符命中词语时会提示修改。" },
      { title:"全局违禁词", what:"让同一作品的所有占位符共用一份限制词。", where:"进入【占位符管理】，找到【全局违禁词】。", use:"输入词语后点【整理全部词库】。小手机还要点设置页底部【保存】。", effect:"任一占位符命中词语时都会提示修改。" },
      { title:"搜索与整理词库", what:"查找占位符和清理重复词语。", where:"进入【占位符管理】，使用顶部搜索框和【整理全部词库】。", use:"在搜索框输入名称、标记、问题或违禁词。需要拆分和去重时点【整理全部词库】。", effect:"可以快速定位项目，并保留每个词第一次出现的写法。" },
      { title:"作者占位符预设", what:"保存可跨作品复用的占位符配置。", where:"文章的【占位符管理】、小手机【设置】App，或页面顶部【?】中的【写作习惯】。", use:"在当前作品中点【保存当前为预设】。到其它作品打开【我的预设】，选择名称后点【套用预设】。", effect:"目标作品获得一份可独立修改的配置。" },
    ],
  },
  {
    id:"files", title:"文件与备份", features:[
      { title:"导出单篇作品", what:"生成可交给读者的作品文件。", where:"创作端首页的作品卡片。", use:"点【更多 ▾】，再点【导出 JSON】或【导出 PNG】。", effect:"读者端可以导入并阅读。" },
      { title:"导出作品集", what:"把多篇作品和目录放进一个文件。", where:"创作端首页的作品集卡片。", use:"点【更多 ▾】，再点【导出 JSON】或【导出 PNG】。", effect:"读者导入后会看到作品集目录。" },
      { title:"读者导入", what:"把作品或作品集加入读者端。", where:"点页面顶部【读者端】，再点读者首页的【导入】。", use:"选择 JSON 或 PNG 文件并确认。", effect:"作品会加入当前浏览器的读者书架。" },
      { title:"读者美化包", what:"单独导出或导入读者端的阅读外观。", where:"进入【读者端】，点顶部【外观】，再找到【美化包】。", use:"点【导出美化包】保存当前外观；导入时点文件选择入口并选择美化包。美化包可包含壁纸、字体、图标、自定义样式和个人主页顶部图。", effect:"导入只更新读者端外观。昵称、头像、读者 ID、阅读记录和作品内容不会写入美化包。" },
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
    { question:"选项点击后没有跳转怎么办？", answer:"如果是节点末尾的剧情分支，请检查目标章节和目标节点，再从阅读预览重新点击；正文中间的普通互动本来就不会跳转。" },
    { question:"为什么同一章节的下一个节点没有显示？", answer:"普通节点会沿当前阅读路线按结构顺序合并。请检查它是否仍在同一章节、是否是另一个选项指向的并行分支、是否为隐藏节点，以及显示条件是否满足；互动图片节点会在阅读到对应位置时单独打开。" },
    { question:"只想显示选择结果，不想换节点怎么设置？", answer:"把光标放在正文中希望出现的位置，点工具栏的“普通互动”。在“选项文本”填写按钮文字，在“选择后内容”填写点击后出现的正文；内容可以换行，每一行会按照独立正文段落排版。" },
    { question:"一个节点里可以放多组普通互动吗？", answer:"可以。每组都能放在正文里的不同位置，并独立记录读者选择。点互动卡片可编辑或移动；剧情分支仍固定在节点末尾，不会与这些互动组混排。" },
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
    { question:"为什么互动图片出现在节点列表里？", answer:"互动图片会占用一个完整阅读页面。读者走到这个节点时会直接打开全屏互动页。作者需要移动时，按住节点左边【⠿】拖动；需要编辑时，点节点后再点中间【编辑互动页】；需要删除时，点节点这一行右侧【…】，再点【×】。" },
    { question:"为什么点击对话框还不能进入下一画面？", answer:"先探索当前画面的全部互动点。页面会提示还有几个位置未探索；全部完成后，再点击对话框进入左侧列表中的下一画面。" },
    { question:"画面没有互动点时怎样进入下一张？", answer:"没有互动点的画面会直接视为探索完成。只要后面还有画面，点击对话框即可继续。" },
    { question:"热区在读者端为什么看不见？", answer:"这是正常设计。普通阅读时热区保持透明，避免轮廓破坏画面；键盘聚焦时仍会保留必要的焦点提示。" },
    { question:"热区和人物位置对不上怎么办？", answer:"先确认作者端选中的背景或立绘、填充方式、平移和缩放都已保存。替换素材或重新构图后，在预览中重新拖动、缩放或手绘热区，再到真实读者端复测。" },
    { question:"靠近后点击或靠近后长按没有触发怎么办？", answer:"先确认在进入作品时允许了摄像头，并使用 HTTPS 页面或本机 localhost。测试时先让镜头在普通距离看到脸，再明显靠近到几乎无法识别人脸，随后在短暂等待时间内点击或长按目标区域。普通坐在镜头前直接点击不会算成功。" },
    { question:"读者拒绝摄像头权限还能继续吗？", answer:"可以。作者应为摄像头热区选择点击或长按备用互动；读者拒绝权限时会使用该备用方式。已经授权但浏览器本身不能识别靠近时，不会自动把普通点击当作成功。" },
    { question:"动作帧播放结束后会发生什么？", answer:"静态图达到作者设置的时间、GIF 播完首轮或视频播放结束后，会回到触发前的背景和立绘。读者也可以提前点击对话框返回。" },
    { question:"为什么图床 GIF 使用了备用播放时间？", answer:"部分图床不允许浏览器读取 GIF 文件内容，因此无法计算首轮时长。此时会使用作者填写的 GIF 备用播放时间；需要精确结束时可改用允许跨域读取的图床或 MP4、WebM。" },
    { question:"本地图片太大导致保存失败怎么办？", answer:"静态图片会先尝试压缩；请等待底部显示压缩和嵌入结果后再保存。大型 GIF 或视频建议改用 HTTPS 图床。如果仍提示浏览器存储空间不足，请缩小素材、清理不需要的本地大图，并先导出作品备份。" },
    { question:"占位符可以写在哪些互动文字里？", answer:"触摸提示、画面说话人、初始台词、热区说话人和热区台词都支持作品占位符。图片或视频链接、内部 ID 不会被替换。" },
    { question:"怎样让全部互动页共用同一套对话框？", answer:"在任一互动页的“对话框样式”中调整完成后，勾选“同步到作品全部互动页”再保存。只会同步外观和透明 PNG 素材，不会覆盖各页说话人与台词。" },
  ],
  phone:[
    { question:"链接怎样打开作品里的论坛帖子？", answer:"添加链接时，在“链接内容”中选择已有帖子。读者点击卡片后会在聊天内打开画中画。" },
    { question:"链接怎样打开外部网页？", answer:"添加链接时保留“外部网址”，填写以 http:// 或 https:// 开头的完整地址。" },
    { question:"外卖卡片点击后会去哪里？", answer:"卡片会按商家和订单内容打开外卖搜索；支持的 Android 环境会先尝试打开对应 App，并保留网页入口。" },
    { question:"红包、转账和亲属卡会改变作者数据吗？", answer:"领取与收款状态只记录在读者当前设备的阅读进度中。" },
    { question:"怎样修改已经添加的消息？", answer:"手机或 iPad 长按消息，电脑右键消息，再从菜单选择编辑、引用或插入内容。" },
    { question:"怎样修改已经添加的商品？", answer:"手机或 iPad 长按商品卡片，电脑右键商品卡片，再从菜单选择“编辑”。购物车和订单里的已有商品都可以重新修改，包括显示时间。" },
    { question:"角色后续回复怎样分成多个气泡？", answer:"在消息的“添加选项”中填写后续回复，每行文字会生成一个气泡。" },
    { question:"怎样回复指定的论坛评论或楼中楼？", answer:"轻点目标评论或楼中楼，选择联系人、小号或 NPC，再填写内容。发布后会显示回复双方的名字。" },
    { question:"为什么没有看到论坛回复选项？", answer:"轻点目标评论或楼中楼，在回复人选择器中选择“读者”，再打开“编辑读者回复选项”。" },
    { question:"已经设置的论坛回复选项怎样修改？", answer:"点评论下方的选项文字，修改选项、读者完整回复或角色后续消息，再保存。" },
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
    { question:"修改作者预设会影响已套用的作品吗？", answer:"不会。套用时会在作品中建立独立副本，之后可以分别修改。" },
    { question:"随机结果怎样在几个节点中保持一致？", answer:"选择“场景锁定”，再给这些节点设置同一个场景。" },
  ],
  files:[
    { question:"分享作品应该使用哪种文件？", answer:"导出单篇作品或作品集的 JSON、PNG 文件，再交给读者导入。" },
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
