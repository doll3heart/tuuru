import test from "node:test"
import assert from "node:assert/strict"

import { inspectWorkBeforePublish } from "../js/work-preflight.js"

test("a complete article passes without findings", () => {
  const report = inspectWorkBeforePublish({
    id:"article-ok",
    type:"article",
    title:"完整文章",
    startNode:"start",
    placeholders:[{ id:"placeholder-1", key:"读者", label:"姓名" }],
    nodes:[
      {
        id:"start",
        title:"开始",
        content:"<p>正文</p>",
        choices:[
          { id:"interaction", text:"点头", mode:"interaction", targetId:"" },
          { id:"continue", text:"继续", targetId:"ending" },
        ],
      },
      { id:"ending", title:"结尾", content:"<p>结束</p>", choices:[] },
    ],
    phoneModules:[],
  })

  assert.deepEqual(report.counts, { error:0, warning:0 })
  assert.deepEqual(report.issues, [])
})

test("article inspection accepts a complete random game and rejects a dangling outcome target", () => {
  const work = {
    id:"article-game",
    type:"article",
    title:"小游戏文章",
    startNode:"start",
    placeholders:[], phoneModules:[],
    nodes:[
      {
        id:"start", title:"开始",
        content:'<p>正文</p><div class="article-interaction-anchor" data-article-interaction-group="game-a" contenteditable="false"></div>',
        choices:[],
        interactionGroups:[{
          id:"game-a", kind:"random-game", label:"命运骰",
          game:{type:"dice", sides:6, buttonLabel:"掷骰子"},
          choices:[
            {id:"low", text:"低点数", selectedText:"低", targetId:"low-node", rangeMin:1, rangeMax:3},
            {id:"high", text:"高点数", selectedText:"高", targetId:"high-node", rangeMin:4, rangeMax:6},
          ],
        }],
      },
      {id:"low-node", title:"低", content:"<p>低</p>", choices:[], interactionGroups:[]},
      {id:"high-node", title:"高", content:"<p>高</p>", choices:[], interactionGroups:[]},
    ],
  }
  assert.deepEqual(inspectWorkBeforePublish(work).counts, {error:0, warning:0})
  work.nodes[0].interactionGroups[0].choices[1].targetId = "missing"
  const report = inspectWorkBeforePublish(work)
  assert.ok(report.issues.some(issue => issue.code === "article-random-game-target-invalid"))
})

test("article inspection derives its start and reports blank nodes and broken branches", () => {
  const report = inspectWorkBeforePublish({
    id:"article-broken",
    type:"article",
    title:"",
    startNode:"missing",
    placeholders:[
      { id:"placeholder-1", key:"读者", label:"姓名" },
      { id:"placeholder-2", key:"读者", label:"昵称" },
      { id:"placeholder-3", key:"", label:"空标记" },
    ],
    nodes:[{
      id:"start",
      title:"",
      content:"",
      choices:[
        { id:"empty-label", text:"", targetId:"start" },
        { id:"missing-target", text:"继续", targetId:"gone" },
        { id:"interaction", text:"停留", mode:"interaction", targetId:"" },
      ],
    }],
    phoneModules:[{ id:"module-1", nodeId:"gone", type:"memo" }],
  })

  assert.deepEqual(report.counts, { error:4, warning:3 })
  assert.deepEqual(
    report.issues.map(issue => issue.code),
    [
      "work-title-empty",
      "placeholder-key-duplicate",
      "placeholder-key-empty",
      "article-node-title-empty",
      "article-choice-text-empty",
      "article-choice-target-missing",
      "article-phone-module-node-missing",
    ],
  )
  assert.ok(report.issues.every(issue => issue.title && issue.location && issue.action))
  assert.equal(report.issues.find(issue => issue.code === "work-title-empty").locator.surface, "work-info")
  assert.deepEqual(
    report.issues.find(issue => issue.code === "article-choice-target-missing").locator,
    {surface:"article", nodeId:"start"},
  )
})

test("phone inspection reports broken people, links, flow steps, and hidden App content", () => {
  const report = inspectWorkBeforePublish({
    id:"phone-broken",
    type:"phone",
    title:"测试小手机",
    placeholders:[],
    phoneData:{
      contacts:[{ id:"contact-1", name:"林澈" }],
      apps:[
        { id:"messages-app", type:"messages", enabled:false },
        { id:"forum-app", type:"forum", enabled:true },
      ],
      chats:[{
        id:"chat-1",
        type:"single",
        contactIds:["missing-contact"],
        messages:[
          { id:"link-post", type:"link", senderId:"contact-1", linkTitle:"站内帖子", forumPostId:"missing-post" },
          { id:"link-script", type:"link", senderId:"contact-1", linkTitle:"危险链接", linkUrl:"javascript:alert(1)" },
        ],
        rounds:[],
      }],
      moments:[],
      forumPosts:[],
      forumNpcs:[],
      memos:[],
      photos:[],
      albums:[],
      browserHistory:[],
      shoppingItems:[],
      readingFlow:{
        enabled:true,
        sequence:[{ type:"messages", chatId:"chat-1", itemId:"missing-message", label:"已删除消息" }],
      },
    },
  })

  assert.deepEqual(report.counts, { error:3, warning:2 })
  assert.deepEqual(
    report.issues.map(issue => issue.code),
    [
      "phone-chat-contact-missing",
      "phone-forum-link-missing",
      "phone-external-link-invalid",
      "phone-reading-flow-target-missing",
      "phone-hidden-app-has-content",
    ],
  )
  assert.ok(report.issues.every(issue => issue.locator?.surface === "phone"))
  assert.equal(
    report.issues.find(issue => issue.code === "phone-forum-link-missing").locator.appType,
    "messages",
  )
})

