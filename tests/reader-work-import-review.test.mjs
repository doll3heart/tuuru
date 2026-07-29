import test from "node:test"
import assert from "node:assert/strict"

import { createWorkRelease } from "../js/work-release.js"
import { readerWorkImportReview } from "../reader/work-import-review.js"

function work(title, revision) {
  const candidate = {
    id: "shared-work",
    type: "article",
    title,
    createdAt: 1,
    updatedAt: revision,
    nodes: [{ id: "start", content: title }],
  }
  candidate.release = createWorkRelease(candidate, {
    revision,
    exportedAt: "2026-07-28T00:00:00.000Z",
  })
  return candidate
}

test("reader import review gives each known release relationship explicit copy", () => {
  const existing = work("Current", 20)
  const fixtures = [
    {
      incoming: work("New", 21),
      state: "newer",
      label: "发现作品更新",
      body: /作者新发布的版本/,
      confirm: "更新作品",
      primaryAction: "replace",
      secondary: "返回选择",
      secondaryAction: "cancel",
    },
    {
      incoming: JSON.parse(JSON.stringify(existing)),
      state: "same",
      label: "当前版本已在书架",
      body: /内容与书架中的版本一致/,
      confirm: "继续阅读",
      primaryAction: "continue",
      secondary: "重新写入缓存",
      secondaryAction: "replace",
    },
    {
      incoming: work("Old", 19),
      state: "older",
      label: "这是较早的版本",
      body: /较早版本替换当前正文/,
      confirm: "仍要替换",
      primaryAction: "replace",
      secondary: "仅本次打开",
      secondaryAction: "preview",
    },
    {
      incoming: work("Conflict", 20),
      state: "conflict",
      label: "版本标记存在冲突",
      body: /版本号相同，但内容不同/,
      confirm: "仍要导入",
      primaryAction: "replace",
      secondary: "仅本次打开",
      secondaryAction: "preview",
    },
  ]

  for (const fixture of fixtures) {
    const review = readerWorkImportReview(fixture.incoming, existing, { hasBook:true })
    assert.equal(review.state, fixture.state)
    assert.equal(review.label, fixture.label)
    assert.match(review.contentSummary, fixture.body)
    assert.equal(review.confirmLabel, fixture.confirm)
    assert.equal(review.primaryAction, fixture.primaryAction)
    assert.equal(review.secondaryLabel, fixture.secondary)
    assert.equal(review.secondaryAction, fixture.secondaryAction)
    assert.match(review.readerSummary, /存档、身份、占位符与书签/)
  }
  assert.deepEqual(
    readerWorkImportReview(fixtures[0].incoming, existing, { hasBook:true }).changeSummary,
    ["修改 1 段正文"],
  )
})

test("legacy and cache-recovery imports retain safe fallback states", () => {
  const legacy = {
    id: "shared-work",
    type: "article",
    title: "Legacy",
    nodes: [],
  }
  const existing = work("Current", 20)

  const unknown = readerWorkImportReview(legacy, existing, { hasBook:true })
  assert.equal(unknown.state, "unknown")
  assert.equal(unknown.label, "检测到已有作品")
  assert.equal(unknown.confirmLabel, "更新作品")
  assert.equal(unknown.secondaryAction, "cancel")

  const recovery = readerWorkImportReview(legacy, null, { hasBook:true })
  assert.equal(recovery.state, "recovery")
  assert.equal(recovery.label, "恢复书架内容")
  assert.equal(recovery.confirmLabel, "恢复并继续")
  assert.deepEqual(recovery.changeSummary, [])
})
