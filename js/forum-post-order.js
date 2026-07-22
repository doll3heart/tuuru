function posts(value) {
  return Array.isArray(value) ? value.slice() : []
}

function sameId(left, right) {
  return left != null && right != null && String(left) === String(right)
}

export function orderedForumPosts(value) {
  var source = posts(value)
  return source.filter(function(post) { return post?.pinned === true })
    .concat(source.filter(function(post) { return post?.pinned !== true }))
}

export function toggleForumPostFlag(value, postId, flag) {
  if (flag !== "pinned" && flag !== "featured") {
    return { ok:false, reason:"invalid-flag", posts:posts(value) }
  }
  var source = posts(value)
  var index = source.findIndex(function(post) { return sameId(post?.id, postId) })
  if (index < 0) return { ok:false, reason:"missing-post", posts:source }

  var updated = Object.assign({}, source[index], { [flag]:source[index]?.[flag] !== true })
  if (flag === "featured") {
    source[index] = updated
    return { ok:true, posts:source }
  }

  source.splice(index, 1)
  var ordered = orderedForumPosts(source)
  if (updated.pinned === true) {
    ordered.unshift(updated)
  } else {
    var firstOrdinary = ordered.findIndex(function(post) { return post?.pinned !== true })
    ordered.splice(firstOrdinary < 0 ? ordered.length : firstOrdinary, 0, updated)
  }
  return { ok:true, posts:ordered }
}

export function reorderForumPosts(value, sourceId, targetId, position) {
  var ordered = orderedForumPosts(value)
  var sourceIndex = ordered.findIndex(function(post) { return sameId(post?.id, sourceId) })
  var targetIndex = ordered.findIndex(function(post) { return sameId(post?.id, targetId) })
  if (sourceIndex < 0 || targetIndex < 0) {
    return { ok:false, reason:"missing-post", posts:ordered }
  }
  if (sourceIndex === targetIndex) return { ok:true, posts:ordered }
  if ((ordered[sourceIndex]?.pinned === true) !== (ordered[targetIndex]?.pinned === true)) {
    return { ok:false, reason:"pin-boundary", posts:ordered }
  }

  var moved = ordered.splice(sourceIndex, 1)[0]
  targetIndex = ordered.findIndex(function(post) { return sameId(post?.id, targetId) })
  var insertionIndex = targetIndex + (position === "after" ? 1 : 0)
  ordered.splice(insertionIndex, 0, moved)
  return { ok:true, posts:ordered }
}
