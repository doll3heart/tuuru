import test from "node:test"
import assert from "node:assert/strict"

import {
  WORK_SIZE_CAUTION_BYTES,
  WORK_SIZE_HIGH_RISK_BYTES,
  inspectWorkSize,
  inspectWorkSizeWithAssets,
} from "../js/work-size-report.js"
import { prepareWorkForExport } from "../js/data.js"

function dataUrl(bytes, type = "image/png") {
  return `data:${type};base64,${Buffer.alloc(bytes, 7).toString("base64")}`
}

test("reports exact encrypted package overhead and embedded asset bytes", () => {
  const image = dataUrl(32)
  const work = {
    id:"work-size",
    type:"article",
    nodes:[{
      id:"node-1",
      title:"第一幕",
      content:`<p>正文</p><img src="${image}">`,
    }],
  }
  const report = inspectWorkSize(work)
  const serializedBytes = new TextEncoder().encode(JSON.stringify(work)).length

  assert.equal(report.plaintextBytes, serializedBytes)
  assert.equal(report.encryptedPackageBytes, serializedBytes + 35)
  assert.equal(report.embeddedAssetBytes, 32)
  assert.equal(report.assets.length, 1)
  assert.equal(report.assets[0].bytes, 32)
  assert.equal(report.assets[0].mediaType, "image/png")
  assert.equal(report.assets[0].locator.surface, "article")
  assert.equal(report.assets[0].locator.nodeId, "node-1")
})

test("prepared exports and the size report use the same compact JSON bytes", () => {
  const work = {
    id:"prepared-size",
    type:"article",
    title:"Compact export",
    createdAt:1,
    updatedAt:2,
    nodes:[],
    editorSettings:{ indentFirstLine:true, fontSize:18 },
  }
  const prepared = prepareWorkForExport(work)
  const serialized = JSON.stringify(prepared)
  const report = inspectWorkSize(prepared)

  assert.equal(report.plaintextBytes, new TextEncoder().encode(serialized).length)
  assert.equal(report.encryptedPackageBytes, report.plaintextBytes + 35)
  assert.equal(prepared.editorSettings, undefined)
  assert.equal(prepared.updatedAt, undefined)
  assert.equal(prepared.release.workId, work.id)
})

test("portable IndexedDB assets are counted once in the encrypted package", async () => {
  const assetId = "a".repeat(64)
  const work = {
    id:"portable-size",
    type:"article",
    interactiveScenes:[{
      stages:[{
        image:`asset://${assetId}`,
        characterImage:`asset://${assetId}`,
      }],
    }],
  }
  const report = await inspectWorkSizeWithAssets(work, async () => [{
    id:assetId,
    type:"image/png",
    fileName:"scene.png",
    blob:new Blob([new Uint8Array(4096)], { type:"image/png" }),
  }])

  assert.equal(report.assets.length, 1)
  assert.equal(report.assets[0].bytes, 4096)
  assert.equal(report.embeddedAssetBytes, 4096)
  assert.ok(report.encryptedPackageBytes > report.plaintextBytes + 4096)
})

test("standalone Mini文游 assets use the authored picture name in the size report", async () => {
  const assetId = "b".repeat(64)
  const work = {
    id:"mini-size",
    type:"article",
    experienceMode:"interactive",
    interactiveScenes:[{
      title:"独立场景",
      stages:[{
        name:"雨夜相遇",
        image:`asset://${assetId}`,
      }],
    }],
  }
  const report = await inspectWorkSizeWithAssets(work, async () => [{
    id:assetId,
    type:"image/webp",
    fileName:"rain.webp",
    blob:new Blob([new Uint8Array(2048)], { type:"image/webp" }),
  }])

  assert.equal(report.assets[0].location, "Mini文游 · 雨夜相遇")
  assert.doesNotMatch(report.assets[0].location, /互动图片/)
})

test("counts repeated embedded values as repeated storage and orders largest first", () => {
  const small = dataUrl(10, "image/webp")
  const large = dataUrl(90, "video/mp4")
  const report = inspectWorkSize({
    id:"phone-size",
    type:"phone",
    watermark:{image:small},
    phoneData:{
      skin:{wallpaperImage:large},
      moments:[{id:"moment-1", images:[small]}],
    },
  })

  assert.equal(report.assets.length, 3)
  assert.equal(report.embeddedAssetBytes, 110)
  assert.equal(report.assets[0].bytes, 90)
  assert.equal(report.assets[0].locator.surface, "phone")
  assert.ok(report.assets.some(asset => asset.locator.surface === "work-info"))
  assert.ok(report.assets.some(asset => asset.locator.appType === "messages"))
})

test("uses explicit caution and high-risk package thresholds", () => {
  const safe = inspectWorkSize({id:"safe", title:"短篇"})
  assert.equal(safe.risk, "safe")
  assert.equal(safe.thresholds.caution, WORK_SIZE_CAUTION_BYTES)
  assert.equal(safe.thresholds.high, WORK_SIZE_HIGH_RISK_BYTES)

  const caution = inspectWorkSize({
    id:"caution",
    payload:"x".repeat(WORK_SIZE_CAUTION_BYTES),
  })
  assert.equal(caution.risk, "caution")

  const high = inspectWorkSize({
    id:"high",
    payload:"x".repeat(WORK_SIZE_HIGH_RISK_BYTES),
  })
  assert.equal(high.risk, "high")
})

test("ignores remote links and malformed data URLs without throwing", () => {
  const report = inspectWorkSize({
    id:"links",
    phoneData:{
      photos:[
        {id:"remote", imageUrl:"https://example.com/a.png"},
        {id:"bad", imageUrl:"data:image/png;base64,%%%"},
      ],
    },
  })
  assert.deepEqual(report.assets, [])
  assert.equal(report.embeddedAssetBytes, 0)
})
