import test from "node:test"
import assert from "node:assert/strict"

import { createWorkArtifact, deliverArtifact } from "../js/work-export.js"
import { MAX_WORK_PNG_FILE_BYTES } from "../js/png-payload.js"

class FakeFile {
  constructor(parts, name, options = {}) {
    this.parts = parts
    this.name = name
    this.type = options.type || ""
  }
}

const baseArtifact = {
  blob: new Blob(["encrypted"], { type: "application/vnd.tuuru.work" }),
  filename: "Story.tuuru",
  title: "Story",
  format: "tuuru",
  entityType: "work",
  entityId: "work-a",
  revision: 42,
}

test("system sharing receives a local File without downloading", async () => {
  const events = []
  const result = await deliverArtifact(baseArtifact, {
    navigatorObject: {
      canShare: ({ files }) => files.length === 1,
      share: async data => events.push(["share", data.files[0].name]),
    },
    FileConstructor: FakeFile,
    download: () => events.push(["download"]),
  })

  assert.equal(result, "shared")
  assert.deepEqual(events, [["share", "Story.tuuru"]])
})

test("share cancellation does not trigger an unwanted download", async () => {
  const cancelled = Object.assign(new Error("cancelled"), { name: "AbortError" })
  const downloads = []
  const result = await deliverArtifact(baseArtifact, {
    navigatorObject: {
      canShare: () => true,
      share: async () => { throw cancelled },
    },
    FileConstructor: FakeFile,
    download: (...args) => downloads.push(args),
  })

  assert.equal(result, "cancelled")
  assert.equal(downloads.length, 0)
})

test("unsupported and failed sharing fall back to a local download", async () => {
  const downloads = []
  const unsupported = await deliverArtifact(baseArtifact, {
    navigatorObject: { canShare: () => false, share: async () => {} },
    FileConstructor: FakeFile,
    download: (...args) => downloads.push(args),
  })
  const failed = await deliverArtifact(baseArtifact, {
    navigatorObject: {
      canShare: () => true,
      share: async () => { throw new Error("share unavailable") },
    },
    FileConstructor: FakeFile,
    download: (...args) => downloads.push(args),
  })

  assert.equal(unsupported, "downloaded")
  assert.equal(failed, "downloaded")
  assert.equal(downloads.length, 2)
  assert.equal(downloads[0][1], "Story.tuuru")
})

test("work artifacts preserve export metadata and safe filenames", async () => {
  const work = { id: "work-a", title: "A/B: Story", updatedAt: 123 }
  const artifact = await createWorkArtifact("work-a", {
    format: "tuuru",
    getWorkById: () => work,
    exportWork: () => "{\"id\":\"work-a\"}",
    encrypt: async value => new TextEncoder().encode(value),
  })

  assert.equal(artifact.filename, "A-B- Story.tuuru")
  assert.equal(artifact.title, work.title)
  assert.equal(artifact.entityId, work.id)
  assert.equal(artifact.revision, 123)
  assert.equal(artifact.format, "tuuru")
  assert.equal(artifact.blob.type, "application/vnd.tuuru.work")
  assert.equal(artifact.bytes, artifact.blob.size)
})

test("PNG artifacts convert the encoded data URL into an image blob", async () => {
  const work = { id: "work-png", title: "Cover", updatedAt: 456 }
  const artifact = await createWorkArtifact("work-png", {
    format: "png",
    coverUrl: "data:image/png;base64,cover",
    getWorkById: () => work,
    exportWork: () => "{}",
    encrypt: async () => new Uint8Array([1, 2, 3]),
    encodePng: (_encrypted, coverUrl, resolve) => {
      assert.equal(coverUrl, "data:image/png;base64,cover")
      resolve("data:image/png;base64,AQID")
    },
  })

  assert.equal(artifact.filename, "Cover.png")
  assert.equal(artifact.blob.type, "image/png")
  assert.deepEqual([...new Uint8Array(await artifact.blob.arrayBuffer())], [1, 2, 3])
})

test("PNG artifacts larger than the reader import limit are rejected after encoding", async () => {
  class OversizedPngBlob {
    constructor(_parts, options = {}) {
      this.type = options.type || ""
      this.size = MAX_WORK_PNG_FILE_BYTES + 1
    }
  }

  await assert.rejects(
    createWorkArtifact("work-png-limit", {
      format:"png",
      coverUrl:"data:image/png;base64,cover",
      getWorkById:() => ({ id:"work-png-limit", title:"Large cover", updatedAt:456 }),
      exportWork:() => "{}",
      loadAssets:async () => [],
      encrypt:async () => new Uint8Array([1, 2, 3]),
      encodePng:(_encrypted, _coverUrl, resolve) => resolve("data:image/png;base64,AQID"),
      BlobConstructor:OversizedPngBlob,
    }),
    /25 MB.*封面.*\.tuuru/,
  )
})

test("work artifacts include referenced binary assets in the encrypted package", async () => {
  const reference = `asset://${"a".repeat(64)}`
  const work = { id: "work-assets", title: "Assets", updatedAt: 789, image: reference }
  const calls = []
  const artifact = await createWorkArtifact("work-assets", {
    format: "tuuru",
    getWorkById: () => work,
    exportWork: () => JSON.stringify(work),
    loadAssets: async exported => {
      assert.equal(exported.image, reference)
      return [{ id: "a".repeat(64), blob: new Blob(["image"]) }]
    },
    encrypt: async () => { throw new Error("legacy package must not be used") },
    encryptPortable: async (serialized, assets) => {
      calls.push([serialized, assets])
      return new Uint8Array([7, 8, 9])
    },
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0][1].length, 1)
  assert.deepEqual([...new Uint8Array(await artifact.blob.arrayBuffer())], [7, 8, 9])
})