test("missing type-specific content fails closed without throwing", () => {
  const article = inspectWorkBeforePublish({ type:"article", title:"空文章" })
  const phone = inspectWorkBeforePublish({ type:"phone", title:"空手机" })

  assert.deepEqual(article.issues.map(issue => issue.code), ["article-nodes-empty"])
  assert.deepEqual(phone.issues.map(issue => issue.code), ["phone-data-missing"])
})

test("Mini picture choices must have visible text and a valid different target", () => {
  const report = inspectWorkBeforePublish({
    id:"mini-choice",
    type:"article",
    experienceMode:"interactive",
    title:"分岔",
    placeholders:[],
    interactiveScenes:[{
      id:"scene-1",
      stages:[
        {
          id:"stage-1",
          image:"https://example.test/one.jpg",
          choices:[
            { id:"empty", label:"", targetStageId:"stage-2" },
            { id:"missing", label:"离开", targetStageId:"gone" },
          ],
        },
        { id:"stage-2", image:"https://example.test/two.jpg", choices:[] },
      ],
    }],
  })

  assert.deepEqual(
    report.issues.filter(issue => issue.code.startsWith("interactive-experience-choice-")).map(issue => issue.code),
    ["interactive-experience-choice-label-empty", "interactive-experience-choice-target-invalid"],
  )
})

test("an article also inspects its embedded phone data and image sources", () => {
  const report = inspectWorkBeforePublish({
    id:"article-with-phone",
    type:"article",
    title:"带小手机的文章",
    startNode:"start",
    nodes:[{ id:"start", title:"开始", content:"正文", choices:[] }],
    placeholders:[],
    phoneModules:[],
    phoneData:{
      contacts:[{ id:"contact-1", name:"林澈" }],
      apps:[],
      chats:[{
        id:"chat-1",
        type:"single",
        contactIds:["contact-1"],
        rounds:[{
          id:"round-1",
          messages:[
            { id:"empty-image", type:"image", senderId:"contact-1", image:"" },
            { id:"empty-link", type:"link", senderId:"contact-1", linkUrl:"" },
          ],
        }],
      }],
      moments:[{ id:"moment-1", contactId:"contact-1", images:["not-a-url"] }],
      forumPosts:[],
      memos:[],
      photos:[],
      albums:[],
      browserHistory:[],
      shoppingItems:[],
    },
  })

  assert.deepEqual(report.counts, { error:2, warning:1 })
  assert.deepEqual(
    report.issues.map(issue => issue.code),
    [
      "phone-image-message-empty",
      "phone-link-target-missing",
      "phone-image-url-invalid",
    ],
  )
})

test("article inspection blocks missing and invalid interactive-picture continuation targets", () => {
  const base = {
    id:"article-scenes",
    type:"article",
    title:"互动图片出口",
    startNode:"start",
    placeholders:[],
    phoneModules:[],
    nodes:[
      { id:"start", title:"开始", content:"正文", choices:[{ id:"to-scene", text:"进入", targetId:"scene-node" }] },
      { id:"scene-node", title:"互动图片", content:"", choices:[], kind:"interactive-scene", interactiveSceneId:"scene-1" },
      { id:"hidden", title:"隐藏内容", content:"隐藏", choices:[], kind:"conditional" },
      { id:"ending", title:"结束", content:"结束", choices:[] },
    ],
  }

  const missing = inspectWorkBeforePublish({
    ...base,
    interactiveScenes:[{ id:"scene-1", nodeId:"scene-node", nextNodeId:"", stages:[{ id:"stage-1", hotspots:[] }] }],
  })
  assert.ok(missing.issues.some(issue => issue.code === "interactive-scene-next-node-missing"))

  for (const nextNodeId of ["gone", "hidden", "scene-node"]) {
    const invalid = inspectWorkBeforePublish({
      ...base,
      interactiveScenes:[{ id:"scene-1", nodeId:"scene-node", nextNodeId, stages:[{ id:"stage-1", hotspots:[] }] }],
    })
    assert.ok(
      invalid.issues.some(issue => issue.code === "interactive-scene-next-node-invalid"),
      nextNodeId,
    )
  }

  const valid = inspectWorkBeforePublish({
    ...base,
    interactiveScenes:[{ id:"scene-1", nodeId:"scene-node", nextNodeId:"ending", stages:[{ id:"stage-1", hotspots:[] }] }],
  })
  assert.equal(valid.issues.some(issue => issue.code.startsWith("interactive-scene-next-node-")), false)
})

