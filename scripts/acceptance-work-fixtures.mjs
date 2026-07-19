import { PHONE_APP_DEFS } from "../js/data.js"
import { CURRENT_WORK_SCHEMA_VERSION } from "../js/work-schema.js"
import { createIllustrationDataUrl } from "./acceptance-work-assets.mjs"

export const ACCEPTANCE_APP_TYPES = Object.freeze([
  "messages",
  "forum",
  "memo",
  "gallery",
  "browser",
  "shopping",
  "contacts",
])

export const ACCEPTANCE_FILES = Object.freeze({
  article: "tuuru-article-acceptance",
  phone: "tuuru-phone-acceptance",
})

const CREATED_AT = Date.UTC(2026, 6, 19, 8, 0, 0)

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

function articleAssets() {
  return {
    cover: createIllustrationDataUrl("article-cover-mist-port", { width: 320, height: 190 }),
    platform: createIllustrationDataUrl("article-rain-platform", { width: 280, height: 168 }),
    market: createIllustrationDataUrl("article-night-market", { width: 280, height: 168 }),
    rooftop: createIllustrationDataUrl("article-rooftop-dawn", { width: 280, height: 168 }),
    avatar: createIllustrationDataUrl("article-contact-lin", { width: 96, height: 96, kind: "portrait" }),
    clue: createIllustrationDataUrl("article-gallery-ticket", { width: 180, height: 120, kind: "product" }),
    forum: createIllustrationDataUrl("article-forum-clock", { width: 180, height: 120 }),
    product: createIllustrationDataUrl("article-shop-recorder", { width: 180, height: 120, kind: "product" }),
  }
}

