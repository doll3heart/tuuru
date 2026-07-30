import test from "node:test"
import assert from "node:assert/strict"
import {
  READER_LIBRARY_STORAGE_KEY,
  appendReaderCheckpoint,
  applyReaderIdentity,
  clearReaderProgress,
  createReaderSlot,
  dismissReaderWorkUpdate,
  emptyReaderLibrary,
  readReaderLibrary,
  readerActiveSlot,
  readerBook,
  readerBookStatus,
  reconcileReaderWorkUpdate,
  rememberReaderPhoneAccess,
  rememberReaderWork,
  removeReaderBook,
  removeReaderBookmark,
  removeReaderIdentity,
  removeReaderSlot,
  renameReaderSlot,
  restoreArticleReadingState,
  restoreReaderBook,
  restoreReaderBookmark,
  saveReaderPlaceholders,
  saveReaderProgress,
  saveReaderIdentity,
  setReaderCompletion,
  setReaderBookPinned,
  switchReaderSlot,
  toggleReaderBookmark,
  updateReaderBookmark,
  writeReaderLibrary,
} from "../reader/reader-library-state.js"

function work(overrides = {}) {
  return {
    id:"work-a",
    type:"article",
    title:"山茶书简",
    author:"白榆",
    coverColor:"#8f6672",
    placeholders:[
      { id:"name", label:"姓名", default:"某某" },
      { id:"nickname", label:"昵称", default:"小某" },
    ],
    nodes:[
      {
        id:"start",
        chapterId:"chapter-a",
        choices:[{ id:"stay", text:"留下", targetId:"ending" }],
        interactionGroups:[{
          id:"group-a",
          choices:[{ id:"reply-a", text:"回应" }],
        }],
      },
      { id:"ending", chapterId:"chapter-b", choices:[] },
    ],
    ...overrides,
  }
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
    removeItem(key) { values.delete(key) },
    value(key) { return values.get(key) },
  }
}

test("reader library remembers bounded detached book metadata", () => {
  const source = emptyReaderLibrary()
  const remembered = rememberReaderWork(source, work(), 100)

  assert.deepEqual(source, { version:1, identities:[], books:[] })
  assert.equal(remembered.books.length, 1)
  assert.deepEqual(remembered.books[0], {
    id:"work-a",
    type:"article",
    title:"山茶书简",
    author:"白榆",
    coverColor:"#8f6672",
    addedAt:100,
    lastOpenedAt:100,
    placeholderDefinitions:[
      { id:"name", key:"姓名", label:"姓名", prompt:"", default:"某某" },
      { id:"nickname", key:"昵称", label:"昵称", prompt:"", default:"小某" },
    ],
    placeholderValues:{},
    progress:null,
    completedAt:0,
    bookmarks:[],
    activeSlotId:"reader-slot-default",
    slots:[{
      id:"reader-slot-default",
      name:"",
      createdAt:100,
      updatedAt:100,
      identityId:"",
      phoneAccess:{},
      placeholderValues:{},
      progress:null,
      completedAt:0,
      bookmarks:[],
    }],
  })

  const changedSource = work()
  changedSource.title = "mutated"
  changedSource.placeholders[0].label = "mutated"
  assert.equal(remembered.books[0].title, "山茶书简")
  assert.equal(remembered.books[0].placeholderDefinitions[0].label, "姓名")

  const reopened = rememberReaderWork(remembered, work({ title:"新版标题" }), 200)
  assert.equal(reopened.books.length, 1)
  assert.equal(reopened.books[0].title, "新版标题")
  assert.equal(reopened.books[0].addedAt, 100)
  assert.equal(reopened.books[0].lastOpenedAt, 200)
  assert.equal(reopened.books[0].completedAt, 0)
  assert.deepEqual(reopened.books[0].bookmarks, [])
})

