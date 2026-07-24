import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

const readerSource = readFileSync(new URL("../reader/reader.js", import.meta.url), "utf8")

function installDom(t) {
  const dom = new JSDOM("<!doctype html><html><body><div id=app></div></body></html>", {
    url: "http://localhost/reader/",
  })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.localStorage = dom.window.localStorage
  globalThis.sessionStorage = dom.window.sessionStorage
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.Event = dom.window.Event
  globalThis.MouseEvent = dom.window.MouseEvent
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.FileReader = dom.window.FileReader
  globalThis.requestAnimationFrame = callback => { callback(); return 1 }
  globalThis.alert = () => {}
  t.after(() => dom.window.close())
}

function socialChoiceWork() {
  return {
    schemaVersion: 1,
    id: "reader-social-choice-runtime",
    type: "phone",
    title: "Social choice runtime",
    placeholders: [],
    scenes: [],
    phoneData: {
      contacts: [{ id: "contact-1", name: "沈岚", avatarUrl: "" }],
      chats: [{
        id: "chat-1",
        type: "single",
        contactIds: ["contact-1"],
        messages: [],
        rounds: [],
      }],
      moments: [{
        id: "moment-1",
        contactId: "contact-1",
        contactName: "沈岚",
        content: "今天的风很舒服。",
        images: [],
        time: "20:10",
        likes: [],
        comments: [
          {
            id: "moment-owner",
            contactId: "contact-1",
            contactName: "沈岚",
            content: "有人陪我散步吗？",
            time: "20:11",
            choices: [
              {
                id: "moment-choice-a",
                text: "我陪你，还是老地方见。",
                replyText: "我陪你，还是老地方见。",
                followUpMessages: [{
                  id: "moment-follow-a",
                  senderId: "contact-1",
                  text: "好，我等你。",
                  type: "text",
                }],
              },
              {
                id: "moment-choice-b",
                text: "今天不行，明天可以吗？",
                replyText: "今天不行，明天可以吗？",
                followUpMessages: [{
                  id: "moment-follow-b",
                  senderId: "contact-1",
                  text: "可以，明天见。",
                  type: "text",
                }],
              },
            ],
          },
          {
            id: "moment-authored-tail",
            contactId: "contact-1",
            contactName: "沈岚",
            content: "这是作者排在后面的动态评论。",
            time: "20:12",
          },
        ],
      }],
      forumPosts: [{
        id: "forum-post-1",
        contactId: "contact-1",
        contactName: "沈岚",
        title: "今晚有人看流星吗",
        content: "天台见。",
        images: [],
        time: "21:00",
        comments: [
          {
            id: "forum-owner",
            contactId: "contact-1",
            contactName: "沈岚",
            content: "我会带望远镜。",
            time: "21:01",
            replies: [],
            choices: [{
              id: "forum-choice-a",
              text: "那我带热饮过去。",
              replyText: "那我带热饮过去。",
              followUpMessages: [{
                id: "forum-follow-a",
                senderId: "contact-1",
                text: "正好，晚上会冷。",
                type: "text",
              }],
            }],
          },
          {
            id: "forum-authored-tail",
            contactId: "contact-1",
            contactName: "沈岚",
            content: "这是作者排在后面的论坛评论。",
            time: "21:02",
            replies: [],
          },
        ],
      }],
      forumNpcs: [],
      memos: [],
      photos: [],
      albums: [],
      browserHistory: [],
      shoppingItems: [],
      skin: {
        readerId: "故事中的我",
        showDynamicIsland: false,
        showHomeIndicator: false,
      },
      apps: [
        {
          id: "messages-app",
          type: "messages",
          name: "消息",
          icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>',
          desktopX: 0,
          desktopY: 0,
          enabled: true,
        },
        {
          id: "forum-app",
          type: "forum",
          name: "论坛",
          icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>',
          desktopX: 1,
          desktopY: 0,
          enabled: true,
        },
      ],
    },
  }
}

function seedPhoneWork(work) {
  localStorage.setItem("moirain_recent", JSON.stringify([{
    id: work.id,
    title: work.title,
    type: work.type,
    importedAt: Date.now(),
  }]))
  localStorage.setItem(`moirain_work_${work.id}`, JSON.stringify(work))
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({ readerId: "小鱼" }))
}