test("standalone interactive works validate their画面 without requiring article nodes or continuation targets", () => {
  const report = inspectWorkBeforePublish({
    type:"article",
    experienceMode:"interactive",
    title:"门后",
    placeholders:[],
    nodes:[],
    interactiveScenes:[{
      id:"scene-1",
      stages:[{ id:"stage-1", name:"门外", image:"https://example.test/door.jpg", hotspots:[] }],
    }],
  })
  assert.equal(report.counts.error, 0)
  assert.equal(report.issues.some(issue => issue.code === "interactive-scene-next-node-missing"), false)
  assert.equal(report.issues.some(issue => issue.code === "article-nodes-empty"), false)
})

test("article inspection accepts placed ordinary interaction groups and their independent response text", () => {
  const report = inspectWorkBeforePublish({
    schemaVersion:4,
    id:"article-inline-interactions",
    type:"article",
    title:"正文普通互动",
    chapters:[{ id:"chapter", name:"第一章" }],
    nodes:[{
      id:"start",
      chapterId:"chapter",
      title:"开始",
      content:'<p>正文前段</p><div class="article-interaction-anchor" data-article-interaction-group="group-1" contenteditable="false"></div><p>正文后段</p>',
      interactionGroups:[{
        id:"group-1",
        label:"要怎么回应？",
        choices:[
          { id:"group-1-a", text:"点头", selectedText:"你轻轻点头。\n她笑了。" },
          { id:"group-1-b", text:"摇头", selectedText:"你摇了摇头。" },
        ],
      }],
      choices:[],
    }],
    placeholders:[],
    phoneModules:[],
  })

  assert.deepEqual(report.counts, { error:0, warning:0 })
})

test("article inspection reports unplaced, duplicated, undersized, and orphaned ordinary interactions", () => {
  const report = inspectWorkBeforePublish({
    schemaVersion:4,
    id:"article-broken-inline-interactions",
    type:"article",
    title:"异常普通互动",
    chapters:[{ id:"chapter", name:"第一章" }],
    nodes:[{
      id:"start",
      chapterId:"chapter",
      title:"开始",
      content:'<p>正文</p><div class="article-interaction-anchor" data-article-interaction-group="orphan" contenteditable="false"></div>',
      interactionGroups:[{
        id:"group-1",
        label:"",
        choices:[{ id:"only-choice", text:"", selectedText:"" }],
      }],
      choices:[],
    }],
    placeholders:[],
    phoneModules:[],
  })

  assert.deepEqual(
    report.issues.map(issue => issue.code),
    [
      "article-interaction-group-marker-missing",
      "article-interaction-group-too-small",
      "article-interaction-choice-text-empty",
      "article-interaction-marker-orphaned",
    ],
  )
  assert.deepEqual(report.counts, { error:3, warning:1 })
})

test("article inspection requires exactly one marker for each in-article placeholder", () => {
  const base = {
    schemaVersion:4,
    id:"article-inline-placeholders",
    type:"article",
    title:"正文占位符",
    chapters:[{ id:"chapter", name:"第一章" }],
    nodes:[{
      id:"start",
      chapterId:"chapter",
      title:"开始",
      content:'<p>给它起名</p><span class="article-placeholder-anchor" data-article-placeholder="cat-name" contenteditable="false"></span><p>CAT 回头看你。</p>',
      interactionGroups:[],
      choices:[],
    }],
    placeholders:[{
      id:"cat-name", key:"CAT", label:"小猫名字", prompt:"它叫什么？", fillMode:"inline",
    }],
    phoneModules:[],
  }

  assert.deepEqual(inspectWorkBeforePublish(base).counts, {error:0, warning:0})

  const missing = structuredClone(base)
  missing.nodes[0].content = "<p>没有填写位置</p>"
  assert.ok(inspectWorkBeforePublish(missing).issues.some(issue => (
    issue.code === "article-placeholder-marker-missing"
  )))

  const duplicate = structuredClone(base)
  duplicate.nodes[0].content += '<span class="article-placeholder-anchor" data-article-placeholder="cat-name" contenteditable="false"></span>'
  assert.ok(inspectWorkBeforePublish(duplicate).issues.some(issue => (
    issue.code === "article-placeholder-marker-duplicate"
  )))

  const orphaned = structuredClone(base)
  orphaned.placeholders[0].fillMode = "landing"
  assert.ok(inspectWorkBeforePublish(orphaned).issues.some(issue => (
    issue.code === "article-placeholder-marker-orphaned"
  )))
})