test("books can be pinned independently and keep their pin through refresh and storage", () => {
  let library = rememberReaderWork(emptyReaderLibrary(), work(), 100)
  library = rememberReaderWork(library, work({ id:"work-b", title:"第二本" }), 110)
  const beforePin = library

  const pinned = setReaderBookPinned(library, "work-a", true, 200)
  assert.equal(readerBook(beforePin, "work-a").pinnedAt, undefined)
  assert.equal(readerBook(pinned, "work-a").pinnedAt, 200)
  assert.equal(readerBook(pinned, "work-b").pinnedAt, undefined)

  const repeated = setReaderBookPinned(pinned, "work-a", true, 300)
  assert.equal(readerBook(repeated, "work-a").pinnedAt, 200)

  const reopened = rememberReaderWork(repeated, work({ title:"重新导入后的标题" }), 400)
  assert.equal(readerBook(reopened, "work-a").pinnedAt, 200)

  const reconciled = reconcileReaderWorkUpdate(
    reopened,
    work(),
    work({ title:"作者更新后的标题" }),
    { now:500, markUpdated:true },
  )
  assert.equal(readerBook(reconciled, "work-a").pinnedAt, 200)

  const storage = memoryStorage()
  assert.equal(writeReaderLibrary(storage, reconciled), true)
  const restored = readReaderLibrary(storage)
  assert.equal(readerBook(restored, "work-a").pinnedAt, 200)

  const unpinned = setReaderBookPinned(restored, "work-a", false, 600)
  assert.equal(readerBook(unpinned, "work-a").pinnedAt, undefined)
  assert.deepEqual(setReaderBookPinned(unpinned, "missing", true, 700), unpinned)
})

test("placeholder and progress updates are immutable and survive storage round trips", () => {
  const remembered = rememberReaderWork(emptyReaderLibrary(), work(), 100)
  const withValues = saveReaderPlaceholders(remembered, "work-a", {
    name:["云枝"],
    nickname:"阿云",
    missing:["ignored"],
  }, 110)
  assert.deepEqual(readerBook(withValues, "work-a").placeholderValues, {
    name:["云枝"],
    nickname:["阿云"],
  })
  assert.deepEqual(readerBook(remembered, "work-a").placeholderValues, {})

  const progress = {
    kind:"article",
    path:["start", "ending"],
    choiceMemory:{ start:"stay" },
    interactionSelections:{ "group-a":{ nodeId:"start", choiceId:"reply-a" } },
    checkpoints:[],
    readingPosition:{
      kind:"article",
      pathIndex:1,
      anchorIndex:2,
      viewportTop:84.5,
      scrollY:620,
    },
  }
  const withProgress = saveReaderProgress(withValues, "work-a", progress, 120)
  progress.path.push("mutated")
  assert.deepEqual(readerBook(withProgress, "work-a").progress.path, ["start", "ending"])
  assert.deepEqual(readerBook(withProgress, "work-a").progress.readingPosition, {
    kind:"article",
    pathIndex:1,
    anchorIndex:2,
    viewportTop:84.5,
    scrollY:620,
  })
  assert.equal(readerBook(withProgress, "work-a").progress.savedAt, 120)

  const storage = memoryStorage()
  assert.equal(writeReaderLibrary(storage, withProgress), true)
  assert.equal(storage.value(READER_LIBRARY_STORAGE_KEY).includes("山茶书简"), true)
  assert.deepEqual(readReaderLibrary(storage), withProgress)

  const cleared = clearReaderProgress(withProgress, "work-a", 130)
  assert.equal(readerBook(cleared, "work-a").progress, null)
  assert.deepEqual(readerBook(cleared, "work-a").placeholderValues, {
    name:["云枝"],
    nickname:["阿云"],
  })
  assert.equal(readerBookStatus(cleared.books[0]), "unread")
})