export function buildArticleAcceptanceWork() {
  const image = articleAssets()
  const contact = {
    id: "article-lin",
    name: "林弦",
    alias: "L",
    avatarUrl: image.avatar,
    note: "雾港旧站值夜人",
    faceUrl: image.avatar,
    msgId: "article-chat",
    forumId: "article-post",
  }

  const modules = [
    {
      id: "module-messages",
      type: "messages",
      nodeId: "start",
      data: emptyPhoneData({
        contacts: [contact],
        chats: [{
          id: "article-chat",
          type: "single",
          contactIds: [contact.id],
          groupName: "",
          messages: [],
          rounds: [{
            id: "article-chat-round",
            label: "未读来信",
            messages: [
              { id: "article-chat-time", type: "time", time: "23:17" },
              { id: "article-chat-text", type: "text", senderId: contact.id, text: "别找钟声。去找那张没有日期的票。" },
              { id: "article-chat-image", type: "image", senderId: contact.id, image: image.clue },
            ],
          }],
        }],
      }),
    },
    {
      id: "module-gallery",
      type: "gallery",
      nodeId: "platform",
      data: emptyPhoneData({
        contacts: [contact],
        albums: [{ id: "article-album", contactId: contact.id, name: "没有日期的票" }],
        photos: [
          { id: "article-photo-1", contactId: contact.id, albumId: "article-album", caption: "背面的手写坐标", imageUrl: image.clue, time: "未知" },
          { id: "article-photo-2", contactId: contact.id, albumId: null, caption: "空站台", imageUrl: image.platform, time: "23:20" },
        ],
      }),
    },
    {
      id: "module-contacts",
      type: "contacts",
      nodeId: "inbox",
      data: emptyPhoneData({ contacts: [contact, { ...contact, id: "article-qiao", name: "乔砂", alias: "档案室" }] }),
    },
    {
      id: "module-forum",
      type: "forum",
      nodeId: "forum",
      data: emptyPhoneData({
        contacts: [contact],
        forumPosts: [{
          id: "article-post",
          platform: "tieba",
          contactId: contact.id,
          contactName: contact.name,
          title: "旧站午夜为什么会多出第七码？",
          content: "钟停在 23:17 时，不要看站牌，数地上的影子。",
          images: [image.forum],
          time: "昨夜 23:18",
          likes: ["乔砂"],
          reposts: [],
          comments: [{
            id: "article-comment",
            contactId: "article-qiao",
            contactName: "乔砂",
            content: "第七个影子通向天台。",
            time: "23:21",
            choices: [],
            replies: [],
          }],
        }],
      }),
    },
    {
      id: "module-memo",
      type: "memo",
      nodeId: "quiet-room",
      data: emptyPhoneData({
        contacts: [contact],
        memos: [{ id: "article-memo", contactId: contact.id, title: "值夜规则", content: "<strong>值夜规则</strong><br>一、不要替钟上弦。<br>二、记住：真正的出口在风来的方向。" }],
      }),
    },
    {
      id: "module-shopping",
      type: "shopping",
      nodeId: "market",
      data: emptyPhoneData({
        contacts: [contact],
        shoppingItems: [
          { id: "article-cart", contactId: contact.id, status: "cart", name: "袖珍录音机", price: 117, imageUrl: image.product, time: "23:25" },
          { id: "article-order", contactId: contact.id, status: "order", name: "铜制发条钥匙", price: 23.17, imageUrl: image.clue, time: "三年前" },
        ],
      }),
    },
    {
      id: "module-browser",
      type: "browser",
      nodeId: "market",
      data: emptyPhoneData({
        contacts: [contact],
        browserHistory: [
          { id: "article-history-1", contactId: contact.id, title: "雾港旧站封闭记录", url: "archive.local/station-07", time: "23:16" },
          { id: "article-history-2", contactId: contact.id, title: "如何辨认逆风方向", url: "field-note.local/wind", time: "23:17" },
        ],
      }),
    },
  ]

  const nodes = [
    {
      id: "start",
      title: "第七码",
      chapterId: "chapter-mist",
      scene: "scene-platform",
      content: `${figure(image.cover, "雾中的旧站与停住的钟")}<p>雾港旧站封闭后的第七年，<em>某某</em>在午夜收到一条没有号码的消息。</p><p>屏幕只亮了三秒，钟却从此停在 23:17。</p>${moduleCard("module-messages", "messages", "查看未读来信")}`,
      choices: [
        { id: "choice-start-platform", text: "沿站台追那束光", targetId: "platform" },
        { id: "choice-start-inbox", text: "先核对发信人的身份", targetId: "inbox" },
      ],
    },
    {
      id: "platform",
      title: "雨水里的票根",
      chapterId: "chapter-mist",
      scene: "scene-platform",
      content: `${figure(image.platform, "雨夜站台")}<p>第六盏灯下压着一张干燥的旧票，背面墨迹仍新。</p>${moduleCard("module-gallery", "gallery", "打开票根相册")}`,
      choices: [
        { id: "choice-platform-forum", text: "搜索旧站传闻", targetId: "forum" },
        { id: "choice-platform-market", text: "按票根坐标去夜市", targetId: "market" },
      ],
    },
    {
      id: "inbox",
      title: "两个同名联系人",
      chapterId: "chapter-mist",
      scene: "scene-archive",
      content: `<p>通讯录里有两个从未添加过的人。一个备注“值夜”，另一个备注“档案室”。</p>${moduleCard("module-contacts", "contacts", "核对联系人")}`,
      choices: [
        { id: "choice-inbox-forum", text: "追查林弦留下的论坛账号", targetId: "forum" },
        { id: "choice-inbox-quiet", text: "去档案室找乔砂", targetId: "quiet-room" },
      ],
    },
    {
      id: "forum",
      title: "删不掉的帖子",
      chapterId: "chapter-mist",
      scene: "scene-archive",
      content: `<p>帖子每刷新一次，就多出一句像是写给此刻的你。</p>${moduleCard("module-forum", "forum", "阅读午夜旧帖")}`,
      choices: [{ id: "choice-forum-market", text: "带着第七个影子的坐标去夜市", targetId: "market" }],
    },
    {
      id: "quiet-room",
      title: "档案室没有风",
      chapterId: "chapter-mist",
      scene: "scene-archive",
      content: `<p>乔砂不在，桌上的手机却停在一页未关闭的备忘录。</p>${moduleCard("module-memo", "memo", "查看值夜规则")}`,
      choices: [
        { id: "choice-quiet-market", text: "去买录音机验证钟声", targetId: "market" },
        { id: "choice-quiet-platform", text: "返回站台重新数影子", targetId: "platform" },
      ],
    },
    {
      id: "market",
      title: "只收旧时间的摊位",
      chapterId: "chapter-corridor",
      scene: "scene-market",
      content: `${figure(image.market, "雨棚下的雾港夜市")}<p>摊主不要钱，只问你愿不愿意把 23:17 之后的记忆留下。</p>${moduleCard("module-shopping", "shopping", "查看购物与订单")}${moduleCard("module-browser", "browser", "查看浏览记录")}`,
      choices: [
        { id: "choice-market-rooftop", text: "买下录音机，去天台迎风播放", targetId: "rooftop" },
        { id: "choice-market-archive", text: "拒绝交易，返回档案室查封站记录", targetId: "archive" },
      ],
    },
    {
      id: "archive",
      title: "被改写的封站记录",
      chapterId: "chapter-corridor",
      scene: "scene-archive",
      content: `<p>纸面记录说旧站从未有第七码；复写纸下却压着林弦的名字。</p><blockquote>出口不在地图上，在你愿意相信的那阵风里。</blockquote>`,
      choices: [
        { id: "choice-archive-rooftop", text: "把记录带上天台", targetId: "rooftop" },
        { id: "choice-archive-ending", text: "烧掉记录，让第七码消失", targetId: "ending" },
      ],
    },
    {
      id: "rooftop",
      title: "逆风的方向",
      chapterId: "chapter-ending",
      scene: "scene-rooftop",
      content: `${figure(image.rooftop, "天台尽头的晨光")}<p>录音机倒放钟声后，雾像门帘一样从中间分开。林弦站在七年前的晨光里。</p>`,
      choices: [
        { id: "choice-rooftop-wait", text: "留下来等钟重新走动", targetId: "ending" },
        { id: "choice-rooftop-go", text: "牵住他的手穿过雾门", targetId: "ending" },
      ],
    },
    {
      id: "ending",
      title: "零点以后",
      chapterId: "chapter-ending",
      scene: "scene-rooftop",
      content: `<p>零点的第一声钟响起时，所有屏幕同时熄灭。</p><p>只有那张没有日期的票还留在掌心，背面多了一行字：<strong>这一次，你没有来迟。</strong></p>`,
      choices: [],
    },
  ]

  return {
    id: "acceptance-article-20260719",
    schemaVersion: CURRENT_WORK_SCHEMA_VERSION,
    type: "article",
    title: "《雾港第七码》全链路验收作品",
    desc: "三章九节点的离线分支短篇；覆盖七类文章手机模块、内嵌图片、回环与汇流跳转。",
    coverColor: "#526978",
    author: "Tuuru 验收作者",
    authorNote: "这是功能验收样例，不是正式连载。请按 README 的两条路线分别阅读，并逐个打开手机卡片。",
    createdAt: CREATED_AT,
    password: "2468",
    locked: true,
    watermark: {
      enabled: true,
      kind: "text",
      text: "纯代乙向禁止偷吃 · Tuuru 验收样例",
      image: null,
      opacity: 0.14,
      coverage: "full",
      position: "bottom-right",
      pattern: "cross",
      spacing: 112,
    },
    chapters: [
      { id: "chapter-mist", name: "第一章 · 雾中来信" },
      { id: "chapter-corridor", name: "第二章 · 失物回廊" },
      { id: "chapter-ending", name: "第三章 · 零点以后" },
    ],
    scenes: [
      { id: "scene-platform", name: "旧站台" },
      { id: "scene-archive", name: "档案室" },
      { id: "scene-market", name: "雾港夜市" },
      { id: "scene-rooftop", name: "旧站天台" },
    ],
    placeholders: [{
      id: "placeholder-name",
      key: "某某",
      label: "读者姓名",
      prompt: "主角希望被怎样称呼？",
      mode: "each",
      forbidden: [],
      values: ["阿雾", "小满"],
      default: "某某",
    }],
    placeholderMode: "each",
    nodes,
    phoneModules: modules,
    startNode: "start",
  }
}

