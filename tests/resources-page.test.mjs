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
  assert.match(app, /app-resources-link-label">教程</)
  assert.match(app, /router\("\/resources"/)
  assert.match(app, /router\("\/resources\/tutorial"/)
  assert.match(app, /app-header-resources/)
  assert.match(css, /\.app-resources-link\s*\{[^}]*min-height\s*:\s*44px/s)
  assert.doesNotMatch(css, /\.app-resources-link-label\s*\{[^}]*display\s*:\s*none/)
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.app-header-resources\s+\.theme-wrap/)
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.app-header-resources\s+\.logo\s+span/)
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
  for (const term of ["别名", "小号", "消息头像", "论坛头像", "视频通话背景", "占位符", "@ 提及", "IP 属地"]) {
    assert.match(source, new RegExp(term))
  }
  assert.match(source, /旧称“固定脸”/)
  assert.match(source, /语音通话不会使用/)
  assert.match(source, /纯文本/)
  assert.match(source, /读者本人[^。]*IP/)
})

test("the tutorial exposes a compact directory and one panel per complete route", () => {
  assert.match(source, /class="tutorial-layout"/)
  assert.match(source, /class="tutorial-directory"/)
  assert.match(source, /class="tutorial-content"/)
  assert.doesNotMatch(source, /data-tutorial-search/)
  assert.doesNotMatch(source, /data-tutorial-filter/)
  assert.doesNotMatch(source, /共 6 个教程版块/)
  for (const category of ["start", "article", "phone", "social", "placeholders", "files"]) {
    assert.match(source, new RegExp(`data-tutorial-nav="${category}"`))
    assert.match(source, new RegExp(`category:"${category}"`))
  }
})

test("the tutorial explains routes by the effect a user wants", () => {
  for (const heading of [
    "第一次使用：从新建到交给读者",
    "制作一篇有分支的互动文章",
    "制作一部可阅读的小手机",
    "建立角色并编排社交互动",
    "让读者填写并替换占位符",
    "导出、导入与保护本地作品",
  ]) assert.match(source, new RegExp(heading))
  assert.match(source, /class="tutorial-steps"/)
  assert.match(source, /你会完成/)
  assert.match(source, /完成后检查/)
  assert.match(source, /我想要……该怎么做？/)
  assert.doesNotMatch(source, /跟做练习|tutorial-practice|完成标志/)
  assert.match(source, /首页[^。]*新建[^。]*互动文章/)
  assert.match(source, /添加章节[^。]*添加节点/)
  assert.match(source, /联系人 App[^。]*消息 App[^。]*论坛 App/)
  assert.match(source, /导出 JSON[^。]*导出 PNG/)
  assert.match(source, /我想让两个选择走向不同结局/)
  assert.match(source, /我想让论坛主楼分段，或者发布后再修改/)
  assert.match(source, /我想换浏览器，并把作者端和读者端本地信息一起带走/)
  assert.match(source, /<strong>入口：<\/strong>/)
})

test("the article tutorial distinguishes scene tags from chapters with an actionable route", () => {
  assert.match(source, /分清“场景”和“第一章”/)
  assert.match(source, /作品结构 → 第一章/)
  assert.match(source, /场景锁定/)
  assert.match(source, /章节组织阅读结构/)
  assert.match(source, /场景相同也不表示节点必须在同一章/)
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
})

test("the resources layout reflows form rows and keeps readable tutorial prose on phones", () => {
  assert.match(css, /\.resources-page\s*\{[^}]*max-width\s*:/s)
  assert.match(css, /\.resource-prose\s*\{[^}]*max-width\s*:\s*75ch/s)
  assert.match(css, /\.tutorial-layout\s*\{[^}]*grid-template-columns\s*:\s*190px\s+minmax\(0,1fr\)/s)
  assert.match(css, /@media\s*\(max-width:\s*700px\)[\s\S]*\.tutorial-directory\s*\{[^}]*overflow-x\s*:\s*auto/s)
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.preset-field-row\s*\{[^}]*grid-template-columns\s*:\s*1fr/)
  assert.match(css, /\.resource-status\s*\{[^}]*overflow-wrap\s*:\s*anywhere/s)
})