test("phone reading positions are bounded and legacy progress remains compatible", () => {
  let library = rememberReaderWork(emptyReaderLibrary(), work({ type:"phone" }), 100)
  library = saveReaderProgress(library, "work-a", {
    kind:"phone",
    flowIndex:3,
    readingPosition:{
      kind:"phone",
      appType:"messages",
      view:"chat",
      itemId:"chat-a",
      contactIndex:2,
      scrollTop:480.25,
      anchorId:"message-8",
      anchorOffset:36,
    },
  }, 110)
  assert.deepEqual(readerBook(library, "work-a").progress.readingPosition, {
    kind:"phone",
    appType:"messages",
    view:"chat",
    itemId:"chat-a",
    contactIndex:2,
    scrollTop:480.25,
    anchorId:"message-8",
    anchorOffset:36,
  })

  const legacy = saveReaderProgress(library, "work-a", {
    kind:"phone",
    flowIndex:4,
  }, 120)
  assert.equal(readerBook(legacy, "work-a").progress.readingPosition, null)

  const invalid = saveReaderProgress(library, "work-a", {
    kind:"phone",
    flowIndex:5,
    readingPosition:{
      kind:"article",
      pathIndex:0,
      anchorIndex:0,
      viewportTop:0,
      scrollY:0,
    },
  }, 130)
  assert.equal(readerBook(invalid, "work-a").progress.readingPosition, null)
})

test("completion, bookmarks, and removal remain detached from cached work bodies", () => {
  let library = rememberReaderWork(emptyReaderLibrary(), work(), 100)
  assert.equal(readerBookStatus(library.books[0]), "unread")

  library = saveReaderProgress(library, "work-a", {
    kind:"article",
    path:["start"],
    choiceMemory:{},
    interactionSelections:{},
    checkpoints:[],
  }, 110)
  assert.equal(readerBookStatus(library.books[0]), "reading")

  library = setReaderCompletion(library, "work-a", true, 120)
  assert.equal(readerBook(library, "work-a").completedAt, 120)
  assert.equal(readerBookStatus(library.books[0]), "completed")

  library = toggleReaderBookmark(library, "work-a", {
    id:"bookmark-a",
    kind:"article",
    label:"第一章 · 起点",
    path:["start"],
    choiceMemory:{ start:"stay" },
    interactionSelections:{ "group-a":{ nodeId:"start", choiceId:"reply-a" } },
  }, 130)
  assert.deepEqual(readerBook(library, "work-a").bookmarks, [{
    id:"bookmark-a",
    kind:"article",
    label:"第一章 · 起点",
    note:"",
    savedAt:130,
    path:["start"],
    choiceMemory:{ start:"stay" },
    interactionSelections:{ "group-a":{ nodeId:"start", choiceId:"reply-a" } },
  }])

  const refreshed = rememberReaderWork(library, work({ title:"新版" }), 140)
  assert.equal(readerBook(refreshed, "work-a").completedAt, 120)
  assert.equal(readerBook(refreshed, "work-a").bookmarks.length, 1)

  const toggledOff = toggleReaderBookmark(refreshed, "work-a", {
    id:"bookmark-b",
    kind:"article",
    label:"同一位置",
    path:["start"],
    choiceMemory:{ start:"stay" },
    interactionSelections:{ "group-a":{ nodeId:"start", choiceId:"reply-a" } },
  }, 150)
  assert.deepEqual(readerBook(toggledOff, "work-a").bookmarks, [])

  let bounded = toggledOff
  for (let index = 0; index < 35; index += 1) {
    bounded = toggleReaderBookmark(bounded, "work-a", {
      id:`bookmark-${index}`,
      kind:"article",
      label:`位置 ${index}`,
      path:["start", `node-${index}`],
      choiceMemory:{},
      interactionSelections:{},
    }, 200 + index)
  }
  assert.equal(readerBook(bounded, "work-a").bookmarks.length, 30)
  assert.equal(readerBook(bounded, "work-a").bookmarks[0].id, "bookmark-34")

  const withoutOne = removeReaderBookmark(bounded, "work-a", "bookmark-20")
  assert.equal(readerBook(withoutOne, "work-a").bookmarks.some(item => item.id === "bookmark-20"), false)
  assert.equal(readerBook(withoutOne, "work-a").bookmarks.length, 29)

  const withSecond = rememberReaderWork(withoutOne, work({ id:"work-b" }), 300)
  const removed = removeReaderBook(withSecond, "work-a")
  assert.equal(readerBook(removed, "work-a"), null)
  assert.equal(readerBook(removed, "work-b").title, "山茶书简")
})