function phoneAssets() {
  return {
    wallpaper: createIllustrationDataUrl("phone-wallpaper-starry-port", { width: 300, height: 520, kind: "wallpaper" }),
    top: createIllustrationDataUrl("phone-profile-rain-roof", { width: 300, height: 130 }),
    reader: createIllustrationDataUrl("phone-reader-avatar", { width: 96, height: 96, kind: "portrait" }),
    lin: createIllustrationDataUrl("phone-lin-avatar", { width: 96, height: 96, kind: "portrait" }),
    zhen: createIllustrationDataUrl("phone-zhen-avatar", { width: 96, height: 96, kind: "portrait" }),
    qiao: createIllustrationDataUrl("phone-qiao-avatar", { width: 96, height: 96, kind: "portrait" }),
    pier: createIllustrationDataUrl("phone-gallery-pier", { width: 220, height: 160 }),
    ticket: createIllustrationDataUrl("phone-gallery-ticket", { width: 220, height: 160, kind: "product" }),
    clock: createIllustrationDataUrl("phone-forum-clock", { width: 220, height: 160 }),
    recorder: createIllustrationDataUrl("phone-product-recorder", { width: 180, height: 140, kind: "product" }),
    umbrella: createIllustrationDataUrl("phone-product-umbrella", { width: 180, height: 140, kind: "product" }),
    seal: createIllustrationDataUrl("phone-watermark-seal", { width: 128, height: 128, kind: "seal" }),
  }
}

