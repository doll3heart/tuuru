function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue)
  if (!value || typeof value !== "object") return value

  const clone = {}
  for (const [key, nestedValue] of Object.entries(value)) {
    clone[key] = cloneValue(nestedValue)
  }
  return clone
}

export function applyChatChoice(round, ownerMessageId, choiceIndex, options) {
  const messages = Array.isArray(round?.messages) ? round.messages : []
  const ownerIndexes = []

  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index]?.id === ownerMessageId) ownerIndexes.push(index)
  }

  if (ownerIndexes.length === 0) {
    return { ok: false, reason: "owner-message-not-found" }
  }
  if (ownerIndexes.length > 1) {
    return { ok: false, reason: "owner-message-ambiguous" }
  }

  const ownerIndex = ownerIndexes[0]
  const choices = messages[ownerIndex]?.choices
  if (
    !Number.isInteger(choiceIndex)
    || !Array.isArray(choices)
    || choiceIndex < 0
    || choiceIndex >= choices.length
    || !choices[choiceIndex]
    || typeof choices[choiceIndex] !== "object"
  ) {
    return { ok: false, reason: "choice-not-found" }
  }

  if (typeof options?.idFactory !== "function") {
    return { ok: false, reason: "id-factory-required" }
  }

  const choice = choices[choiceIndex]
  const generatedMessages = []
  let replyMessageId = null

  if (typeof choice.replyText === "string" && choice.replyText.length > 0) {
    replyMessageId = options.idFactory()
    generatedMessages.push({
      id: replyMessageId,
      senderId: "self",
      text: choice.replyText,
      type: "text",
    })
  }

  const followUpMessages = Array.isArray(choice.followUpMessages)
    ? choice.followUpMessages
    : []

  for (const followUpMessage of followUpMessages) {
    const generatedMessage = cloneValue(followUpMessage)
    generatedMessage.id = options.idFactory()
    generatedMessages.push(generatedMessage)
  }

  const nextRound = cloneValue(round)
  nextRound.messages.splice(ownerIndex + 1, 0, ...generatedMessages)

  return {
    ok: true,
    round: nextRound,
    run: {
      ownerMessageId,
      choiceIndex,
      generatedMessageIds: generatedMessages.map(message => message.id),
      replyMessageId,
    },
  }
}

export function rollbackChatChoice(round, run) {
  const generatedMessageIds = new Set(
    Array.isArray(run?.generatedMessageIds) ? run.generatedMessageIds : [],
  )
  const nextRound = cloneValue(round)

  if (Array.isArray(nextRound?.messages)) {
    nextRound.messages = nextRound.messages.filter(
      message => !generatedMessageIds.has(message?.id),
    )
  }

  return nextRound
}
