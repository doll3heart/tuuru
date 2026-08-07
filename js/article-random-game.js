export const ARTICLE_RANDOM_GAME_KIND = "random-game"
export const ARTICLE_RANDOM_GAME_TYPES = Object.freeze(["dice", "number", "versus"])

const RESULT_TYPES = new Set(["win", "draw", "lose"])
const MAX_RANDOM_SPAN = 10_000

function exactId(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function integer(value) {
  return Number.isInteger(value) ? value : null
}

function cleanText(value, fallback = "") {
  return typeof value === "string" ? value.slice(0, 200) : fallback
}

function normalizedChoice(choice, type) {
  if (!choice || typeof choice !== "object" || Array.isArray(choice)) return null
  if (!exactId(choice.id) || !exactId(choice.targetId)) return null
  const normalized = {
    ...choice,
    id:choice.id,
    text:cleanText(choice.text),
    selectedText:cleanText(choice.selectedText, cleanText(choice.text)),
    targetId:choice.targetId,
  }
  if (type === "versus") {
    if (!RESULT_TYPES.has(choice.result)) return null
    normalized.result = choice.result
    delete normalized.rangeMin
    delete normalized.rangeMax
  } else {
    const rangeMin = integer(choice.rangeMin)
    const rangeMax = integer(choice.rangeMax)
    if (rangeMin === null || rangeMax === null || rangeMin > rangeMax) return null
    normalized.rangeMin = rangeMin
    normalized.rangeMax = rangeMax
    delete normalized.result
  }
  return normalized
}

export function normalizeArticleRandomGame(group) {
  if (!group || typeof group !== "object" || Array.isArray(group)) {
    return {ok:false, reason:"invalid-game"}
  }
  if (group.kind !== ARTICLE_RANDOM_GAME_KIND) return {ok:false, reason:"invalid-game-kind"}
  const sourceGame = group.game
  if (!sourceGame || typeof sourceGame !== "object" || Array.isArray(sourceGame)) {
    return {ok:false, reason:"invalid-game-config"}
  }
  const type = ARTICLE_RANDOM_GAME_TYPES.includes(sourceGame.type) ? sourceGame.type : ""
  if (!type) return {ok:false, reason:"invalid-game-type"}

  const game = {
    type,
    buttonLabel:cleanText(sourceGame.buttonLabel).trim() || (type === "number" ? "抽取数字" : type === "versus" ? "开始判定" : "掷骰子"),
  }
  let minimum
  let maximum
  if (type === "number") {
    minimum = integer(sourceGame.min)
    maximum = integer(sourceGame.max)
    if (minimum === null || maximum === null || minimum >= maximum || maximum - minimum + 1 > MAX_RANDOM_SPAN) {
      return {ok:false, reason:"invalid-game-range"}
    }
    game.min = minimum
    game.max = maximum
  } else {
    const sides = integer(sourceGame.sides)
    if (sides === null || sides < 2 || sides > 100) return {ok:false, reason:"invalid-game-sides"}
    game.sides = sides
    minimum = 1
    maximum = sides
    if (type === "versus") game.opponentLabel = cleanText(sourceGame.opponentLabel).trim() || "对手"
  }

  const sourceChoices = Array.isArray(group.choices) ? group.choices : []
  const choices = sourceChoices.map(choice => normalizedChoice(choice, type))
  if (!choices.length || choices.some(choice => !choice)) {
    const missingTarget = sourceChoices.some(choice => choice && !exactId(choice.targetId))
    return {ok:false, reason:missingTarget ? "game-target-required" : "invalid-game-outcome"}
  }

  if (type === "versus") {
    if (choices.length !== 3 || new Set(choices.map(choice => choice.result)).size !== 3) {
      return {ok:false, reason:"game-versus-results-invalid"}
    }
  } else {
    const ordered = choices.slice().sort((left, right) => left.rangeMin - right.rangeMin || left.rangeMax - right.rangeMax)
    if (ordered[0].rangeMin !== minimum || ordered.at(-1).rangeMax !== maximum) {
      return {ok:false, reason:"game-range-gap"}
    }
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].rangeMin <= ordered[index - 1].rangeMax) {
        return {ok:false, reason:"game-range-overlap"}
      }
      if (ordered[index].rangeMin !== ordered[index - 1].rangeMax + 1) {
        return {ok:false, reason:"game-range-gap"}
      }
    }
  }

  return {
    ok:true,
    group:{
      ...group,
      kind:ARTICLE_RANDOM_GAME_KIND,
      label:cleanText(group.label).trim(),
      game,
      choices,
    },
  }
}

export function normalizeArticleGameResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  if (value.type === "versus") {
    const player = integer(value.player)
    const opponent = integer(value.opponent)
    const sides = integer(value.sides)
    if (player === null || opponent === null || sides === null || sides < 2 || sides > 100) return null
    if (player < 1 || player > sides || opponent < 1 || opponent > sides) return null
    return {type:"versus", player, opponent, sides}
  }
  if (value.type !== "dice" && value.type !== "number") return null
  const roll = integer(value.value)
  if (roll === null || Math.abs(roll) > 1_000_000) return null
  return {type:value.type, value:roll}
}

export function randomIntegerInclusive(minimum, maximum, cryptoLike = globalThis.crypto) {
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum > maximum) {
    throw new Error("invalid-random-range")
  }
  const span = maximum - minimum + 1
  if (span === 1) return minimum
  if (span > 0x100000000 || !cryptoLike || typeof cryptoLike.getRandomValues !== "function") {
    throw new Error("secure-random-unavailable")
  }
  const limit = Math.floor(0x100000000 / span) * span
  const buffer = new Uint32Array(1)
  do cryptoLike.getRandomValues(buffer)
  while (buffer[0] >= limit)
  return minimum + (buffer[0] % span)
}

export function playArticleRandomGame(group, randomInteger = randomIntegerInclusive) {
  const normalized = normalizeArticleRandomGame(group)
  if (!normalized.ok || typeof randomInteger !== "function") return null
  const current = normalized.group
  if (current.game.type === "versus") {
    const player = randomInteger(1, current.game.sides)
    const opponent = randomInteger(1, current.game.sides)
    if (!Number.isInteger(player) || !Number.isInteger(opponent)) return null
    const result = player === opponent ? "draw" : player > opponent ? "win" : "lose"
    const choice = current.choices.find(candidate => candidate.result === result)
    return choice ? {choice, roll:{type:"versus", player, opponent, sides:current.game.sides}} : null
  }
  const minimum = current.game.type === "number" ? current.game.min : 1
  const maximum = current.game.type === "number" ? current.game.max : current.game.sides
  const value = randomInteger(minimum, maximum)
  if (!Number.isInteger(value) || value < minimum || value > maximum) return null
  const choice = current.choices.find(candidate => value >= candidate.rangeMin && value <= candidate.rangeMax)
  return choice ? {choice, roll:{type:current.game.type, value}} : null
}
