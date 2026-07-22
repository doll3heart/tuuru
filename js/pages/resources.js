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
    <label><span>正文标记</span><input class="form-input" data-field-key value="${esc(field.key)}" placeholder="例如：某某"></label>
    <label><span>显示名称</span><input class="form-input" data-field-label value="${esc(field.label)}" placeholder="例如：姓名"></label>
    <label><span>提问文字</span><input class="form-input" data-field-prompt value="${esc(field.prompt)}" placeholder="例如：你的名字？"></label>
    <label><span>替换方式</span><select class="form-select" data-field-mode>${modeOptions(field.mode || "each")}</select></label>
    <label class="preset-forbidden"><span>禁用词（逗号或换行分隔）</span><input class="form-input" data-field-forbidden value="${esc(Array.isArray(field.forbidden) ? field.forbidden.join("，") : "")}" placeholder="可留空"></label>
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
      <p>把会跨作品复用的内容放在这里。联系人仍属于具体作品；占位符习惯属于当前浏览器里的作者设置。</p>
    </div>
    ${renderContactHabits(getWorks())}
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
  return `<aside class="tutorial-checkpoint"><h3>完成后检查</h3><ul>${items.map(item => `<li>${item}</li>`).join("")}</ul></aside>`
}

function tutorialFaq(items) {
  return `<div class="tutorial-faq"><h3>我想要……该怎么做？</h3>${items.map(item => glossaryItem(item.title, item.body)).join("")}</div>`
}

function tutorialGuide({ category, title, outcome, intro, steps, checklist, faq }) {
  return `<section class="tutorial-section tutorial-guide resource-prose" id="tutorial-${category}" role="tabpanel" data-tutorial-category="${category}"${category === "start" ? "" : " hidden"}>
    <header class="tutorial-guide-header"><h2>${title}</h2><p>${intro}</p></header>
    <p class="tutorial-outcome"><strong>你会完成：</strong>${outcome}</p>
    ${tutorialSteps(steps)}
    ${tutorialChecklist(checklist)}
    ${tutorialFaq(faq)}
  </section>`
}

