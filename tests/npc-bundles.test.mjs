import test from "node:test"
import assert from "node:assert/strict"

import {
  NPC_PACK_STORAGE_KEY,
  deleteNpcPack,
  importNpcPackLibrary,
  mergeNpcPack,
  parseNpcPack,
  readNpcPacks,
  saveNpcPack,
  serializeNpcPack,
  serializeNpcPackLibrary,
} from "../js/npc-bundles.js"

function createStorage() {
  const values = new Map()
  return {
    getItem:key => values.has(key) ? values.get(key) : null,
    setItem:(key, value) => values.set(key, String(value)),
    removeItem:key => values.delete(key),
    peek:key => values.get(key),
  }
}

const npc = {
  id:"npc-a",
  type:"momo",
  name:"momo",
  avatarUrl:"https://example.invalid/momo.png",
  ipLocation:"上海",
  time:"2026/7/24",
  privateField:"drop",
}

test("NPC packs round-trip only supported fields with a total pack name", () => {
  const pack = parseNpcPack(serializeNpcPack({
    id:"pack-a",
    name:"  校园论坛路人  ",
    sourceWorkTitle:"  夏日祭  ",
    npcs:[npc],
  }, { now:() => 123 }))

  assert.equal(pack.name, "校园论坛路人")
  assert.equal(pack.sourceWorkTitle, "夏日祭")
  assert.equal(pack.exportedAt, 123)
  assert.deepEqual(pack.npcs, [{
    id:"npc-a",
    type:"momo",
    name:"momo",
    avatarUrl:"https://example.invalid/momo.png",
    ipLocation:"上海",
    time:"2026/7/24",
  }])
})

test("saving NPC packs persists author-global packs and replaces a duplicate name", () => {
  const storage = createStorage()
  const first = saveNpcPack({ name:"论坛通用", npcs:[npc] }, {
    storage,
    idFactory:() => "pack-a",
    now:() => 100,
  })
  const second = saveNpcPack({ name:"论坛通用", npcs:[{ ...npc, name:"新 momo" }] }, {
    storage,
    idFactory:() => "unused",
    now:() => 200,
  })

  assert.equal(first.id, "pack-a")
  assert.equal(second.id, "pack-a")
  assert.equal(readNpcPacks(storage).length, 1)
  assert.equal(readNpcPacks(storage)[0].npcs[0].name, "新 momo")
  assert.equal(readNpcPacks(storage)[0].createdAt, 100)
  assert.equal(readNpcPacks(storage)[0].updatedAt, 200)
  assert.match(storage.peek(NPC_PACK_STORAGE_KEY), /论坛通用/)
})

test("NPC pack deletion removes only the selected pack", () => {
  const storage = createStorage()
  saveNpcPack({ name:"A", npcs:[npc] }, { storage, idFactory:() => "a" })
  saveNpcPack({ name:"B", npcs:[npc] }, { storage, idFactory:() => "b" })

  assert.equal(deleteNpcPack("a", storage), true)
  assert.deepEqual(readNpcPacks(storage).map(pack => pack.id), ["b"])
  assert.equal(deleteNpcPack("missing", storage), false)
})

test("merging an NPC pack appends records and reassigns colliding ids without mutation", () => {
  const existing = [{ id:"npc-a", type:"npc", name:"原路人" }]
  const before = structuredClone(existing)
  const result = mergeNpcPack(existing, {
    name:"导入包",
    npcs:[npc, { ...npc, id:"", name:"无 ID 路人" }],
  }, { idFactory:(() => {
    const ids = ["npc-imported", "npc-generated"]
    return () => ids.shift()
  })() })

  assert.deepEqual(existing, before)
  assert.equal(result.added, 2)
  assert.equal(result.reassignedIds, 2)
  assert.deepEqual(result.npcs.map(item => item.id), ["npc-a", "npc-imported", "npc-generated"])
})

test("NPC pack library import adds new names and updates matching names", () => {
  const storage = createStorage()
  saveNpcPack({ name:"常用", npcs:[npc] }, { storage, idFactory:() => "existing", now:() => 10 })
  const payload = serializeNpcPackLibrary([
    { id:"incoming-a", name:"常用", npcs:[{ ...npc, name:"更新后" }] },
    { id:"incoming-b", name:"新包", npcs:[npc] },
  ], { now:() => 50 })
  const result = importNpcPackLibrary(payload, {
    storage,
    idFactory:() => "new-id",
    now:() => 60,
  })

  assert.equal(result.added, 1)
  assert.equal(result.updated, 1)
  assert.equal(result.packs.length, 2)
  assert.equal(result.packs.find(pack => pack.name === "常用").id, "existing")
  assert.equal(result.packs.find(pack => pack.name === "常用").npcs[0].name, "更新后")
})

test("malformed NPC packets and libraries fail closed", () => {
  assert.throws(() => parseNpcPack("not json"), /NPC 包/)
  assert.throws(() => parseNpcPack('{"type":"other","version":1,"npcs":[]}'), /NPC 包/)
  const storage = createStorage()
  storage.setItem(NPC_PACK_STORAGE_KEY, "{bad")
  assert.deepEqual(readNpcPacks(storage), [])
})
