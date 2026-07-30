import { PHONE_APP_DEFS } from "../js/data.js"
import { CURRENT_WORK_SCHEMA_VERSION } from "../js/work-schema.js"
import { createIllustrationDataUrl } from "./acceptance-work-assets.mjs"

export const SHOWCASE_PHONE_FILE = "tuuru-phone-full-chain-showcase"

export const SHOWCASE_MESSAGE_TYPES = Object.freeze([
  "text",
  "image",
  "voice",
  "link",
  "redpacket",
  "transfer",
  "familycard",
  "takeaway",
  "location",
  "time",
  "call",
])

const CREATED_AT = Date.UTC(2026, 6, 30, 2, 30, 0)

function assets() {
  return {
    wallpaper: createIllustrationDataUrl("showcase-phone-wallpaper-night-station", { width: 320, height: 560, kind: "wallpaper" }),
    top: createIllustrationDataUrl("showcase-phone-profile-platform", { width: 320, height: 132 }),
    lin: createIllustrationDataUrl("showcase-phone-linwan", { width: 96, height: 96, kind: "portrait" }),
    zhou: createIllustrationDataUrl("showcase-phone-zhouyu", { width: 96, height: 96, kind: "portrait" }),
    aunt: createIllustrationDataUrl("showcase-phone-aunt-he", { width: 96, height: 96, kind: "portrait" }),
    group: createIllustrationDataUrl("showcase-phone-night-watch-group", { width: 96, height: 96, kind: "portrait" }),
    platform: createIllustrationDataUrl("showcase-phone-old-platform", { width: 240, height: 168 }),
    map: createIllustrationDataUrl("showcase-phone-station-map", { width: 240, height: 168 }),
    clock: createIllustrationDataUrl("showcase-phone-platform-clock", { width: 240, height: 168 }),
    ticket: createIllustrationDataUrl("showcase-phone-old-ticket", { width: 220, height: 154, kind: "product" }),
    recorder: createIllustrationDataUrl("showcase-phone-recorder", { width: 190, height: 142, kind: "product" }),
    soup: createIllustrationDataUrl("showcase-phone-warm-soup", { width: 190, height: 142, kind: "product" }),
  }
}

function apps() {
  const records = [
    ["messages", "消息", "#adc8bd", 0, 0],
    ["contacts", "联系人", "#d9c2c9", 1, 0],
    ["forum", "旧站论坛", "#bdc5d8", 2, 0],
    ["memo", "备忘录", "#d7c9a8", 3, 0],
    ["gallery", "相册", "#c8b9d7", 0, 1],
    ["browser", "浏览器", "#b8ced3", 1, 1],
    ["shopping", "购物", "#d8b8ad", 2, 1],
  ]
  return records.map(([type, name, color, desktopX, desktopY]) => ({
    id: `showcase-phone-app-${type}`,
    type,
    name,
    color,
    icon: PHONE_APP_DEFS[type].icon,
    desktopX,
    desktopY,
    enabled: true,
  }))
}

function messageStep(message, label, roundId) {
  return {
    type: "messages",
    itemId: message.id,
    chatId: "showcase-phone-chat-lin",
    roundId,
    contactId: "showcase-phone-contact-lin",
    label,
  }
}

