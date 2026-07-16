function asArray(value) {
  return Array.isArray(value) ? value : []
}

export function resolveArticleChoiceTarget(nodes, targetId) {
  const requestedTargetId = typeof targetId === "string" ? targetId : ""
  if (requestedTargetId.trim().length === 0) {
    return {
      ok: false,
      status: "empty",
      targetId: "",
      target: null,
    }
  }

  const matches = asArray(nodes).filter(node => node?.id === requestedTargetId)
  if (matches.length === 0) {
    return {
      ok: false,
      status: "missing",
      targetId: requestedTargetId,
      target: null,
    }
  }

  if (matches.length > 1) {
    return {
      ok: false,
      status: "duplicate",
      targetId: requestedTargetId,
      target: null,
    }
  }

  return {
    ok: true,
    status: "valid",
    targetId: requestedTargetId,
    target: matches[0],
  }
}