function renderTutorialPage() {
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
      title:"第一次使用：从新建到交给读者",
      outcome:"创建一篇最小可读作品，亲自走完预览，并导出一个能交给读者的文件。",
      intro:"先跑通一次完整流程，再回头增加分支、社交内容和美化，最不容易迷路。",
      steps:[
        { title:"选择作品类型", body:"<p>从首页点击「新建」，选择「互动文章」来写节点式分支故事；如果整部作品都发生在手机界面里，则选择「小手机」。第一次建议先建互动文章。</p>" },
        { title:"填写最少信息", body:"<p>输入作品标题；描述和作者名可以稍后补。创建后会进入编辑器，第一章和第一个开始节点已经准备好。</p>" },
        { title:"写出一段可读内容", body:"<p>选中开始节点，在正文区写一小段文字。观察顶部保存状态，等它显示「已保存」再离开页面。</p>" },
        { title:"增加一次互动", body:"<p>打开「选项」，添加一条读者可点击的文字。暂时不做复杂分支也没关系，可以先让它指向现有节点或新建目标节点。</p>" },
        { title:"用阅读视角检查", body:"<p>从作品页进入阅读预览，实际点击一次选项，确认正文、返回路径和手机内容符合预期。作者端看起来正确，不等于读者流程一定完整。</p>" },
        { title:"导出并留一份备份", body:"<p>回到首页，在作品卡片的「更多」中导出 JSON 或 PNG；再使用「备份全部」保存当前创作库。作品文件用于分享，整库备份用于保护作者数据。</p>" },
      ],
      checklist:["重新打开作品后正文仍在", "读者能从开头走到至少一个结果", "导出的文件保存在自己能找到的位置", "整库备份没有发送给不可信的人"],
      faq:[
        { title:"我想新建一篇能选择不同剧情的作品", body:"<p><strong>入口：</strong>创作端首页 →「新建」→「互动文章」。创建后，在右侧「作品结构」添加节点，再到来源节点的「选项」里选择目标节点。整部内容都只发生在手机界面时，才选择「小手机」。</p>" },
        { title:"我想先看看读者实际会看到什么", body:"<p><strong>入口：</strong>打开作品详情或编辑器中的阅读预览入口。预览时要真正点击选项、打开小手机和返回上一章；只在作者端切换节点不能代替读者流程检查。</p>" },
        { title:"我想修改已经创建的作品信息", body:"<p><strong>入口：</strong>首页作品卡片 →「更多」或作品信息入口。标题、简介、作者署名和作品相关展示设置都应在作品自己的信息页修改，不需要重新新建作品。</p>" },
        { title:"我想确认刚才写的内容有没有保存", body:"<p><strong>位置：</strong>文章编辑器顶部的保存状态。停止输入后等状态稳定为「已保存」再关闭页面；导出文件和备份不会因为自动保存而自动下载，仍需手动执行。</p>" },
        { title:"为什么换了网址或端口后作品不见了？", body:"<p>作者数据主要保存在当前浏览器的站点存储中。不同域名、端口、浏览器或隐私模式会使用不同的本地空间；请回到原地址，或使用整库备份恢复。</p>" },
        { title:"自动保存后还要手动点保存吗？", body:"<p>正文和大部分编辑操作会进入本地保存流程。离开前应确认保存状态已经稳定；导出文件和备份仍需要你主动操作。</p>" },
      ],
    })}
    ${tutorialGuide({
      category:"article",
      title:"制作一篇有分支的互动文章",
      outcome:"建立章节与节点、连接选项目标，并在阅读预览中走通分支。",
      intro:"互动文章的核心不是把正文切碎，而是让每个选项都能到达一个明确、可检查的目标。",
      steps:[
        { title:"先画最小路线", body:"<p>先写下“开始 → 选择 → 两个结果”这条最小路线。不要一开始建立几十个空节点，否则很难判断哪些分支没有接好。</p>" },
        { title:"建立作品结构", body:"<p>在「作品结构」中先用「添加章节」整理大段剧情，再用「添加节点」建立每个可到达的阅读片段。节点标题写成事件名，比“节点 1”更容易找。</p>" },
        { title:"分清“场景”和“第一章”", body:"<p>「作品结构 → 第一章」是章节容器，决定节点归类以及跨章节阅读跳转；选中节点后，标题旁的「场景」是占位符替换标签。使用“场景锁定”占位符时，选择同一场景的节点会沿用同一个替换结果。旧作品初始化时两边都可能显示“第一章”，只是默认名称相同，并不代表它们是同一项。</p><p>实际操作：先在右侧作品结构把节点放进章节；只有需要让随机占位符在几段剧情中保持一致时，才设置节点顶部的场景。</p>" },
        { title:"填写节点正文", body:"<p>逐个选择节点，在正文区写内容；需要图片时使用「图片」，需要聊天或论坛片段时从「插入内容」选择对应的小手机模块。</p>" },
        { title:"连接读者选项", body:"<p>在来源节点打开「选项」，填写按钮文字，再从作品结构中选择目标节点。普通互动可以不跳转；剧情分支必须确认目标没有空缺或同 ID 歧义。</p>" },
        { title:"检查跨章节跳转", body:"<p>同章节目标会继续当前阅读页；跨章节目标会进入新的章节页。分别测试前进和返回，确认历史路径符合你的叙事设计。</p>" },
        { title:"从读者端走每条主线", body:"<p>不要只看作者预览静态画面。至少走通每条主要分支一次，并测试重新选择较早选项时，旧的后续内容是否正确截断。</p>" },
      ],
      checklist:["开始节点指向正确", "所有剧情选项都有有效目标", "没有读者到不了的必要节点", "跨章节前进与返回都符合预期"],
      faq:[
        { title:"我想直接在某个章节里添加节点", body:"<p><strong>入口：</strong>作品结构 → 找到目标章节 → 使用该章节旁的新增节点按钮。这样节点会直接进入这个章节；使用全局新增时，旧行为仍可能默认放进第一个章节。</p>" },
        { title:"我想让两个选择走向不同结局", body:"<p><strong>入口：</strong>选中来源节点 →「选项」→ 添加两条剧情选项 → 分别点击目标选择器，从作品结构中选择两个不同节点。结果节点应先有清楚且唯一的标题，避免选错。</p>" },
        { title:"我只想让读者点一下，不跳转剧情", body:"<p><strong>入口：</strong>节点「选项」→ 选择普通互动模式。填写选项文字和反馈即可，不必指定目标节点；剧情分支模式才承担节点跳转。</p>" },
        { title:"我想调整节点属于哪一章或在章内的顺序", body:"<p><strong>入口：</strong>作品结构 → 节点操作菜单，或使用节点拖拽手柄。移动只改变结构位置，不需要删除重建；移动后仍建议在预览中检查原有选项连接。</p>" },
        { title:"我想把聊天、论坛或小手机片段放进正文", body:"<p><strong>入口：</strong>选中节点 → 正文工具栏「插入内容」→ 选择小手机或对应模块。先在小手机编辑入口准备联系人和内容，再把模块插入需要出现的节点。</p>" },
        { title:"我想撤回刚才的正文修改或换字体", body:"<p><strong>入口：</strong>正文工具栏中的撤销、重做和字体控件。撤销与重做针对当前编辑内容；保存的编辑器字体会在下次打开时继续使用。</p>" },
        { title:"选项一定要跳转吗？", body:"<p>不一定。普通互动模式可以只显示选择和反馈，不要求目标；只有承担剧情分支的选项才需要连接节点。</p>" },
        { title:"节点标题会给读者看吗？", body:"<p>标题主要帮助作者整理结构。是否出现在阅读体验中取决于具体呈现；仍建议使用清楚、唯一的标题，方便选择目标和排查断路。</p>" },
        { title:"场景和章节有什么区别？", body:"<p>章节组织阅读结构；场景控制“场景锁定”占位符在哪些节点之间共用替换结果。章节改变不会自动改变场景，场景相同也不表示节点必须在同一章。</p>" },
      ],
    })}
    ${tutorialGuide({
      category:"phone",
      title:"制作一部可阅读的小手机",
      outcome:"配置联系人和常用 App 内容，安排读者浏览顺序，并完成一次文件交付测试。",
      intro:"小手机作品更像一组互相关联的 App 数据。先确定人物，再填消息、论坛和其他内容，身份才不会混乱。",
      steps:[
        { title:"新建小手机作品", body:"<p>在新建页选择「小手机」。进入编辑器后，先确认桌面上的 App，再按故事需要调整启用状态、名称、图标和排列。</p>" },
        { title:"先建立联系人", body:"<p>打开联系人 App 添加角色，填写主号姓名和通用头像。消息、论坛、朋友圈都依赖联系人身份，先做这一步可以减少后续返工。</p>" },
        { title:"按剧情填充 App", body:"<p>在消息 App 建立单聊或群聊，在论坛 App 添加帖子和评论；备忘录、相册、浏览记录和购物清单用来补充线索。每个内容块都应服务于读者理解，而不是只填满桌面。</p>" },
        { title:"设置角色接入", body:"<p>需要让某位联系人拥有自己的备忘录、相册、浏览器或购物内容时，使用角色接入设置，并检查无联系人、单联系人和多联系人时的入口是否清楚。</p>" },
        { title:"编排阅读节奏", body:"<p>在设置 App 的「阅读节奏控制」中开启并拖拽卡片顺序。这个顺序决定导出后读者依次浏览哪些内容，不等于桌面图标的位置。</p>" },
        { title:"用导出文件测试", body:"<p>导出作品后在读者端重新导入，逐个打开启用的 App，检查返回按钮、联系人切换、长内容滚动和图片是否都能使用。</p>" },
      ],
      checklist:["每个消息或论坛身份都能解析到角色", "阅读节奏顺序与剧情信息释放顺序一致", "所有启用 App 都有可读内容或明确空状态", "导出后仍能完整打开"],
      faq:[
        { title:"我想调整小手机桌面上显示哪些 App", body:"<p><strong>入口：</strong>小手机编辑器 → 桌面或 App 管理。可以调整启用状态、名称、图标和桌面位置；关闭 App 不等于删除其中已经编辑的数据。</p>" },
        { title:"我想做单聊或群聊", body:"<p><strong>入口：</strong>消息 App → 新建会话。单聊选择一个联系人；群聊选择多个联系人并设置群名称、群头像和成员身份。消息编辑时再选择发送者和消息类型。</p>" },
        { title:"我想添加图片、链接、转账或红包消息", body:"<p><strong>入口：</strong>消息 App → 打开会话 → 添加消息 → 选择消息类型。链接可以指向外部网址，也可以选择作品内论坛帖子，让读者在聊天里打开帖子画中画。</p>" },
        { title:"我想让角色打语音或视频电话", body:"<p><strong>入口：</strong>消息或通话相关编辑入口 → 添加通话事件。视频画面使用联系人资料里的「视频通话背景」；语音通话不会读取这张背景图。</p>" },
        { title:"我想让论坛主楼分段，或者发布后再修改", body:"<p><strong>入口：</strong>论坛 App → 发帖时在正文按回车分段；发布后打开帖子详情 →「编辑」。可以重新修改标题、正文、发帖时间和图片，空行会在读者端保留。</p>" },
        { title:"我想置顶、加精或调整论坛帖子顺序", body:"<p><strong>入口：</strong>论坛 App → 帖子列表 → 帖子卡片右下角粉色爱心省略按钮。轻点按钮可选择置顶或加精；长按约半秒后上下拖动可调整同组帖子顺序。使用键盘时，聚焦按钮后按上下方向键也能排序。置顶帖和普通帖分组排列；需要跨组移动时，请先切换帖子的置顶状态。</p>" },
        { title:"我想让读者按我安排的顺序查看 App", body:"<p><strong>入口：</strong>设置 App →「阅读节奏控制」。开启后拖拽内容卡片排序；它控制读者流程提示，不会改变桌面图标的视觉位置。</p>" },
        { title:"桌面图标顺序就是阅读顺序吗？", body:"<p>不是。桌面排列控制手机外观；设置 App 里的阅读节奏控制决定作者安排的浏览流程，两者可以不同。</p>" },
        { title:"为什么某个角色没有自己的 App 内容？", body:"<p>先确认联系人已建立，再检查角色接入配置。未设置角色专属内容时，读者会看到作品的通用内容或相应兼容状态。</p>" },
      ],
    })}
    ${tutorialGuide({
      category:"social",
      title:"建立角色并编排社交互动",
      outcome:"让同一角色在联系人、消息和论坛中使用正确身份，并为读者选择配置后续回复。",
      intro:"联系人是人物底座；别名、小号、论坛 NPC 和分界面头像是在不同场景中使用的身份层。",
      steps:[
        { title:"建立主号", body:"<p>先在联系人 App 填写姓名、备注、消息 ID 和论坛 ID。通用头像用于联系人名片，也是在消息头像或论坛头像留空时的兼容回退。</p>" },
        { title:"区分昵称与论坛小号", body:"<p>别名只是同一联系人的常用称呼；需要独立论坛名称、头像或 IP 属地时，点击「添加小号」。小号只用于论坛身份，不会自动成为新的聊天联系人。</p>" },
        { title:"分别设置可见身份", body:"<p>消息头像只出现在聊天，论坛头像只出现在帖子与评论。视频通话背景（旧称“固定脸”）用于视频通话画面，语音通话不会使用。</p>" },
        { title:"编写消息与论坛内容", body:"<p>联系人 App 定义人物，消息 App 编排聊天，论坛 App 编排帖子、评论和楼中楼。发帖或回复时选择主号、小号或论坛 NPC，不要只靠显示文字猜身份。</p>" },
        { title:"加入提及和读者续答", body:"<p>点击「@ 提及」选择角色，系统会插入纯文本名称并在预览中高亮。为读者选项添加多条角色后续回复时，可以逐条选择不同主号、小号或 NPC。</p>" },
        { title:"跨作品复用联系人", body:"<p>进入「写作习惯」，选中来源作品导出联系人包；再选择目标作品和文件，确认「合并到所选作品」。ID 冲突会自动换新，目标作品原有联系人不会被整库覆盖。</p>" },
      ],
      checklist:["主号、小号和 NPC 的用途没有混用", "消息头像与论坛头像在各自界面正确", "开启论坛 IP 后只有配置过的作者角色显示属地", "读者本人回复没有被伪造 IP"],
      faq:[
        { title:"我想让聊天和论坛显示不同头像", body:"<p><strong>入口：</strong>联系人 App → 编辑联系人 → 分别填写「消息头像」和「论坛头像」。通用头像仍用于联系人名片，并在专用头像留空时承担兼容回退。</p>" },
        { title:"我想让同一个人在论坛使用另一个账号", body:"<p><strong>入口：</strong>联系人 App → 编辑联系人 →「添加小号」。为小号填写独立论坛名称、头像和 IP；之后在发帖、评论或回复的身份选择器中选这个小号。</p>" },
        { title:"我想添加不属于联系人的论坛路人", body:"<p><strong>入口：</strong>论坛 App →「NPC」→ 新建。论坛 NPC 可以拥有名称、头像和 IP，适合一次性路人；如果人物还要参与聊天，应建立联系人而不是只建 NPC。</p>" },
        { title:"我想置顶联系人或自己调整联系人顺序", body:"<p><strong>入口：</strong>联系人编辑入口 → 排序设置。可选择置顶、A–Z 或自定义；自定义模式支持拖拽，也支持聚焦手柄后用键盘上下移动。</p>" },
        { title:"我想在群聊或论坛里 @ 某个角色", body:"<p><strong>入口：</strong>发消息、发帖、评论或回复的编辑框旁 →「@ 提及」→ 选择身份。系统插入的是纯文本 @名称，作者预览和读者端会负责高亮。</p>" },
        { title:"我想让读者回复后，多个角色依次接话", body:"<p><strong>入口：</strong>消息、动态评论或论坛评论的「回复选项」→ 添加读者选项 → 在后续回复区继续添加多条消息。每一条都能单独选择联系人主号、小号或论坛 NPC。</p>" },
        { title:"我想修改论坛评论时间、顺序或点赞数", body:"<p><strong>入口：</strong>论坛帖子详情。评论内容可进入编辑并修改显示时间；拖拽手柄或键盘上下键用于调整楼层顺序；点赞按钮进入作者设置数值。</p>" },
        { title:"我想显示论坛 IP 属地", body:"<p><strong>入口：</strong>先在联系人主号、小号或论坛 NPC 资料中填写 IP，再到论坛帖子列表顶部打开「IP」开关。开关默认关闭，读者本人回复不会被伪造 IP。</p>" },
        { title:"别名和小号有什么区别？", body:"<p>别名是同一联系人的昵称或称呼，不是第二个独立角色；小号是该联系人名下可单独选择的论坛身份，可以有自己的论坛 ID、头像和 IP 属地。</p>" },
        { title:"通用头像、消息头像与论坛头像", body:"<p>通用头像用于联系人名片并承担旧数据回退；消息头像只用于聊天；论坛头像只用于帖子和评论。留空时会沿用通用头像。</p>" },
        { title:"视频通话背景（旧称“固定脸”）", body:"<p>原“固定脸 URL”现在表示视频通话时的画面背景，不是头像或角色面部模型；语音通话不会使用。</p>" },
        { title:"IP 属地何时显示？", body:"<p>主号、小号和论坛 NPC 可以配置 IP 属地，但只有作者开启论坛 IP 显示后才呈现。读者本人发布的回复不会被伪造一个 IP。</p>" },
      ],
    })}
    ${tutorialGuide({
      category:"placeholders",
      title:"让读者填写并替换占位符",
      outcome:"定义一个读者姓名占位符，把它写入正文或消息，并验证导出后的替换结果。",
      intro:"占位符有两部分：作者写进内容的“标记”，以及读者开始阅读时看到的“问题”。两者必须对应。",
      steps:[
        { title:"打开占位符管理", body:"<p>互动文章可从编辑器的「占位符」进入；小手机可从设置 App 的「占位符管理」进入。可以添加单项，也可以先用 NAME 预设建立姓名、昵称和网名。</p>" },
        { title:"定义标记和问题", body:"<p>例如把正文标记设为“某某”，显示名称设为“姓名”，问题设为“你的名字？”。读者不会看到作者的全局习惯名称，只会看到作品内的问题。</p>" },
        { title:"选择替换方式", body:"<p>全文替换适合姓名；随机替换会从读者提供的值池中变化；场景锁定让同一场景保持同一个结果。先用最简单的全文替换跑通，再使用复杂模式。</p>" },
        { title:"把标记写进内容", body:"<p>在正文、消息或支持占位符的文本中输入完全相同的标记“某某”。多一个空格或换成别的写法都会被视为不同文字。</p>" },
        { title:"设置禁用词并预览", body:"<p>需要限制输入时填写禁用词。进入读者预览，输入一个允许值和一个禁用值，确认提示、替换范围和场景一致性。</p>" },
        { title:"保存为作者全局习惯", body:"<p>经常复用的配置可保存为“我的预设”，也可以在「写作习惯」统一编辑和导入导出。套用时会在当前作品创建独立副本，不会联动改写旧作品。</p>" },
      ],
      checklist:["正文标记与占位符 key 完全一致", "读者能理解问题文字", "禁用词有实际测试", "修改全局习惯不会改变已有作品"],
      faq:[
        { title:"我想把“新占位符”改成“外号”或其他名称", body:"<p><strong>入口：</strong>作品编辑器 →「占位符」→ 找到该项 → 修改「显示名称」。显示名称用于作者识别和读者提问展示，不会强制改变正文里已经使用的标记。</p>" },
        { title:"我想让读者输入一次姓名，全文都使用它", body:"<p><strong>入口：</strong>占位符管理 → 新增或编辑 → 替换方式选择「全文替换」。把正文标记设为一个明确词，例如“某某”，并在正文、消息等支持区域输入完全相同的标记。</p>" },
        { title:"我想让一个称呼随机变化", body:"<p><strong>入口：</strong>占位符管理 → 替换方式选择「随机替换」，再填写可用值。它适合变化称呼或网名；固定姓名通常更适合全文替换。</p>" },
        { title:"我想让同一场景里随机结果保持一致", body:"<p><strong>入口：</strong>占位符管理 → 选择「场景锁定」；再到各节点顶部设置场景。场景相同的节点共用结果，章节是否相同不会影响这条规则。</p>" },
        { title:"我想限制读者不能填写某些词", body:"<p><strong>入口：</strong>占位符编辑 →「禁用词」。使用逗号或换行分隔多个词；保存后应从读者预览实际输入一次禁用值，确认拦截提示符合预期。</p>" },
        { title:"我想把常用占位符带到另一篇作品", body:"<p><strong>入口：</strong>当前作品的占位符设置 → 保存为作者预设；或顶部「教程」→「写作习惯」→ 作者占位符习惯。套用时会创建作品内副本，之后修改某一篇作品不会连带修改其他作品。</p>" },
        { title:"为什么正文里的文字没有替换？", body:"<p>先检查标记是否完全一致，再确认占位符已经保存在当前作品中。全局习惯本身不会自动写入每篇作品，必须先套用或创建作品内副本。</p>" },
        { title:"导出作品会带走我的所有全局习惯吗？", body:"<p>不会。作品只携带该作品内部的占位符数据；作者的整套全局习惯仍只保存在当前浏览器的独立设置命名空间。</p>" },
      ],
    })}
    ${tutorialGuide({
      category:"files",
      title:"导出、导入与保护本地作品",
      outcome:"分清作品文件、联系人包、作者习惯和整库备份，并建立不会误删本地成果的保存习惯。",
      intro:"Tuuru 没有业务后端替你保存账号云端副本。不同文件承担不同任务，不能互相替代。",
      steps:[
        { title:"等本地保存完成", body:"<p>编辑后先观察保存状态。关闭标签页、清站点数据、使用隐私模式或切换域名与端口，都可能影响你能否再次看到本地作品。</p>" },
        { title:"导出单篇作品", body:"<p>在首页作品卡片的「更多」中选择「导出 JSON」或「导出 PNG」。两者携带同一篇作品的阅读语义；PNG 可以选择封面作为宿主图，更适合直接分享。</p>" },
        { title:"让读者导入测试", body:"<p>在读者端导入刚导出的 JSON 或 PNG，重新完成解锁、占位符填写、分支选择和小手机浏览。作者浏览器里的草稿不会自动出现在读者端。</p>" },
        { title:"备份整个创作库", body:"<p>首页的「备份全部」包含密码、私密内容、编辑设置和作者配置。使用「检查 / 恢复」可先查看备份摘要，再明确确认是否替换当前创作库。</p>" },
        { title:"按用途保存辅助文件", body:"<p>联系人包用于在作品之间合并人物；作者占位符习惯文件用于迁移全局模板。它们都不是完整作品，也不能代替整库备份。</p>" },
        { title:"建立版本习惯", body:"<p>重大修改前导出作品并备份全部，文件名保留日期。不要用清理 localStorage、IndexedDB 或浏览器站点数据来解决显示问题。</p>" },
      ],
      checklist:["读者端成功导入并走通作品", "作品文件与整库备份分别保存", "包含密码和私密内容的备份没有公开分享", "知道原作品所在的浏览器、域名和端口"],
      faq:[
        { title:"我想把单篇作品发给读者", body:"<p><strong>入口：</strong>创作端首页 → 作品卡片「更多」→ 导出 JSON 或 PNG。发给读者的是这份单篇作品文件，不是“备份全部”或“整机搬家”数据包。</p>" },
        { title:"我想换浏览器，并把作者端和读者端本地信息一起带走", body:"<p><strong>入口：</strong>创作端首页标题旁 →「整机搬家」→ 导出本地信息；在新浏览器打开同一网址后，再进入「整机搬家」选择文件、检查摘要并确认导入。导入采用合并方式，不要求清空新浏览器。</p>" },
        { title:"我只想备份自己的全部创作作品", body:"<p><strong>入口：</strong>创作端首页 →「备份全部」。这份文件用于保护作者创作库，可能包含私密内容和设置；它与给读者分享的单篇作品文件用途不同。</p>" },
        { title:"我想把联系人从一篇作品复制到另一篇", body:"<p><strong>入口：</strong>顶部「教程」→「写作习惯」→ 联系人跨作品使用。先选择来源作品导出联系人包，再选择目标作品和文件执行合并；聊天、论坛和其他作品内容不会被覆盖。</p>" },
        { title:"我想把作者占位符习惯带到另一台设备", body:"<p><strong>入口：</strong>顶部「教程」→「写作习惯」→ 作者占位符习惯 →「导出习惯」。新设备在同一区域导入；这只迁移作者模板，不会自动包含作品。</p>" },
        { title:"我导入时遇到相同 ID，会覆盖哪一边？", body:"<p>联系人包和整机搬家都按合并规则处理。同 ID 且内容不同的记录会为导入项生成新的 ID，并同步调整相关引用；不会用整库覆盖来解决冲突。</p>" },
        { title:"我想恢复以前的备份，应该先做什么？", body:"<p>先为当前浏览器再导出一份新备份，然后使用对应入口的「检查 / 恢复」阅读摘要。恢复创作库属于高影响操作；联系人包和整机搬家采用合并，不应拿清站点数据当作恢复步骤。</p>" },
        { title:"JSON 和 PNG 哪个内容更完整？", body:"<p>当前导出流程要求两者保持相同作品语义。JSON 便于识别和管理；PNG 更适合作为带封面的传播文件。重要作品仍建议两种都保留。</p>" },
        { title:"恢复备份会发生什么？", body:"<p>整库恢复是高影响操作，会在你确认后替换当前浏览器的创作库。先阅读检查结果，并另外备份当前库；联系人包导入则只合并到明确选择的作品。</p>" },
      ],
    })}
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
    forbidden: (row.querySelector("[data-field-forbidden]")?.value || "")
      .split(/[,，\n]/)
      .map(value => value.trim())
      .filter(Boolean),
  })).filter(field => field.key || field.label || field.prompt)
}

