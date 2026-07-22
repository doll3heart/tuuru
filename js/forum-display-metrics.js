function integerAtLeast(value, minimum) {
  if (value === "" || value === null || value === undefined) return null
  const number = Number(value)
  if (!Number.isInteger(number) || number < minimum) return null
  return number
}

export function forumDisplayCommentCount(post) {
  const authored = integerAtLeast(post && post.displayCommentCount, 0)
  if (authored !== null) return authored
  return Array.isArray(post && post.comments) ? post.comments.length : 0
}

export function forumDisplayFloor(comment, fallbackFloor) {
  const authored = integerAtLeast(comment && comment.displayFloor, 1)
  if (authored !== null) return authored
  const fallback = integerAtLeast(fallbackFloor, 1)
  return fallback === null ? 1 : fallback
}
