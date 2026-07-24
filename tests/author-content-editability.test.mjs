import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const phoneSource = await readFile(new URL("../js/pages/phone.js", import.meta.url), "utf8")
const forumViewSource = await readFile(new URL("../js/phone-forum-view.js", import.meta.url), "utf8")

function supports(pattern, label) {
  assert.match(phoneSource, pattern, `${label} needs a stable author re-edit path`)
}

test("every character App content family has a create and re-edit path", () => {
  supports(/data-ct-name/, "contact fields")
  supports(/id="ctAddBtn"/, "contact creation")
  supports(/function addNewHistory\(\)[\s\S]*class="browser-title"[\s\S]*addEventListener\('blur'/, "browser history")
  supports(/function addPhoto\(editingPhoto\)[\s\S]*data-photo-edit/, "photos")
  supports(/function addAlbum\(editingAlbum\)[\s\S]*data-album-edit/, "albums")
  supports(/function addItem\(\)[\s\S]*function editItem\(itemId\)/, "shopping items")
  supports(/function addNewMemo\(\)[\s\S]*class="memo-editor" contenteditable="true"[\s\S]*addEventListener\('blur'/, "memos")
})

test("every social content family has a create and re-edit path", () => {
  supports(/function addNpc\(\)[\s\S]*function editNpc\(npcId\)/, "forum identities")
  supports(/function addPost\(\)[\s\S]*function editPost\(postId\)/, "forum posts")
  supports(/function addComment\(postId, replyToCommentId\)[\s\S]*function openForumCommentActionMenu[\s\S]*function editComment\(postId, commentId\)[\s\S]*function editReply\(postId, replyId\)/, "forum comments and replies")
  assert.match(forumViewSource, /data-forum-comment-action=/, "shared forum comments need the author action hook")
  supports(/function openMomentEditor\(moment\)[\s\S]*data-moment-edit/, "moments")
  supports(/function editMomentComment\(momentId, commentIndex\)[\s\S]*data-moment-comment-edit/, "moment comments")
  supports(/function addGroupFromContacts\(\)[\s\S]*function showGroupEditor\(\)/, "group chats")
})

test("every authored chat card type routes back to its complete editor", () => {
  supports(/function addMsg\(type, editingMessage\)/, "typed message cards")
  supports(/function addVoiceMessage\(editingMessage\)/, "voice messages")
  supports(/function showCallEditor\(mode, editingMessage\)/, "voice and video calls")
  supports(/function showInlineStoryEditor\(type, title, placeholder, editingMessage\)/, "time and location cards")
  supports(/\['image', 'link', 'redpacket', 'transfer', 'familycard', 'takeaway'\][\s\S]*addMsg\(msg\.type, msg\)/, "special message context menu")
  supports(/msg\.type === 'call'[\s\S]*showCallEditor\([\s\S]*msg\)/, "call context menu")
  supports(/msg\.type === 'voice'[\s\S]*addVoiceMessage\(msg\)/, "voice context menu")
  supports(/msg\.type === 'time'[\s\S]*showInlineStoryEditor\('time'[\s\S]*msg\)/, "time context menu")
  supports(/msg\.type === 'location'[\s\S]*showInlineStoryEditor\('location'[\s\S]*msg\)/, "location context menu")
})
