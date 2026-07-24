function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function attr(value) {
  return esc(value).replace(/'/g, "&#39;")
}

function renderedText(renderer, value) {
  return typeof renderer === "function" ? String(renderer(value) || "") : esc(value)
}

function identityFor(item, options) {
  var resolved = typeof options.resolveIdentity === "function"
    ? options.resolveIdentity(item)
    : null
  return {
    name:String(resolved?.name || item?.contactName || "用户"),
    avatar:String(resolved?.avatar || item?.contactAvatar || ""),
    ipLocation:String(resolved?.ipLocation || item?.contactIpLocation || ""),
    isReader:resolved?.isReader === true,
  }
}

function avatarHtml(className, identity, item, options) {
  var color = typeof options.avatarColor === "function"
    ? options.avatarColor(item)
    : "var(--phone-system-accent, var(--c-primary))"
  var style = identity.avatar
    ? "background-image:url('" + attr(identity.avatar) + "');background-size:cover"
    : "background:" + attr(color)
  var html = '<span class="' + className + '" style="' + style + '">'
  if (identity.avatar) html += '<img src="' + attr(identity.avatar) + '" alt="">'
  else html += "<span>" + esc((identity.name || "?").charAt(0)) + "</span>"
  return html + "</span>"
}

function ipHtml(identity, item, options) {
  return typeof options.renderIp === "function"
    ? String(options.renderIp(identity, item) || "")
    : ""
}

function timestampHtml(item, kind, options) {
  if (typeof options.showTimestamp === "function" && !options.showTimestamp(item)) return ""
  if (!item?.time) return ""
  var label = typeof options.formatTime === "function" ? options.formatTime(item.time) : item.time
  if (options.editable === true) {
    return '<button type="button" class="forum-comment-time forum-comment-time-button" data-forum-comment-time="' + attr(item.id) + '" aria-label="编辑这条' + (kind === "reply" ? "回复" : "评论") + '的显示时间">' + esc(label) + "</button>"
  }
  return '<time class="forum-comment-time">' + esc(label) + "</time>"
}

function utilitiesHtml(item, kind, options) {
  if (options.editable === true) {
    return '<button type="button" class="forum-comment-like-author" data-forum-comment-likes="' + attr(item.id) + '" aria-label="编辑这条' + (kind === "reply" ? "回复" : "评论") + '的点赞数"><span class="forum-like-heart" aria-hidden="true">♡</span><span>' + (Number(item.likes) || 0) + '</span></button>' +
      '<button type="button" class="forum-comment-action-button" data-forum-comment-action="' + attr(item.id) + '" aria-haspopup="menu" aria-expanded="false" aria-label="' + (kind === "reply" ? "回复" : "评论") + '操作"><span aria-hidden="true">×</span></button>'
  }
  var liked = typeof options.isLiked === "function" && options.isLiked(item)
  var count = Math.max(0, Number(item.likes) || 0) + (liked ? 1 : 0)
  return '<button type="button" class="forum-comment-like-reader' + (liked ? " is-liked" : "") + '" data-forum-comment-like="' + attr(item.id) + '" aria-pressed="' + (liked ? "true" : "false") + '"><span class="forum-like-heart" aria-hidden="true">♡</span><span>' + count + "</span></button>"
}

function choiceHtml(item, context, options) {
  return typeof options.renderChoices === "function"
    ? String(options.renderChoices(item, context) || "")
    : ""
}

function imageHtml(item) {
  return item?.imageUrl
    ? '<img class="forum-comment-image" src="' + attr(item.imageUrl) + '" alt="">'
    : ""
}

function replyTargetName(item, parent, options) {
  if (typeof options.replyTargetName === "function") {
    return String(options.replyTargetName(item, parent) || "")
  }
  if (item?.replyToName) return String(item.replyToName)
  return parent ? identityFor(parent, options).name : ""
}

function renderReply(reply, context, options) {
  var identity = identityFor(reply, options)
  var targetName = replyTargetName(reply, context.parentComment, options)
  var classes = "forum-reply-item"
  if (identity.isReader) classes += " is-reader"
  if (context.generated) classes += " is-generated"
  var html = '<article class="' + classes + '" data-forum-comment-id="' + attr(reply.id) + '" data-forum-comment-kind="reply" data-thread-item-id="' + attr(reply.id) + '" tabindex="0">'
  html += '<div class="forum-reply-line">'
  html += avatarHtml("forum-reply-avatar", identity, reply, options)
  html += '<div class="forum-reply-copy"><div class="forum-reply-meta"><span class="forum-reply-name">' + esc(identity.name) + "</span>"
  if (targetName) html += '<span class="forum-reply-relation">回复</span><span class="forum-reply-target">' + esc(targetName) + "</span>"
  html += ipHtml(identity, reply, options) + "</div>"
  html += '<div class="forum-reply-content">' + renderedText(options.renderText, reply.content ?? reply.text ?? "") + "</div>"
  html += imageHtml(reply)
  html += '<div class="forum-comment-footer"><div class="forum-comment-context">' + timestampHtml(reply, "reply", options) + '<span class="forum-reply-hint">回复</span></div><div class="forum-comment-utilities">' + utilitiesHtml(reply, "reply", options) + "</div></div>"
  html += choiceHtml(reply, context, options)
  if (Array.isArray(reply.replies) && reply.replies.length) {
    var childContainerKey = "replies::" + String(reply.id)
    html += '<div class="forum-replies">'
    reply.replies.forEach(function(child, index) {
      var generated = typeof options.isGenerated === "function" && options.isGenerated(child, childContainerKey)
      html += renderReply(child, {
        floor:index + 1,
        depth:context.depth + 1,
        containerKey:childContainerKey,
        parentComment:reply,
        generated:generated,
      }, options)
    })
    html += "</div>"
  }
  return html + "</div></div></article>"
}

export function renderPhoneForumComment(comment, context = {}, options = {}) {
  var identity = identityFor(comment, options)
  var floor = Number(context.floor) || 1
  var containerKey = context.containerKey || "root"
  var classes = "forum-comment"
  if (identity.isReader) classes += " is-reader"
  if (context.generated) classes += " is-generated"
  var html = '<article class="' + classes + '" data-forum-comment-id="' + attr(comment.id) + '" data-forum-comment-kind="comment" data-thread-item-id="' + attr(comment.id) + '" tabindex="0">'
  html += '<div class="forum-comment-row">'
  html += avatarHtml("forum-comment-avatar", identity, comment, options)
  html += '<div class="forum-comment-body"><div class="forum-comment-by"><span class="forum-comment-name">' + esc(identity.name) + '</span><span class="forum-comment-floor">'
  html += typeof options.displayFloor === "function" ? esc(options.displayFloor(comment, floor)) : floor
  html += "楼</span>" + ipHtml(identity, comment, options) + "</div>"
  html += '<div class="forum-comment-content">' + renderedText(options.renderText, comment.content ?? comment.text ?? "") + "</div>"
  html += imageHtml(comment)
  html += '<div class="forum-comment-footer"><div class="forum-comment-context">' + timestampHtml(comment, "comment", options) + '<span class="forum-reply-hint">回复</span></div><div class="forum-comment-utilities">' + utilitiesHtml(comment, "comment", options) + "</div></div>"
  html += choiceHtml(comment, {
    floor:floor,
    depth:0,
    containerKey:containerKey,
    parentComment:null,
    generated:context.generated === true,
  }, options)
  if (Array.isArray(comment.replies) && comment.replies.length) {
    var childContainerKey = "replies::" + String(comment.id)
    html += '<div class="forum-replies">'
    comment.replies.forEach(function(reply, index) {
      var generated = typeof options.isGenerated === "function" && options.isGenerated(reply, childContainerKey)
      html += renderReply(reply, {
        floor:index + 1,
        depth:1,
        containerKey:childContainerKey,
        parentComment:comment,
        generated:generated,
      }, options)
    })
    html += "</div>"
  }
  return html + "</div></div></article>"
}

export function renderPhoneForumPost(post, options = {}) {
  var identity = identityFor(post, options)
  var html = '<article class="forum-post-full">'
  html += '<div class="forum-post-head">'
  html += avatarHtml("forum-post-avatar", identity, post, options)
  html += '<div class="forum-post-by"><div class="forum-post-author">' + esc(identity.name)
  if (options.showOpBadge !== false) html += ' <span class="forum-badge-op">楼主</span>'
  html += ipHtml(identity, post, options) + "</div>"
  if (typeof options.renderPostMeta === "function") {
    html += String(options.renderPostMeta(post, identity) || "")
  } else if (typeof options.showTimestamp !== "function" || options.showTimestamp(post)) {
    if (post.time) html += '<time class="forum-post-time">' + esc(typeof options.formatTime === "function" ? options.formatTime(post.time) : post.time) + "</time>"
  }
  html += "</div></div>"
  html += '<div class="forum-post-title">' + esc(post.title || "") + "</div>"
  html += '<div class="forum-post-content">' + renderedText(options.renderText, post.content || "") + "</div>"
  var images = Array.isArray(post.images) ? post.images.slice() : []
  if (post.imageUrl) images.unshift(post.imageUrl)
  if (images.length) {
    html += '<div class="forum-post-images">'
    images.forEach(function(image) {
      var src = typeof image === "string" ? image : String(image?.url || image?.src || "")
      if (src) html += '<img src="' + attr(src) + '" alt="">'
    })
    html += "</div>"
  }
  if (typeof options.renderActions === "function") {
    html += '<div class="forum-post-actions">' + String(options.renderActions(post) || "") + "</div>"
  }
  return html + "</article>"
}
