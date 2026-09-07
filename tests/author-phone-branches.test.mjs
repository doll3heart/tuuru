import test from 'node:test'
import assert from 'node:assert/strict'
import {authorPhoneExportJobs} from '../js/author-phone-export.js'
import {phoneExportBranchLabel} from '../reader/phone-content-export.js'
import {bootstrapAuthorPhoneRenderSurface as surface} from './helpers/author-phone-render-surface.mjs'
test("author export branches render independently without changing reader storage", async t => {
  const work = choiceWork()
  work.id = "reader-detached-export-branches"
  const owner = work.phoneData.chats[0].rounds[0].messages[0]
  owner.text = "EXPORT_BRANCH_OWNER"
  owner.choices = [{
    id:"export-choice-a",
    text:"Choose export A",
    replyText:"EXPORT_BRANCH_A_REPLY",
    replyPace:"instant",
    followUpMessages:[{
      id:"export-follow-up-a",
      type:"text",
      senderId:"contact-1",
      text:"EXPORT_BRANCH_A_FOLLOW_UP",
      revealMode:"instant",
      delayBeforeMs:0,
    }],
  }, {
    id:"export-choice-b",
    text:"Choose export B",
    replyText:"EXPORT_BRANCH_B_REPLY",
    replyPace:"instant",
    followUpMessages:[{
      id:"export-follow-up-b",
      type:"text",
      senderId:"contact-1",
      text:"EXPORT_BRANCH_B_FOLLOW_UP",
      revealMode:"instant",
      delayBeforeMs:0,
    }],
  }]
  work.phoneData.chats[0].rounds[0].messages = [owner, {
    id:"export-condition-a",
    type:"text",
    senderId:"contact-1",
    text:"EXPORT_BRANCH_A_CONDITION",
    visibleAfterChoiceId:"export-choice-a",
  }, {
    id:"export-condition-b",
    type:"text",
    senderId:"contact-1",
    text:"EXPORT_BRANCH_B_CONDITION",
    visibleAfterChoiceId:"export-choice-b",
  }]

  const f = await surface(t,work)
  const exportFrame = f.adapter.frame
  const readerModule = { readerPhoneExportJobs:(pd, frame, options) => authorPhoneExportJobs({...f.adapter,phoneData:pd},f.snapshot,options) }
  const currentChatJobs = readerModule.readerPhoneExportJobs(
    work.phoneData,
    exportFrame,
    { branchMode:"current" },
  ).filter(job => job.moduleLabel === "消息")
  assert.equal(currentChatJobs.length, 1)
  assert.equal("branchPath" in currentChatJobs[0], false)

  const chatJobs = readerModule.readerPhoneExportJobs(
    work.phoneData,
    exportFrame,
    { branchMode:"all" },
  ).filter(job => job.moduleLabel === "消息")

  assert.equal(chatJobs.length, 2)
  const renderedBranches = chatJobs.map(job => {
    job.render()
    return exportFrame.textContent
  })
  assert.match(renderedBranches[0], /EXPORT_BRANCH_A_REPLY/)
  assert.match(renderedBranches[0], /EXPORT_BRANCH_A_FOLLOW_UP/)
  assert.match(renderedBranches[0], /EXPORT_BRANCH_A_CONDITION/)
  assert.doesNotMatch(renderedBranches[0], /EXPORT_BRANCH_B_/)
  assert.match(renderedBranches[1], /EXPORT_BRANCH_B_REPLY/)
  assert.match(renderedBranches[1], /EXPORT_BRANCH_B_FOLLOW_UP/)
  assert.match(renderedBranches[1], /EXPORT_BRANCH_B_CONDITION/)
  assert.doesNotMatch(renderedBranches[1], /EXPORT_BRANCH_A_/)

  const noChoicePhoneData = JSON.parse(JSON.stringify(work.phoneData))
  noChoicePhoneData.chats[0].rounds[0].messages = [{
    id:"ordinary-message",
    type:"text",
    senderId:"contact-1",
    text:"ORDINARY_CHAT_ONLY",
  }]
  const ordinaryJobs = readerModule.readerPhoneExportJobs(
    noChoicePhoneData,
    exportFrame,
    { branchMode:"all" },
  ).filter(job => job.moduleLabel === "消息")
  assert.equal(ordinaryJobs.length, 1)
  assert.deepEqual(ordinaryJobs[0].branchPath, [])
  assert.equal(ordinaryJobs[0].itemLabel, currentChatJobs[0].itemLabel)

  f.assertUnchanged()
})

