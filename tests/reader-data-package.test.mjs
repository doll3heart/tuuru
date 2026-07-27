import test from "node:test"
import assert from "node:assert/strict"
import {
  READER_DATA_PACKAGE_FORMAT,
  READER_DATA_PACKAGE_MAX_BYTES,
  inspectReaderDataPackage,
  mergeReaderDataPackage,
  serializeReaderDataPackage,
} from "../reader/reader-data-package.js"
import {
  emptyReaderLibrary,
  rememberReaderWork,
  saveReaderProgress,
} from "../reader/reader-library-state.js"

function work(id, title = id) {
  return {
    id,
    type:"article",
    title,
    author:"Author",
    placeholders:[],
  }
}

function libraryWithProgress(id, updatedAt, path) {
  let library = rememberReaderWork(emptyReaderLibrary(), work(id), updatedAt - 10)
  library = saveReaderProgress(library, id, {
    kind:"article",
    path,
    choiceMemory:{},
    interactionSelections:{},
    checkpoints:[],
  }, updatedAt)
  return library
}

test("reader data packages round trip portable state without works, passwords, or binary assets", () => {
  const library = libraryWithProgress("book-a", 200, ["start"])
  const serialized = serializeReaderDataPackage({
    library,
    profile:{
      readerId:"Aster",
      bio:"Night reader",
      readerAvatar:"data:image/png;base64,PRIVATE_AVATAR",
      password:"do-not-copy",
    },
    placeholderPresets:{
      name:"Lin",
      nickname:"Moon",
      webname:"night-signal",
      password:"do-not-copy",
    },
    appearance:{
      article:{
        fontSize:18,
        backgroundImage:"data:image/png;base64,PRIVATE_BACKGROUND",
        customFonts:[{ name:"Private Font", data:"data:font/woff2;base64,PRIVATE_FONT" }],
      },
      phone:{
        fontSize:13,
        wallpaperImage:"data:image/png;base64,PRIVATE_WALLPAPER",
        customIcons:{ messages:"data:image/png;base64,PRIVATE_ICON" },
        appBgs:{ messages:"data:image/png;base64,PRIVATE_APP_BG" },
        customFonts:[{ name:"Private Phone Font", data:"data:font/woff2;base64,PRIVATE_PHONE_FONT" }],
        appSettings:{
          messages:{ callBackgroundImage:"data:image/png;base64,PRIVATE_CALL", bubbleFontSize:14 },
        },
      },
    },
  }, new Date("2026-07-28T12:00:00.000Z"))

  assert.ok(Buffer.byteLength(serialized, "utf8") < READER_DATA_PACKAGE_MAX_BYTES)
  assert.doesNotMatch(serialized, /PRIVATE_|do-not-copy|password|readerAvatar|backgroundImage|wallpaperImage|customFonts|customIcons|appBgs|callBackgroundImage/)
  const inspected = inspectReaderDataPackage(serialized)
  assert.equal(inspected.format, READER_DATA_PACKAGE_FORMAT)
  assert.equal(inspected.exportedAt, "2026-07-28T12:00:00.000Z")
  assert.deepEqual(inspected.profile, { readerId:"Aster", bio:"Night reader" })
  assert.deepEqual(inspected.placeholderPresets, {
    name:"Lin",
    nickname:"Moon",
    webname:"night-signal",
  })
  assert.equal(inspected.appearance.article.fontSize, 18)
  assert.equal(inspected.appearance.phone.fontSize, 13)
  assert.equal(inspected.summary.books, 1)
  assert.equal(inspected.summary.slots, 1)
})