test("version one storage gains optional bookmark and completion defaults", () => {
  const library = readReaderLibrary(memoryStorage({
    [READER_LIBRARY_STORAGE_KEY]:JSON.stringify({
      version:1,
      books:[{
        id:"legacy",
        title:"旧书",
        type:"article",
        placeholderDefinitions:[],
        placeholderValues:{},
        progress:null,
      }],
    }),
  }))
  assert.equal(library.books[0].completedAt, 0)
  assert.deepEqual(library.books[0].bookmarks, [])
  assert.equal(library.books[0].activeSlotId, "reader-slot-default")
  assert.equal(library.books[0].slots.length, 1)
})

test("reading slots isolate routes and keep the active compatibility mirror", () => {
  let library = rememberReaderWork(emptyReaderLibrary(), work(), 100)
  library = saveReaderProgress(library, "work-a", {
    kind:"article",
    path:["start"],
    choiceMemory:{},
    interactionSelections:{},
    checkpoints:[],
  }, 110)
  library = createReaderSlot(library, "work-a", {
    id:"slot-second",
    name:"",
  }, 120)
  assert.equal(readerBook(library, "work-a").slots.length, 2)
  assert.equal(readerBook(library, "work-a").activeSlotId, "slot-second")
  assert.equal(readerBook(library, "work-a").progress, null)
  assert.deepEqual(readerBook(library, "work-a").slots[0].progress.path, ["start"])

  library = saveReaderProgress(library, "work-a", {
    kind:"article",
    path:["start", "ending"],
    choiceMemory:{ start:"stay" },
    interactionSelections:{},
    checkpoints:[],
  }, 130)
  library = renameReaderSlot(library, "work-a", "slot-second", "另一条路线", 140)
  assert.equal(readerActiveSlot(readerBook(library, "work-a")).name, "另一条路线")

  library = switchReaderSlot(library, "work-a", "reader-slot-default", 150)
  assert.deepEqual(readerBook(library, "work-a").progress.path, ["start"])
  assert.equal(readerActiveSlot(readerBook(library, "work-a")).id, "reader-slot-default")

  for (let index = 3; index <= 6; index += 1) {
    library = createReaderSlot(library, "work-a", {
      id:`slot-${index}`,
      name:`存档 ${index}`,
    }, 150 + index)
  }
  assert.equal(readerBook(library, "work-a").slots.length, 5)
  assert.equal(readerBook(library, "work-a").slots.some(slot => slot.id === "slot-6"), false)

  library = removeReaderSlot(library, "work-a", "slot-3", 170)
  assert.equal(readerBook(library, "work-a").slots.length, 4)
  const only = rememberReaderWork(emptyReaderLibrary(), work({ id:"only" }), 200)
  assert.deepEqual(removeReaderSlot(only, "only", "reader-slot-default", 210), only)
})