function bindContactTransfer(root) {
  const selector = root.querySelector("[data-contact-work]")
  const exportButton = root.querySelector("[data-contact-export]")
  const fileInput = root.querySelector("[data-contact-import-file]")
  const mergeButton = root.querySelector("[data-contact-merge]")
  const summary = root.querySelector("[data-contact-summary]")
  const status = root.querySelector("[data-contact-status]")
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
    const blob = new Blob([serializeContactBundle(contacts)], { type:"application/json;charset=utf-8" })
    downloadBlob(blob, `${safeFilename(work.title)}-联系人包.json`)
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
      if (status) status.textContent = `已读取“${file.name}”：${pendingBundle.contacts.length} 位联系人。请选择目标作品并确认合并。`
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
      const saved = saveAuthorPlaceholderPreset(name, fields)
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
  if (!sections.length || !navigation.length) return

  function showTutorial(category) {
    navigation.forEach(button => {
      const active = button.dataset.tutorialNav === category
      button.classList.toggle("active", active)
      if (active) button.setAttribute("aria-current", "page")
      else button.removeAttribute("aria-current")
    })
    sections.forEach(section => {
      const active = section.dataset.tutorialCategory === category
      section.hidden = !active
    })
  }

  navigation.forEach(button => {
    button.addEventListener("click", () => {
      showTutorial(button.dataset.tutorialNav || "start")
    })
  })
  showTutorial(navigation.find(button => button.classList.contains("active"))?.dataset.tutorialNav || "start")
}

export function bindResourcesPage() {
  const root = document.getElementById("resourcesRoot")
  if (!root || root.dataset.resourceBound === "true") return
  root.dataset.resourceBound = "true"
  bindContactTransfer(root)
  bindPlaceholderLibrary(root)
  bindTutorialDirectory(root)
}
