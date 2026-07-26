import test from "node:test"
import assert from "node:assert/strict"

import {
  READER_APPEARANCE_PACKAGE_FORMAT,
  READER_APPEARANCE_PACKAGE_VERSION,
  createReaderAppearancePackage,
  inspectReaderAppearancePackage,
  serializeReaderAppearancePackage,
} from "../reader/appearance-package.js"

test("appearance package carries visual settings and excludes reader identity and activity", () => {
  const input = {
    article: {
      fontSize: 23,
      textColor: "#223344",
      backgroundImage: "data:image/png;base64,YXJ0aWNsZQ==",
      customCss: ".article-title { letter-spacing: .1em; }",
      customFonts: [{ name: "Shareable", data: "data:font/woff2;base64,Zm9udA==" }],
      readerId: "PRIVATE_ARTICLE_ID",
    },
    phone: {
      wallpaper: "#ddeeff",
      wallpaperImage: "data:image/png;base64,d2FsbHBhcGVy",
      topBgImage: "data:image/png;base64,cHJvZmlsZS1jb3Zlcg==",
      readerId: "PRIVATE_READER_ID",
      readerAvatar: "data:image/png;base64,UFJJVkFURV9BVkFUQVI=",
      bio: "PRIVATE_BIO",
      readingProgress: { workId: "PRIVATE_WORK" },
      customFonts: [{ name: "Phone Font", data: "data:font/woff;base64,cGhvbmUtZm9udA==" }],
      customIcons: {
        memo: "data:image/png;base64,bWVtby1pY29u",
        profile: "PRIVATE_PROFILE_ICON",
      },
      appSettings: {
        memo: {
          cardBg: "#ffffff",
          customCss: ".memo-card { box-shadow: none; }",
          readerId: "PRIVATE_NESTED_ID",
        },
      },
    },
    profile: { readerId: "PRIVATE_PROFILE", readerAvatar: "PRIVATE_AVATAR", bio: "PRIVATE_BIO" },
    recent: [{ id: "PRIVATE_WORK" }],
    shelf: ["PRIVATE_WORK"],
    password: "PRIVATE_PASSWORD",
  }

  const serialized = serializeReaderAppearancePackage(input)
  const parsed = JSON.parse(serialized)

  assert.equal(parsed.format, READER_APPEARANCE_PACKAGE_FORMAT)
  assert.equal(parsed.version, READER_APPEARANCE_PACKAGE_VERSION)
  assert.equal(parsed.appearance.article.fontSize, 23)
  assert.equal(parsed.appearance.phone.wallpaper, "#ddeeff")
  assert.equal(parsed.appearance.phone.topBgImage, "data:image/png;base64,cHJvZmlsZS1jb3Zlcg==")
  assert.equal(parsed.appearance.phone.appSettings.memo.cardBg, "#ffffff")
  assert.equal(parsed.appearance.phone.customIcons.memo, "data:image/png;base64,bWVtby1pY29u")
  for (const secret of [
    "PRIVATE_READER_ID",
    "PRIVATE_AVATAR",
    "PRIVATE_BIO",
    "PRIVATE_WORK",
    "PRIVATE_PASSWORD",
    "PRIVATE_NESTED_ID",
    "PRIVATE_PROFILE_ICON",
  ]) assert.equal(serialized.includes(secret), false, secret)
})

test("inspection strips unknown fields and returns detached appearance records", () => {
  const source = createReaderAppearancePackage({
    article: { fontSize: 28, unknownArticle: "DROP_ME" },
    phone: {
      frameColor: "#334455",
      unknownPhone: "DROP_ME",
      appSettings: { gallery: { columns: 4, unknownNested: "DROP_ME" } },
    },
  })
  source.appearance.article.fontSize = 26
  const inspected = inspectReaderAppearancePackage(JSON.stringify(source))

  assert.deepEqual(inspected.article.fontSize, 26)
  assert.equal(Object.hasOwn(inspected.article, "unknownArticle"), false)
  assert.equal(Object.hasOwn(inspected.phone, "unknownPhone"), false)
  assert.deepEqual(inspected.phone.appSettings.gallery, { columns: 4 })
  inspected.phone.frameColor = "#000000"
  assert.equal(source.appearance.phone.frameColor, "#334455")
})

test("inspection rejects malformed, unsupported, oversized, and empty packages", () => {
  assert.throws(() => inspectReaderAppearancePackage("{"), /JSON|美化包/)
  assert.throws(() => inspectReaderAppearancePackage(JSON.stringify({
    format: READER_APPEARANCE_PACKAGE_FORMAT,
    version: READER_APPEARANCE_PACKAGE_VERSION + 1,
    appearance: { article: {}, phone: {} },
  })), /版本/)
  assert.throws(() => inspectReaderAppearancePackage(JSON.stringify({
    format: "other-format",
    version: 1,
    appearance: { article: {}, phone: {} },
  })), /格式/)
  assert.throws(() => inspectReaderAppearancePackage(JSON.stringify({
    format: READER_APPEARANCE_PACKAGE_FORMAT,
    version: READER_APPEARANCE_PACKAGE_VERSION,
    appearance: {},
  })), /外观/)
  assert.throws(() => inspectReaderAppearancePackage(" ".repeat(24 * 1024 * 1024 + 1)), /过大/)
})

test("prototype-like and accessor fields never enter a package", () => {
  let reads = 0
  const phone = Object.create(null)
  Object.defineProperty(phone, "readerId", {
    enumerable: true,
    get() {
      reads += 1
      return "PRIVATE_ACCESSOR"
    },
  })
  phone.wallpaper = "#abcdef"
  const font = {}
  Object.defineProperty(font, "name", {
    enumerable: true,
    get() {
      reads += 1
      return "PRIVATE_FONT_NAME"
    },
  })
  font.data = "data:font/woff2;base64,Zm9udA=="
  phone.customFonts = [font]
  phone.__proto__ = { readerId: "PRIVATE_PROTO" }

  const serialized = serializeReaderAppearancePackage({ article: {}, phone })
  assert.equal(reads, 0)
  assert.equal(serialized.includes("PRIVATE_ACCESSOR"), false)
  assert.equal(serialized.includes("PRIVATE_PROTO"), false)
  assert.equal(serialized.includes("PRIVATE_FONT_NAME"), false)
  assert.equal(JSON.parse(serialized).appearance.phone.wallpaper, "#abcdef")
})
