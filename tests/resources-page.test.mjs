import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const source = readFileSync(new URL("../js/pages/resources.js", import.meta.url), "utf8")
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")
const editorSource = readFileSync(new URL("../js/pages/editor.js", import.meta.url), "utf8")
const phoneSource = readFileSync(new URL("../js/pages/phone.js", import.meta.url), "utf8")
const phoneDataSource = readFileSync(new URL("../js/data.js", import.meta.url), "utf8")
const interactiveSource = readFileSync(new URL("../js/interactive-scene-editor.js", import.meta.url), "utf8")
const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")
const tutorialCopy = source.slice(
  source.indexOf("function renderLegacyTutorialPage"),
  source.indexOf("function renderTutorialFeature("),
)

test("the author shell exposes one compact writing-help entry and two resource routes", () => {
  assert.match(app, /class="app-resources-link\$\{/)
  assert.match(app, /aria-label="写作习惯与使用教程"/)
  assert.match(app, /href="#\/resources\/tutorial"/)
  assert.doesNotMatch(app, /app-resources-link-label/)
  assert.match(app, /router\("\/resources"/)
  assert.match(app, /router\("\/resources\/tutorial"/)
  assert.match(app, /app-header-resources/)
  assert.match(css, /\.app-resources-link\s*\{[^}]*min-height\s*:\s*44px/s)
  assert.doesNotMatch(css, /\.app-resources-link-label\s*\{[^}]*display\s*:\s*none/)
  assert.doesNotMatch(css, /\.app-header-resources\s+\.theme-wrap\s*,/)
  assert.doesNotMatch(css, /\.app-header-resources\s+\.app-header-actions>nav:not\(\.app-mode-switch\)\{display:none\}/)
  assert.doesNotMatch(css, /\.app-header:not\(\.app-header-editor\)\s+\.theme-wrap\{display:none\}/)
})

test("the writing-habits page keeps contact transfer explicit and placeholder presets global", () => {
  assert.match(source, /写作习惯/)
  assert.match(source, /使用教程/)
  assert.match(source, /data-contact-work/)
  assert.match(source, /合并到所选作品/)
  assert.match(source, /mergeContactBundle/)
  assert.match(source, /updateWork\(work\.id,\s*\{\s*phoneData:/s)
  assert.match(source, /readAuthorPlaceholderPresets/)
  assert.match(source, /saveAuthorPlaceholderPreset/)
  assert.match(source, /data-preset-global-forbidden/)
  assert.match(source, /globalForbidden:parseForbiddenWords/)
  assert.doesNotMatch(source, /updateWork\([^)]*placeholders/s)
})

test("the tutorial explains the social identities and author placeholders that are easy to confuse", () => {
  for (const term of ["别名", "小号", "消息头像", "论坛头像", "视频通话背景", "占位符", "IP 属地"]) {
    assert.match(source, new RegExp(term))
  }
  assert.match(source, /旧称“固定脸”/)
  assert.match(source, /语音通话不显示/)
  assert.match(source, /标记可自由命名/)
  assert.match(source, /读者本人[^。]*IP/)
})

test("the tutorial exposes a compact directory and one panel per complete route", () => {
  assert.match(source, /class="tutorial-layout"/)
  assert.match(source, /class="tutorial-directory"/)
  assert.match(source, /class="tutorial-content"/)
  assert.match(source, /data-tutorial-search/)
  assert.doesNotMatch(source, /data-tutorial-filter/)
  assert.doesNotMatch(source, /共 6 个教程版块/)
  for (const category of ["start", "article", "phone", "social", "placeholders", "files"]) {
    assert.match(source, new RegExp(`data-tutorial-nav="${category}"`))
    assert.match(source, new RegExp(`category:"${category}"`))
  }
})

test("the tutorial lists features by meaning, location, use, and effect", () => {
  for (const heading of [
    "作品与书架",
    "互动文章",
    "小手机",
    "人物社交",
    "占位符",
    "文件与备份",
  ]) assert.match(source, new RegExp(heading))
  for (const label of ["是什么", "在哪里", "怎么用", "使用效果"]) assert.match(source, new RegExp(`<dt>${label}</dt>`))
  assert.match(source, /data-tutorial-feature/)
  assert.match(source, /data-tutorial-search/)
  assert.match(source, /输入功能、位置或问题/)
  assert.doesNotMatch(source, /data-tutorial-search-clear/)
  assert.match(source, /剧情选项/)
  assert.match(source, /阅读节奏控制/)
  assert.match(source, /读者剧情桌面组件/)
  assert.match(source, /同一种内容可以自由换外观/)
  assert.match(source, /论坛小号/)
  assert.match(source, /作者占位符预设/)
  assert.match(source, /SVG 骰子图标【小游戏】/)
  assert.match(source, /【互动页】右边/)
  assert.match(source, /手机模块分割线左边/)
  assert.match(source, /手机端点【插入】，再点【小游戏】/)
  assert.match(source, /掷骰判定、随机数或对抗骰/)
  assert.match(source, /点数、结果和剧情路线会保存在当前阅读档案中/)
  assert.match(source, /创建作品集/)
  assert.match(source, /整机搬家/)
  assert.match(source, /作品排序与置顶/)
  assert.match(source, /每张文章手机卡片只对应一个 App/)
  assert.match(source, /填写联系人包名称/)
  assert.match(source, /为 NPC 包命名/)
  assert.match(source, /导入只追加/)
})

test("the article feature list distinguishes scene tags from chapters", () => {
  assert.match(source, /章节决定读者翻到哪一页/)
  assert.match(source, /场景锁定/)
  assert.match(source, /编辑器顶部的“场景：…”下拉框/)
  assert.match(source, /普通写作选【不使用场景】/)
})

test("the tutorial fully explains paragraph nodes, ordinary responses, and hidden conditions", () => {
  for (const phrase of [
    "章节是读者翻阅的一页",
    "同章普通节点按当前路线合并",
    "选项文本",
    "选择后内容",
    "每一行都会按独立正文段落显示",
    "同一节点可以放多组",
    "移动状态",
    "待放置提示",
    "剧情分支始终固定在节点正文末尾",
    "每组单独记录选择",
    "才会继续看到它后面的正文、下一组互动或后续场景",
    "普通互动全部完成后，末尾剧情分支才会出现",
    "普通互动标题、选项文本、选择后内容和末尾剧情分支文字都支持当前作品的占位符",
    "普通互动和末尾剧情分支可以同时存在",
    "选择【阅读前集中填写】时",
    "选择【文中填写】时",
    "插入正文光标处",
    "读者保存当前答案后才会看到后面的正文和节点",
    "答案同时保存在当前阅读档案中",
    "移动到其他节点",
    "复制到其他节点",
    "模块会完整保留",
    "只在当前浏览器内完成",
    "同一组中的选项按【或】判断",
    "不同组按【且】判断",
    "稳定 ID",
    "条件已失效",
    "隐藏节点会在拖动后的结构位置插入",
    "右侧【节点列表】",
    "目标章节名称",
    "展开【＋、隐、◎、✎、×】",
    "编辑器顶部的场景下拉框",
    "点“＋ 新建场景…”",
    "按住节点左边的“⠿”拖动",
  ]) assert.match(source, new RegExp(phrase))
  assert.match(source, /故事总纲、章节规划、伏笔回收、世界规则、地点与组织、人物档案、人物关系和灵感碎片/)
  assert.match(source, /顶部搜索框可搜索分类和内容/)
  assert.match(source, /作者正文颜色[\s\S]*不随作品导出/)
  assert.match(source, /导出中心[\s\S]*不保存作品文件，也不会上传作品内容/)
  assert.match(source, /发送 \.tuuru[\s\S]*下载 \.tuuru[\s\S]*生成加密 PNG/)
})

test("tutorial entries use visible click-by-click controls without internal shorthand", () => {
  for (const phrase of [
    "右侧【节点列表】",
    "目标章节名称",
    "这一行右侧【…】",
    "展开【＋、隐、◎、✎、×】",
  ]) {
    assert.match(tutorialCopy, new RegExp(phrase))
  }
  assert.doesNotMatch(tutorialCopy, /作品结构|章节操作|上移、下移/)
  assert.doesNotMatch(tutorialCopy, /点添加按钮|进入设置页|节点菜单|章节树|等控件/)
  assert.doesNotMatch(tutorialCopy, /不是[^。；\n]{0,100}而是|并非[^。；\n]{0,100}而是/)
  assert.doesNotMatch(tutorialCopy, /→/)
})

test("critical tutorial button names are backed by the shipped interface", () => {
  for (const label of [
    "节点列表",
    "在本章添加隐藏节点",
    "在本章添加互动页",
    "在正文中插入普通互动",
    "编辑末尾剧情分支",
    "选择目标节点",
    "放到光标处",
    "显示条件",
    "编辑互动页",
    "移至…",
  ]) {
    assert.match(editorSource, new RegExp(label))
  }
  assert.match(source, /【节点列表】/)
  assert.match(source, /【＋、隐、◎、✎、×】/)
  assert.match(source, /【◇】/)
  assert.match(source, /【⇄】/)
  assert.match(source, /【选择目标节点】/)
  assert.match(source, /【放到光标处】/)
  assert.match(source, /【显示条件】/)
  assert.match(source, /【编辑互动页】/)
  assert.match(source, /【移至…】/)
  for (const label of [
    "排列 App",
    "保存并编辑内容",
    "新建群聊",
    "对话操作",
    "结束此轮",
  ]) {
    assert.match(phoneSource, new RegExp(label))
  }
  assert.match(source, /【排列】/)
  assert.match(phoneDataSource, /浏览器/)
  assert.match(source, /【浏览器】|【插入浏览器模块】/)
  assert.match(interactiveSource, /后续跳转至（必选）/)
  assert.match(source, /后续跳转至（必选）/)
  assert.match(readerSource, /导出美化包/)
  assert.match(readerSource, /导入美化包/)
  assert.match(source, /导出美化包/)
  assert.doesNotMatch(tutorialCopy, /【美化】|APP 图标与名称|浏览记录图标/)
})

test("the tutorial documents reader appearance package privacy in the existing file section", () => {
  assert.match(source, /读者美化包/)
  assert.match(source, /个人主页顶部图/)
  assert.match(source, /昵称、头像、读者 ID、阅读记录和作品内容不会写入美化包/)
})

test("the tutorial gives interactive pictures a complete searchable section", () => {
  assert.match(source, /id:"interactive", title:"互动图片"/)
  for (const feature of [
    "创建独立互动页",
    "管理多个画面",
    "背景图与立绘",
    "移动和缩放画面",
    "矩形、椭圆与手绘热区",
    "六种触发方式",
    "摄像头靠近互动",
    "热区动作帧",
    "动作帧播放与返回",
    "说话人、台词与占位符",
    "对话框与触摸提示美化",
    "素材体积与保存",
    "读者端逐页验收",
  ]) assert.match(source, new RegExp(feature))
  for (const detail of [
    "探索完当前画面的全部互动点",
    "点击对话框进入下一画面",
    "靠近后点击",
    "靠近后长按",
    "静态图",
    "GIF",
    "视频",
    "0\\.3",
    "30 秒",
    "首轮",
    "HTTPS 图床",
    "不会替换图片链接",
  ]) assert.match(source, new RegExp(detail))
})

test("interactive-picture guidance documents page splitting, final continuation, and branch placement", () => {
  assert.match(source, /互动图片前正文页、互动图片页、后续普通节点开始的正文页/)
  assert.match(source, /最后一个画面/)
  assert.match(source, /后续普通节点/)
  assert.match(source, /互动图片内不能添加剧情分支/)
  assert.match(source, /选项组.*后续普通节点/)
  assert.match(source, /后续跳转至/)
  assert.match(source, /稳定节点 ID/)
  assert.match(source, /严格进入作者选择的节点/)
})

test("shipped tutorial copy uses neutral route terms", () => {
  assert.doesNotMatch(source, /父节点|兄弟节点/)
  assert.match(source, /并行节点/)
})

test("the tutorial explains article message contact visibility without reviving step movement", () => {
  assert.match(source, /本模块可见/)
  assert.match(source, /消息.*联系人/s)
  assert.match(source, /后来新增的联系人/)
  assert.match(source, /只影响当前.*消息卡片/s)
  assert.doesNotMatch(source, /上移一位|下移一位/)
})

test("the phone feature list covers apps, conversations, calls, forums, and reading flow", () => {
  for (const feature of [
    "App 排列", "单聊与群聊", "外部链接卡片", "作品内论坛链接", "红包、转账与亲属卡",
    "外卖卡片", "消息编辑菜单", "消息多选与转发", "会话置顶与排序", "消息回复选项", "聊天轮次", "语音与视频通话",
    "动态", "论坛", "楼中楼回复关系", "备忘录", "相册", "浏览记录", "购物", "角色接入", "阅读节奏控制",
  ]) {
    assert.match(source, new RegExp(feature))
  }
})

test("the message tutorial explains the distilled composer and multi-select forwarding", () => {
  assert.match(source, /选中系统时会生成居中的系统提示/)
  assert.match(source, /右键或长按下一条消息.*在前插入时间/s)
  assert.match(source, /长按任意消息.*右键消息.*多选/s)
  assert.match(source, /不需要手填聊天记录/)
  assert.match(source, /长按消息；电脑右键消息.*撤回.*发送失败/s)
  assert.match(source, /发送失败时[^。]*先看到消息发出[^。]*迅速消失/)
  assert.match(source, /撤回时[^。]*可点开查看原文的系统提示/)
})

test("the shopping tutorial explains how to edit an existing product card", () => {
  assert.match(source, /手机或 iPad 长按商品卡片/)
  assert.match(source, /电脑右键商品卡片/)
  assert.match(source, /购物车和订单里的已有商品都可以重新修改/)
  assert.match(source, /包括显示时间/)
})

test("the forum tutorial explains the current comment controls and reader reply branches", () => {
  for (const feature of [
    "评论操作菜单",
    "评论点赞数",
    "评论显示时间",
    "评论与楼中楼排序",
    "论坛读者回复选项",
    "论坛角色后续回复",
  ]) {
    assert.match(source, new RegExp(feature))
  }
  assert.match(source, /轻点目标评论或楼中楼/)
  assert.match(source, /评论或楼中楼右侧的 ×/)
  assert.match(source, /爱心和数字/)
  assert.match(source, /点时间戳[^。]*隐藏时间/)
  assert.match(source, /手机或 iPad 长按[^。]*电脑按住鼠标/)
  assert.match(source, /一级评论会带着全部楼中楼移动/)
  assert.match(source, /楼中楼只在当前同级回复中移动/)
  assert.match(source, /Alt \+ ↑\/↓/)
  assert.match(source, /回复人选择器中点【读者】/)
  assert.match(source, /已设置的选项会显示在评论下方[^。]*再次编辑/)
  assert.match(source, /逐条选择联系人、小号或 NPC/)
})

test("the placeholder feature list covers global words, search, and cleanup", () => {
  for (const feature of ["单项违禁词", "全局违禁词", "搜索与整理词库"]) {
    assert.match(source, new RegExp(feature))
  }
  assert.match(source, /整理全部词库/)
  assert.match(source, /换行、逗号、顿号、分号、斜杠或竖线/)
})

test("every tutorial category keeps a searchable FAQ", () => {
  assert.match(source, /<h3>答疑<\/h3>/)
  assert.match(source, /data-tutorial-faq/)
  for (const question of [
    "删除作品集会删除原作品吗",
    "选项点击后没有跳转怎么办",
    "为什么点击对话框还不能进入下一画面",
    "靠近后点击或靠近后长按没有触发怎么办",
    "动作帧播放结束后会发生什么",
    "本地图片太大导致保存失败怎么办",
    "链接怎样打开作品里的论坛帖子",
    "外卖卡片点击后会去哪里",
    "为什么没有看到论坛回复选项",
    "论坛评论和楼中楼怎样排序",
    "论坛评论时间怎样修改或隐藏",
    "@ 提及没有高亮怎么办",
    "随机结果怎样在几个节点中保持一致",
    "完整备份适合发给读者吗",
  ]) assert.match(source, new RegExp(question))
})

test("the final tutorial tab centers the support copy and image", async t => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url:"https://tuuru.local/#/resources/tutorial" })
  const previous = { window:globalThis.window, document:globalThis.document, location:globalThis.location, localStorage:globalThis.localStorage }
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.location = dom.window.location
  globalThis.localStorage = dom.window.localStorage
  t.after(() => {
    globalThis.window = previous.window
    globalThis.document = previous.document
    globalThis.location = previous.location
    globalThis.localStorage = previous.localStorage
    dom.window.close()
  })
  const page = await import(`../js/pages/resources.js?support-tab=${Date.now()}`)
  document.body.innerHTML = page.renderResourcesPage({ initialTab:"tutorial" })
  page.bindResourcesPage()

  const tabs = Array.from(document.querySelectorAll("[data-tutorial-nav]"))
  assert.equal(tabs.at(-1)?.dataset.tutorialNav, "support")
  assert.equal(tabs.at(-1)?.textContent, "打赏")
  tabs.at(-1).click()
  assert.equal(document.querySelector('[data-tutorial-category="support"]').hidden, false)
  assert.equal(document.querySelector(".tutorial-support-ears").textContent, "(\\⑅(\\")
  assert.equal(document.querySelector(".tutorial-support-ears").parentElement.className, "tutorial-support-mascot")
  assert.equal(document.querySelector(".tutorial-support-face").parentElement.className, "tutorial-support-mascot")
  assert.match(document.querySelector(".tutorial-support-copy").textContent, /感谢投喂，助力站长继续开发/)
  assert.match(document.querySelector(".tutorial-support-face").textContent, /໒꒰ྀི˶´˘`˵꒱ྀི১/)
  assert.match(document.querySelector(".tutorial-support img").getAttribute("src"), /zsm\.png$/)
  assert.match(css, /\.tutorial-support-copy\s*\{[^}]*display\s*:\s*inline-flex[^}]*font-weight\s*:\s*700/s)
  assert.match(css, /\.tutorial-support-mascot\s*\{[^}]*align-items\s*:\s*center[^}]*flex-direction\s*:\s*column/s)
  assert.match(css, /\.tutorial-support img\s*\{[^}]*width\s*:\s*min\(100%,520px\)[^}]*object-fit\s*:\s*contain/s)
})

test("tutorial directory switches the visible guide without a page reload", async t => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url:"https://tuuru.local/#/resources/tutorial" })
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    location: globalThis.location,
    localStorage: globalThis.localStorage,
  }
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.location = dom.window.location
  globalThis.localStorage = dom.window.localStorage
  t.after(() => {
    globalThis.window = previous.window
    globalThis.document = previous.document
    globalThis.location = previous.location
    globalThis.localStorage = previous.localStorage
    dom.window.close()
  })

  const page = await import(`../js/pages/resources.js?tutorial-directory=${Date.now()}`)
  document.body.innerHTML = page.renderResourcesPage({ initialTab:"tutorial" })
  page.bindResourcesPage()

  assert.ok(document.querySelector('[data-tutorial-nav="interactive"]'))
  assert.equal(document.querySelector('[data-tutorial-category="start"]').hidden, false)
  assert.equal(document.querySelector('[data-tutorial-category="social"]').hidden, true)
  document.querySelector('[data-tutorial-nav="article"]').click()
  assert.equal(document.querySelector('[data-tutorial-category="start"]').hidden, true)
  assert.equal(document.querySelector('[data-tutorial-category="article"]').hidden, false)
  assert.equal(document.querySelector('[data-tutorial-nav="article"]').getAttribute("aria-current"), "page")
  assert.equal(document.querySelector('[data-tutorial-nav="start"]').hasAttribute("aria-current"), false)

  const search = document.querySelector('[data-tutorial-search]')
  search.value = "视频通话背景"
  search.dispatchEvent(new window.Event("input", { bubbles:true }))
  const visibleFeatures = Array.from(document.querySelectorAll('[data-tutorial-feature]')).filter(feature => !feature.hidden)
  assert.equal(visibleFeatures.length, 1)
  assert.match(visibleFeatures[0].textContent, /视频通话背景/)
  assert.equal(document.querySelector('[data-tutorial-search-status]').textContent, "找到 1 项结果")
  assert.equal(document.querySelector('[data-tutorial-category="social"]').hidden, false)

  search.value = "链接怎样打开作品里的论坛帖子"
  search.dispatchEvent(new window.Event("input", { bubbles:true }))
  const visibleFaqs = Array.from(document.querySelectorAll('[data-tutorial-faq]')).filter(item => !item.hidden)
  assert.equal(visibleFaqs.length, 1)
  assert.equal(visibleFaqs[0].open, true)
  assert.equal(document.querySelector('[data-tutorial-category="phone"]').hidden, false)

  search.value = ""
  search.dispatchEvent(new window.Event("input", { bubbles:true }))
  assert.equal(document.querySelector('[data-tutorial-category="article"]').hidden, false)
  assert.equal(document.querySelector('[data-tutorial-category="phone"]').hidden, true)
  assert.equal(document.querySelector('[data-tutorial-search-status]').textContent, "")
})

test("the rendered feature manual avoids task framing and contrast formulas", async t => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url:"https://tuuru.local/#/resources/tutorial" })
  const previous = { window:globalThis.window, document:globalThis.document, location:globalThis.location, localStorage:globalThis.localStorage }
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.location = dom.window.location
  globalThis.localStorage = dom.window.localStorage
  t.after(() => {
    globalThis.window = previous.window
    globalThis.document = previous.document
    globalThis.location = previous.location
    globalThis.localStorage = previous.localStorage
    dom.window.close()
  })
  const page = await import(`../js/pages/resources.js?feature-manual=${Date.now()}`)
  document.body.innerHTML = page.renderResourcesPage({ initialTab:"tutorial" })
  const text = document.body.textContent
  assert.doesNotMatch(text, /你会完成|本节目标|完成后检查|我想要……该怎么做/)
  assert.doesNotMatch(text, /不是[^。；]*而是|不等于/)
})

test("the resources layout reflows form rows and keeps readable tutorial prose on phones", () => {
  assert.match(css, /\.resources-page\s*\{[^}]*max-width\s*:/s)
  assert.match(css, /\.resource-prose\s*\{[^}]*max-width\s*:\s*75ch/s)
  assert.match(css, /\.tutorial-layout\s*\{[^}]*grid-template-columns\s*:\s*190px\s+minmax\(0,1fr\)/s)
  assert.match(css, /@media\s*\(max-width:\s*700px\)[\s\S]*\.tutorial-directory\s*\{[^}]*overflow-x\s*:\s*auto/s)
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.preset-field-row\s*\{[^}]*grid-template-columns\s*:\s*1fr/)
  assert.match(css, /\.resource-status\s*\{[^}]*overflow-wrap\s*:\s*anywhere/s)
})
