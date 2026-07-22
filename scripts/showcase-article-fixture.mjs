import { CURRENT_WORK_SCHEMA_VERSION } from "../js/work-schema.js"
import { createIllustrationDataUrl } from "./acceptance-work-assets.mjs"

export const SHOWCASE_ARTICLE_FILE = "tuuru-full-feature-showcase"

export const SHOWCASE_MODULE_TYPES = Object.freeze([
  "messages",
  "forum",
  "memo",
  "gallery",
  "browser",
  "shopping",
  "contacts",
])

const CREATED_AT = Date.UTC(2026, 6, 20, 0, 20, 0)

function emptyPhoneData(overrides = {}) {
  return {
    contacts: [],
    chats: [],
    moments: [],
    forumPosts: [],
    forumNpcs: [],
    apps: [],
    memos: [],
    photos: [],
    albums: [],
    browserHistory: [],
    shoppingItems: [],
    ...overrides,
  }
}

function moduleCard(id, type, label) {
  return `<div class="pm-inline-card" data-pm-id="${id}" data-pm-type="${type}"><span>${label}</span></div>`
}

function figure(image, caption) {
  return `<figure><img src="${image}" alt="${caption}"><figcaption>${caption}</figcaption></figure>`
}

function showcaseAssets() {
  return {
    cover: createIllustrationDataUrl("showcase-cover-gray-pink", { width: 320, height: 190 }),
    formatting: createIllustrationDataUrl("showcase-rich-text", { width: 280, height: 168 }),
    branchLeft: createIllustrationDataUrl("showcase-branch-left", { width: 280, height: 168 }),
    branchRight: createIllustrationDataUrl("showcase-branch-right", { width: 280, height: 168 }),
    avatarA: createIllustrationDataUrl("showcase-avatar-a", { width: 96, height: 96, kind: "portrait" }),
    avatarB: createIllustrationDataUrl("showcase-avatar-b", { width: 96, height: 96, kind: "portrait" }),
    avatarC: createIllustrationDataUrl("showcase-avatar-c", { width: 96, height: 96, kind: "portrait" }),
    chat: createIllustrationDataUrl("showcase-chat-image", { width: 220, height: 150 }),
    galleryA: createIllustrationDataUrl("showcase-gallery-a", { width: 220, height: 160 }),
    galleryB: createIllustrationDataUrl("showcase-gallery-b", { width: 220, height: 160 }),
    forum: createIllustrationDataUrl("showcase-forum-image", { width: 220, height: 160 }),
    productA: createIllustrationDataUrl("showcase-product-a", { width: 180, height: 140, kind: "product" }),
    productB: createIllustrationDataUrl("showcase-product-b", { width: 180, height: 140, kind: "product" }),
  }
}

function buildContacts(image) {
  return [
    {
      id: "showcase-contact-a",
      name: "示例联系人A",
      alias: "消息演示",
      avatarUrl: image.avatarA,
      note: "用于展示文字、图片、语音、选项与通话",
      faceUrl: image.avatarA,
      msgId: "showcase-chat-a",
      forumId: "showcase-forum-post",
    },
    {
      id: "showcase-contact-b",
      name: "示例联系人B",
      alias: "群聊演示",
      avatarUrl: image.avatarB,
      note: "用于展示转账与红包",
      faceUrl: image.avatarB,
      msgId: "showcase-chat-group",
      forumId: "showcase-forum-post",
    },
    {
      id: "showcase-contact-c",
      name: "示例联系人C",
      alias: "资料演示",
      avatarUrl: image.avatarC,
      note: "用于展示相册、备忘录和购物记录",
      faceUrl: image.avatarC,
      msgId: "showcase-chat-group",
      forumId: "showcase-forum-post",
    },
  ]
}