test("named identities start from caller data and apply only to the active slot", () => {
  let library = rememberReaderWork(emptyReaderLibrary(), work(), 100)
  const unchanged = saveReaderIdentity(library, {
    id:"identity-empty",
    name:"",
    values:{ 姓名:"", 昵称:"" },
  }, 110)
  assert.deepEqual(unchanged, library)

  library = saveReaderIdentity(library, {
    id:"identity-a",
    name:"夜间阅读",
    values:{ 姓名:"云枝", 昵称:"阿云" },
  }, 120)
  assert.deepEqual(library.identities[0], {
    id:"identity-a",
    name:"夜间阅读",
    values:{ 姓名:"云枝", 昵称:"阿云" },
    createdAt:120,
    updatedAt:120,
  })

  library = applyReaderIdentity(library, "work-a", "identity-a", 130)
  assert.deepEqual(readerBook(library, "work-a").placeholderValues, {
    name:["云枝"],
    nickname:["阿云"],
  })
  assert.equal(readerActiveSlot(readerBook(library, "work-a")).identityId, "identity-a")

  library = createReaderSlot(library, "work-a", { id:"slot-blank", name:"" }, 140)
  library = saveReaderPlaceholders(library, "work-a", { name:["另一人"], nickname:[""] }, 150)
  library = switchReaderSlot(library, "work-a", "reader-slot-default", 160)
  assert.deepEqual(readerBook(library, "work-a").placeholderValues, {
    name:["云枝"],
    nickname:["阿云"],
  })

  library = removeReaderIdentity(library, "identity-a")
  assert.equal(library.identities.length, 0)
  assert.equal(readerActiveSlot(readerBook(library, "work-a")).identityId, "")
  assert.deepEqual(readerBook(library, "work-a").placeholderValues.name, ["云枝"])
})

test("refreshing a work body preserves every reader-owned slot and identity field", () => {
  let library = rememberReaderWork(emptyReaderLibrary(), work(), 100)
  library = saveReaderIdentity(library, {
    id:"identity-a",
    name:"夜间阅读",
    values:{ 姓名:"云枝", 昵称:"阿云" },
  }, 110)
  library = applyReaderIdentity(library, "work-a", "identity-a", 120)
  library = saveReaderProgress(library, "work-a", {
    kind:"article",
    path:["start", "ending"],
    choiceMemory:{ start:"stay" },
    interactionSelections:{},
    checkpoints:[],
  }, 130)
  library = setReaderCompletion(library, "work-a", true, 140)
  library = toggleReaderBookmark(library, "work-a", {
    id:"bookmark-a",
    kind:"article",
    label:"结尾",
    note:"保留备注",
    path:["start", "ending"],
    choiceMemory:{ start:"stay" },
    interactionSelections:{},
  }, 150)
  library = createReaderSlot(library, "work-a", {
    id:"slot-second",
    name:"另一条路线",
  }, 160)
  library = saveReaderProgress(library, "work-a", {
    kind:"article",
    path:["start"],
    choiceMemory:{},
    interactionSelections:{},
    checkpoints:[],
  }, 170)

  const refreshed = rememberReaderWork(library, work({
    title:"山茶书简 · 修订版",
    placeholders:[
      {id:"name", label:"姓名", default:"某某"},
      {id:"nickname", label:"昵称", default:"小某"},
      {id:"new-field", label:"新字段", default:""},
    ],
  }), 200)
  const book = readerBook(refreshed, "work-a")

  assert.equal(book.title, "山茶书简 · 修订版")
  assert.equal(book.addedAt, 100)
  assert.equal(book.activeSlotId, "slot-second")
  assert.equal(book.slots.length, 2)
  assert.deepEqual(book.slots[0].placeholderValues, {
    name:["云枝"],
    nickname:["阿云"],
  })
  assert.equal(book.slots[0].identityId, "identity-a")
  assert.equal(book.slots[0].completedAt, 140)
  assert.equal(book.slots[0].bookmarks[0].note, "保留备注")
  assert.deepEqual(book.slots[0].progress.path, ["start", "ending"])
  assert.deepEqual(book.slots[1].progress.path, ["start"])
  assert.deepEqual(refreshed.identities, library.identities)
})

