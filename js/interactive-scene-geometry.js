function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0))
}

function rounded(value) {
  return Math.round(value * 100) / 100
}

function positiveNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function mediaContentRect(canvasWidth, canvasHeight, sourceWidth, sourceHeight, fit, transform) {
  const fitScale = fit === "contain"
    ? Math.min(canvasWidth / sourceWidth, canvasHeight / sourceHeight)
    : Math.max(canvasWidth / sourceWidth, canvasHeight / sourceHeight)
  const fittedWidth = sourceWidth * fitScale
  const fittedHeight = sourceHeight * fitScale
  const mediaScale = positiveNumber(transform?.scale) || 1
  const translateX = (Number(transform?.x) || 0) / 100 * canvasWidth
  const translateY = (Number(transform?.y) || 0) / 100 * canvasHeight
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2
  const fittedLeft = (canvasWidth - fittedWidth) / 2
  const fittedTop = (canvasHeight - fittedHeight) / 2

  return {
    left: centerX + ((fittedLeft - centerX) * mediaScale) + translateX,
    top: centerY + ((fittedTop - centerY) * mediaScale) + translateY,
    width: fittedWidth * mediaScale,
    height: fittedHeight * mediaScale,
  }
}

export function projectHotspotToMediaViewport(hotspot, options = {}) {
  const referenceAspectRatio = positiveNumber(hotspot?.referenceAspectRatio)
  const viewportWidth = positiveNumber(options.viewportWidth)
  const viewportHeight = positiveNumber(options.viewportHeight)
  const sourceWidth = positiveNumber(options.sourceWidth)
  const sourceHeight = positiveNumber(options.sourceHeight)
  const geometry = {
    x: Number(hotspot?.x) || 0,
    y: Number(hotspot?.y) || 0,
    width: Number(hotspot?.width) || 0,
    height: Number(hotspot?.height) || 0,
  }
  if (!referenceAspectRatio || !viewportWidth || !viewportHeight || !sourceWidth || !sourceHeight) {
    return geometry
  }

  const referenceWidth = referenceAspectRatio
  const referenceHeight = 1
  const referenceMedia = mediaContentRect(
    referenceWidth,
    referenceHeight,
    sourceWidth,
    sourceHeight,
    options.fit,
    options.transform,
  )
  const targetMedia = mediaContentRect(
    viewportWidth,
    viewportHeight,
    sourceWidth,
    sourceHeight,
    options.fit,
    options.transform,
  )
  const referenceLeft = geometry.x / 100 * referenceWidth
  const referenceTop = geometry.y / 100 * referenceHeight
  const referenceRight = (geometry.x + geometry.width) / 100 * referenceWidth
  const referenceBottom = (geometry.y + geometry.height) / 100 * referenceHeight
  const sourceLeft = (referenceLeft - referenceMedia.left) / referenceMedia.width
  const sourceTop = (referenceTop - referenceMedia.top) / referenceMedia.height
  const sourceRight = (referenceRight - referenceMedia.left) / referenceMedia.width
  const sourceBottom = (referenceBottom - referenceMedia.top) / referenceMedia.height
  const targetLeft = targetMedia.left + sourceLeft * targetMedia.width
  const targetTop = targetMedia.top + sourceTop * targetMedia.height
  const targetRight = targetMedia.left + sourceRight * targetMedia.width
  const targetBottom = targetMedia.top + sourceBottom * targetMedia.height

  return {
    x: rounded(targetLeft / viewportWidth * 100),
    y: rounded(targetTop / viewportHeight * 100),
    width: rounded((targetRight - targetLeft) / viewportWidth * 100),
    height: rounded((targetBottom - targetTop) / viewportHeight * 100),
  }
}

export function moveInteractiveHotspot(hotspot, deltaX, deltaY) {
  const width = clamp(hotspot?.width, 1, 100)
  const height = clamp(hotspot?.height, 1, 100)
  return {
    x: rounded(clamp((Number(hotspot?.x) || 0) + deltaX, 0, 100 - width)),
    y: rounded(clamp((Number(hotspot?.y) || 0) + deltaY, 0, 100 - height)),
    width: rounded(width),
    height: rounded(height),
  }
}

export function resizeInteractiveHotspot(hotspot, handle, deltaX, deltaY, minimumSize = 3) {
  const start = moveInteractiveHotspot(hotspot, 0, 0)
  const right = start.x + start.width
  const bottom = start.y + start.height
  let x = start.x
  let y = start.y
  let width = start.width
  let height = start.height

  if (handle.includes("w")) {
    x = clamp(start.x + deltaX, 0, right - minimumSize)
    width = right - x
  }
  if (handle.includes("e")) {
    width = clamp(start.width + deltaX, minimumSize, 100 - start.x)
  }
  if (handle.includes("n")) {
    y = clamp(start.y + deltaY, 0, bottom - minimumSize)
    height = bottom - y
  }
  if (handle.includes("s")) {
    height = clamp(start.height + deltaY, minimumSize, 100 - start.y)
  }

  return {
    x: rounded(x),
    y: rounded(y),
    width: rounded(width),
    height: rounded(height),
  }
}

export function freehandPointsToHotspot(points, seed = {}) {
  const normalized = (Array.isArray(points) ? points : [])
    .map(point => ({
      x: clamp(point?.x, 0, 100),
      y: clamp(point?.y, 0, 100),
    }))
  if (normalized.length < 3) return null

  const xs = normalized.map(point => point.x)
  const ys = normalized.map(point => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  const right = Math.max(...xs)
  const bottom = Math.max(...ys)
  const width = Math.max(1, right - x)
  const height = Math.max(1, bottom - y)

  return {
    ...seed,
    shape: "polygon",
    x: rounded(x),
    y: rounded(y),
    width: rounded(width),
    height: rounded(height),
    points: normalized.map(point => ({
      x: rounded(((point.x - x) / width) * 100),
      y: rounded(((point.y - y) / height) * 100),
    })),
  }
}