function buildModules(image, contacts) {
  const messages = {
    id: "showcase-module-messages",
    type: "messages",
    nodeId: "showcase-messages",
    data: emptyPhoneData({
      contacts,
      chats: [
        {
          id: "showcase-chat-a",
          type: "single",
          contactIds: ["showcase-contact-a"],
          groupName: "",
          messages: [],
          rounds: [
            {
              id: "showcase-chat-round-1",
              label: "【这是消息轮次1】",
              messages: [
                { id: "showcase-time", type: "time", time: "今天 20:26" },
                { id: "showcase-text", type: "text", senderId: "showcase-contact-a", text: "【这是一条文字消息】你好，某某。" },
                { id: "showcase-image", type: "image", senderId: "showcase-contact-a", image: image.chat, text: "" },
                { id: "showcase-voice", type: "voice", senderId: "showcase-contact-a", text: "【这是一条语音消息】点击后显示语音文本。", duration: 6 },
                {
                  id: "showcase-message-choice",
                  type: "text",
                  senderId: "showcase-contact-a",
                  text: "【这是消息选项】请选择一条完整回复。",
                  choices: [
                    {
                      id: "showcase-chat-choice-a",
                      text: "选择回复A",
                      replyText: "【这是读者回复A】",
                      followUpMessages: [
                        { id: "showcase-follow-a-1", type: "text", senderId: "showcase-contact-a", text: "【这是选择A的后续消息1】" },
                        { id: "showcase-follow-a-2", type: "image", senderId: "showcase-contact-a", image: image.galleryA, text: "" },
                      ],
                    },
                    {
                      id: "showcase-chat-choice-b",
                      text: "选择回复B",
                      replyText: "【这是读者回复B】",
                      followUpMessages: [
                        { id: "showcase-follow-b-1", type: "voice", senderId: "showcase-contact-a", text: "【这是选择B的后续语音】", duration: 4 },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: "showcase-chat-call",
          type: "group",
          contactIds: ["showcase-contact-a", "showcase-contact-b"],
          groupName: "【这是语音通话展示】",
          messages: [],
          rounds: [{
            id: "showcase-call-round",
            label: "【这是通话轮次】",
            messages: [{
              id: "showcase-call",
              type: "call",
              senderId: "showcase-contact-a",
              text: "【这是语音通话台词1】|【这是语音通话台词2】|【这是语音通话台词3】",
              callMode: "audio",
              callLines: ["【这是语音通话台词1】", "【这是语音通话台词2】", "【这是语音通话台词3】"],
            }],
          }],
        },
        {
          id: "showcase-chat-group",
          type: "group",
          contactIds: ["showcase-contact-a", "showcase-contact-b", "showcase-contact-c"],
          groupName: "【这是一个群聊】",
          messages: [],
          rounds: [{
            id: "showcase-group-round",
            label: "【这是群聊轮次】",
            messages: [
              { id: "showcase-group-text", type: "text", senderId: "showcase-contact-c", text: "【这是群聊文字消息】" },
              { id: "showcase-transfer", type: "transfer", senderId: "showcase-contact-b", transferAmount: 88.88, text: "" },
              { id: "showcase-redpacket", type: "redpacket", senderId: "showcase-contact-a", redpacketAmount: 6.66, redpacketMsg: "【这是红包祝福语】" },
            ],
          }],
        },
      ],
    }),
  }

  const forum = {
    id: "showcase-module-forum",
    type: "forum",
    nodeId: "showcase-social",
    data: emptyPhoneData({
      contacts,
      forumPosts: [{
        id: "showcase-forum-post",
        platform: "tieba",
        contactId: "showcase-contact-a",
        contactName: "示例联系人A",
        title: "【这是论坛帖子标题】",
        content: "【这是论坛帖子正文】此处展示图片、点赞、评论和评论选项。",
        images: [image.forum],
        time: "刚刚",
        likes: ["示例联系人B", "示例联系人C"],
        reposts: [],
        comments: [{
          id: "showcase-forum-comment",
          contactId: "showcase-contact-b",
          contactName: "示例联系人B",
          content: "【这是论坛评论】请选择一个回复。",
          time: "刚刚",
          choices: [
            { id: "showcase-forum-choice-a", text: "论坛回复A", replyText: "【这是论坛回复A】", followUpMessages: [{ contactId: "showcase-contact-b", contactName: "示例联系人B", content: "【这是论坛后续A】", time: "刚刚" }] },
            { id: "showcase-forum-choice-b", text: "论坛回复B", replyText: "【这是论坛回复B】", followUpMessages: [{ contactId: "showcase-contact-a", contactName: "示例联系人A", content: "【这是论坛后续B】", time: "刚刚" }] },
          ],
          replies: [{
            id: "showcase-forum-reply",
            contactId: "showcase-contact-c",
            contactName: "示例联系人C",
            content: "【这是一条嵌套回复】",
            time: "1分钟前",
            choices: [],
            replies: [],
          }],
        }],
      }],
    }),
  }

  const contactsModule = {
    id: "showcase-module-contacts",
    type: "contacts",
    nodeId: "showcase-social",
    data: emptyPhoneData({ contacts }),
  }

  const memo = {
    id: "showcase-module-memo",
    type: "memo",
    nodeId: "showcase-tools",
    data: emptyPhoneData({
      contacts,
      memos: [
        { id: "showcase-memo-1", contactId: "showcase-contact-a", title: "【这是备忘录标题1】", content: "<strong>【这是一段备忘录】</strong><br>支持粗体、换行与多条记录。" },
        { id: "showcase-memo-2", contactId: "showcase-contact-a", title: "【这是备忘录标题2】", content: "第一项：章节。<br>第二项：节点。<br>第三项：选项跳转。" },
      ],
    }),
  }

  const gallery = {
    id: "showcase-module-gallery",
    type: "gallery",
    nodeId: "showcase-tools",
    data: emptyPhoneData({
      contacts,
      albums: [
        { id: "showcase-album-a", contactId: "showcase-contact-a", name: "【这是相册1】" },
        { id: "showcase-album-b", contactId: "showcase-contact-a", name: "【这是相册2】" },
      ],
      photos: [
        { id: "showcase-photo-a", contactId: "showcase-contact-a", albumId: "showcase-album-a", caption: "【这是照片1】", imageUrl: image.galleryA, description: "展示照片说明", time: "今天" },
        { id: "showcase-photo-b", contactId: "showcase-contact-a", albumId: "showcase-album-b", caption: "【这是照片2】", imageUrl: image.galleryB, description: "展示相册二级页面", time: "昨天" },
      ],
    }),
  }

  const browser = {
    id: "showcase-module-browser",
    type: "browser",
    nodeId: "showcase-utilities",
    data: emptyPhoneData({
      contacts,
      browserHistory: [
        { id: "showcase-history-a", contactId: "showcase-contact-a", title: "【这是浏览记录1】占位符功能说明", url: "demo.local/placeholders", time: "20:26" },
        { id: "showcase-history-b", contactId: "showcase-contact-a", title: "【这是浏览记录2】分支跳转说明", url: "demo.local/choices", time: "20:27" },
        { id: "showcase-history-c", contactId: "showcase-contact-c", title: "【这是浏览记录3】手机模块说明", url: "demo.local/phone-modules", time: "20:28" },
      ],
    }),
  }

  const shopping = {
    id: "showcase-module-shopping",
    type: "shopping",
    nodeId: "showcase-utilities",
    data: emptyPhoneData({
      contacts,
      shoppingItems: [
        { id: "showcase-cart-a", contactId: "showcase-contact-a", status: "cart", name: "【这是购物车商品】", price: 19.9, imageUrl: image.productA, time: "今天" },
        { id: "showcase-order-a", contactId: "showcase-contact-a", status: "order", name: "【这是已购订单】", price: 88.8, imageUrl: image.productB, time: "昨天" },
      ],
    }),
  }

  return [messages, forum, memo, gallery, browser, shopping, contactsModule]
}

function buildNodes(image) {
  return [
    {
      id: "showcase-start",
      title: "【这是节点1】占位符替换",
      chapterId: "showcase-chapter-1",
      scene: "showcase-scene-article",
      content: `<h2>【这是章节1】文章基础</h2>${figure(image.cover, "Tuuru 灰粉功能展示封面")}<p><strong>【这是占位符替换结果】</strong></p><p>姓名=某某；昵称=小某；网名=wm。</p><p>只要读者在进入作品时填写内容，同一组占位文字会在正文中统一替换。</p><p>【这是选项组1】请选择下一项展示。</p>`,
      choices: [
        { id: "showcase-start-format", text: "查看富文本排版", targetId: "showcase-formatting" },
        { id: "showcase-start-branch", text: "跳到分支与汇流", targetId: "showcase-choice-group" },
      ],
    },
    {
      id: "showcase-formatting",
      title: "【这是节点2】富文本排版",
      chapterId: "showcase-chapter-1",
      scene: "showcase-scene-article",
      content: `<h2>【这是二级标题】</h2><p><strong>这是粗体</strong>、<em>这是斜体</em>、<u>这是下划线</u>，这一段用于展示正文格式。</p><blockquote>【这是引用块】读者可以调整字号、行距、页边距、背景和打字效果。</blockquote><hr><p style="text-align:center">【这是居中文字】</p><p style="text-align:right">【这是右对齐文字】</p>`,
      choices: [{ id: "showcase-format-picture", text: "继续查看图片与水印", targetId: "showcase-picture" }],
    },
    {
      id: "showcase-picture",
      title: "【这是节点3】图片与作者水印",
      chapterId: "showcase-chapter-1",
      scene: "showcase-scene-article",
      content: `${figure(image.formatting, "【这是一张内嵌图片】")}<p>【这是图片说明】图片保存在作品文件中；页面与文字之间可见作者设置的交叉斜排水印。</p>`,
      choices: [{ id: "showcase-picture-messages", text: "进入手机模块展示", targetId: "showcase-messages" }],
    },
    {
      id: "showcase-messages",
      title: "【这是节点4】消息模块",
      chapterId: "showcase-chapter-2",
      scene: "showcase-scene-phone",
      content: `<h2>【这是章节2】文章内置手机模块</h2><p>点击下面的消息通知，会直接进入对应页面。内容覆盖文字、图片、语音、回复选项、转账、红包和语音通话。</p>${moduleCard("showcase-module-messages", "messages", "打开【消息模块】")}`,
      choices: [{ id: "showcase-messages-social", text: "继续查看论坛与联系人", targetId: "showcase-social" }],
    },
    {
      id: "showcase-social",
      title: "【这是节点5】论坛与联系人",
      chapterId: "showcase-chapter-2",
      scene: "showcase-scene-phone",
      content: `<p>【这是论坛模块说明】展示帖子、图片、点赞、评论、嵌套回复与评论选项。</p>${moduleCard("showcase-module-forum", "forum", "打开【论坛模块】")}<p>【这是联系人模块说明】展示姓名、别名、备注与头像。</p>${moduleCard("showcase-module-contacts", "contacts", "打开【联系人模块】")}`,
      choices: [{ id: "showcase-social-tools", text: "继续查看备忘录与相册", targetId: "showcase-tools" }],
    },
    {
      id: "showcase-tools",
      title: "【这是节点6】备忘录与相册",
      chapterId: "showcase-chapter-2",
      scene: "showcase-scene-phone",
      content: `<p>【这是备忘录模块说明】展示多条富文本备忘录。</p>${moduleCard("showcase-module-memo", "memo", "打开【备忘录模块】")}<p>【这是相册模块说明】展示相册、照片和二级相册页面。</p>${moduleCard("showcase-module-gallery", "gallery", "打开【相册模块】")}`,
      choices: [{ id: "showcase-tools-utilities", text: "继续查看浏览器与购物", targetId: "showcase-utilities" }],
    },
    {
      id: "showcase-utilities",
      title: "【这是节点7】浏览器与购物",
      chapterId: "showcase-chapter-2",
      scene: "showcase-scene-phone",
      content: `<p>【这是浏览器模块说明】展示多条带时间的浏览记录。</p>${moduleCard("showcase-module-browser", "browser", "打开【浏览器模块】")}<p>【这是购物模块说明】展示购物车与已购订单两个页面。</p>${moduleCard("showcase-module-shopping", "shopping", "打开【购物模块】")}`,
      choices: [{ id: "showcase-utilities-choice", text: "进入选项跳转演示", targetId: "showcase-choice-group" }],
    },
    {
      id: "showcase-choice-group",
      title: "【这是节点8】分支选项",
      chapterId: "showcase-chapter-3",
      scene: "showcase-scene-branch",
      content: `<h2>【这是章节3】分支、汇流与回退</h2><p>【这是选项组2】下面两个选项会进入不同节点，随后汇流到同一个节点。</p>`,
      choices: [
        { id: "showcase-choice-left", text: "进入分支A", targetId: "showcase-branch-a" },
        { id: "showcase-choice-right", text: "进入分支B", targetId: "showcase-branch-b" },
      ],
    },
    {
      id: "showcase-branch-a",
      title: "【这是节点9A】分支A",
      chapterId: "showcase-chapter-3",
      scene: "showcase-scene-branch",
      content: `${figure(image.branchLeft, "【这是分支A图片】")}<p>这是只在选择分支A后显示的内容。</p>`,
      choices: [{ id: "showcase-branch-a-merge", text: "汇流到公共节点", targetId: "showcase-merge" }],
    },
    {
      id: "showcase-branch-b",
      title: "【这是节点9B】分支B",
      chapterId: "showcase-chapter-3",
      scene: "showcase-scene-branch",
      content: `${figure(image.branchRight, "【这是分支B图片】")}<p>这是只在选择分支B后显示的内容。</p>`,
      choices: [{ id: "showcase-branch-b-merge", text: "汇流到公共节点", targetId: "showcase-merge" }],
    },
    {
      id: "showcase-merge",
      title: "【这是节点10】公共汇流节点",
      chapterId: "showcase-chapter-3",
      scene: "showcase-scene-branch",
      content: `<p>【这是汇流结果】无论选择分支A还是分支B，都会到达这里。</p><p>左上角返回按钮会回到刚才访问的上一节，而不是退出阅读器。</p>`,
      choices: [
        { id: "showcase-merge-loop", text: "查看回环跳转", targetId: "showcase-loop" },
        { id: "showcase-merge-end", text: "直接进入结束页", targetId: "showcase-end" },
      ],
    },
    {
      id: "showcase-loop",
      title: "【这是节点11】回环跳转",
      chapterId: "showcase-chapter-4",
      scene: "showcase-scene-end",
      content: `<h2>【这是章节4】回环与结束</h2><p>【这是回环节点】可以返回第一个节点，也可以继续结束。</p>`,
      choices: [
        { id: "showcase-loop-start", text: "回到第一个节点", targetId: "showcase-start" },
        { id: "showcase-loop-end", text: "进入结束页", targetId: "showcase-end" },
      ],
    },
    {
      id: "showcase-end",
      title: "【这是节点12】功能展示结束",
      chapterId: "showcase-chapter-4",
      scene: "showcase-scene-end",
      content: `<h2>【这是无选项结束节点】</h2><p>已展示章节、节点、富文本、图片、占位符、水印、选项分支、汇流、回环、上一节返回和七类手机模块。</p>`,
      choices: [],
    },
  ]
}

export function buildShowcaseArticleWork() {
  const image = showcaseAssets()
  const contacts = buildContacts(image)

  return {
    id: "showcase-article-20260720",
    schemaVersion: CURRENT_WORK_SCHEMA_VERSION,
    type: "article",
    title: "《Tuuru 全功能展示》",
    desc: "非故事型功能展板：四章十三节点，覆盖占位符、富文本、图片、水印、分支跳转与七类文章手机模块。",
    coverColor: "#8f6671",
    author: "Tuuru 功能演示",
    authorNote: "阅读密码：2026。建议将姓名填为“小桃”、昵称填为“桃桃”、网名填为“桃子汽水”，并按节点顺序打开所有手机模块。",
    createdAt: CREATED_AT,
    password: "2026",
    locked: true,
    watermark: {
      enabled: true,
      kind: "text",
      text: "纯代乙向禁止偷吃 · Tuuru 功能展示",
      image: null,
      opacity: 0.14,
      coverage: "full",
      position: "center",
      pattern: "cross",
      spacing: 118,
    },
    chapters: [
      { id: "showcase-chapter-1", name: "第一章 · 文章与占位符" },
      { id: "showcase-chapter-2", name: "第二章 · 文章手机模块" },
      { id: "showcase-chapter-3", name: "第三章 · 选项跳转" },
      { id: "showcase-chapter-4", name: "第四章 · 回环与结束" },
    ],
    scenes: [
      { id: "showcase-scene-article", name: "文章功能" },
      { id: "showcase-scene-phone", name: "手机模块" },
      { id: "showcase-scene-branch", name: "跳转逻辑" },
      { id: "showcase-scene-end", name: "回环结束" },
    ],
    placeholders: [
      { id: "showcase-placeholder-name", key: "某某", label: "姓名（某某）", prompt: "例如：小桃", mode: "each", forbidden: [], values: ["小桃"], default: "某某" },
      { id: "showcase-placeholder-nickname", key: "小某", label: "昵称（小某）", prompt: "例如：桃桃", mode: "each", forbidden: [], values: ["桃桃"], default: "小某" },
      { id: "showcase-placeholder-webname", key: "wm", label: "网名（wm）", prompt: "例如：桃子汽水", mode: "each", forbidden: [], values: ["桃子汽水"], default: "wm" },
    ],
    placeholderMode: "each",
    nodes: buildNodes(image),
    phoneModules: buildModules(image, contacts),
    startNode: "showcase-start",
  }
}