test("work updates migrate placeholder values by id, unique key, and unique label across slots", () => {
  const previousWork = work({
    placeholders:[
      {id:"same-id", key:"name", label:"姓名"},
      {id:"old-nickname", key:"nickname", label:"昵称"},
      {id:"old-pronoun", key:"old-pronoun-key", label:"称谓"},
      {id:"ambiguous-a", key:"a", label:"重复标签"},
      {id:"ambiguous-b", key:"b", label:"重复标签"},
    ],
  })
  let library = rememberReaderWork(emptyReaderLibrary(), previousWork, 100)
  library = saveReaderPlaceholders(library, "work-a", {
    "same-id":["云枝"],
    "old-nickname":["阿云"],
    "old-pronoun":["小姐"],
    "ambiguous-a":["甲"],
    "ambiguous-b":["乙"],
  }, 110)
  library = createReaderSlot(library, "work-a", {id:"slot-two", name:"二周目"}, 120)
  library = saveReaderPlaceholders(library, "work-a", {
    "same-id":["迟雨"],
    "old-nickname":["小雨"],
    "old-pronoun":["同学"],
  }, 130)

  const incomingWork = work({
    placeholders:[
      {id:"same-id", key:"name", label:"姓名"},
      {id:"new-nickname", key:"nickname", label:"新昵称标签"},
      {id:"new-pronoun", key:"pronoun", label:"称谓"},
      {id:"new-ambiguous", key:"new-ambiguous", label:"重复标签"},
    ],
  })
  const migrated = reconcileReaderWorkUpdate(library, previousWork, incomingWork, {
    now:200,
    markUpdated:true,
  })
  const book = readerBook(migrated, "work-a")

  assert.deepEqual(book.slots[0].placeholderValues, {
    "same-id":["云枝"],
    "new-nickname":["阿云"],
    "new-pronoun":["小姐"],
  })
  assert.deepEqual(book.slots[1].placeholderValues, {
    "same-id":["迟雨"],
    "new-nickname":["小雨"],
    "new-pronoun":["同学"],
  })
  assert.equal(book.placeholderValues["new-ambiguous"], undefined)
  assert.equal(book.unseenUpdateAt, 200)
  assert.equal(readerBook(dismissReaderWorkUpdate(migrated, "work-a"), "work-a").unseenUpdateAt, undefined)
})

test("work updates preserve valid bookmarks and repair removed nodes to nearby content", () => {
  const previousWork = work({
    chapters:[{id:"chapter-a", name:"第一章"}],
    nodes:[
      {id:"start", chapterId:"chapter-a", title:"开场", content:"<p>起点</p>", choices:[]},
      {id:"removed-ending", chapterId:"chapter-a", title:"月台", content:"<p>雨停了</p>", choices:[]},
    ],
  })
  let library = rememberReaderWork(emptyReaderLibrary(), previousWork, 100)
  library = toggleReaderBookmark(library, "work-a", {
    id:"bookmark-valid",
    kind:"article",
    label:"开场",
    note:"原样保留",
    path:["start"],
    choiceMemory:{},
    interactionSelections:{},
  }, 110)
  library = toggleReaderBookmark(library, "work-a", {
    id:"bookmark-moved",
    kind:"article",
    label:"月台",
    note:"不要丢掉这条备注",
    path:["start", "removed-ending"],
    choiceMemory:{},
    interactionSelections:{},
  }, 120)

  const incomingWork = work({
    chapters:[{id:"chapter-a", name:"第一章"}],
    nodes:[
      {id:"start", chapterId:"chapter-a", title:"开场", content:"<p>起点</p>", choices:[]},
      {id:"ending-v2", chapterId:"chapter-a", title:"月台", content:"<p>雨终于停了</p>", choices:[]},
    ],
  })
  const migrated = reconcileReaderWorkUpdate(library, previousWork, incomingWork, {now:200})
  const bookmarks = readerBook(migrated, "work-a").bookmarks
  const valid = bookmarks.find(bookmark => bookmark.id === "bookmark-valid")
  const moved = bookmarks.find(bookmark => bookmark.id === "bookmark-moved")

  assert.deepEqual(valid.path, ["start"])
  assert.equal(valid.updateStatus, undefined)
  assert.deepEqual(moved.path, ["start", "ending-v2"])
  assert.equal(moved.updateStatus, "moved")
  assert.equal(moved.label, "月台")
  assert.equal(moved.note, "不要丢掉这条备注")

  const storage = memoryStorage()
  assert.equal(writeReaderLibrary(storage, migrated), true)
  const reopened = readerBook(readReaderLibrary(storage), "work-a")
  assert.equal(reopened.bookmarks.find(bookmark => bookmark.id === "bookmark-moved").updateStatus, "moved")
})