export function buildShowcasePhoneWork() {
  const image = assets()
  const contacts = [
    {
      id: "showcase-phone-contact-lin",
      name: "林晚",
      alias: "旧站引路人",
      aliases: ["阿晚"],
      avatarUrl: image.lin,
      messageAvatarUrl: image.lin,
      forumAvatarUrl: image.lin,
      forumIpLocation: "雾港",
      note: "会叫你“小某”，负责把阅读流程带到终点。",
      faceUrl: image.top,
      msgId: "林晚",
      forumId: "引路人_林晚",
    },
    {
      id: "showcase-phone-contact-zhou",
      name: "周屿",
      alias: "夜巡组长",
      aliases: [],
      avatarUrl: image.zhou,
      messageAvatarUrl: image.zhou,
      forumAvatarUrl: image.zhou,
      forumIpLocation: "临海",
      note: "负责群聊和论坛里的补充线索。",
      faceUrl: image.zhou,
      msgId: "周屿",
      forumId: "夜巡组长",
    },
    {
      id: "showcase-phone-contact-aunt",
      name: "贺阿姨",
      alias: "值班室",
      aliases: [],
      avatarUrl: image.aunt,
      messageAvatarUrl: image.aunt,
      forumAvatarUrl: image.aunt,
      forumIpLocation: "旧站",
      note: "准备夜宵，也保管旧站钥匙。",
      faceUrl: image.aunt,
      msgId: "贺阿姨",
      forumId: "旧站值班室",
    },
  ]

  const choiceMessage = {
    id: "showcase-phone-message-choice",
    type: "text",
    senderId: "showcase-phone-contact-lin",
    text: "小某，进站前选一个你最想先确认的线索。",
    choices: [
      {
        id: "showcase-phone-choice-clock",
        text: "先确认停住的钟",
        replyText: "我先去看站台的钟。",
        followUpMessages: [
          {
            id: "showcase-phone-follow-clock",
            type: "text",
            senderId: "showcase-phone-contact-lin",
            text: "好。它停在 23:17，但今晚会为某某再走一分钟。",
          },
        ],
      },
      {
        id: "showcase-phone-choice-ticket",
        text: "先确认没有日期的票",
        replyText: "我先检查那张旧票。",
        followUpMessages: [
          {
            id: "showcase-phone-follow-ticket",
            type: "image",
            senderId: "showcase-phone-contact-lin",
            image: image.ticket,
            text: "",
          },
        ],
      },
    ],
  }

  const roundOneMessages = [
    { id: "showcase-phone-message-time", type: "time", time: "今天 22:47" },
    {
      id: "showcase-phone-message-system",
      type: "time",
      time: "你已以“wm”的身份加入旧站夜巡。",
    },
    {
      id: "showcase-phone-message-text",
      type: "text",
      senderId: "showcase-phone-contact-lin",
      text: "某某，欢迎来到小手机全链路示例。接下来每一种消息都会出现一次。",
    },
    {
      id: "showcase-phone-message-image",
      type: "image",
      senderId: "showcase-phone-contact-lin",
      image: image.platform,
    },
    {
      id: "showcase-phone-message-voice",
      type: "voice",
      senderId: "showcase-phone-contact-lin",
      text: "小某，听见第二声钟响以后再往前走。",
      duration: 6,
    },
    {
      id: "showcase-phone-message-location",
      type: "location",
      senderId: "showcase-phone-contact-lin",
      locationName: "雾港旧站 · 北侧候车厅",
      text: "雾港旧站 · 北侧候车厅",
    },
    {
      id: "showcase-phone-message-link",
      type: "link",
      senderId: "showcase-phone-contact-lin",
      linkTitle: "《夜巡须知：给 wm 的第一份说明》",
      forumPostId: "showcase-phone-forum-guide",
      linkUrl: "",
    },
    {
      id: "showcase-phone-message-redpacket",
      type: "redpacket",
      senderId: "showcase-phone-contact-lin",
      redpacketAmount: 8.88,
      redpacketMsg: "小某的夜巡补贴",
    },
    {
      id: "showcase-phone-message-transfer",
      type: "transfer",
      senderId: "showcase-phone-contact-lin",
      transferAmount: 23.17,
      transferNote: "旧站钥匙押金",
    },
    {
      id: "showcase-phone-message-familycard",
      type: "familycard",
      senderId: "showcase-phone-contact-lin",
      fcRelation: "特别关心",
      fcAmount: 52,
    },
    {
      id: "showcase-phone-message-takeaway",
      type: "takeaway",
      senderId: "showcase-phone-contact-lin",
      takeawayShop: "贺阿姨的夜班食堂",
      takeawayOrder: "热汤面 × 1，备注：留给某某",
      takeawayAmount: 18,
      takeawayStatus: "已送到旧站值班室",
    },
    choiceMessage,
  ]

  const roundTwoMessages = [
    {
      id: "showcase-phone-message-call-voice",
      type: "call",
      callMode: "voice",
      senderId: "showcase-phone-contact-lin",
      text: "小某？听得到吗？\n看见蓝色站牌以后向左。\n我在钟下等你。",
      callLines: ["小某？听得到吗？", "看见蓝色站牌以后向左。", "我在钟下等你。"],
      allowHangup: true,
    },
    {
      id: "showcase-phone-message-call-video",
      type: "call",
      callMode: "video",
      senderId: "showcase-phone-contact-lin",
      text: "镜头里能看见我身后的钟吗？\n记住指针的位置。\n好，我们在站台见。",
      callLines: ["镜头里能看见我身后的钟吗？", "记住指针的位置。", "好，我们在站台见。"],
      allowHangup: true,
    },
    {
      id: "showcase-phone-message-ending",
      type: "text",
      senderId: "showcase-phone-contact-lin",
      text: "消息卡片已经全部看完。接下来跟着弹窗，把其他 App 也走一遍吧。",
    },
  ]

  const chats = [
    {
      id: "showcase-phone-chat-lin",
      type: "single",
      contactIds: ["showcase-phone-contact-lin"],
      groupName: "",
      groupAvatarUrl: "",
      messages: [],
      rounds: [
        {
          id: "showcase-phone-round-cards",
          label: "全部消息卡片",
          messages: roundOneMessages,
        },
        {
          id: "showcase-phone-round-calls",
          label: "通话与收尾",
          messages: roundTwoMessages,
        },
      ],
    },
    {
      id: "showcase-phone-chat-group",
      type: "group",
      contactIds: [
        "showcase-phone-contact-lin",
        "showcase-phone-contact-zhou",
        "showcase-phone-contact-aunt",
      ],
      groupName: "旧站夜巡",
      groupAvatarUrl: image.group,
      groupOwnerId: "showcase-phone-contact-zhou",
      groupAdminIds: ["showcase-phone-contact-lin"],
      groupTitles: {
        "showcase-phone-contact-lin": "引路人",
        "showcase-phone-contact-aunt": "后勤",
      },
      messages: [],
      rounds: [
        {
          id: "showcase-phone-round-group",
          label: "夜巡交接",
          messages: [
            { id: "showcase-phone-group-time", type: "time", time: "今天 22:40" },
            {
              id: "showcase-phone-group-zhou",
              type: "text",
              senderId: "showcase-phone-contact-zhou",
              text: "欢迎 wm。今晚由林晚带某某走完整条线。",
            },
            {
              id: "showcase-phone-group-aunt",
              type: "text",
              senderId: "showcase-phone-contact-aunt",
              text: "值班室给小某留了热汤，回来记得喝。",
            },
          ],
        },
      ],
    },
  ]

  const forumPosts = [
    {
      id: "showcase-phone-forum-guide",
      platform: "tieba",
      contactId: "showcase-phone-contact-lin",
      contactName: "林晚",
      title: "夜巡须知：给 wm 的第一份说明",
      content: "看到流程弹窗后直接点击，它会把某某送到对应 App 和对应内容。资料类 App 第一次打开会询问是否接入林晚的设备。",
      images: [image.map],
      time: "今天 22:30",
      pinned: true,
      featured: true,
      likes: ["周屿", "贺阿姨"],
      reposts: [],
      comments: [
        {
          id: "showcase-phone-forum-choice",
          contactId: "showcase-phone-contact-zhou",
          contactName: "周屿",
          content: "wm 抵达旧站后，第一件事做什么？",
          time: "今天 22:34",
          choices: [
            {
              id: "showcase-phone-forum-choice-clock",
              text: "核对站台时钟",
              replyText: "先核对站台时钟。",
              followUpMessages: [
                {
                  contactId: "showcase-phone-contact-zhou",
                  contactName: "周屿",
                  content: "正确。记住 23:17。",
                  time: "刚刚",
                },
              ],
            },
            {
              id: "showcase-phone-forum-choice-lin",
              text: "先找到林晚",
              replyText: "我先去找林晚。",
              followUpMessages: [
                {
                  contactId: "showcase-phone-contact-lin",
                  contactName: "林晚",
                  content: "我就在钟下面等小某。",
                  time: "刚刚",
                },
              ],
            },
          ],
          replies: [
            {
              id: "showcase-phone-forum-reply",
              contactId: "showcase-phone-contact-aunt",
              contactName: "贺阿姨",
              content: "别忘了先把夜巡灯打开。",
              time: "今天 22:36",
              choices: [],
              replies: [],
            },
          ],
        },
      ],
    },
  ]

  const moments = [
    {
      id: "showcase-phone-moment-arrival",
      contactId: "showcase-phone-contact-lin",
      contactName: "林晚",
      content: "今晚的旧站只为某某亮灯。等 wm 到站，我们就出发。",
      images: [image.platform, image.clock],
      time: "今天 22:41",
      likes: ["周屿", "贺阿姨"],
      comments: [
        {
          id: "showcase-phone-moment-comment",
          contactId: "showcase-phone-contact-zhou",
          contactName: "周屿",
          content: "夜巡灯已经打开。",
          time: "今天 22:42",
          choices: [
            {
              id: "showcase-phone-moment-choice",
              text: "回复：我马上到",
              replyText: "我马上到。",
              followUpMessages: [
                {
                  contactId: "showcase-phone-contact-lin",
                  contactName: "林晚",
                  content: "慢慢来，小某。我会等你。",
                  time: "刚刚",
                },
              ],
            },
          ],
        },
      ],
    },
  ]

  const flowMessages = [
    ...roundOneMessages.map(message => messageStep(
      message,
      message.id === "showcase-phone-message-time"
        ? "林晚 · 时间卡片"
        : message.id === "showcase-phone-message-system"
          ? "旧站夜巡 · 系统提示"
          : `林晚 · ${{
            text: "文字消息",
            image: "图片消息",
            voice: "语音消息",
            location: "位置消息",
            link: "链接卡片",
            redpacket: "红包卡片",
            transfer: "转账卡片",
            familycard: "亲属卡",
            takeaway: "外卖卡片",
          }[message.type] || "回复选择"}`,
      "showcase-phone-round-cards",
    )),
    ...roundTwoMessages.map(message => messageStep(
      message,
      message.id === "showcase-phone-message-call-voice"
        ? "林晚 · 语音通话"
        : message.id === "showcase-phone-message-call-video"
          ? "林晚 · 视频通话"
          : "林晚 · 消息流程收尾",
      "showcase-phone-round-calls",
    )),
  ]

  return {
    id: "showcase-phone-full-chain-20260730",
    schemaVersion: CURRENT_WORK_SCHEMA_VERSION,
    type: "phone",
    title: "今晚十一点，旧站见 · 小手机全链路示例",
    desc: "从消息通知一路跑到论坛、朋友圈、备忘录、相册、浏览器和购物；完整展示小手机消息卡片与占位符。",
    coverColor: "#6f5963",
    author: "Tuuru 示例作品",
    authorNote: "导入后填写三个占位符并开始阅读。开启阅读引导后，点击每次出现的消息预览弹窗即可进入对应 App；聊天中选择任一回复，通话剧情播放完成后挂断即可继续。",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    password: "",
    locked: false,
    placeholders: [
      {
        id: "showcase-phone-placeholder-name",
        key: "某某",
        label: "你的名字",
        prompt: "希望故事里怎样称呼你？",
        mode: "each",
        forbidden: [],
        values: [],
        default: "某某",
      },
      {
        id: "showcase-phone-placeholder-nickname",
        key: "小某",
        label: "林晚对你的称呼",
        prompt: "林晚私下会怎样叫你？",
        mode: "each",
        forbidden: [],
        values: [],
        default: "小某",
      },
      {
        id: "showcase-phone-placeholder-group",
        key: "wm",
        label: "夜巡群昵称",
        prompt: "你在“旧站夜巡”群里显示什么名字？",
        mode: "each",
        forbidden: [],
        values: [],
        default: "wm",
      },
    ],
    placeholderMode: "each",
    globalForbidden: [],
    scenes: [],
    nodes: [],
    chapters: [],
    startNode: "",
    phoneData: {
      contacts,
      chats,
      moments,
      forumPosts,
      forumNpcs: [
        {
          id: "showcase-phone-forum-npc",
          name: "旧站广播",
          avatarUrl: image.clock,
        },
      ],
      forumSettings: {
        name: "旧站论坛",
        description: "夜巡组内部信息板",
      },
      apps: apps(),
      skin: {
        wallpaper: "#302b36",
        wallpaperType: "image",
        wallpaperImage: image.wallpaper,
        frameColor: "#7b6670",
        borderRadius: 30,
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
        readerId: "某某",
        readerAvatar: null,
        showDynamicIsland: true,
        iconStyle: "mixed",
        showIconShadow: true,
        iconBorderRadius: 14,
        showGlassEffect: true,
        iconColumns: 4,
        showAppLabels: true,
        timeColor: "#fff9f3",
        showHomeIndicator: true,
        materialType: "glass",
        materialOpacity: 72,
        topBgImage: image.top,
      },
      appConnections: {
        memo: {
          contactId: "showcase-phone-contact-lin",
          prompt: "林晚给小某留了一页备忘录，是否接入她的设备？",
        },
        gallery: {
          contactId: "showcase-phone-contact-lin",
          prompt: "检测到林晚的旧站相册，是否接入查看？",
        },
        browser: {
          contactId: "showcase-phone-contact-lin",
          prompt: "林晚共享了一段与某某有关的浏览记录，是否接入？",
        },
        shopping: {
          contactId: "showcase-phone-contact-lin",
          prompt: "林晚的订单中有给小某准备的物品，是否接入查看？",
        },
      },
      readingFlow: {
        enabled: true,
        sequence: [
          ...flowMessages,
          {
            type: "forum",
            itemId: "showcase-phone-forum-guide",
            contactId: "showcase-phone-contact-lin",
            label: "旧站论坛 · 夜巡须知",
          },
          {
            type: "moments",
            itemId: "showcase-phone-moment-arrival",
            contactId: "showcase-phone-contact-lin",
            label: "林晚 · 今晚的旧站亮灯了",
          },
          {
            type: "memo",
            itemId: "showcase-phone-memo-guide",
            contactId: "showcase-phone-contact-lin",
            label: "林晚 · 夜巡路线备忘",
          },
          {
            type: "gallery",
            itemId: "showcase-phone-photo-clock",
            contactId: "showcase-phone-contact-lin",
            label: "林晚 · 停在 23:17 的钟",
          },
          {
            type: "browser",
            itemId: "showcase-phone-history-search",
            contactId: "showcase-phone-contact-lin",
            label: "林晚 · 旧站夜巡搜索记录",
          },
          {
            type: "shopping",
            itemId: "showcase-phone-order-lamp",
            contactId: "showcase-phone-contact-lin",
            label: "林晚 · 夜巡灯订单",
          },
        ],
      },
      memos: [
        {
          id: "showcase-phone-memo-guide",
          contactId: "showcase-phone-contact-lin",
          title: "给小某的路线备忘",
          content: "<strong>某某的夜巡路线</strong><br>一、跟随消息提示完成聊天。<br>二、打开论坛与朋友圈。<br>三、依次查看备忘录、相册、浏览器和购物。<br>四、流程结束后回到桌面自由探索。",
        },
      ],
      albums: [
        {
          id: "showcase-phone-album-station",
          contactId: "showcase-phone-contact-lin",
          name: "等某某到站",
        },
      ],
      photos: [
        {
          id: "showcase-phone-photo-clock",
          contactId: "showcase-phone-contact-lin",
          albumId: "showcase-phone-album-station",
          caption: "停在 23:17 的钟",
          description: "林晚说，某某到站后它会再走一分钟。",
          imageUrl: image.clock,
          time: "今天 22:12",
        },
        {
          id: "showcase-phone-photo-ticket",
          contactId: "showcase-phone-contact-lin",
          albumId: "showcase-phone-album-station",
          caption: "没有日期的旧票",
          description: "背面写着 wm 的群昵称。",
          imageUrl: image.ticket,
          time: "今天 22:14",
        },
      ],
      browserHistory: [
        {
          id: "showcase-phone-history-search",
          contactId: "showcase-phone-contact-lin",
          title: "搜索：某某 旧站 夜巡",
          url: "search.local/night-watch",
          time: "今天 22:19",
        },
        {
          id: "showcase-phone-history-guide",
          contactId: "showcase-phone-contact-lin",
          title: "夜巡流程为什么会直接跳到对应 App",
          url: "guide.local/phone-flow",
          time: "今天 22:20",
        },
      ],
      shoppingItems: [
        {
          id: "showcase-phone-order-lamp",
          contactId: "showcase-phone-contact-lin",
          status: "order",
          name: "给小某的夜巡灯",
          price: 23.17,
          imageUrl: image.recorder,
          time: "今天 21:57",
        },
        {
          id: "showcase-phone-cart-soup",
          contactId: "showcase-phone-contact-lin",
          status: "cart",
          name: "贺阿姨的热汤面",
          price: 18,
          imageUrl: image.soup,
          time: "今天 22:02",
        },
      ],
      displaySettings: {},
      contactSortMode: "authored",
    },
  }
}
