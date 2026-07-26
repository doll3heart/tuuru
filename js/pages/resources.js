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
        { title:"选择类型", body:"<p>首页点「新建」。分支故事选「互动文章」；全程模拟手机选「小手机」。</p>" },
        { title:"填写信息", body:"<p>先填标题。简介和作者名可以稍后补。</p>" },
        { title:"整理书架", body:"<p>电脑可拖动作品卡右上角抓手调整顺序；打开「更多」可选择置顶或取消置顶。</p>" },
        { title:"写一段内容", body:"<p>选中开始节点并输入正文。看到「已保存」后再离开。</p>" },
        { title:"添加互动", body:"<p>打开「选项」，添加一条选择并设置目标。</p>" },
        { title:"实际预览", body:"<p>进入阅读预览，点击选项并检查返回路径。</p>" },
        { title:"导出和备份", body:"<p>在作品卡片「更多」中导出 JSON 或 PNG，再点「备份全部」。作品文件用于分享，备份用于恢复。</p>" },
      ],
      checklist:["重新打开作品后正文仍在", "读者能从开头走到至少一个结果", "导出的文件保存在自己能找到的位置", "整库备份没有发送给不可信的人"],
      faq:[
        { title:"新建分支故事", body:"<p><strong>入口：</strong>首页 →「新建」→「互动文章」。在「作品结构」添加节点，再为选项设置目标。</p>" },
        { title:"查看读者画面", body:"<p><strong>入口：</strong>作品的阅读预览。请实际点击选项、打开小手机并测试返回。</p>" },
        { title:"修改作品信息", body:"<p><strong>入口：</strong>作品卡片 →「更多」→「作品信息」。可修改标题、简介和作者署名。</p>" },
        { title:"移动或置顶作品", body:"<p>电脑拖动作品卡右上角抓手调整顺序；打开「更多」可选择置顶或取消置顶。置顶作品会排在普通作品之前。</p>" },
        { title:"确认内容已保存", body:"<p>查看编辑器顶部状态。显示「已保存」后再关闭页面。</p>" },
        { title:"换网址后作品不见了", body:"<p>作品保存在当前浏览器和网址下。请回到原地址，或用备份恢复。</p>" },
        { title:"自动保存后还要点保存吗？", body:"<p>正文会自动保存。导出作品和下载备份仍需手动操作。</p>" },
      ],
    })}
    ${tutorialGuide({
      category:"article",
      title:"制作一篇有分支的互动文章",
      outcome:"建立节点、连接选项并走通分支。",
      intro:"每个剧情选项都要有明确目标。",
      steps:[
        { title:"画最小路线", body:"<p>先做“开始 → 选择 → 两个结果”，再扩展。</p>" },
        { title:"建立结构", body:"<p>用章节整理剧情，用节点承载内容。节点标题要清楚且唯一。</p>" },
        { title:"分清章节和场景", body:"<p>章节组织阅读路线；场景只控制「场景锁定」占位符。两者互不影响。</p>" },
        { title:"填写正文", body:"<p>选中普通节点后写正文。普通图片和小手机内容从正文工具栏插入。</p>" },
        { title:"制作互动图片", body:"<p>点「互动页」，会在当前章节新建一个独立互动节点。背景图和立绘分层上传，并可分别拖动、缩放；矩形和椭圆热区可直接拖动并拉四角，复杂轮廓使用「手绘热区」。触发支持点击、长按、滑动、脸部靠近、靠近后点击和靠近后长按。初始说话人、台词、触摸提示及热区台词都会应用读者填写的占位符。透明 PNG 可作为对话框边框覆盖素材。大型 GIF 建议使用 HTTPS 图床。</p>" },
        { title:"连接选项", body:"<p>填写选项文字并选择目标。普通互动可以不跳转。</p>" },
        { title:"检查跳转", body:"<p>分别测试同章、跨章和返回。</p>" },
        { title:"走通主线", body:"<p>实际走完每条主要分支，并测试重新选择。</p>" },
      ],
      checklist:["最前章节的第一个普通节点就是预期起点", "所有剧情选项都有有效目标", "分支后的汇合节点没有被选项直接指向", "跨章节前进与返回都符合预期"],
      faq:[
        { title:"在指定章节添加节点", body:"<p><strong>入口：</strong>作品结构 → 目标章节 → 新增节点。</p>" },
        { title:"让两个选择走向不同结局", body:"<p><strong>入口：</strong>节点 →「选项」。添加两条剧情选项，并分别选择目标节点。</p>" },
        { title:"只互动，不跳转", body:"<p>选择「普通互动」，填写选项和反馈即可。</p>" },
        { title:"移动节点", body:"<p>在作品结构中拖动节点，或使用节点菜单。移动后请重新预览。</p>" },
        { title:"插入聊天或论坛", body:"<p><strong>入口：</strong>正文工具栏 →「插入内容」。先准备小手机内容，再选择模块。</p>" },
        { title:"文章手机卡片怎样打开？", body:"<p>每张文章手机卡片只对应一个 App。作者编辑和读者打开时都会使用独立小手机中同一个 App 的界面与内容交互；返回会退出当前卡片。</p>" },
        { title:"添加可触摸的图片剧情", body:"<p><strong>入口：</strong>编辑器左侧「互动页」，或章节操作 →「◎」。保存后它会作为带“互动”标记的节点出现在对应章节；选中节点即可编辑，删除节点会同时删除场景数据。摄像头触发必须同时设置点击或长按备用操作；读者拒绝权限或设备不支持时会自动使用备用操作。</p>" },
        { title:"撤销修改或换字体", body:"<p>使用正文工具栏的撤销、重做和字体按钮。</p>" },
        { title:"选项一定要跳转吗？", body:"<p>不一定。普通互动模式可以只显示选择和反馈，不要求目标；只有承担剧情分支的选项才需要连接节点。</p>" },
        { title:"节点标题会给读者看吗？", body:"<p>标题主要用于整理结构。请保持清楚且唯一。</p>" },
        { title:"场景和章节有什么区别？", body:"<p>章节组织阅读路线；场景控制「场景锁定」的替换结果。</p>" },
      ],
    })}
    ${tutorialGuide({
      category:"phone",
      title:"制作一部可阅读的小手机",
      outcome:"添加人物和 App 内容，并安排阅读顺序。",
      intro:"先建人物，再写消息、论坛和其他内容。",
      steps:[
        { title:"新建小手机", body:"<p>新建时选择「小手机」，再调整 App 的名称、图标和位置。</p>" },
        { title:"建立联系人", body:"<p>先添加角色并填写姓名、头像。消息和论坛会使用这些身份。</p>" },
        { title:"填写 App 内容", body:"<p>添加聊天、帖子、备忘录、相册等剧情内容。</p>" },
        { title:"设置角色内容", body:"<p>需要角色专属内容时，使用「角色接入」。</p>" },
        { title:"安排阅读顺序", body:"<p>在设置 App 打开「阅读节奏控制」，拖动内容排序。</p>" },
        { title:"导入测试", body:"<p>导出后到读者端重新导入，逐个打开启用的 App。</p>" },
      ],
      checklist:["每个消息或论坛身份都能解析到角色", "阅读节奏顺序与剧情信息释放顺序一致", "所有启用 App 都有可读内容或明确空状态", "导出后仍能完整打开"],
      faq:[
        { title:"调整桌面 App", body:"<p><strong>入口：</strong>小手机编辑器 → App 管理。可修改开关、名称、图标和位置。关闭 App 不会删除内容。</p>" },
        { title:"创建单聊或群聊", body:"<p><strong>入口：</strong>消息 App → 新建会话。单聊选一人，群聊选多人。</p>" },
        { title:"添加特殊消息", body:"<p><strong>入口：</strong>会话 → 添加消息 → 选择类型。支持图片、链接、转账和红包。</p>" },
        { title:"添加语音或视频通话", body:"<p>添加通话事件。视频会使用联系人的「视频通话背景」。</p>" },
        { title:"编辑论坛帖子", body:"<p>正文按回车分段。发布后打开帖子并点「编辑」。</p>" },
        { title:"置顶、加精或排序帖子", body:"<p>轻点帖子操作按钮可置顶或加精；长按按钮后拖动可排序。</p>" },
        { title:"安排 App 阅读顺序", body:"<p><strong>入口：</strong>设置 App →「阅读节奏控制」。它不会改变桌面图标顺序。</p>" },
        { title:"桌面图标顺序就是阅读顺序吗？", body:"<p>不是。桌面排列控制手机外观；设置 App 里的阅读节奏控制决定作者安排的浏览流程，两者可以不同。</p>" },
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
        { title:"添加或复用论坛路人", body:"<p>论坛 App →「NPC」→ 新建；也可以导入通用 NPC 包。编辑好一组 NPC 后可保存到通用包供其他作品使用。需要参与聊天的人物请创建联系人。</p>" },
        { title:"置顶或排列联系人", body:"<p>打开联系人排序设置，选择置顶、A–Z 或自定义排序。</p>" },
        { title:"在小手机里 @ 身份", body:"<p>在文本框输入 @，再选择联系人、NPC、读者称呼或作品占位符。</p>" },
        { title:"让多个角色依次回复", body:"<p>在「回复选项」的后续回复区添加多条消息，并逐条选择发送者。</p>" },
        { title:"修改评论数或楼层", body:"<p>编辑帖子填写「显示评论数」；编辑主评论填写「显示楼层」。留空时自动计算。</p>" },
        { title:"修改动态评论", body:"<p>消息 App → 动态 → 评论旁「编辑」。可修改正文和显示时间。</p>" },
        { title:"显示论坛 IP", body:"<p>先填写身份的 IP，再打开论坛顶部「IP」开关。读者回复不会显示伪造 IP。</p>" },
        { title:"别名和小号有什么区别？", body:"<p>别名是同一联系人的昵称或称呼，不是第二个独立角色；小号是该联系人名下可单独选择的论坛身份，可以有自己的论坛 ID、头像和 IP 属地。</p>" },
        { title:"通用头像、消息头像与论坛头像", body:"<p>通用头像用于联系人名片并承担旧数据回退；消息头像只用于聊天；论坛头像只用于帖子和评论。留空时会沿用通用头像。</p>" },
        { title:"视频通话背景（旧称“固定脸”）", body:"<p>原“固定脸 URL”现在表示视频通话时的画面背景，不是头像或角色面部模型；语音通话不会使用。</p>" },
        { title:"IP 属地何时显示？", body:"<p>主号、小号和论坛 NPC 可以配置 IP 属地，但只有作者开启论坛 IP 显示后才呈现。读者本人发布的回复不会被伪造一个 IP。</p>" },
      ],
    })}
    ${tutorialGuide({
      category:"placeholders",
      title:"使用占位符",
      outcome:"创建一个占位符并测试替换结果。",
      intro:"作者自定义标记和问题。系统没有固定标记，也不规定读者扮演谁。",
      steps:[
        { title:"打开管理", body:"<p>互动文章点「占位符」；小手机进入设置 App 的「占位符管理」。</p>" },
        { title:"填写标记和问题", body:"<p>标记是作者写进内容的文字；问题是读者看到的提示。标记可自由命名。</p>" },
        { title:"选择替换方式", body:"<p>全文替换使用同一个答案；随机替换会变化；场景锁定会在同一场景保持一致。</p>" },
        { title:"写入标记", body:"<p>把标记原样写进正文、消息或其他支持的内容。</p>" },
        { title:"整理与搜索", body:"<p>搜索名称、标记、问题或违禁词；点击「整理全部词库」可按多种分隔符拆词并清除重复项。</p>" },
        { title:"预览测试", body:"<p>在读者预览中填写答案，检查替换范围和违禁词。</p>" },
        { title:"保存作者预设", body:"<p>常用配置可保存为作者预设。套用后，各作品仍可单独修改。</p>" },
      ],
      checklist:["内容中的标记完全一致", "问题文字容易理解", "违禁词已经测试", "修改作者预设不会改变旧作品"],
      faq:[
        { title:"修改显示名称", body:"<p><strong>入口：</strong>作品编辑器 →「占位符」→「显示名称」。这不会修改正文标记。</p>" },
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
        { title:"导出单篇作品", body:"<p>作品卡片 →「更多」→ 导出 JSON 或 PNG。两种格式内容相同。</p>" },
        { title:"创建作品集", body:"<p>手机或 iPad 长按作品；电脑右键作品。选中至少两篇后创建作品集。</p>" },
        { title:"导出作品集", body:"<p>作品集卡片 →「更多」→ 导出 JSON 或 PNG。读者导入后会看到作品目录。</p>" },
        { title:"到读者端测试", body:"<p>重新导入文件，检查密码、占位符、分支和小手机内容。</p>" },
        { title:"备份创作库", body:"<p>点「备份全部」。备份含密码和私密内容，请勿公开分享。</p>" },
        { title:"定期留版本", body:"<p>重大修改前导出作品并备份，文件名保留日期。</p>" },
      ],
      checklist:["读者端成功导入并走通作品", "作品文件与整库备份分别保存", "包含密码和私密内容的备份没有公开分享", "知道原作品所在的浏览器、域名和端口"],
      faq:[
        { title:"分享单篇作品", body:"<p>作品卡片 →「更多」→ 导出 JSON 或 PNG。不要发送整库备份。</p>" },
        { title:"分享多篇作品", body:"<p>长按或右键作品进入多选，创建作品集后再导出。</p>" },
        { title:"换浏览器或设备", body:"<p>在旧浏览器点「整机搬家」导出，再到新浏览器导入。</p>" },
        { title:"备份全部创作", body:"<p>首页点「备份全部」。文件含私密内容，请妥善保管。</p>" },
        { title:"复制联系人或 NPC 到另一篇作品", body:"<p>联系人使用「写作习惯」里的有名称联系人包；论坛 NPC 可在作品的 NPC 管理页保存到通用包，再到目标作品导入。</p>" },
        { title:"迁移作者占位符预设", body:"<p>「写作习惯」→「导出习惯」，再到新设备导入。</p>" },
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
      { title:"新建作品", what:"创建互动文章或小手机作品。", where:"创作端首页 → 新建。", use:"选择作品类型，填写标题并创建。", effect:"书架新增一张作品卡片。" },
      { title:"作品信息", what:"管理标题、简介、作者署名和展示设置。", where:"作品卡片 → 更多 → 作品信息。", use:"修改内容后保存。", effect:"阅读页和导出文件使用新信息。" },
      { title:"作品排序与置顶", what:"调整作品在书架中的显示位置。", where:"作品卡右上角抓手；或作品卡 → 更多。", use:"电脑拖动抓手调整顺序；在「更多」中选择置顶或取消置顶。", effect:"置顶作品排在前面，同一分组内保存自定义顺序。" },
      { title:"自动保存", what:"把编辑内容保存到当前浏览器。", where:"编辑器顶部保存状态。", use:"编辑后等待状态显示“已保存”。", effect:"重新打开作品时保留最新内容。" },
      { title:"阅读预览", what:"查看读者实际看到的作品。", where:"作品卡片 → 阅读，或编辑器预览入口。", use:"从开头阅读，点击选项并测试返回。", effect:"提前发现断开的分支和显示问题。" },
      { title:"复制作品", what:"创建一份独立副本。", where:"作品卡片 → 更多 → 复制作品。", use:"点击后在副本中继续编辑。", effect:"原作保持不变。" },
      { title:"删除作品", what:"移除一篇本地作品。", where:"作品卡片 → 删除。", use:"阅读提示后确认删除。", effect:"作品从书架和相关作品集目录中移除。" },
      { title:"创建作品集", what:"把多篇作品组成一个可导出的目录。", where:"手机或 iPad 长按作品；电脑右键作品。", use:"选中至少两篇，点“创建作品集”，再填写信息。", effect:"书架新增作品集卡片，原作品继续保留。" },
      { title:"管理作品集", what:"修改作品集信息、顺序和进入方式。", where:"作品集卡片 → 管理。", use:"增删作品、调整顺序并保存。", effect:"下一次导出使用最新目录和作品内容。" },
      { title:"作品集进入方式", what:"控制读者进入作品集时填写信息的次数。", where:"作品集管理 → 进入方式。", use:"选择“各篇独立”或“作品集统一”。", effect:"各篇独立会保留每篇设置；作品集统一只填写一次。" },
    ],
  },
  {
    id:"article", title:"互动文章", features:[
      { title:"章节", what:"章节才是读者翻阅的一页，用来整理同一页中连续出现的剧情文段。", where:"互动文章编辑器 → 作品结构。", use:"添加章节，再把需要连续阅读的普通节点放入同一章节并调整顺序。最前章节的第一个普通节点会自动成为作品起点；需要更换起点时，直接把目标节点拖到这个位置。", effect:"同一章节内符合当前阅读路线的正文会合并在一页；章节结束后使用 NEXT 进入下一章。" },
      { title:"节点", what:"节点是章节内的一段正文；同一章节内的普通节点会按结构顺序合并。互动图片节点则承载一整页独立互动。", where:"作品结构 → 添加节点；互动页使用章节操作里的「◎」或编辑器左侧「互动页」。", use:"普通节点可以只写一段正文，不需要选项组也会继续显示后续普通节点；节点名称用于作者整理结构，不会作为正文标题显示。", effect:"普通节点合并为章节正文，互动图片节点在阅读到对应位置时单独打开；可用的普通节点和互动图片节点可以成为剧情选项的跳转目标。" },
      { title:"剧情选项", what:"让读者的选择跳转到另一条剧情路线，并记录本次选择。", where:"节点编辑区 → 选项。", use:"填写选项文本，选择“剧情分支”，再指定目标章节和目标节点。被选项直接指向的普通节点会自动属于对应路线，不需要另外设置显示条件。", effect:"读者点击后只显示所选目标路线，不会同时显示同组选项指向的并行节点；每个选项的稳定 ID 会用于后续显示条件，修改选项文字不会改变已有条件的关联。" },
      { title:"普通互动", what:"显示选择后的正文反馈，不改变当前剧情路线。", where:"节点编辑区 → 选项。", use:"选择“普通互动”，分别填写按钮上显示的“选项文本”和点击后出现的“选择后内容”。选择后内容可以分行，每一行都会按独立正文段落显示。", effect:"读者点击后留在当前章节；反馈会跟随正文的字体、字号、行距、字距、段落间距、首行缩进和自定义样式。" },
      { title:"隐藏节点", what:"在满足指定选择记录时才显示的补充正文，用于插入回忆、回应和细微剧情差异。", where:"作品结构 → 章节操作 → 在本章添加隐藏节点；选中后在编辑器顶部打开“显示条件”。", use:"先填写隐藏节点正文，再设置显示条件并把节点移动到希望出现的位置。隐藏节点不能设置自己的选项，也不能作为剧情跳转目标或章节起点。", effect:"条件满足时，隐藏节点会按照它在结构树中的位置插入章节正文；条件不满足时不会占位，也不会打断当前路线。" },
      { title:"显示条件（或 / 且）", what:"用读者曾经选择过的选项决定隐藏节点是否显示。", where:"选中隐藏节点 → 编辑器顶部 → 显示条件。", use:"搜索选项文本、节点、章节或稳定 ID 并加入条件。同一组中的选项使用“或”，不同条件组之间使用“且”；例如“同意或沉默”且“曾经拒绝”。需要同时满足更多条件时，点击“添加附加条件（且）”。", effect:"条件根据稳定 ID 读取选择记录，选项改名后仍能继续关联；选项被删除或引用无法确定时会显示“条件已失效”，修复或移除失效条件后才能保存。" },
      { title:"章节连续阅读、分支汇合与 NEXT", what:"控制章节内文段合并、选项后的路线汇合以及章节之间的翻页。", where:"读者端的章节正文和页面底部。", use:"普通节点末尾不设置选项时，会沿当前路线继续读取同一章节的后续节点。若节点 1 的 A、B 分别指向节点 2、3，可把无人直接指向的节点 4 排在它们之后作为汇合主线：初次打开只显示节点 1，选择 A 后显示节点 2 再接节点 4，选择 B 后显示节点 3 再接节点 4。当前章节结束后点击 NEXT。", effect:"未选择的并行分支不会提前出现；汇合节点只在当前支线走完后顺延显示。NEXT 会进入下一章节，最后一章结束后显示返回首页。" },
      { title:"作者设定笔记", what:"在作品内整理故事总纲、章节规划、伏笔回收、世界规则、地点与组织、人物档案、人物关系和灵感碎片。", where:"移动端位于正文与结构之间的设定页；电脑端位于编辑器右侧的设定区域。", use:"从剧情、世界、人物和随记目录中选择分类；可搜索分类名称或已记录内容，分类旁会显示当前字数。旧版大纲、世界观、人物和灵感内容会自动保留在对应的新分类中。", effect:"笔记只保存在作者端，不会进入作品预览，也不会随作品导出给读者。" },
      { title:"场景", what:"为场景锁定占位符划分共享范围。", where:"节点标题旁的场景选择器。", use:"给需要共享结果的节点选择同一场景。", effect:"这些节点使用相同的随机结果。" },
      { title:"富文本与图片", what:"设置正文格式并插入图片。", where:"正文工具栏。", use:"选择文字后设置格式，或点击图片按钮。", effect:"阅读页显示排版后的内容。" },
      { title:"作者正文颜色", what:"调整作者端正文编辑器的文字颜色，便于建立个人写作环境。", where:"正文工具栏 → 字色。", use:"选择需要的编辑颜色；需要恢复时重新选择默认颜色。", effect:"作者正文颜色只影响本机编辑界面，不会随作品导出，也不会覆盖读者自己的阅读美化。" },
      { title:"互动图片", what:"制作独立渐入的可触摸图片剧情节点，并在同一章节中分隔前后正文页面。", where:"编辑器左侧 → 互动页，或章节操作 →「◎」；已建立的互动节点可从章节树选中、编辑或删除。", use:"分层上传背景图和立绘，选择对应图层后分别拖动缩放；直接拖拉矩形或椭圆热区，或沿轮廓手绘不规则热区。每个热区可设置点击、长按、滑动、脸部靠近、靠近后点击或靠近后长按，并单独改变说话人、台词或画面；互动文字支持作品占位符，对话框可叠加透明 PNG 素材。保存前必须在「后续跳转至」选择一个固定的普通节点；保存的是稳定节点 ID，目标改名或移动不会改变去向，目标被删除后需要重新选择。互动图片暂不支持承载剧情分支，也不能在画面内设置选项组；需要分流时，请把选项组放在所选的后续普通节点。", effect:"互动图片前的正文、互动图片、跳转目标开始的正文会成为连续的独立页面。最后一个画面完成后会严格进入作者选择的节点，可以越过结构中间的其它节点。" },
      { title:"插入小手机内容", what:"在文章节点中展示聊天、论坛等模块。", where:"正文工具栏 → 插入内容。", use:"先准备小手机数据，再选择需要插入的模块；每张文章手机卡片只对应一个 App。", effect:"作者和读者会打开与独立小手机一致的该 App 界面，返回时退出当前卡片。" },
      { title:"消息模块联系人可见性", what:"避免尚未登场的联系人提前出现在文章消息卡片中。", where:"互动文章 → 打开消息卡片编辑器 → 联系人。", use:"查看“本模块可见”数量，点联系人右侧按钮切换读者可见或已隐藏；剧情已使用的联系人需先删除相关聊天或动态。", effect:"只影响当前文章里的消息卡片；后来新增的联系人默认不会进入已有模块，也不影响独立小手机或其他卡片。" },
      { title:"移动节点", what:"调整节点所属章节、正文顺序和作品起点。", where:"作品结构中的拖动手柄或节点菜单。", use:"拖到目标位置后重新预览分支；最前章节的第一个普通节点是自动起点，隐藏节点在结构树中的位置则是它满足条件时插入正文的位置。", effect:"结构顺序与自动起点同步更新，节点 ID、选项稳定 ID 和连接继续保留。" },
      { title:"撤销、重做与字体", what:"恢复正文修改并设置编辑字体。", where:"正文工具栏。", use:"点击撤销、重做或字体按钮。", effect:"正文恢复到对应版本，字体设置会保存。" },
    ],
  },
  {
    id:"interactive", title:"互动图片", features:[
      { title:"创建独立互动页", what:"把一组可触摸画面做成章节里的独立剧情节点，不是插在正文中的卡片。", where:"互动文章编辑器左侧「◎ 在本章添加互动页」；也可以使用章节操作中的「◎」。", use:"在希望出现的位置添加互动页，编辑完成后点「保存」。已经建立的互动页会直接出现在章节树中。", effect:"读者走到该节点时会渐入全屏互动页面；退出后回到文章阅读流程。" },
      { title:"管理多个画面", what:"在同一个互动页内安排依次出现的画面。", where:"互动图片编辑器左侧「画面」列表。", use:"点「添加画面」建立画面 2、画面 3；点列表项目切换编辑，必要时删除当前画面。读者探索完当前画面的全部互动点后，点击对话框进入下一画面；没有互动点时可直接点击。最后一个画面完成后，同样点击对话框，并固定跳到「后续跳转至」选定的普通节点。", effect:"画面严格按左侧顺序推进，不需要在每个热区中重复指定下一张图，也不会在互动图片内部产生剧情分支。" },
      { title:"固定后续跳转", what:"为整组互动图片指定最后一个画面完成后的唯一出口。它是固定去向，不是给读者选择的剧情分支。", where:"互动图片编辑器左侧画面列表下方 →「后续跳转至（必选）」。", use:"按章节选择一个普通节点后才能保存。保存的是稳定节点 ID，所以目标改名或移动后仍然有效；如果目标被删除，发布检查会提示修复。互动图片内部暂不支持选项组，需要分流时，请把选项组放在所选的后续普通节点。", effect:"最后一个画面完成后会严格进入作者选择的节点，可以直接从节点 5 跳到节点 9 或节点 10，并越过结构中间不属于这条路线的节点。" },
      { title:"背景图与立绘", what:"把环境和人物拆成两个可以独立调整的图层。", where:"每个画面的「背景图」和「立绘」设置。", use:"可以填写 HTTPS 图片或 GIF 链接，也可以选择本地图片。只需要立绘时可以不填背景；两层同时使用时，立绘显示在背景上方。补充替代文字可以帮助无法查看图片的读者理解画面。", effect:"同一画面可以只显示一层，也可以合成背景与透明立绘。" },
      { title:"移动和缩放画面", what:"调整背景图或立绘在互动页面中的构图。", where:"预览上方「背景图 / 立绘」「移动图片」、缩放按钮和「复位」。", use:"先选中要调整的图层，再点「移动图片」；拖动画面平移，滚轮或加减按钮缩放。「完整显示」保留整张图，「铺满裁切」填满画面。", effect:"背景和立绘分别保存自己的位置、缩放与填充方式，互不覆盖。" },
      { title:"矩形、椭圆与手绘热区", what:"指定读者可以触发互动的画面区域。", where:"预览工具栏「＋矩形」「＋椭圆」「手绘热区」。", use:"矩形和椭圆创建后可直接拖动，拉四角调整大小；手绘时沿目标轮廓描一圈。右侧可以修改名称、形状和精确位置。替换图片或大幅改变构图后，应重新检查热区是否仍对准。", effect:"热区在普通阅读状态下保持不可见，只负责接收点击、长按或滑动。" },
      { title:"六种触发方式", what:"控制一个热区需要怎样操作才会触发。", where:"选中热区 →「触发方式」。", use:"可选点击、长按、滑动、脸部靠近、靠近后点击、靠近后长按。长按时可设置等待时间；摄像头方式还可设置未授权时使用点击或长按作为备用互动。", effect:"不同热区可以使用不同操作，普通点击不会冒充已经授权的靠近互动。" },
      { title:"摄像头靠近互动", what:"用设备前置摄像头判断读者是否完成了明显靠近镜头的动作。识别过程只在当前设备进行。", where:"热区触发方式中的「脸部靠近」「靠近后点击」「靠近后长按」。", use:"作品含摄像头互动时，会在进入作品时统一申请权限。测试时先在普通阅读距离让摄像头看到脸，再明显靠近，直到镜头几乎无法继续识别人脸；组合触发会短暂等待对应的点击或长按，触屏贴近时也允许先触摸再完成靠近。", effect:"未授权时使用作者设置的备用互动；已经授权但浏览器不能识别时不会偷偷降级成普通点击。" },
      { title:"热区动作帧", what:"在热区台词出现时临时覆盖一张反馈图片、GIF 或视频，不占用左侧画面序列。", where:"选中热区 → 打开「触发动作帧」。", use:"填写素材链接或选择本地文件，选择铺满或完整显示。本地选择成功后会显示「已嵌入：文件名」；「预览动作帧」可以在作者端检查效果。", effect:"读者触发该热区时，动作帧与该热区的说话人、台词同时出现，结束后回到原始画面。" },
      { title:"动作帧播放与返回", what:"控制临时动作帧何时结束。", where:"热区的动作帧设置。", use:"静态图可设置 0.3 到 30 秒；本地 GIF 会读取首轮动画时长，图床不允许读取时使用备用播放时间；MP4 或 WebM 视频播放一遍。读者也可以提前点击对话框返回。", effect:"静态图计时结束、GIF 播完首轮或视频结束后都会自动回到原画面，不会无限停留或循环播放。" },
      { title:"说话人、台词与占位符", what:"为每个画面和热区分别安排角色名与文字反馈。", where:"画面设置中的「说话人、初始台词」；热区设置中的「触发时说话人、触发时台词」。", use:"画面台词负责进入画面时的内容；热区台词负责触发后的反应。可以直接写入当前作品的占位符标记。", effect:"读者端会替换触摸提示、说话人、初始台词和热区台词中的占位符；不会替换图片链接、视频链接或内部 ID。" },
      { title:"对话框与触摸提示美化", what:"统一调整互动提示和剧情对话框的外观。", where:"画面设置中的「触摸提示样式」和「对话框样式」。", use:"可调整颜色、透明度、圆角、位置、对话框宽度和高度。透明 PNG 可以作为对话框装饰并向外延伸；需要统一时勾选「同步到作品全部互动页」，只同步样式，不覆盖角色名和台词。", effect:"作者预览与读者端使用同一个互动组件，保存后的样式会直接用于实际阅读页面。" },
      { title:"素材体积与保存", what:"避免本地嵌入素材把作品文件和浏览器存储撑得过大。", where:"背景、立绘和动作帧的本地嵌入区域及底部状态提示。", use:"静态 PNG、JPG 和 WebP 会尝试压缩后嵌入；等待状态栏显示嵌入结果再保存。大型 GIF 或视频优先使用 HTTPS 图床。若浏览器存储不足，编辑器会保留当前窗口并提示缩小素材或改用图床。", effect:"静态图更容易稳定保存；本地嵌入仍会计入作品导出体积，链接素材不会写进导出文件本体。" },
      { title:"编辑、删除与排序互动页", what:"像管理普通剧情节点一样管理整个互动页。", where:"章节树中的互动节点和互动页工作区。", use:"选中节点后点「编辑互动页」修改画面；使用节点菜单调整章节、顺序或删除。互动页标题也可以直接修改。", effect:"互动页始终作为一个完整节点移动，不会散成正文卡片或多个章节节点。" },
      { title:"读者端逐页验收", what:"用真实作品检查作者预览以外的完整阅读流程。", where:"作品卡片 →「阅读」。", use:"从能到达互动页的剧情路线进入，逐个测试所有热区、摄像头备用方式、动作帧、对话框推进和返回文章；电脑、手机或 iPad 至少各检查一次目标设备。", effect:"可以确认热区对齐、素材加载、占位符、权限提示和画面推进都符合实际读者端。" },
    ],
  },
  {
    id:"phone", title:"小手机", features:[
      { title:"App 管理", what:"控制桌面 App 的开关、名称、图标和位置。", where:"小手机编辑器 → App 管理。", use:"调整开关和排列后保存。", effect:"读者桌面按设置显示。" },
      { title:"联系人", what:"建立消息和论坛使用的人物资料。", where:"联系人 App。", use:"填写姓名、账号、头像和简介。", effect:"其他 App 可以选择并显示这个身份。" },
      { title:"单聊与群聊", what:"创建聊天会话。", where:"消息 App → 新建会话。", use:"单聊选择一人；群聊选择多人并填写群资料。", effect:"读者可打开完整聊天记录。" },
      { title:"消息发送者", what:"指定每条消息由读者、角色或系统发出。", where:"会话底部的发送者选择区。", use:"先选择发送者，再输入消息或添加剧情内容。", effect:"气泡方向、头像和身份按发送者显示。" },
      { title:"文字与图片消息", what:"添加普通文字或图片气泡。", where:"会话输入框；会话 → ＋ → 图片。", use:"文字可直接输入；图片填写图片地址和说明。", effect:"读者按消息顺序看到文字或图片。" },
      { title:"语音、位置、日期与系统消息", what:"添加语音气泡、地点、时间分隔和系统提示。", where:"会话 → ＋ 的第一页。", use:"选择类型并填写时长、地点、时间或提示文字。", effect:"聊天记录显示对应样式和剧情信息。" },
      { title:"外部链接卡片", what:"把 HTTP 或 HTTPS 网页做成聊天卡片。", where:"会话 → ＋ → 下一页 → 链接 → 外部网址。", use:"填写卡片标题和完整网址。", effect:"读者点击后在外部页面打开；无效协议只显示文字。" },
      { title:"作品内论坛链接", what:"把当前作品的一篇论坛帖子放进聊天。", where:"会话 → ＋ → 下一页 → 链接 → 链接内容。", use:"从列表选择已有帖子，卡片标题可单独填写。", effect:"读者点击后在聊天内用画中画查看帖子。" },
      { title:"红包、转账与亲属卡", what:"添加带金额和备注的互动卡片。", where:"会话 → ＋ → 转账；下一页还有红包和亲属卡。", use:"选择卡片类型，填写金额、祝福语、备注或亲属关系。", effect:"接收方读者可以领取或收款，状态保存在本地阅读记录中。" },
      { title:"外卖卡片", what:"添加商家、订单、金额和配送状态。", where:"会话 → ＋ → 下一页 → 外卖卡片。", use:"填写商家和订单内容后保存。", effect:"读者可领取卡片；点击卡片会打开外卖搜索，支持时会尝试打开对应 App。" },
      { title:"消息编辑菜单", what:"修改消息并在指定位置补充剧情。", where:"手机或 iPad 长按消息；电脑右键消息。", use:"选择编辑、引用、在前插入时间、在前插入消息或添加选项。", effect:"可以修正文案、补充上下文和设置读者回复。" },
      { title:"会话置顶与排序", what:"整理单聊和群聊在消息列表中的顺序。", where:"小手机 → 消息列表。", use:"点击置顶按钮；长按拖动排序柄，或聚焦后使用上下方向键。", effect:"置顶会话排在前面；同一分区内可保存自定义顺序。" },
      { title:"消息回复选项", what:"在一条消息后加入读者选择和角色接话。", where:"消息编辑菜单 → 添加选项。", use:"填写选项文本、读者回复和角色后续回复；每行后续文字生成一个气泡。", effect:"读者选择后会按顺序显示对应回复。" },
      { title:"聊天轮次", what:"把聊天剧情分成依次开放的多轮内容。", where:"会话右上角菜单。", use:"结束当前轮并填写下一轮信息，再继续添加消息。", effect:"阅读节奏可以按轮次或单条消息推进。" },
      { title:"语音与视频通话", what:"添加角色通话事件。", where:"消息或通话编辑入口。", use:"选择通话类型并填写内容。", effect:"读者可体验来电和通话流程。" },
      { title:"群聊身份", what:"设置群主、管理员和成员头衔。", where:"群聊 → 右上角菜单 → 管理群聊。", use:"勾选成员并设置群主、管理员和头衔。", effect:"群聊消息旁显示对应身份。" },
      { title:"动态", what:"制作角色动态、评论和读者回复。", where:"消息 App → 动态。", use:"添加动态内容、发布身份、评论和回复选项。", effect:"读者可以浏览动态并选择回复。" },
      { title:"论坛", what:"创建帖子和一级评论。", where:"论坛 App。", use:"选择发布身份，填写帖子内容、评论内容和显示时间。", effect:"读者可浏览帖子并参与评论区互动。" },
      { title:"楼中楼回复关系", what:"让角色回复指定的评论或楼中楼。", where:"论坛 App → 打开帖子 → 评论区。", use:"轻点评论或楼中楼，选择联系人、小号或 NPC，再填写回复内容。", effect:"评论区显示“回复者 回复 被回复者”，多层回复保留各自的目标关系。" },
      { title:"评论操作菜单", what:"编辑或删除一条评论、楼中楼。", where:"评论或楼中楼右侧的 ×。", use:"点 ×，再选择“编辑”或“删除”。", effect:"编辑会更新当前内容；删除会移除当前内容及其下方回复。" },
      { title:"评论点赞数", what:"设置评论和楼中楼显示的点赞数。", where:"评论或楼中楼右侧的爱心和数字。", use:"点爱心或数字，填写非负整数并保存。", effect:"作者端和读者端会显示更新后的点赞数。" },
      { title:"评论显示时间", what:"修改、隐藏单条时间，或统一隐藏本帖全部回复时间。", where:"单条时间在评论或楼中楼下方；整帖开关在主楼时间右侧。", use:"点时间戳，修改后保存；需要隐藏单条时点“隐藏时间”。点“隐藏全部回复时间”可统一隐藏，再点可恢复。", effect:"作者端和读者端按设置显示；整帖开关不会清空各条已保存的时间。" },
      { title:"评论与楼中楼排序", what:"调整评论区内容的显示顺序。", where:"论坛帖子评论区。", use:"手机或 iPad 长按后上下拖动；电脑按住鼠标后上下拖动。一级评论会带着全部楼中楼移动；楼中楼只在当前同级回复中移动。键盘聚焦后可按 Alt + ↑/↓。", effect:"评论顺序会保存，楼中楼层级和回复目标保持不变。" },
      { title:"论坛读者回复选项", what:"为指定评论准备多句读者可选的完整回复。", where:"轻点评论或楼中楼 → 选择回复人 → 读者。", use:"回复选项入口会在回复人选择“读者”后打开。进入“编辑读者回复选项”，添加选项文字和读者发出的完整回复。已设置的选项会显示在评论下方，点击选项可以再次编辑。", effect:"读者可从多条回复中选择一条，评论区会按该选项继续显示内容。" },
      { title:"论坛角色后续回复", what:"为每个读者选项安排角色继续接话。", where:"编辑读者回复选项 → 角色后续消息。", use:"点“添加”，逐条选择联系人、小号或 NPC，再填写回复内容。", effect:"同一选项可连续显示多个角色回复，不同选项可进入不同对话走向。" },
      { title:"备忘录", what:"为角色添加带时间的备忘内容。", where:"备忘录 App 或角色接入。", use:"选择联系人并添加备忘内容和时间。", effect:"读者在该角色的备忘录中查看。" },
      { title:"相册", what:"按相册整理角色照片和说明。", where:"相册 App 或角色接入。", use:"新建相册，再添加图片、说明和时间。", effect:"读者可进入相册逐张查看。" },
      { title:"浏览记录", what:"添加角色浏览过的页面记录。", where:"浏览器 App 或角色接入。", use:"填写标题、网址和日期时间。", effect:"读者看到带时间的浏览历史。" },
      { title:"购物", what:"制作购物车、订单和商品记录。", where:"购物 App 或角色接入。", use:"填写商品信息；修改已有商品时，手机或 iPad 长按商品卡片，电脑右键商品卡片，再选择“编辑”。也可以在购物车与订单状态之间调整。", effect:"读者可查看角色的购物清单和订单。" },
      { title:"角色接入", what:"为不同联系人分配专属 App 内容。", where:"小手机设置 → 角色接入。", use:"选择联系人，再配置备忘录、相册、浏览器或购物内容。", effect:"切换角色时显示对应数据。" },
      { title:"阅读节奏控制", what:"安排读者查看内容的顺序。", where:"设置 App → 阅读节奏控制。", use:"打开功能并拖动内容卡片排序。", effect:"读者会按顺序收到浏览提示。" },
    ],
  },
  {
    id:"social", title:"人物社交", features:[
      { title:"别名", what:"同一联系人的其他称呼。", where:"联系人编辑页。", use:"添加一个或多个别名。", effect:"作品可在不同位置使用不同称呼。" },
      { title:"论坛小号", what:"联系人名下的独立论坛身份。", where:"联系人编辑页 → 添加小号。", use:"填写论坛名称、头像、论坛 ID 和 IP。", effect:"发帖和回复时可以选择这个小号。" },
      { title:"论坛 NPC", what:"只参加论坛内容的独立身份。", where:"论坛 App → NPC。", use:"新建 NPC 并填写资料。", effect:"帖子和评论可以使用该身份。" },
      { title:"专用头像", what:"分别设置聊天头像和论坛头像。", where:"联系人编辑页。", use:"填写消息头像和论坛头像。", effect:"两个界面显示各自的头像。" },
      { title:"视频通话背景", what:"设置视频通话画面。", where:"联系人编辑页。", use:"选择或填写背景图片。", effect:"视频通话使用该画面。" },
      { title:"@ 提及", what:"在文本中插入可识别的身份或占位符。", where:"小手机文本输入框。", use:"输入 @，再从列表选择一项。", effect:"支持的预览和读者页面会高亮提及。" },
      { title:"读者回复与后续消息", what:"让读者选择回复，并安排角色继续接话。", where:"消息、动态或论坛的回复选项。", use:"添加读者选项，再逐条添加后续回复和发送者。", effect:"读者选择后按顺序看到后续内容。" },
      { title:"论坛显示数、楼层与 IP", what:"设置读者看到的论坛数字和属地。", where:"帖子编辑、评论编辑和论坛顶部 IP 开关。", use:"填写显示评论数或楼层；需要时打开 IP。", effect:"论坛按作者设置显示这些信息。" },
    ],
  },
  {
    id:"placeholders", title:"占位符", features:[
      { title:"创建占位符", what:"用读者填写的内容替换作品文字。", where:"互动文章的占位符入口；小手机设置 App → 占位符管理。", use:"填写自定义标记、显示名称和问题。", effect:"阅读前会显示对应问题。" },
      { title:"全文替换", what:"所有标记使用同一个答案。", where:"占位符的替换方式。", use:"选择“全文替换”，再把标记写进内容。", effect:"支持的文字位置统一替换。" },
      { title:"随机替换", what:"从可用值中随机选择结果。", where:"占位符的替换方式。", use:"选择“随机替换”并填写可用值。", effect:"标记出现时可以得到不同结果。" },
      { title:"场景锁定", what:"让同一场景使用同一个随机结果。", where:"占位符替换方式和节点场景。", use:"选择“场景锁定”，再为节点设置场景。", effect:"同场景节点保持一致。" },
      { title:"单项违禁词", what:"只限制一个占位符的部分输入。", where:"占位符卡片 → 违禁词。", use:"输入词语，可用换行、逗号、顿号、分号、斜杠或竖线分隔。", effect:"该占位符命中词语时会提示修改。" },
      { title:"全局违禁词", what:"让同一作品的所有占位符共用一份限制词。", where:"占位符管理 → 全局违禁词。", use:"输入词语后点击「整理全部词库」；小手机再点击底部「保存」。", effect:"任一占位符命中词语时都会提示修改。" },
      { title:"搜索与整理词库", what:"查找占位符和清理重复词语。", where:"占位符管理顶部。", use:"输入关键词筛选；点击「整理全部词库」拆分并去重。", effect:"快速定位项目，并保留每个词第一次出现的写法。" },
      { title:"作者占位符预设", what:"保存可跨作品复用的占位符配置。", where:"作品占位符设置或“写作习惯”。", use:"保存预设，再到其他作品套用。", effect:"目标作品获得一份可独立修改的配置。" },
    ],
  },
  {
    id:"files", title:"文件与备份", features:[
      { title:"导出单篇作品", what:"生成可交给读者的作品文件。", where:"作品卡片 → 更多。", use:"选择“导出 JSON”或“导出 PNG”。", effect:"读者端可以导入并阅读。" },
      { title:"导出作品集", what:"把多篇作品和目录放进一个文件。", where:"作品集卡片 → 更多。", use:"选择“导出 JSON”或“导出 PNG”。", effect:"读者导入后会看到作品集目录。" },
      { title:"读者导入", what:"把作品或作品集加入读者端。", where:"读者端 → 导入。", use:"选择 JSON 或 PNG 文件并确认。", effect:"作品可在当前浏览器中打开。" },
      { title:"读者美化包", what:"单独导出或导入读者端的阅读外观，不修改作品正文和作者数据。", where:"读者端 → 外观 → 美化包。", use:"选择导出美化包保存当前外观，或选择已有美化包导入。美化包可以包含壁纸、字体、图标、自定义样式和个人主页顶部图。", effect:"导入后只更新当前读者端的外观；读者昵称和头像不会写入美化包，读者 ID 和阅读记录也不会随包导出。" },
      { title:"备份全部", what:"保存完整创作库。", where:"创作端首页 → 备份。", use:"下载文件并妥善保管。", effect:"文件包含作品、密码、私密内容和设置。" },
      { title:"检查与恢复", what:"查看备份内容并恢复创作库。", where:"创作端首页 → 恢复。", use:"选择备份，检查摘要后确认。", effect:"当前创作库会替换为备份内容。" },
      { title:"整机搬家", what:"迁移作者端和读者端的本地数据。", where:"创作端首页 → 搬家。", use:"旧设备导出，新设备导入。", effect:"两端数据会合并到新浏览器。" },
      { title:"联系人包", what:"在作品之间复用联系人。", where:"写作习惯 → 联系人跨作品使用。", use:"选择来源作品，填写联系人包名称并导出，再合并到目标作品。", effect:"导入只追加联系人，不覆盖目标作品已有内容。" },
      { title:"论坛 NPC 包", what:"把论坛路人保存为作者通用资源。", where:"写作习惯 → 论坛 NPC 包；或作品论坛 → NPC 管理。", use:"为 NPC 包命名并保存，再到目标作品导入。", effect:"导入只追加 NPC；重复 ID 自动换新。" },
      { title:"作者预设文件", what:"迁移作者占位符预设。", where:"写作习惯 → 作者占位符预设。", use:"导出文件，再到另一浏览器导入。", effect:"作者预设会按名称合并。" },
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
    { question:"选项点击后没有跳转怎么办？", answer:"打开该节点的选项设置，检查类型、目标章节和目标节点，再从阅读预览重新点击。" },
    { question:"为什么同一章节的下一个节点没有显示？", answer:"普通节点会沿当前阅读路线按结构顺序合并。请检查它是否仍在同一章节、是否是另一个选项指向的并行分支、是否为隐藏节点，以及显示条件是否满足；互动图片节点会在阅读到对应位置时单独打开。" },
    { question:"只想显示选择结果，不想换节点怎么设置？", answer:"把选项类型设为“普通互动”，在“选项文本”填写按钮文字，在“选择后内容”填写点击后出现的正文。选择后内容可以换行，每一行会按照独立正文段落排版。" },
    { question:"隐藏节点的多个条件怎样计算？", answer:"同一条件组内是“或”：选中过其中任意一项即可；不同条件组之间是“且”：每一组都必须满足。条件编辑器中的分组摘要会同步显示这套关系。" },
    { question:"移动隐藏节点会改变触发条件吗？", answer:"不会。移动只改变条件满足时正文插入的位置，条件仍通过选项的稳定 ID 读取。把隐藏节点放在普通节点前面或后面，它就会在对应位置出现。" },
    { question:"修改或删除选项会影响隐藏节点吗？", answer:"修改选项文本不会影响关联，因为条件使用稳定 ID。删除选项后，引用它的条件会显示“条件已失效”；请在显示条件中移除失效项或改选仍然存在的选项。" },
    { question:"章节和场景分别控制什么？", answer:"章节整理阅读路线；场景为“场景锁定”占位符提供共享范围。" },
    { question:"文章里的手机卡片为什么只打开一个 App？", answer:"文章手机模块是一张卡片对应一个 App。它复用独立小手机中该 App 的界面与交互，返回时直接退出当前卡片。" },
    { question:"怎样避免新联系人提前在文章消息里剧透？", answer:"打开该文章的消息卡片，进入“联系人”，用右侧按钮设置本模块可见名单。后来新增的联系人会在已有模块中保持隐藏；这个设置只影响当前消息卡片。已经被聊天或动态使用的联系人不能直接隐藏，请先删除相关内容。" },
  ],
  interactive:[
    { question:"为什么互动图片出现在章节里，而不是正文卡片里？", answer:"互动图片本来就是独立剧情节点。读者走到这个节点时会直接打开全屏互动页；作者可以在章节树中移动、编辑或删除整个节点。" },
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