test("bookmark labels and notes can be edited without changing their route snapshot", () => {
  let library = rememberReaderWork(emptyReaderLibrary(), work(), 100)
  library = toggleReaderBookmark(library, "work-a", {
    id:"bookmark-edit",
    kind:"article",
    label:"第一章",
    path:["start"],
    choiceMemory:{},
    interactionSelections:{},
  }, 110)
  library = updateReaderBookmark(library, "work-a", "bookmark-edit", {
    label:"伏笔位置",
    note:"下次尝试另一个选择。",
  }, 120)
  const bookmark = readerBook(library, "work-a").bookmarks[0]
  assert.equal(bookmark.label, "伏笔位置")
  assert.equal(bookmark.note, "下次尝试另一个选择。")
  assert.deepEqual(bookmark.path, ["start"])
  assert.equal(bookmark.savedAt, 120)
})

test("malformed library storage fails closed without invoking accessors", () => {
  let reads = 0
  const hostileBook = {}
  Object.defineProperty(hostileBook, "id", {
    enumerable:true,
    get() {
      reads += 1
      throw new Error("must not run")
    },
  })
  const storage = memoryStorage({
    [READER_LIBRARY_STORAGE_KEY]:JSON.stringify({
      version:1,
      books:[null, [], { id:"", title:"bad" }, { id:"safe", title:"Safe", type:"phone" }],
    }),
  })
  const normalized = readReaderLibrary(storage)
  assert.equal(normalized.books.length, 1)
  assert.equal(normalized.books[0].id, "safe")
  assert.deepEqual(readReaderLibrary(memoryStorage({
    [READER_LIBRARY_STORAGE_KEY]:"not json",
  })), emptyReaderLibrary())
  assert.equal(reads, 0)
  assert.deepEqual(rememberReaderWork(emptyReaderLibrary(), hostileBook, 1), emptyReaderLibrary())
})

test("choice checkpoints deduplicate and retain only the newest eight", () => {
  let progress = {
    kind:"article",
    path:["start"],
    choiceMemory:{},
    interactionSelections:{},
    checkpoints:[],
  }
  for (let index = 0; index < 10; index += 1) {
    progress = appendReaderCheckpoint(progress, {
      id:`checkpoint-${index}`,
      sourceNodeId:"start",
      label:`选择 ${index}`,
      path:["start"],
      choiceMemory:{ start:`choice-${index}` },
      interactionSelections:{},
    }, index)
  }
  assert.equal(progress.checkpoints.length, 8)
  assert.equal(progress.checkpoints[0].id, "checkpoint-2")
  assert.equal(progress.checkpoints.at(-1).id, "checkpoint-9")

  const duplicate = appendReaderCheckpoint(progress, {
    id:"replacement",
    sourceNodeId:"start",
    label:"选择 9",
    path:["start"],
    choiceMemory:{ start:"choice-9" },
    interactionSelections:{},
  }, 20)
  assert.equal(duplicate.checkpoints.length, 8)
  assert.equal(duplicate.checkpoints.at(-1).id, "replacement")
})

test("article progress restoration rejects stale routes and prunes stale selections", () => {
  const restored = restoreArticleReadingState(work(), {
    kind:"article",
    path:["start", "ending"],
    choiceMemory:{ start:"stay", missing:"choice" },
    interactionSelections:{
      "group-a":{ nodeId:"start", choiceId:"reply-a" },
      missing:{ nodeId:"missing", choiceId:"missing" },
    },
    checkpoints:[
      {
        id:"valid",
        sourceNodeId:"start",
        label:"留下",
        savedAt:20,
        path:["start"],
        choiceMemory:{},
        interactionSelections:{},
      },
      {
        id:"stale",
        sourceNodeId:"missing",
        label:"失效",
        savedAt:30,
        path:["missing"],
        choiceMemory:{},
        interactionSelections:{},
      },
    ],
  })
  assert.deepEqual(restored.path, ["start", "ending"])
  assert.deepEqual(restored.choiceMemory, { start:"stay" })
  assert.deepEqual(restored.interactionSelections, {
    "group-a":{ nodeId:"start", choiceId:"reply-a" },
  })
  assert.equal(restored.checkpoints.length, 1)
  assert.equal(restored.readingPosition, null)

  assert.equal(restoreArticleReadingState(work(), {
    kind:"article",
    path:["start", "missing"],
  }), null)
  assert.equal(restoreArticleReadingState(work({ type:"phone" }), {
    kind:"article",
    path:["start"],
  }), null)
})

