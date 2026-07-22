import test from "node:test"
import assert from "node:assert/strict"
import { substitutePhoneTextData } from "../js/phone-placeholder-text.js"

const placeholders = [{ id:"reader", key:"某某", label:"读者名字", default:"读者", values:[] }]
const options = { valuesMap:{ reader:["读者"] }, usePlaceholderMode:false }

test("reader phone substitution covers nested visible text", () => {
  const source = {
    contacts:[{ id:"contact-placeholder", name:"某某全肯定bot", msgId:"我推某某", forumId:"某某命", bio:"只支持某某", avatarUrl:"https://img.test/placeholder.png", aliases:[{ id:"alias-1", name:"某某小号", forumId:"某某分命" }] }],
    forumNpcs:[{ id:"npc-1", name:"某某后援会" }],
    moments:[{ id:"moment-1", content:"今天也夸某某", time:"某某生日", comments:[{ id:"comment-1", content:"@某某 你好", time:"刚刚" }] }],
    forumPosts:[{ id:"post-1", title:"给某某", content:"正文某某", comments:[{ id:"forum-comment-1", content:"评论某某", choices:[{ id:"choice-1", text:"问某某", followUpMessages:[{ id:"follow-1", text:"答某某" }] }] }] }],
    chats:[{ id:"chat-1", type:"group", groupName:"某某群", contactIds:["contact-placeholder"], rounds:[{ id:"round-1", label:"某某回合", messages:[{ id:"message-1", type:"text", text:"你好某某" }] }] }],
    memos:[{ id:"memo-1", contactId:"contact-placeholder", content:"<p>给某某的备忘</p>" }],
    photos:[{ id:"photo-1", contactId:"contact-placeholder", caption:"某某的照片", description:"拍给某某", imageUrl:"https://img.test/某某.png" }],
    albums:[{ id:"album-1", contactId:"contact-placeholder", name:"某某相册" }],
    browserHistory:[{ id:"history-1", contactId:"contact-placeholder", title:"搜索某某", url:"https://example.test/某某", time:"某某的日期" }],
    shoppingItems:[{ id:"shop-1", contactId:"contact-placeholder", name:"某某同款", style:"某某色", shop:"某某小店", logistics:"送给某某", time:"某某下单", imageUrl:"https://img.test/shop-某某.png" }],
    skin:{ readerId:"某某" },
    appConnections:{ memo:{ contactId:"contact-placeholder", prompt:"查看某某的备忘" } },
  }
  const rendered = substitutePhoneTextData(source, placeholders, options)
  assert.equal(rendered.contacts[0].name, "读者全肯定bot")
  assert.equal(rendered.contacts[0].msgId, "我推读者")
  assert.equal(rendered.contacts[0].forumId, "读者命")
  assert.equal(rendered.contacts[0].aliases[0].name, "读者小号")
  assert.equal(rendered.contacts[0].aliases[0].forumId, "读者分命")
  assert.equal(rendered.contacts[0].bio, "只支持读者")
  assert.equal(rendered.forumNpcs[0].name, "读者后援会")
  assert.equal(rendered.moments[0].comments[0].content, "@读者 你好")
  assert.equal(rendered.forumPosts[0].comments[0].choices[0].followUpMessages[0].text, "答读者")
  assert.equal(rendered.chats[0].rounds[0].messages[0].text, "你好读者")
  assert.equal(rendered.memos[0].content, "<p>给读者的备忘</p>")
  assert.equal(rendered.photos[0].caption, "读者的照片")
  assert.equal(rendered.photos[0].description, "拍给读者")
  assert.equal(rendered.photos[0].imageUrl, "https://img.test/某某.png")
  assert.equal(rendered.albums[0].name, "读者相册")
  assert.equal(rendered.browserHistory[0].title, "搜索读者")
  assert.equal(rendered.browserHistory[0].url, "https://example.test/某某")
  assert.equal(rendered.browserHistory[0].time, "读者的日期")
  assert.equal(rendered.shoppingItems[0].name, "读者同款")
  assert.equal(rendered.shoppingItems[0].style, "读者色")
  assert.equal(rendered.shoppingItems[0].shop, "读者小店")
  assert.equal(rendered.shoppingItems[0].logistics, "送给读者")
  assert.equal(rendered.shoppingItems[0].time, "读者下单")
  assert.equal(rendered.shoppingItems[0].imageUrl, "https://img.test/shop-某某.png")
  assert.equal(rendered.skin.readerId, "读者")
  assert.equal(rendered.appConnections.memo.prompt, "查看读者的备忘")
})

test("reader phone substitution preserves structural and media strings and detaches input", () => {
  const source = { contacts:[{ id:"contact-某某", avatarUrl:"https://img.test/某某.png" }], apps:[{ type:"某某", icon:"某某", color:"#某某" }] }
  const rendered = substitutePhoneTextData(source, placeholders, options)
  assert.notEqual(rendered, source)
  assert.equal(rendered.contacts[0].id, source.contacts[0].id)
  assert.equal(rendered.contacts[0].avatarUrl, source.contacts[0].avatarUrl)
  assert.equal(rendered.apps[0].type, source.apps[0].type)
  assert.equal(rendered.apps[0].icon, source.apps[0].icon)
  assert.equal(rendered.apps[0].color, source.apps[0].color)
  assert.equal(source.contacts[0].id, "contact-某某")
})
