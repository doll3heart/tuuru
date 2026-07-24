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

test("article inspection reports invalid starts, blank nodes, and broken branches", () => {
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

  assert.deepEqual(report.counts, { error:5, warning:3 })
  assert.deepEqual(
    report.issues.map(issue => issue.code),
    [
      "work-title-empty",
      "placeholder-key-duplicate",
      "placeholder-key-empty",
      "article-start-invalid",
      "article-node-title-empty",
      "article-choice-text-empty",
      "article-choice-target-missing",
      "article-phone-module-node-missing",
    ],
  )
  assert.ok(report.issues.every(issue => issue.title && issue.location && issue.action))
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
})

test("missing type-specific content fails closed without throwing", () => {
  const article = inspectWorkBeforePublish({ type:"article", title:"空文章" })
  const phone = inspectWorkBeforePublish({ type:"phone", title:"空手机" })

  assert.deepEqual(article.issues.map(issue => issue.code), ["article-nodes-empty"])
  assert.deepEqual(phone.issues.map(issue => issue.code), ["phone-data-missing"])
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
