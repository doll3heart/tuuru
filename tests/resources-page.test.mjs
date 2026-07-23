import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const source = readFileSync(new URL("../js/pages/resources.js", import.meta.url), "utf8")
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8")

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
  assert.doesNotMatch(source, /updateWork\([^)]*placeholders/s)
})

test("the tutorial explains the social identities and author placeholders that are easy to confuse", () => {
  for (const term of ["别名", "小号", "消息头像", "论坛头像", "视频通话背景", "占位符", "IP 属地"]) {
    assert.match(source, new RegExp(term))
  }
  assert.match(source, /旧称“固定脸”/)
  assert.match(source, /语音通话不会使用/)
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
  assert.match(source, /论坛小号/)
  assert.match(source, /作者占位符预设/)
  assert.match(source, /创建作品集/)
  assert.match(source, /整机搬家/)
})

test("the article feature list distinguishes scene tags from chapters", () => {
  assert.match(source, /章节组织阅读路线/)
  assert.match(source, /场景锁定/)
  assert.match(source, /节点标题旁的场景选择器/)
})

test("the phone feature list covers apps, conversations, calls, forums, and reading flow", () => {
  for (const feature of [
    "App 管理", "单聊与群聊", "外部链接卡片", "作品内论坛链接", "红包、转账与亲属卡",
    "外卖卡片", "消息编辑菜单", "消息回复选项", "聊天轮次", "语音与视频通话",
    "动态", "论坛", "备忘录", "相册", "浏览记录", "购物", "角色接入", "阅读节奏控制",
  ]) {
    assert.match(source, new RegExp(feature))
  }
})

test("every tutorial category keeps a searchable FAQ", () => {
  assert.match(source, /<h3>答疑<\/h3>/)
  assert.match(source, /data-tutorial-faq/)
  for (const question of [
    "删除作品集会删除原作品吗",
    "选项点击后没有跳转怎么办",
    "链接怎样打开作品里的论坛帖子",
    "外卖卡片点击后会去哪里",
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
  assert.match(document.querySelector(".tutorial-support-copy").textContent, /支持任意打赏支持站长后续开发/)
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
