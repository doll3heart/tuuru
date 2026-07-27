import test from "node:test"
import assert from "node:assert/strict"

import {
  buildUnlockedReaderSearchIndex,
  searchUnlockedReaderIndex,
} from "../reader/reader-unlocked-search.js"

function searchWork() {
  return {
    type:"article",
    chapters:[
      {id:"chapter-a", name:"雨夜"},
      {id:"chapter-b", name:"清晨"},
    ],
    nodes:[
      {
        id:"start",
        chapterId:"chapter-a",
        title:"旧站",
        content:[
          "<p>已解锁正文写着：钟停在二十三点十七分。</p>",
          '<div class="pm-inline-card" data-pm-id="messages-open" data-pm-type="messages"></div>',
          '<div class="pm-inline-card" data-pm-id="forum-open" data-pm-type="forum"></div>',
          '<div class="pm-inline-card" data-pm-id="memo-open" data-pm-type="memo"></div>',
        ].join(""),
        choices:[{
          id:"reply",
          mode:"interaction",
          text:"回答",
          selectedText:"你已经回答：我会赴约。",
        }],
      },
      {
        id:"locked",
        chapterId:"chapter-b",
        title:"密室",
        content:"<p>未解锁秘密在灯塔下面。</p>",
        choices:[],
      },
    ],
    phoneModules:[
      {
        id:"messages-open",
        type:"messages",
        nodeId:"start",
        data:{
          chats:[{
            id:"chat-secret-id",
            name:"没有号码的人",
            messages:[
              {id:"message-secret-id", text:"站台尽头见。", image:"https://secret.example/message.png"},
            ],
          }],
        },
      },
      {
        id:"forum-open",
        type:"forum",
        nodeId:"start",
        data:{
          forumPosts:[{
            id:"post-secret-id",
            title:"旧站传闻",
            content:"第六盏灯从不熄灭。",
            url:"https://secret.example/forum",
          }],
        },
      },
      {
        id:"memo-open",
        type:"memo",
        nodeId:"start",
        data:{
          memos:[{
            id:"memo-secret-id",
            title:"票根背面",
            content:"不要回头。",
          }],
        },
      },
      {
        id:"memo-locked",
        type:"memo",
        nodeId:"locked",
        data:{
          memos:[{title:"灯塔", content:"未解锁手机秘密。"}],
        },
      },
      {
        id:"gallery-open",
        type:"gallery",
        nodeId:"start",
        data:{
          photos:[{caption:"不应被搜索的相册说明"}],
        },
      },
    ],
  }
}

test("unlocked search indexes only the active route and supported owned phone modules", () => {
  const entries = buildUnlockedReaderSearchIndex(searchWork(), ["start"], {
    choiceMemory:{start:"reply"},
    interactionSelections:{},
  })
  const joined = entries.map(entry => entry.text).join(" ")

  assert.match(joined, /已解锁正文/)
  assert.match(joined, /你已经回答：我会赴约/)
  assert.match(joined, /站台尽头见/)
  assert.match(joined, /第六盏灯从不熄灭/)
  assert.match(joined, /不要回头/)
  assert.doesNotMatch(joined, /未解锁秘密/)
  assert.doesNotMatch(joined, /未解锁手机秘密/)
  assert.doesNotMatch(joined, /不应被搜索的相册说明/)
  assert.doesNotMatch(joined, /chat-secret-id|message-secret-id|post-secret-id|memo-secret-id/)
  assert.doesNotMatch(joined, /secret\.example/)
  assert.deepEqual(
    [...new Set(entries.map(entry => entry.kind))],
    ["article", "messages", "forum", "memo"],
  )
  assert.equal(entries.filter(entry => entry.kind === "article")[0].location, "雨夜 · 旧站")
})

test("unlocked search matches literal text, returns context, and deduplicates repeated route nodes", () => {
  const entries = buildUnlockedReaderSearchIndex(searchWork(), ["start", "start"], {
    choiceMemory:{},
    interactionSelections:{},
  })

  assert.equal(entries.filter(entry => entry.kind === "article").length, 1)
  const results = searchUnlockedReaderIndex(entries, "第六盏灯")
  assert.equal(results.length, 1)
  assert.equal(results[0].kind, "forum")
  assert.equal(results[0].snippet.match, "第六盏灯")
  assert.match(results[0].snippet.after, /从不熄灭/)
  assert.equal(searchUnlockedReaderIndex(entries, "未解锁秘密").length, 0)
  assert.equal(searchUnlockedReaderIndex(entries, "   ").length, 0)
})

test("unlocked search fails closed for malformed work and path data", () => {
  assert.deepEqual(buildUnlockedReaderSearchIndex(null, ["start"]), [])
  assert.deepEqual(buildUnlockedReaderSearchIndex(searchWork(), null), [])
  assert.deepEqual(searchUnlockedReaderIndex(null, "站台"), [])
})