test("all-branch planner exposes only masked branch labels in its progress item labels", async t => {
  const work = choiceWork()
  work.id = "reader-export-masked-branch-label"
  work.phoneData.chats[0].rounds[0].messages[0].choices = [{
    id:"choice-private-label",
    text:"ABCDEFGHIJKLMNO小雨/长名字",
    replyText:"",
    silent:true,
    followUpMessages:[],
  }]
  const f = await surface(t,work)
  const exportFrame = f.adapter.frame
  const readerModule = { readerPhoneExportJobs:(pd, frame, options) => authorPhoneExportJobs({...f.adapter,phoneData:pd},f.snapshot,options) }

  const [job] = readerModule.readerPhoneExportJobs(work.phoneData, exportFrame, {
    branchMode:"all",
    phoneExportBranchLabel:(path, index, total) => phoneExportBranchLabel(path, index, total, {
      maskValues:["ABCDEFGHIJKLMNO", "小雨/长名字"],
    }),
  }).filter(candidate => candidate.moduleLabel === "消息")

  assert.ok(job)
  assert.doesNotMatch(job.itemLabel, /ABCDEFGHIJKLMNO|ABCDEFGHIJKL|小雨\/长名字|小雨-长名字/)
  assert.match(job.itemLabel, /▖▜▖▗/)
})

test("phone export planning enforces the aggregate 64-branch limit before rendering", async t => {
  const work = choiceWork()
  work.id = "reader-export-aggregate-branch-limit"
  const f = await surface(t,work)
  const exportFrame = f.adapter.frame
  const readerModule = { readerPhoneExportJobs:(pd, frame, options) => authorPhoneExportJobs({...f.adapter,phoneData:pd},f.snapshot,options) }

  function phoneDataWithSingleRouteChats(chatCount) {
    const phoneData = JSON.parse(JSON.stringify(work.phoneData))
    phoneData.moments = []
    phoneData.forumPosts = []
    phoneData.chats = Array.from({ length:chatCount }, (_, chatIndex) => ({
      id:`limit-chat-${chatIndex}`,
      type:"single",
      contactIds:["contact-1"],
      messages:[],
      rounds:[{
        id:`limit-round-${chatIndex}`,
        messages:[{
          id:`limit-owner-${chatIndex}`,
          type:"text",
          senderId:"contact-1",
          text:`Owner ${chatIndex}`,
          choices:[{
            id:`limit-choice-${chatIndex}`,
            text:`Only route ${chatIndex}`,
            replyText:"",
            silent:true,
            followUpMessages:[],
          }],
        }],
      }],
    }))
    return phoneData
  }

  const sixtyFourJobs = readerModule.readerPhoneExportJobs(
    phoneDataWithSingleRouteChats(64),
    exportFrame,
    { branchMode:"all" },
  )
  assert.equal(
    sixtyFourJobs.filter(job => job.moduleLabel === "消息").length,
    64,
  )

  const exactLimitError = new Error(
    "可导出的消息选项分支超过 64 条，请减少选项后重试，或改用“默认分支”。",
  )
  let aggregateRenderCalls = 0
  assert.throws(() => {
    const jobs = readerModule.readerPhoneExportJobs(
      phoneDataWithSingleRouteChats(65),
      exportFrame,
      { branchMode:"all" },
    )
    jobs.forEach(job => {
      aggregateRenderCalls += 1
      job.render()
    })
  }, exactLimitError)
  assert.equal(aggregateRenderCalls, 0)

  const branchLimitedPhoneData = phoneDataWithSingleRouteChats(1)
  branchLimitedPhoneData.chats[0].rounds[0].messages[0].choices = Array.from(
    { length:65 },
    (_, choiceIndex) => ({
      id:`single-chat-choice-${choiceIndex}`,
      text:`Route ${choiceIndex}`,
      replyText:"",
      silent:true,
      followUpMessages:[],
    }),
  )
  let branchLimitRenderCalls = 0
  assert.throws(() => {
    const jobs = readerModule.readerPhoneExportJobs(
      branchLimitedPhoneData,
      exportFrame,
      { branchMode:"all" },
    )
    jobs.forEach(job => {
      branchLimitRenderCalls += 1
      job.render()
    })
  }, exactLimitError)
  assert.equal(branchLimitRenderCalls, 0)
})

