import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const productionCopy = [
  "../js/pages/new.js",
  "../js/pages/editor.js",
  "../js/pages/home.js",
  "../js/pages/resources.js",
  "../js/work-preflight.js",
  "../reader/reader.js",
].map(path => ({ path, source:readFileSync(new URL(path, import.meta.url), "utf8") }))

test("standalone picture experiences use Mini文游 consistently in every shipped surface", () => {
  for (const file of productionCopy) {
    assert.doesNotMatch(file.source, /互动文游|mini\s*文游/, file.path)
  }
  for (const path of [
    "../js/pages/new.js",
    "../js/pages/editor.js",
    "../js/pages/home.js",
    "../js/pages/resources.js",
    "../js/work-preflight.js",
    "../reader/reader.js",
  ]) {
    assert.match(productionCopy.find(file => file.path === path).source, /Mini文游/, path)
  }
})

test("the Mini文游 tutorial teaches a complete short-work flow without promising a full game engine", () => {
  const source = productionCopy.find(file => file.path === "../js/pages/resources.js").source
  for (const copy of [
    "Mini文游适合做什么",
    "从零创建 Mini文游",
    "安排画面顺序与完成条件",
    "叠加图层与多立绘",
    "逐画面触摸提示",
    "多个可移动对话框",
    "固定画布与三种预览",
    "删除误建热区",
    "预览、导出与交给读者",
    "不是完整文游引擎",
    "不提供自由剧情分支、背包、数值养成、战斗或自定义脚本",
    "在一个互动场景里安排多个固定顺序画面",
    "最多 24 个叠加图层",
    "最多 12 个叠加对话框",
    "不会保存画面内的中途探索进度",
    "互动文章里的互动页没有默认音乐",
    "AudioContext、MediaRecorder",
    "最终加密载荷已经包含约 35 字节封装开销",
    "完整 PNG 最多 25 MiB",
    "更换较小封面或改用 .tuuru",
    "最后一个画面完成后进入作品完成页",
    "超过 10 MiB 无法导出",
  ]) assert.ok(source.includes(copy), copy)
  assert.doesNotMatch(source, /不能把文件刚好塞满|贴近边界.*可能无法生成|贴近边界.*被读者拒绝/)
})

test("the tutorial distinguishes the shared picture runtime from each work shell", () => {
  const source = productionCopy.find(file => file.path === "../js/pages/resources.js").source
  for (const copy of [
    "Mini文游和互动图片的画面能力一样吗",
    "共用同一套画面编辑与播放能力",
    "同样的素材组合在播放时需要相近的解码内存",
    "Mini文游是可单独导入书架的短篇外壳",
    "互动图片位于互动文章路线中",
    "HTTPS 链接只会减小导出包和本地存储",
    "不会降低读者播放时的图片、GIF 或视频解码内存",
  ]) assert.ok(source.includes(copy), copy)
})

test("the Mini文游 tutorial states the exact ZIP and package-size boundary", () => {
  const source = productionCopy.find(file => file.path === "../js/pages/resources.js").source
  for (const copy of [
    "Mini文游可以导出 ZIP 压缩包吗",
    "作者端只支持导出 .tuuru 或加密 PNG",
    "读者端不能直接导入 ZIP",
    "不会增加作品的 10 MiB 加密载荷上限",
    "优先压缩图片、裁剪本地 BGM",
    "稳定的 HTTPS 链接",
  ]) assert.ok(source.includes(copy), copy)
})
