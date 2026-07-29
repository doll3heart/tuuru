import test from "node:test"
import assert from "node:assert/strict"

import { summarizeReaderWorkUpdate } from "../reader/work-update-analysis.js"

test("article update summaries count structure without exposing authored text", () => {
  const existing = {
    id:"work-a",
    type:"article",
    chapters:[{id:"chapter-a", name:"秘密旧章"}],
    nodes:[
      {id:"node-a", chapterId:"chapter-a", title:"旧标题", content:"不能剧透的旧内容", choices:[]},
      {id:"node-b", chapterId:"chapter-a", title:"不变", content:"保持不变", choices:[]},
    ],
    phoneModules:[],
  }
  const incoming = {
    id:"work-a",
    type:"article",
    chapters:[
      {id:"chapter-a", name:"秘密旧章"},
      {id:"chapter-b", name:"绝密新章"},
    ],
    nodes:[
      {id:"node-a", chapterId:"chapter-a", title:"新标题", content:"不能剧透的新内容", choices:[]},
      {id:"node-b", chapterId:"chapter-a", title:"不变", content:"保持不变", choices:[]},
      {id:"node-c", chapterId:"chapter-b", title:"新增段落", content:"结局真相", choices:[]},
    ],
    phoneModules:[],
  }

  const summary = summarizeReaderWorkUpdate(existing, incoming)

  assert.deepEqual(summary, [
    "新增 1 个章节",
    "新增 1 段正文",
    "修改 1 段正文",
  ])
  const serialized = summary.join(" · ")
  for (const secret of ["秘密旧章", "绝密新章", "不能剧透", "结局真相", "新标题"]) {
    assert.doesNotMatch(serialized, new RegExp(secret))
  }
})

test("phone update summaries count messages, posts, memos, and images with a four-item ceiling", () => {
  const existing = {
    id:"work-phone",
    type:"phone",
    phoneData:{
      chats:[{id:"chat-a", messages:[{id:"message-a", text:"旧消息"}], rounds:[]}],
      forumPosts:[{id:"post-a", content:"旧帖子", images:[]}],
      memos:[{id:"memo-a", content:"旧备忘录"}],
      photos:[{id:"photo-a", url:"data:image/png;base64,AA=="}],
    },
  }
  const incoming = {
    id:"work-phone",
    type:"phone",
    phoneData:{
      chats:[{
        id:"chat-a",
        messages:[
          {id:"message-a", text:"旧消息"},
          {id:"message-b", text:"凶手是谁不能说"},
        ],
        rounds:[{id:"round-a", messages:[{id:"message-c", text:"隐藏消息"}]}],
      }],
      forumPosts:[
        {id:"post-a", content:"旧帖子", images:[]},
        {id:"post-b", content:"秘密论坛内容", images:["data:image/png;base64,BB=="]},
      ],
      memos:[
        {id:"memo-a", content:"旧备忘录"},
        {id:"memo-b", content:"秘密备忘录"},
      ],
      photos:[
        {id:"photo-a", url:"data:image/png;base64,AA=="},
        {id:"photo-b", url:"data:image/png;base64,CC=="},
      ],
    },
  }

  const summary = summarizeReaderWorkUpdate(existing, incoming)

  assert.deepEqual(summary, [
    "新增 2 条消息",
    "新增 1 篇帖子",
    "新增 1 条备忘录",
    "新增 2 张图片",
  ])
  assert.equal(summary.length, 4)
  assert.doesNotMatch(summary.join(" · "), /凶手|秘密|隐藏/)
})

test("unrelated, malformed, and unchanged works produce no update summary", () => {
  assert.deepEqual(summarizeReaderWorkUpdate(null, null), [])
  assert.deepEqual(
    summarizeReaderWorkUpdate(
      {id:"work-a", type:"article", nodes:[]},
      {id:"work-b", type:"article", nodes:[{id:"new"}]},
    ),
    [],
  )
  assert.deepEqual(
    summarizeReaderWorkUpdate(
      {id:"same", type:"article", chapters:[], nodes:[]},
      {id:"same", type:"article", chapters:[], nodes:[]},
    ),
    [],
  )
})
