import test from "node:test"
import assert from "node:assert/strict"
import { searchArticleWork } from "../js/article-work-search.js"

const work = {
  chapters:[{id:"chapter-a",name:"第一章"},{id:"chapter-b",name:"第二章"}],
  nodes:[
    {id:"node-a",chapterId:"chapter-a",title:"雨夜",content:"<p>她在车站等待&nbsp;末班车。</p>",choices:[{text:"走进雨里"}]},
    {id:"node-b",chapterId:"chapter-b",title:"清晨",content:"<p>太阳升起。</p>",choices:[{text:"回到车站"}]},
  ],
}

test("work search covers title, visible body text, choice text, and chapter path", () => {
  assert.equal(searchArticleWork(work, "雨夜")[0].nodeId, "node-a")
  assert.equal(searchArticleWork(work, "末班车")[0].nodeId, "node-a")
  assert.equal(searchArticleWork(work, "走进雨里")[0].nodeId, "node-a")
  assert.equal(searchArticleWork(work, "第二章")[0].nodeId, "node-b")
})

test("title matches rank above body and results include safe excerpts", () => {
  const rankedWork = structuredClone(work)
  rankedWork.nodes[1].content = "<p>雨夜只是回忆</p><script>hidden()</script>"
  const results = searchArticleWork(rankedWork, "雨夜")
  assert.deepEqual(results.map(result => result.nodeId), ["node-a", "node-b"])
  assert.doesNotMatch(results[1].excerpt, /script|hidden/)
})

test("blank queries do not return the entire work", () => {
  assert.deepEqual(searchArticleWork(work, "   "), [])
})
