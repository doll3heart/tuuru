import test from "node:test"
import assert from "node:assert/strict"
import { JSDOM } from "jsdom"

function installDom(t) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url:"http://localhost/reader/",
  })
  Object.assign(globalThis, {
    window:dom.window,
    document:dom.window.document,
    localStorage:dom.window.localStorage,
    sessionStorage:dom.window.sessionStorage,
    Element:dom.window.Element,
    HTMLElement:dom.window.HTMLElement,
    Node:dom.window.Node,
    Event:dom.window.Event,
    MouseEvent:dom.window.MouseEvent,
    MutationObserver:dom.window.MutationObserver,
    FileReader:dom.window.FileReader,
    requestAnimationFrame:callback => { callback(); return 1 },
    alert:() => {},
  })
  t.after(() => dom.window.close())
  return dom
}

function waitForPopstate(window) {
  return new Promise(resolve => {
    const fallback = setTimeout(resolve, 80)
    window.addEventListener("popstate", () => {
      clearTimeout(fallback)
      setTimeout(resolve, 0)
    }, { once:true })
  })
}

test("browser Back exits phone detail and App one layer at a time", async t => {
  const dom = installDom(t)
  const work = {
    schemaVersion:1,
    id:"browser-back-phone",
    type:"phone",
    title:"Layered Phone",
    password:"",
    placeholders:[],
    phoneData:{
      skin:{},
      apps:[{ id:"messages-app", type:"messages", name:"消息", enabled:true }],
      contacts:[{ id:"contact-a", name:"Aster" }],
      chats:[{
        id:"chat-a",
        type:"private",
        contactIds:["contact-a"],
        rounds:[{
          id:"round-a",
          messages:[{ id:"message-a", senderId:"contact-a", type:"text", text:"在吗？" }],
        }],
      }],
      moments:[],
      forumPosts:[],
    },
  }
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id:work.id,
    title:work.title,
    type:work.type,
    importedAt:100,
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))

  await import(`../reader/reader.js?browser-back-phone=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  assert.ok(document.getElementById("chatBack"))

  let popped = waitForPopstate(dom.window)
  dom.window.history.back()
  await popped
  assert.equal(document.getElementById("chatBack"), null)
  assert.ok(document.querySelector('.rd-chat-card[data-chat-index="0"]'))

  popped = waitForPopstate(dom.window)
  dom.window.history.back()
  await popped
  assert.ok(document.getElementById("phoneDesktopReader"))
  assert.equal(document.querySelector(".rd-phone-app-panel"), null)
})

test("visible in-phone Back controls cannot be covered by the bookshelf Back control", async t => {
  const dom = installDom(t)
  const work = {
    schemaVersion:1,
    id:"control-back-phone",
    type:"phone",
    title:"Control Back Phone",
    password:"",
    placeholders:[],
    phoneData:{
      skin:{},
      apps:[
        { id:"messages-app", type:"messages", name:"消息", enabled:true },
        { id:"forum-app", type:"forum", name:"论坛", enabled:true },
      ],
      contacts:[{ id:"contact-a", name:"Aster" }],
      chats:[{
        id:"chat-a",
        type:"group",
        groupName:"测试群",
        contactIds:["contact-a"],
        rounds:[{
          id:"round-a",
          messages:[{ id:"message-a", senderId:"contact-a", type:"text", text:"在吗？" }],
        }],
      }],
      moments:[],
      forumPosts:[{
        id:"post-a",
        title:"返回测试帖",
        content:"正文",
        contactId:"contact-a",
        comments:[],
      }],
    },
  }
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id:work.id,
    title:work.title,
    type:work.type,
    importedAt:100,
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))

  await import(`../reader/reader.js?control-back-phone=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()

  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('.rd-chat-card[data-chat-index="0"]').click()
  let bookshelfBack = document.querySelector('.reader-back[data-reader-home]')
  assert.equal(bookshelfBack.hidden, true, "the bookshelf Back control must not cover chat navigation")

  let popped = waitForPopstate(dom.window)
  document.getElementById("chatBack").click()
  await popped
  assert.ok(document.querySelector('.rd-chat-card[data-chat-index="0"]'))
  assert.equal(document.querySelector(".rd-home"), null)

  popped = waitForPopstate(dom.window)
  document.querySelector('.rd-phone-app-header .rd-back-btn').click()
  await popped
  bookshelfBack = document.querySelector('.reader-back[data-reader-home]')
  assert.equal(bookshelfBack.hidden, false)
  assert.ok(document.getElementById("phoneDesktopReader"))

  document.querySelector('[data-app-type="forum"]').click()
  document.querySelector('.rd-post-card[data-post-index="0"]').click()
  bookshelfBack = document.querySelector('.reader-back[data-reader-home]')
  assert.equal(bookshelfBack.hidden, true, "the bookshelf Back control must not cover forum navigation")

  popped = waitForPopstate(dom.window)
  document.querySelector('.rd-forum-detail .rd-back-btn').click()
  await popped
  assert.ok(document.querySelector('.rd-post-card[data-post-index="0"]'))
  assert.equal(document.querySelector(".rd-home"), null)
})
