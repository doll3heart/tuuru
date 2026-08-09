import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const editorSource = readFileSync(new URL("../js/pages/editor.js", import.meta.url), "utf8")

test("Mini文游默认 BGM links expose an accessible package-size explanation", () => {
  assert.match(editorSource, /data-a="mini-media-link-help-open"/)
  assert.match(editorSource, /aria-haspopup="dialog"/)
  assert.match(editorSource, /aria-controls="miniBgmMediaLinkHelp"/)
  assert.match(editorSource, /aria-expanded="false"/)
  assert.match(editorSource, /role="dialog"/)
  assert.match(editorSource, /aria-labelledby="miniBgmMediaLinkHelpTitle"/)
  assert.match(editorSource, /data-a="mini-media-link-help-close"/)
  assert.match(editorSource, /event\.key !== "Escape"/)
})

test("Mini文游 link help distinguishes package size from runtime memory and network risk", () => {
  for (const copy of [
    "不会把音频文件打进 .tuuru 或加密 PNG",
    "不占用 256 个本地素材名额",
    "读者播放时需要联网",
    "链接失效、防盗链或站点跨域限制",
    "Tuuru 不会裁剪远程文件",
    "链接只改变包体，播放时仍需解码和缓冲",
    "不能据此判断运行内存更低",
  ]) assert.match(editorSource, new RegExp(copy))
})