test("reader data merge keeps newer slots and local binary appearance assets", () => {
  const currentLibrary = libraryWithProgress("book-a", 400, ["start", "current"])
  const incomingLibrary = libraryWithProgress("book-a", 200, ["start", "backup"])
  const incomingSecond = libraryWithProgress("book-b", 300, ["other"])
  incomingLibrary.books.push(incomingSecond.books[0])

  const merged = mergeReaderDataPackage({
    library:currentLibrary,
    profile:{
      readerId:"Current",
      bio:"Current bio",
      readerAvatar:"data:image/png;base64,YXZhdGFy",
    },
    placeholderPresets:{ name:"Current name", nickname:"", webname:"" },
    appearance:{
      article:{
        fontSize:16,
        backgroundImage:"data:image/png;base64,YXJ0aWNsZQ==",
        customFonts:[{ name:"Local Font", data:"data:font/woff2;base64,Zm9udA==" }],
      },
      phone:{
        fontSize:11,
        wallpaperImage:"data:image/png;base64,d2FsbHBhcGVy",
        customIcons:{ messages:"data:image/png;base64,aWNvbg==" },
        appBgs:{ messages:"data:image/png;base64,YXBwLWJn" },
        customFonts:[{ name:"Local Phone Font", data:"data:font/woff2;base64,cGhvbmUtZm9udA==" }],
        appSettings:{
          messages:{ callBackgroundImage:"data:image/png;base64,Y2FsbA==", bubbleFontSize:12 },
        },
      },
    },
  }, inspectReaderDataPackage(serializeReaderDataPackage({
    library:incomingLibrary,
    profile:{ readerId:"Backup", bio:"Backup bio" },
    placeholderPresets:{ name:"Backup name", nickname:"Backup nick", webname:"Backup web" },
    appearance:{
      article:{ fontSize:19 },
      phone:{ fontSize:15, appSettings:{ messages:{ bubbleFontSize:16 } } },
    },
  }, new Date("2026-07-28T12:00:00.000Z"))))

  assert.equal(merged.library.books.length, 2)
  assert.deepEqual(
    merged.library.books.find(book => book.id === "book-a").progress.path,
    ["start", "current"],
  )
  assert.deepEqual(
    merged.library.books.find(book => book.id === "book-b").progress.path,
    ["other"],
  )
  assert.deepEqual(merged.profile, {
    readerId:"Backup",
    bio:"Backup bio",
    readerAvatar:"data:image/png;base64,YXZhdGFy",
  })
  assert.deepEqual(merged.placeholderPresets, {
    name:"Backup name",
    nickname:"Backup nick",
    webname:"Backup web",
  })
  assert.equal(merged.appearance.article.fontSize, 19)
  assert.equal(merged.appearance.article.backgroundImage, "data:image/png;base64,YXJ0aWNsZQ==")
  assert.equal(merged.appearance.article.customFonts[0].name, "Local Font")
  assert.equal(merged.appearance.phone.fontSize, 15)
  assert.equal(merged.appearance.phone.wallpaperImage, "data:image/png;base64,d2FsbHBhcGVy")
  assert.equal(merged.appearance.phone.customIcons.messages, "data:image/png;base64,aWNvbg==")
  assert.equal(merged.appearance.phone.appBgs.messages, "data:image/png;base64,YXBwLWJn")
  assert.equal(merged.appearance.phone.customFonts[0].name, "Local Phone Font")
  assert.equal(
    merged.appearance.phone.appSettings.messages.callBackgroundImage,
    "data:image/png;base64,Y2FsbA==",
  )
  assert.equal(merged.appearance.phone.appSettings.messages.bubbleFontSize, 16)
})

test("reader data inspection rejects malformed, unsupported, oversized, and accessor-backed input", () => {
  assert.throws(() => inspectReaderDataPackage("{}"), /Tuuru|format/i)
  assert.throws(() => inspectReaderDataPackage(JSON.stringify({
    format:READER_DATA_PACKAGE_FORMAT,
    version:999,
  })), /version/i)
  assert.throws(() => inspectReaderDataPackage(" ".repeat(READER_DATA_PACKAGE_MAX_BYTES + 1)), /large|size/i)

  let touched = false
  const hostile = {
    format:READER_DATA_PACKAGE_FORMAT,
    version:1,
    get library() {
      touched = true
      return {}
    },
  }
  assert.throws(() => inspectReaderDataPackage(hostile), /data|package|format/i)
  assert.equal(touched, false)
})