test("all-branch planning expands only chats and keeps non-chat modules singleton", async t => {
  const work = choiceWork()
  work.id = "reader-export-non-chat-singletons"
  work.phoneData.moments = [{
    id:"export-moment",
    contactId:"contact-1",
    content:"One moment",
  }]
  work.phoneData.forumPosts = [{
    id:"export-forum-post",
    contactId:"contact-1",
    title:"One forum post",
    content:"Forum body",
  }]
  const f = await surface(t,work)
  const exportFrame = f.adapter.frame
  const readerModule = { readerPhoneExportJobs:(pd, frame, options) => authorPhoneExportJobs({...f.adapter,phoneData:pd},f.snapshot,options) }

  const currentJobs = readerModule.readerPhoneExportJobs(
    work.phoneData,
    exportFrame,
    { branchMode:"current" },
  )
  const allJobs = readerModule.readerPhoneExportJobs(
    work.phoneData,
    exportFrame,
    { branchMode:"all" },
  )
  function countModule(jobs, label) {
    return jobs.filter(job => job.moduleLabel === label).length
  }

  assert.equal(countModule(currentJobs, "消息"), 1)
  assert.equal(countModule(allJobs, "消息"), 2)
  assert.equal(countModule(currentJobs, "动态"), 1)
  assert.equal(countModule(allJobs, "动态"), 1)
  assert.equal(countModule(currentJobs, "论坛"), 1)
  assert.equal(countModule(allJobs, "论坛"), 1)
  assert.equal(allJobs.length, currentJobs.length + 1)
})

function choiceWork() {
  return {
    schemaVersion: 1,
    id: "reader-chat-choice-runtime",
    type: "phone",
    title: "Choice runtime",
    placeholders: [],
    scenes: [],
    phoneData: {
      contacts: [{ id: "contact-1", name: "林澈" }],
      chats: [{
        id: "chat-1",
        type: "single",
        contactIds: ["contact-1"],
        messages: [],
        rounds: [{
          id: "round-1",
          label: "第一轮",
          messages: [
            {
              id: "owner-message",
              type: "text",
              senderId: "contact-1",
              text: "今晚要不要见面？",
              choices: [
                {
                  id: "choice-a",
                  replyPace: "instant",
                  text: "好，我会准时到。",
                  replyText: "好，我会准时到。",
                  followUpMessages: [{
                    id: "authored-followup-a",
                    type: "text",
                    senderId: "contact-1",
                    text: "那我在老地方等你。",
                  }],
                },
                {
                  id: "choice-b",
                  replyPace: "instant",
                  text: "今晚不太方便，改天好吗？",
                  replyText: "今晚不太方便，改天好吗？",
                  followUpMessages: [{
                    id: "authored-followup-b",
                    type: "text",
                    senderId: "contact-1",
                    text: "好，那你方便时告诉我。",
                  }],
                },
              ],
            },
            {
              id: "authored-tail",
              type: "text",
              senderId: "contact-1",
              text: "这是作者原本排在后面的消息。",
            },
          ],
        }],
      }],
      moments: [],
      forumPosts: [],
      forumNpcs: [],
      memos: [],
      photos: [],
      albums: [],
      browserHistory: [],
      shoppingItems: [],
      skin: { readerId: "Reader", showDynamicIsland: false, showHomeIndicator: false },
      apps: [{
        id: "messages-app",
        type: "messages",
        name: "消息",
        icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>',
        desktopX: 0,
        desktopY: 0,
        enabled: true,
      }],
    },
  }
}