async function openSeededPhone(t, work = socialChoiceWork()) {
  installDom(t)
  seedPhoneWork(work)
  await import(`../reader/reader.js?reader-social-choice-runtime=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  return work
}

test("a social choice without reader text keeps reselection on its first follow-up", async t => {
  const work = socialChoiceWork()
  const choice = work.phoneData.moments[0].comments[0].choices[0]
  choice.text = "Stay quiet."
  choice.replyText = ""
  choice.followUpMessages = [{
    id: "silent-moment-follow-up",
    senderId: "contact-1",
    text: "I will keep talking.",
    type: "text",
  }]

  await openSeededPhone(t, work)
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('[data-message-section="moments"]').click()
  document.querySelector('.rd-thread-choice-option[data-thread-scope="moment"]').click()

  assert.match(document.querySelector(".rd-moment-feed").textContent, /I will keep talking\./)
  document.querySelector(".rd-back-btn").click()
  document.querySelector('[data-app-type="messages"]').click()
  document.querySelector('[data-message-section="moments"]').click()
  assert.match(document.querySelector(".rd-moment-feed").textContent, /I will keep talking\./)
  const reselect = document.querySelector('.rd-thread-choice-reselect[data-thread-scope="moment"]')
  assert.ok(reselect)
  reselect.click()

  assert.doesNotMatch(document.querySelector(".rd-moment-feed").textContent, /I will keep talking\./)
  assert.ok(document.querySelector('.rd-thread-choice-option[data-thread-scope="moment"]'))
})

test("reader social choices use the shared immutable runtime without a free-input path", () => {
  assert.match(readerSource, /import\s*\{[^}]*applyThreadChoice[^}]*rollbackThreadChoice[^}]*\}\s*from\s*['"]\.\.\/js\/thread-choice-runtime\.js['"]/s)

  const messagesStart = readerSource.indexOf("if (type === 'messages')")
  const chatStart = readerSource.indexOf("function openReaderChat", messagesStart)
  const messagesSource = readerSource.slice(messagesStart, chatStart)
  const forumStart = readerSource.indexOf("function openReaderForumPost")
  const forumEnd = readerSource.indexOf("// ====== Reader Phone Custom", forumStart)
  const forumSource = readerSource.slice(forumStart, forumEnd)

  assert.match(messagesSource, /applyThreadChoice\s*\(/)
  assert.match(messagesSource, /rollbackThreadChoice\s*\(/)
  assert.match(forumSource, /applyThreadChoice\s*\(/)
  assert.match(forumSource, /rollbackThreadChoice\s*\(/)
  assert.doesNotMatch(messagesSource + forumSource, /choice\.used|\.used\s*=/)
})

test("messages exposes chat and moments, then inserts and precisely reselects a full-sentence reply", async t => {
  const authoredWork = await openSeededPhone(t)
  const momentsBeforePlay = JSON.parse(localStorage.getItem(`moirain_work_${authoredWork.id}`)).phoneData.moments
  document.querySelector('[data-app-type="messages"]').click()

  const sectionTabs = [...document.querySelectorAll(".rd-message-section-tab")]
  assert.deepEqual(sectionTabs.map(tab => tab.textContent.trim()), ["聊天", "动态"])
  assert.equal(sectionTabs[0].getAttribute("aria-selected"), "true")
  assert.deepEqual(sectionTabs.map(tab => tab.tabIndex), [0, -1])
  sectionTabs[0].dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
  assert.equal(document.querySelector('[data-message-section="moments"]').getAttribute("aria-selected"), "true")
  assert.equal(document.activeElement.dataset.messageSection, "moments")

  assert.equal(document.querySelectorAll(".rd-moment-card").length, 1)
  let options = [...document.querySelectorAll('.rd-thread-choice-option[data-thread-scope="moment"]')]
  assert.equal(options.length, 2)
  assert.equal(options[0].textContent.trim(), "我陪你，还是老地方见。")
  assert.equal(document.querySelector(".rd-moment-feed input, .rd-moment-feed textarea"), null)
  options[0].click()

  let items = [...document.querySelectorAll('.rd-moment-card [data-thread-item-id]')]
  assert.deepEqual(items.map(item => item.querySelector('.rd-thread-comment-content').textContent.trim()), [
    "有人陪我散步吗？",
    "我陪你，还是老地方见。",
    "好，我等你。",
    "这是作者排在后面的动态评论。",
  ])
  assert.deepEqual(items.map(item => item.querySelector('.rd-thread-comment-name').textContent.trim()), ["沈岚", "小鱼", "沈岚", "沈岚"])
  assert.equal(new Set(items.map(item => item.dataset.threadItemId)).size, items.length)
  assert.equal(document.querySelectorAll('.rd-thread-choice-option[data-thread-scope="moment"]').length, 0)

  const reselect = document.querySelector('.rd-thread-choice-reselect[data-thread-scope="moment"]')
  assert.ok(reselect)
  reselect.click()

  items = [...document.querySelectorAll('.rd-moment-card [data-thread-item-id]')]
  const visibleText = items.map(item => item.querySelector('.rd-thread-comment-content').textContent).join(" ")
  assert.doesNotMatch(visibleText, /我陪你，还是老地方见/)
  assert.doesNotMatch(visibleText, /好，我等你/)
  assert.match(visibleText, /这是作者排在后面的动态评论/)
  options = [...document.querySelectorAll('.rd-thread-choice-option[data-thread-scope="moment"]')]
  assert.equal(options.length, 2)

  const persisted = JSON.parse(localStorage.getItem(`moirain_work_${authoredWork.id}`))
  assert.deepEqual(persisted.phoneData.moments, momentsBeforePlay)
  assert.equal(persisted.phoneData.moments[0].comments[0].choices[0].used, undefined)
})

test("forum detail renders authored comments and keeps generated replies next to their trigger", async t => {
  const authoredWork = await openSeededPhone(t)
  const forumBeforePlay = JSON.parse(localStorage.getItem(`moirain_work_${authoredWork.id}`)).phoneData.forumPosts
  document.querySelector('[data-app-type="forum"]').click()
  document.querySelector('.rd-post-card[data-post-index="0"]').click()

  let items = [...document.querySelectorAll('.rd-forum-thread [data-thread-item-id]')]
  assert.equal(items.length, 2, "existing forum comments must be visible in the detail view")
  assert.match(items[0].textContent, /我会带望远镜/)
  assert.match(items[1].textContent, /这是作者排在后面的论坛评论/)
  assert.equal(document.querySelector(".rd-forum-thread input, .rd-forum-thread textarea"), null)

  const option = document.querySelector('.rd-thread-choice-option[data-thread-scope="forum"]')
  assert.ok(option)
  assert.equal(option.textContent.trim(), "那我带热饮过去。")
  option.click()

  items = [...document.querySelectorAll('.rd-forum-thread [data-thread-item-id]')]
  assert.deepEqual(items.map(item => item.querySelector('.forum-comment-content, .forum-reply-content').textContent.trim()), [
    "我会带望远镜。",
    "那我带热饮过去。",
    "正好，晚上会冷。",
    "这是作者排在后面的论坛评论。",
  ])
  assert.deepEqual(items.map(item => item.querySelector('.forum-comment-name, .forum-reply-name').textContent.trim()), ["沈岚", "小鱼", "沈岚", "沈岚"])
  assert.equal(items[3].querySelector('.forum-comment-floor').textContent, "4楼")

  const reselect = document.querySelector('.rd-thread-choice-reselect[data-thread-scope="forum"]')
  assert.ok(reselect)
  document.querySelector('.rd-forum-detail .rd-back-btn').click()
  document.querySelector('.rd-post-card[data-post-index="0"]').click()
  assert.ok(document.querySelector('.rd-thread-choice-reselect[data-thread-scope="forum"]'))
  assert.equal(document.querySelectorAll('.rd-forum-thread [data-thread-item-id]').length, 4)
  const reopenedReselect = document.querySelector('.rd-thread-choice-reselect[data-thread-scope="forum"]')
  reopenedReselect.click()

  items = [...document.querySelectorAll('.rd-forum-thread [data-thread-item-id]')]
  const visibleText = items.map(item => item.querySelector('.forum-comment-content, .forum-reply-content').textContent).join(" ")
  assert.doesNotMatch(visibleText, /那我带热饮过去/)
  assert.doesNotMatch(visibleText, /正好，晚上会冷/)
  assert.match(visibleText, /这是作者排在后面的论坛评论/)
  assert.ok(document.querySelector('.rd-thread-choice-option[data-thread-scope="forum"]'))

  const persisted = JSON.parse(localStorage.getItem(`moirain_work_${authoredWork.id}`))
  assert.deepEqual(persisted.phoneData.forumPosts, forumBeforePlay)
  assert.equal(persisted.phoneData.forumPosts[0].comments[0].choices[0].used, undefined)
})

test("reader keeps the post time and hides all reply times when the post setting is enabled", async t => {
  const work = socialChoiceWork()
  const post = work.phoneData.forumPosts[0]
  post.hideReplyTimes = true
  post.comments[0].replies.push({
    id: "forum-nested-time",
    contactId: "contact-1",
    contactName: "沈岚",
    content: "这是一条楼中楼。",
    time: "21:03",
    replies: [],
  })
  await openSeededPhone(t, work)

  document.querySelector('[data-app-type="forum"]').click()
  document.querySelector('.rd-post-card[data-post-index="0"]').click()

  assert.equal(document.querySelector(".forum-post-time")?.textContent, "21:00")
  assert.equal(document.querySelectorAll(".forum-comment-time").length, 0)
  assert.match(document.querySelector(".rd-forum-thread").textContent, /这是一条楼中楼/)

  const persisted = JSON.parse(localStorage.getItem(`moirain_work_${work.id}`))
  assert.equal(persisted.phoneData.forumPosts[0].comments[0].time, "21:01")
  assert.equal(persisted.phoneData.forumPosts[0].comments[0].replies[0].time, "21:03")
})

test("forum choices render consecutive follow-ups from different authored roles", async t => {
  const work = socialChoiceWork()
  work.id = "reader-forum-multi-actor-followups"
  work.phoneData.contacts.push({ id:"contact-2", name:"白榆", forumId:"白榆小号", forumAvatarUrl:"data:image/png;base64,dHdv" })
  work.phoneData.forumPosts[0].comments[0].choices[0].followUpMessages.push({
    id:"forum-follow-b",
    senderId:"contact-2",
    contactId:"contact-2",
    text:"我也会过去。",
    type:"text",
  })
  await openSeededPhone(t, work)
  document.querySelector('[data-app-type="forum"]').click()
  document.querySelector('.rd-post-card[data-post-index="0"]').click()
  document.querySelector('.rd-thread-choice-option[data-thread-scope="forum"]').click()
  const items = [...document.querySelectorAll('.rd-forum-thread [data-thread-item-id]')]
  assert.deepEqual(items.slice(0, 4).map(item => item.querySelector('.forum-comment-name, .forum-reply-name').textContent.trim()), ["沈岚", "小鱼", "沈岚", "白榆小号"])
  assert.equal(items[3].querySelector('.forum-comment-content, .forum-reply-content').textContent.trim(), "我也会过去。")
  assert.match(items[3].querySelector('.forum-comment-avatar img, .forum-reply-avatar img')?.getAttribute('src') || '', /^data:image\/png/)
})

test("reader forum applies the selected avatar shape and renders avatars for comments and nested replies", async t => {
  const work = socialChoiceWork()
  work.id = "reader-forum-avatar-shape"
  work.phoneData.contacts[0].avatarUrl = "data:image/png;base64,contact"
  work.phoneData.forumNpcs = [{ id:"npc-avatar", name:"路人甲", avatarUrl:"data:image/png;base64,npc" }]
  work.phoneData.forumPosts[0].comments = [{
    id:"npc-comment",
    contactId:"npc-avatar",
    contactName:"路人甲",
    contactAvatar:"data:image/png;base64,npc",
    content:"主评论",
    replies:[{
      id:"contact-reply",
      contactId:"contact-1",
      contactName:"沈岚",
      contactAvatar:"data:image/png;base64,contact",
      content:"楼中楼回复",
      replies:[],
    }],
  }]
  installDom(t)
  seedPhoneWork(work)
  localStorage.setItem("moirain_phoneCustom", JSON.stringify({
    readerId:"小鱼",
    appSettings:{ forum:{ avatarShape:"circle" } },
  }))
  await import(`../reader/reader.js?reader-forum-avatar=${Date.now()}-${Math.random()}`)
  document.querySelector(".rd-recent-item").click()
  document.getElementById("rdStartBtn").click()
  document.querySelector('[data-app-type="forum"]').click()

  assert.match(document.querySelector(".rd-post-card").getAttribute("style"), /--rd-forum-avatar-radius:50%/)
  document.querySelector('.rd-post-card[data-post-index="0"]').click()
  assert.match(document.querySelector(".rd-forum-detail").getAttribute("style"), /--rd-forum-avatar-radius:50%/)
  const avatars = [...document.querySelectorAll(".forum-comment-avatar img, .forum-reply-avatar img")]
  assert.equal(avatars.length, 2)
  assert.match(avatars[0].src, /^data:image\/png/)
  assert.match(avatars[1].src, /^data:image\/png/)
  assert.ok(document.querySelector(".forum-reply-item .forum-reply-avatar"))
})

test("reader forum defaults to hot comments, keeps authored floors, and stores likes only in the reading session", async t => {
  const work = socialChoiceWork()
  work.id = "reader-forum-sort-like"
  work.phoneData.forumPosts[0].displayCommentCount = 1288
  work.phoneData.forumPosts[0].comments = [
    { id:"comment-old", contactId:"contact-1", contactName:"沈岚", content:"最早评论", createdAt:100, likes:1, replies:[] },
    { id:"comment-hot", contactId:"contact-1", contactName:"沈岚", content:"热门评论", createdAt:200, likes:9, displayFloor:520, replies:[] },
    { id:"comment-latest", contactId:"contact-1", contactName:"沈岚", content:"最新评论", createdAt:300, likes:0, replies:[] },
  ]
  await openSeededPhone(t, work)
  const authoredComments = JSON.parse(localStorage.getItem(`moirain_work_${work.id}`)).phoneData.forumPosts[0].comments
  document.querySelector('[data-app-type="forum"]').click()
  document.querySelector('.rd-post-card[data-post-index="0"]').click()

  let comments = [...document.querySelectorAll('.rd-forum-thread > .forum-comment')]
  assert.equal(document.querySelector('[data-forum-sort="hot"]').getAttribute('aria-pressed'), 'true')
  assert.equal(document.querySelector('.rd-forum-thread-head h4 span').textContent, '1288')
  assert.equal(comments[0].dataset.threadItemId, 'comment-hot')
  assert.equal(comments[0].querySelector('.forum-comment-floor').textContent, '520楼')

  document.querySelector('[data-forum-sort="latest"]').click()
  comments = [...document.querySelectorAll('.rd-forum-thread > .forum-comment')]
  assert.equal(comments[0].dataset.threadItemId, 'comment-latest')
  assert.equal(comments[0].querySelector('.forum-comment-floor').textContent, '3楼')

  const like = comments[0].querySelector('[data-forum-comment-like="comment-latest"]')
  like.click()
  assert.equal(document.querySelector('[data-forum-comment-like="comment-latest"]').textContent.trim(), '♡1')
  assert.equal(document.querySelector('[data-forum-comment-like="comment-latest"]').getAttribute('aria-pressed'), 'true')

  document.querySelector('.rd-forum-detail .rd-back-btn').click()
  document.querySelector('.rd-post-card[data-post-index="0"]').click()
  assert.equal(document.querySelector('[data-forum-sort="latest"]').getAttribute('aria-pressed'), 'true')
  assert.equal(document.querySelector('[data-forum-comment-like="comment-latest"]').textContent.trim(), '♡1')
  assert.deepEqual(JSON.parse(localStorage.getItem(`moirain_work_${work.id}`)).phoneData.forumPosts[0].comments, authoredComments)
})

test("reader forum resolves contact aliases for posts and comments", async t => {
  const work = socialChoiceWork()
  work.id = "reader-forum-alias"
  work.phoneData.contacts[0].aliases = [{ id:"alias-1", name:"匿名马甲", forumId:"雨夜路人", avatarUrl:"data:image/png;base64,alias" }]
  const post = work.phoneData.forumPosts[0]
  post.aliasId = "alias-1"
  post.contactName = "旧小号名"
  post.comments = [{ id:"alias-comment", contactId:"contact-1", aliasId:"alias-1", contactName:"旧小号名", content:"匿名评论", replies:[] }]
  await openSeededPhone(t, work)
  document.querySelector('[data-app-type="forum"]').click()
  assert.match(document.querySelector('.rd-forum-meta').textContent, /雨夜路人/)
  document.querySelector('.rd-post-card[data-post-index="0"]').click()
  assert.equal(document.querySelector('.forum-post-author').childNodes[0].textContent.trim(), "雨夜路人")
  assert.equal(document.querySelector('.forum-comment-name').textContent, "雨夜路人")
  assert.match(document.querySelector('.forum-comment-avatar img').src, /^data:image\/png/)
})