function phoneApps() {
  const order = [
    ["gallery", 0, 0, "影像匣"],
    ["memo", 1, 0, "便笺"],
    ["messages", 2, 0, "信号"],
    ["contacts", 3, 0, "人物簿"],
    ["browser", 0, 1, "航迹"],
    ["forum", 1, 1, "雾港板"],
    ["shopping", 2, 1, "交换所"],
  ]
  return order.map(([type, desktopX, desktopY, name]) => ({
    id: `acceptance-app-${type}`,
    type,
    name,
    icon: PHONE_APP_DEFS[type].icon,
    color: {
      gallery: "#d8bdc9",
      memo: "#e6d8b8",
      messages: "#b7c9d5",
      contacts: "#cabcc1",
      browser: "#b9c7c1",
      forum: "#c4b7d1",
      shopping: "#d6b2aa",
    }[type],
    desktopX,
    desktopY,
    enabled: true,
  }))
}

export function buildPhoneAcceptanceWork() {
  const image = phoneAssets()
  const contacts = [
    { id: "phone-lin", name: "林弦", alias: "值夜人", avatarUrl: image.lin, note: "23:17 后不要替钟上弦", faceUrl: image.lin, msgId: "chat-lin", forumId: "post-clock" },
    { id: "phone-zhen", name: "甄遥", alias: "船主", avatarUrl: image.zhen, note: "只在涨潮时回消息", faceUrl: image.zhen, msgId: "chat-group", forumId: "post-pier" },
    { id: "phone-qiao", name: "乔砂", alias: "档案员", avatarUrl: image.qiao, note: "习惯把答案写进备忘录", faceUrl: image.qiao, msgId: "chat-group", forumId: "post-clock" },
  ]

  const chatChoice = {
    id: "message-choice-owner",
    type: "text",
    senderId: "phone-lin",
    text: "雾里有两条路。你准备从哪里进站？",
    choices: [
      {
        id: "chat-choice-platform",
        text: "从旧站台进去",
        replyText: "我走旧站台。",
        followUpMessages: [
          { id: "template-platform-1", type: "text", senderId: "phone-lin", text: "数第七个影子，别看站牌。" },
          { id: "template-platform-2", type: "image", senderId: "phone-lin", image: image.ticket, text: "" },
        ],
      },
      {
        id: "chat-choice-pier",
        text: "先去码头找船",
        replyText: "我先去码头。",
        followUpMessages: [
          { id: "template-pier-1", type: "text", senderId: "phone-lin", text: "那就找一把红伞，甄遥会认得你。" },
        ],
      },
      {
        id: "chat-choice-wait",
        text: "原地等你来接",
        replyText: "我在原地等。",
        followUpMessages: [
          { id: "template-wait-1", type: "voice", senderId: "phone-lin", text: "别回头。我已经看见你了。", duration: 4 },
        ],
      },
    ],
  }

  const chats = [
    {
      id: "chat-lin",
      type: "single",
      contactIds: ["phone-lin"],
      groupName: "",
      messages: [],
      rounds: [
        {
          id: "chat-lin-round-1",
          label: "23:17",
          messages: [
            { id: "message-time-1", type: "time", time: "今天 23:17" },
            { id: "message-text-1", type: "text", senderId: "phone-lin", text: "测试员，欢迎来到雾港。" },
            { id: "message-image-1", type: "image", senderId: "phone-lin", image: image.pier },
            { id: "message-voice-1", type: "voice", senderId: "phone-lin", text: "钟声停下以后，所有选择都可以重来。", duration: 6 },
            chatChoice,
          ],
        },
        {
          id: "chat-lin-round-2",
          label: "未接来电",
          messages: [{
            id: "message-call-1",
            type: "call",
            senderId: "phone-lin",
            text: "别挂断。|看左边第三盏灯。|灯下就是入口。",
            callMode: "audio",
            callLines: ["别挂断。", "看左边第三盏灯。", "灯下就是入口。"],
          }],
        },
      ],
    },
    {
      id: "chat-group",
      type: "group",
      contactIds: ["phone-lin", "phone-zhen", "phone-qiao"],
      groupName: "零点值夜组",
      messages: [],
      rounds: [{
        id: "chat-group-round",
        label: "值夜交接",
        messages: [
          { id: "group-time", type: "time", time: "昨天 22:50" },
          { id: "group-message-1", type: "text", senderId: "phone-qiao", text: "档案已锁，四个设备入口都接到林弦名下。" },
          { id: "group-message-2", type: "transfer", senderId: "phone-zhen", transferAmount: 23.17, text: "" },
          { id: "group-message-3", type: "redpacket", senderId: "phone-lin", redpacketAmount: 7, redpacketMsg: "第七码通行费" },
        ],
      }],
    },
  ]

  const moments = [{
    id: "moment-pier",
    contactId: "phone-zhen",
    contactName: "甄遥",
    content: "涨潮前最后一班船。有人要去旧站吗？",
    images: [image.pier, image.umbrella],
    time: "22:43",
    likes: ["林弦", "乔砂"],
    comments: [{
      id: "moment-choice-owner",
      contactId: "phone-zhen",
      contactName: "甄遥",
      content: "只剩一个座位，报暗号。",
      time: "22:44",
      choices: [
        { id: "moment-choice-seven", text: "第七码", replyText: "第七码。", followUpMessages: [{ contactId: "phone-zhen", contactName: "甄遥", content: "上船，坐船尾。", time: "刚刚" }] },
        { id: "moment-choice-clock", text: "23:17", replyText: "23:17。", followUpMessages: [{ contactId: "phone-zhen", contactName: "甄遥", content: "时间对，暗号不对。再想想。", time: "刚刚" }] },
      ],
    }],
  }]

  const forumPosts = [
    {
      id: "post-clock",
      platform: "tieba",
      contactId: "phone-lin",
      contactName: "林弦",
      title: "[置顶] 雾港旧站完整值夜规则",
      content: "如果手机里的 App 顺序改变，按相册→备忘→消息→联系人→浏览→论坛→购物的顺序重新打开。",
      images: [image.clock],
      time: "三年前",
      likes: ["乔砂", "甄遥"],
      reposts: [],
      comments: [{
        id: "forum-choice-owner",
        contactId: "phone-qiao",
        contactName: "乔砂",
        content: "你在第七条规则后看见了什么？",
        time: "刚刚",
        choices: [
          { id: "forum-choice-door", text: "一扇门", replyText: "我看见一扇门。", followUpMessages: [{ contactId: "phone-qiao", contactName: "乔砂", content: "那么它会为你打开。", time: "刚刚" }] },
          { id: "forum-choice-name", text: "林弦的名字", replyText: "我只看见林弦的名字。", followUpMessages: [{ contactId: "phone-lin", contactName: "林弦", content: "终于有人还能读到。", time: "刚刚" }] },
        ],
        replies: [{ id: "forum-reply-authored", contactId: "phone-zhen", contactName: "甄遥", content: "我当年看见的是潮汐表。", time: "两年前", choices: [], replies: [] }],
      }],
    },
    {
      id: "post-pier",
      platform: "weibo",
      contactId: "phone-zhen",
      contactName: "甄遥",
      title: "码头失物招领：一把红伞",
      content: "伞骨内侧刻着 07。失主请带票根来领。",
      images: [image.umbrella],
      time: "今天 18:30",
      likes: [],
      reposts: [],
      comments: [],
    },
  ]

  return {
    id: "acceptance-phone-20260719",
    schemaVersion: CURRENT_WORK_SCHEMA_VERSION,
    type: "phone",
    title: "《雾港口袋终端》纯小手机验收作品",
    desc: "覆盖七个可导出 App、复杂桌面排序、角色设备接入、聊天/动态/论坛选项、相册与购物二级跳转。",
    coverColor: "#384b5c",
    author: "Tuuru 验收作者",
    authorNote: "建议按桌面视觉顺序逐个打开 App；四个资料类 App 会先显示林弦设备接入确认。读者仍可在阅读器美化页覆盖显示习惯。",
    createdAt: CREATED_AT + 1000,
    password: "",
    locked: false,
    watermark: {
      enabled: true,
      kind: "image",
      text: "",
      image: image.seal,
      opacity: 0.12,
      coverage: "full",
      position: "center",
      pattern: "cross",
      spacing: 138,
    },
    placeholders: [],
    scenes: [],
    phoneData: {
      contacts,
      chats,
      moments,
      forumPosts,
      forumNpcs: [{ id: "npc-tide", name: "潮汐播报", avatarUrl: image.clock }],
      apps: phoneApps(),
      skin: {
        wallpaper: "#283848",
        wallpaperType: "image",
        wallpaperImage: image.wallpaper,
        frameColor: "#6e7f8e",
        borderRadius: 30,
        fontFamily: "KaiTi, serif",
        fontSize: 13,
        readerId: "雾港档案员",
        readerAvatar: image.reader,
        showDynamicIsland: true,
        iconStyle: "mixed",
        showIconShadow: false,
        iconBorderRadius: 14,
        showGlassEffect: true,
        iconColumns: 4,
        showAppLabels: true,
        timeColor: "#f6e7cc",
        showHomeIndicator: true,
        materialType: "glass",
        materialOpacity: 72,
        topBgImage: image.top,
      },
      appConnections: {
        memo: { contactId: "phone-lin", prompt: "林弦留下的备忘录仍在同步，是否接入他的设备？" },
        gallery: { contactId: "phone-lin", prompt: "检测到林弦手机内的旧站相册，是否接入？" },
        browser: { contactId: "phone-lin", prompt: "一段来自林弦设备的浏览记录正在请求显示。" },
        shopping: { contactId: "phone-lin", prompt: "林弦的购物与订单记录包含剧情线索，是否接入？" },
      },
      readingFlow: {
        enabled: true,
        sequence: [
          { type: "messages", itemId: "message-time-1", chatId: "chat-lin", roundId: "chat-lin-round-1", contactId: "phone-lin", label: "林弦 · 今天 23:17" },
          { type: "messages", itemId: "message-text-1", chatId: "chat-lin", roundId: "chat-lin-round-1", contactId: "phone-lin", label: "林弦 · 欢迎来到雾港" },
          { type: "messages", itemId: "message-image-1", chatId: "chat-lin", roundId: "chat-lin-round-1", contactId: "phone-lin", label: "林弦 · 码头照片" },
          { type: "messages", itemId: "message-voice-1", chatId: "chat-lin", roundId: "chat-lin-round-1", contactId: "phone-lin", label: "林弦 · 语音消息" },
          { type: "messages", itemId: "message-choice-owner", chatId: "chat-lin", roundId: "chat-lin-round-1", contactId: "phone-lin", label: "林弦 · 选择进站路线" },
          { type: "messages", itemId: "message-call-1", chatId: "chat-lin", roundId: "chat-lin-round-2", contactId: "phone-lin", label: "林弦 · 语音通话" },
          { type: "forum", itemId: "post-clock", contactId: "phone-lin", label: "查看置顶的值夜规则" },
          { type: "moments", itemId: "moment-pier", contactId: "phone-zhen", label: "甄遥 · 涨潮前最后一班船" },
          { type: "memo", itemId: "memo-lin-1", contactId: "phone-lin", label: "林弦 · 桌面顺序" },
          { type: "gallery", itemId: "photo-station-1", contactId: "phone-lin", label: "林弦 · 停在 23:17 的钟" },
          { type: "browser", itemId: "history-lin-1", contactId: "phone-lin", label: "林弦 · 雾港旧站封站记录" },
          { type: "shopping", itemId: "shop-order-ticket", contactId: "phone-lin", label: "林弦 · 旧站纪念票" },
        ],
      },
      memos: [
        { id: "memo-lin-1", contactId: "phone-lin", title: "测试顺序", content: "<strong>桌面顺序</strong><br>影像匣 → 便笺 → 信号 → 人物簿<br>航迹 → 雾港板 → 交换所" },
        { id: "memo-lin-2", contactId: "phone-lin", title: "第七码", content: "每个选择都允许重选。真正的答案不会因为第一次走错而消失。" },
        { id: "memo-qiao-1", contactId: "phone-qiao", title: "档案备份", content: "乔砂的独立备忘：23:17 是钟停下的时间，不是故事结束的时间。" },
      ],
      albums: [
        { id: "album-station", contactId: "phone-lin", name: "旧站勘察" },
        { id: "album-pier", contactId: "phone-lin", name: "潮汐与码头" },
        { id: "album-qiao", contactId: "phone-qiao", name: "档案扫描" },
      ],
      photos: [
        { id: "photo-station-1", contactId: "phone-lin", albumId: "album-station", caption: "停在 23:17 的钟", imageUrl: image.clock, description: "第七码上方的旧钟", time: "三年前" },
        { id: "photo-station-2", contactId: "phone-lin", albumId: "album-station", caption: "无日期票根", imageUrl: image.ticket, description: "背面有手写坐标", time: "三年前" },
        { id: "photo-pier-1", contactId: "phone-lin", albumId: "album-pier", caption: "涨潮前的码头", imageUrl: image.pier, time: "昨天" },
        { id: "photo-loose", contactId: "phone-lin", albumId: null, caption: "红伞", imageUrl: image.umbrella, time: "今天" },
        { id: "photo-qiao-1", contactId: "phone-qiao", albumId: "album-qiao", caption: "封站记录", imageUrl: image.ticket, time: "三年前" },
      ],
      browserHistory: [
        { id: "history-lin-1", contactId: "phone-lin", title: "雾港旧站封站记录", url: "archive.local/station-07", time: "07-19 23:12" },
        { id: "history-lin-2", contactId: "phone-lin", title: "逆风方向判断", url: "field-note.local/wind", time: "07-19 23:14" },
        { id: "history-lin-3", contactId: "phone-lin", title: "票根纸张年份检测", url: "lab.local/ticket", time: "07-19 23:16" },
        { id: "history-qiao-1", contactId: "phone-qiao", title: "档案复写纸还原", url: "archive.local/carbon", time: "07-18 09:30" },
      ],
      shoppingItems: [
        { id: "shop-cart-recorder", contactId: "phone-lin", status: "cart", name: "袖珍录音机", price: 117, imageUrl: image.recorder, time: "今天" },
        { id: "shop-cart-umbrella", contactId: "phone-lin", status: "cart", name: "红柄长伞", price: 37.5, imageUrl: image.umbrella, time: "今天" },
        { id: "shop-order-ticket", contactId: "phone-lin", status: "order", name: "旧站纪念票", price: 23.17, imageUrl: image.ticket, time: "三年前" },
        { id: "shop-qiao", contactId: "phone-qiao", status: "order", name: "无酸档案袋", price: 19.9, imageUrl: image.ticket, time: "昨天" },
      ],
    },
  }
}

export function buildAcceptanceWorks() {
  return {
    article: buildArticleAcceptanceWork(),
    phone: buildPhoneAcceptanceWork(),
  }
}