test("restore reader bookmark and book only repairs the missing reader record", () => {
  let library = rememberReaderWork(emptyReaderLibrary(), work(), 100)
  library = rememberReaderWork(library, work({ id:"work-b", title:"另一部作品" }), 101)
  const bookmark = {
    id:"bookmark-undo",
    kind:"article",
    label:"想回来的地方",
    note:"",
    savedAt:120,
    path:["start"],
    choiceMemory:{},
    interactionSelections:{},
  }
  library = toggleReaderBookmark(library, "work-a", bookmark, bookmark.savedAt)
  const untouched = readerBook(library, "work-b")
  const removedBookmark = removeReaderBookmark(library, "work-a", bookmark.id)
  const restoredBookmark = restoreReaderBookmark(removedBookmark, "work-a", bookmark)
  assert.equal(readerBook(restoredBookmark, "work-a").bookmarks[0].id, bookmark.id)
  assert.deepEqual(readerBook(restoredBookmark, "work-b"), untouched)

  const removedBook = readerBook(restoredBookmark, "work-a")
  const withoutBook = removeReaderBook(restoredBookmark, "work-a")
  const restoredBook = restoreReaderBook(withoutBook, removedBook)
  assert.equal(readerBook(restoredBook, "work-a").title, "山茶书简")
  assert.deepEqual(readerBook(restoredBook, "work-b"), untouched)
  assert.equal(restoredBook.books.filter(book => book.id === "work-a").length, 1)
  assert.deepEqual(restoreReaderBook(restoredBook, removedBook), restoredBook)
})

test("phone access approval belongs only to the active reading slot", () => {
  let library = rememberReaderWork(emptyReaderLibrary(), work({ type:"phone" }), 100)
  library = rememberReaderPhoneAccess(library, "work-a", "memo", "contact-a", 110)

  let book = readerBook(library, "work-a")
  assert.deepEqual(readerActiveSlot(book).phoneAccess, { memo:"contact-a" })

  library = createReaderSlot(library, "work-a", { id:"slot-two", name:"第二条线" }, 120)
  book = readerBook(library, "work-a")
  assert.deepEqual(readerActiveSlot(book).phoneAccess, {})

  library = rememberReaderPhoneAccess(library, "work-a", "memo", "contact-b", 130)
  library = switchReaderSlot(library, "work-a", "reader-slot-default", 140)
  book = readerBook(library, "work-a")
  assert.deepEqual(readerActiveSlot(book).phoneAccess, { memo:"contact-a" })

  const roundTrip = readReaderLibrary({
    getItem:() => JSON.stringify(library),
  })
  assert.deepEqual(readerActiveSlot(readerBook(roundTrip, "work-a")).phoneAccess, {
    memo:"contact-a",
  })
})

test("phone access approval ignores invalid identifiers", () => {
  const library = rememberReaderWork(emptyReaderLibrary(), work({ type:"phone" }), 100)
  assert.deepEqual(
    rememberReaderPhoneAccess(library, "work-a", "", "contact-a", 110),
    library,
  )
  assert.deepEqual(
    rememberReaderPhoneAccess(library, "work-a", "memo", " contact-a ", 110),
    library,
  )
  assert.deepEqual(
    rememberReaderPhoneAccess(library, "work-a", "__proto__", "contact-a", 110),
    library,
  )
})
