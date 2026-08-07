import test from "node:test"
import assert from "node:assert/strict"

import { transferArticlePhoneModule } from "../js/article-save-adapter.js"

function card(moduleId, type = "forum") {
  return `<div class="pm-inline-card" contenteditable="false" data-pm-id="${moduleId}" data-pm-type="${type}" draggable="false"><span>${type}</span></div>`
}

function fixture() {
  return {
    id:"work-a",
    type:"article",
    chapters:[
      {id:"chapter-a", name:"第一章"},
      {id:"chapter-b", name:"第二章"},
    ],
    nodes:[
      {
        id:"node-a",
        title:"旧节点",
        chapterId:"chapter-a",
        content:`<p>前文</p>${card("module-a")}<p>后文</p>`,
      },
      {
        id:"node-b",
        title:"新节点",
        chapterId:"chapter-b",
        content:"<p>新节点正文</p>",
      },
      {
        id:"hidden",
        title:"隐藏内容",
        kind:"conditional",
        chapterId:"chapter-b",
        content:"<p>隐藏</p>",
      },
      {
        id:"interactive",
        title:"互动页",
        kind:"interactive-scene",
        chapterId:"chapter-b",
        content:"",
      },
    ],
    phoneModules:[{
      id:"module-a",
      type:"forum",
      nodeId:"node-a",
      data:{posts:[{id:"post-a", title:"已经写好的帖子", comments:[{id:"comment-a", text:"保留我"}]}]},
      futureModule:{keep:true},
    }],
  }
}

test("moving a whole phone module preserves its data and relocates its only card", () => {
  const work = fixture()
  const original = structuredClone(work)
  const moved = transferArticlePhoneModule(work, {
    mode:"move",
    moduleId:"module-a",
    sourceNodeId:"node-a",
    targetNodeId:"node-b",
    cardHtml:card("module-a"),
  })

  assert.deepEqual(work, original)
  assert.equal(moved.phoneModules.length, 1)
  assert.equal(moved.phoneModules[0].id, "module-a")
  assert.equal(moved.phoneModules[0].nodeId, "node-b")
  assert.deepEqual(moved.phoneModules[0].data, original.phoneModules[0].data)
  assert.deepEqual(moved.phoneModules[0].futureModule, {keep:true})
  assert.equal(moved.nodes[0].content, "<p>前文</p><p>后文</p>")
  assert.equal(moved.nodes[1].content, `<p>新节点正文</p>${card("module-a")}`)
})

test("copying a whole phone module creates an independent module at the destination", () => {
  const work = fixture()
  const copied = transferArticlePhoneModule(work, {
    mode:"copy",
    moduleId:"module-a",
    sourceNodeId:"node-a",
    targetNodeId:"node-b",
    copiedModuleId:"module-copy",
    cardHtml:card("module-copy"),
  })

  assert.equal(copied.phoneModules.length, 2)
  assert.equal(copied.phoneModules[0].nodeId, "node-a")
  assert.equal(copied.phoneModules[1].id, "module-copy")
  assert.equal(copied.phoneModules[1].nodeId, "node-b")
  assert.deepEqual(copied.phoneModules[1].data, work.phoneModules[0].data)
  assert.notEqual(copied.phoneModules[1].data, work.phoneModules[0].data)
  copied.phoneModules[1].data.posts[0].title = "副本标题"
  assert.equal(work.phoneModules[0].data.posts[0].title, "已经写好的帖子")
  assert.equal(copied.nodes[0].content, work.nodes[0].content)
  assert.equal(copied.nodes[1].content, `<p>新节点正文</p>${card("module-copy")}`)
})

test("copying into the same ordinary node appends a distinct card", () => {
  const work = fixture()
  const copied = transferArticlePhoneModule(work, {
    mode:"copy",
    moduleId:"module-a",
    sourceNodeId:"node-a",
    targetNodeId:"node-a",
    copiedModuleId:"module-copy",
    cardHtml:card("module-copy"),
  })

  assert.match(copied.nodes[0].content, /data-pm-id="module-a"[\s\S]*data-pm-id="module-copy"/)
  assert.equal(copied.phoneModules.length, 2)
})

test("phone module transfer rejects unsafe destinations and ambiguous records", () => {
  const work = fixture()
  const input = {
    mode:"move",
    moduleId:"module-a",
    sourceNodeId:"node-a",
    targetNodeId:"node-b",
    cardHtml:card("module-a"),
  }
  const reason = (candidate, expected) => {
    assert.throws(
      () => transferArticlePhoneModule(candidate, input),
      error => error?.details?.reason === expected,
    )
  }

  reason({...work, nodes:work.nodes.map(node => node.id === "node-a" ? {...node, content:"<p>卡片丢失</p>"} : node)}, "phone-card-reference-not-found")
  reason({...work, nodes:[...work.nodes, {...work.nodes[0]}]}, "node-ambiguous")
  reason({...work, phoneModules:[...work.phoneModules, {...work.phoneModules[0]}]}, "phone-module-ambiguous")
  reason({...work, phoneModules:[{...work.phoneModules[0], nodeId:"node-b"}]}, "phone-module-node-mismatch")

  assert.throws(
    () => transferArticlePhoneModule(work, {...input, targetNodeId:"node-a"}),
    error => error?.details?.reason === "phone-module-target-same",
  )
  assert.throws(
    () => transferArticlePhoneModule(work, {...input, targetNodeId:"hidden"}),
    error => error?.details?.reason === "phone-module-target-unsupported",
  )
  assert.throws(
    () => transferArticlePhoneModule(work, {...input, targetNodeId:"interactive"}),
    error => error?.details?.reason === "phone-module-target-unsupported",
  )
})

test("phone module copy rejects ID collisions and malformed destination cards", () => {
  const work = fixture()
  const input = {
    mode:"copy",
    moduleId:"module-a",
    sourceNodeId:"node-a",
    targetNodeId:"node-b",
    copiedModuleId:"module-copy",
    cardHtml:card("module-copy"),
  }

  assert.throws(
    () => transferArticlePhoneModule(work, {...input, copiedModuleId:"module-a", cardHtml:card("module-a")}),
    error => error?.details?.reason === "phone-module-id-collision",
  )
  assert.throws(
    () => transferArticlePhoneModule(work, {...input, cardHtml:"<p>不是模块卡片</p>"}),
    error => error?.details?.reason === "invalid-phone-card-html",
  )
  assert.throws(
    () => transferArticlePhoneModule(work, {...input, mode:"clone"}),
    error => error?.details?.reason === "invalid-phone-module-transfer-mode",
  )
})
