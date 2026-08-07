import test from "node:test"
import assert from "node:assert/strict"

import { findWorkReferences } from "../js/work-references.js"

function fixture() {
  return {
    id:"references",
    type:"article",
    startNode:"node-a",
    chapters:[{id:"chapter-1", name:"第一章"}],
    nodes:[
      {
        id:"node-a",
        chapterId:"chapter-1",
        title:"起点",
        choices:[{id:"choice-1", text:"去下一幕", targetId:"node-b"}],
        interactionGroups:[{
          id:"game-a", kind:"random-game", label:"命运骰",
          choices:[{id:"game-win", text:"成功", targetId:"node-b"}],
        }],
      },
      {
        id:"node-b",
        chapterId:"chapter-1",
        title:"下一幕",
        choices:[],
      },
      {
        id:"conditional",
        chapterId:"chapter-1",
        title:"隐藏真相",
        kind:"conditional",
        displayCondition:{all:[{anyChoiceIds:["choice-1"]}]},
      },
    ],
    interactiveScenes:[{id:"scene-1", nodeId:"node-a", title:"房间", nextNodeId:"node-b"}],
    phoneModules:[{id:"module-1", nodeId:"node-b", type:"messages"}],
    phoneData:{
      contacts:[{
        id:"contact-1",
        name:"白榆",
        aliases:[{id:"alias-1", name:"匿名白榆"}],
      }],
      chats:[{
        id:"chat-1",
        groupName:"夜谈",
        contactIds:["contact-1"],
        rounds:[{
          id:"round-1",
          messages:[
            {id:"message-1", senderId:"contact-1", text:"在吗"},
            {id:"message-2", senderId:"self", text:"在"},
          ],
        }],
      }],
      moments:[{
        id:"moment-1",
        contactId:"alias-1",
        content:"动态",
        comments:[{id:"moment-comment-1", contactId:"contact-1", content:"评论"}],
      }],
      forumNpcs:[{id:"npc-1", name:"路人甲"}],
      forumPosts:[{
        id:"post-1",
        npcId:"npc-1",
        title:"帖子",
        comments:[{id:"forum-comment-1", contactId:"contact-1", content:"回复"}],
      }],
      memos:[{id:"memo-1", contactId:"contact-1", content:"备忘"}],
      photos:[],
      browserHistory:[],
      shoppingItems:[],
    },
  }
}

test("finds every authored route that points at an article node", () => {
  const references = findWorkReferences(fixture(), {kind:"node", id:"node-b"})
  assert.deepEqual(
    references.map(reference => reference.category).sort(),
    ["互动图片后续", "剧情分支", "小游戏结果", "插入内容"].sort(),
  )
  assert.ok(references.some(reference => reference.sourceNodeId === "node-a"))
  assert.ok(references.every(reference => reference.id && reference.location))
})

test("finds hidden display conditions that depend on a choice", () => {
  const references = findWorkReferences(fixture(), {kind:"choice", id:"choice-1"})
  assert.equal(references.length, 1)
  assert.equal(references[0].category, "显示条件")
  assert.equal(references[0].sourceNodeId, "conditional")
  assert.match(references[0].location, /隐藏真相/)
})

test("deleting a contact includes its aliases and concrete phone locations", () => {
  const references = findWorkReferences(fixture(), {kind:"contact", id:"contact-1"})
  const categories = new Set(references.map(reference => reference.category))
  assert.ok(categories.has("消息"))
  assert.ok(categories.has("动态"))
  assert.ok(categories.has("论坛"))
  assert.ok(categories.has("备忘录"))
  assert.ok(references.some(reference => reference.location.includes("匿名白榆")))
  assert.ok(references.some(reference => reference.appType === "messages"))
  assert.ok(references.every(reference => !reference.location.includes("联系人名片")))
})

test("finds forum content authored by an NPC without treating its definition as a reference", () => {
  const references = findWorkReferences(fixture(), {kind:"npc", id:"npc-1"})
  assert.equal(references.length, 1)
  assert.equal(references[0].category, "论坛")
  assert.equal(references[0].appType, "forum")
  assert.match(references[0].location, /帖子/)
})

test("unsupported requests and missing identifiers are safe", () => {
  assert.deepEqual(findWorkReferences(null, {kind:"node", id:"x"}), [])
  assert.deepEqual(findWorkReferences(fixture(), {kind:"unknown", id:"x"}), [])
  assert.deepEqual(findWorkReferences(fixture(), {kind:"node", id:""}), [])
})
