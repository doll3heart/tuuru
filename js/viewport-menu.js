function finiteNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

export function computeFixedMenuPosition(point, menuSize, viewport, margin = 8) {
  const viewportLeft = finiteNumber(viewport?.offsetLeft)
  const viewportTop = finiteNumber(viewport?.offsetTop)
  const viewportWidth = Math.max(0, finiteNumber(viewport?.width))
  const viewportHeight = Math.max(0, finiteNumber(viewport?.height))
  const menuWidth = Math.max(0, finiteNumber(menuSize?.width))
  const menuHeight = Math.max(0, finiteNumber(menuSize?.height))
  const safeMargin = Math.max(0, finiteNumber(margin, 8))
  const minLeft = viewportLeft + safeMargin
  const minTop = viewportTop + safeMargin
  const maxLeft = Math.max(minLeft, viewportLeft + viewportWidth - menuWidth - safeMargin)
  const maxTop = Math.max(minTop, viewportTop + viewportHeight - menuHeight - safeMargin)
  const pointX = finiteNumber(point?.x, minLeft)
  const pointY = finiteNumber(point?.y, minTop)

  const preferredLeft = pointX + menuWidth > viewportLeft + viewportWidth - safeMargin
    ? pointX - menuWidth - safeMargin
    : pointX
  const preferredTop = pointY + menuHeight > viewportTop + viewportHeight - safeMargin
    ? pointY - menuHeight - safeMargin
    : pointY

  return {
    left: Math.min(maxLeft, Math.max(minLeft, preferredLeft)),
    top: Math.min(maxTop, Math.max(minTop, preferredTop)),
  }
}

export function placeFixedMenuWithinViewport(menu, point, viewport = globalThis.visualViewport, margin = 8) {
  if (!menu || typeof menu.getBoundingClientRect !== "function") return { left: 0, top: 0 }
  const fallbackViewport = {
    offsetLeft: 0,
    offsetTop: 0,
    width: globalThis.innerWidth || globalThis.document?.documentElement?.clientWidth || 0,
    height: globalThis.innerHeight || globalThis.document?.documentElement?.clientHeight || 0,
  }
  const rect = menu.getBoundingClientRect()
  const position = computeFixedMenuPosition(point, {
    width: rect.width || menu.offsetWidth,
    height: rect.height || menu.offsetHeight,
  }, viewport || fallbackViewport, margin)
  menu.style.left = position.left + "px"
  menu.style.top = position.top + "px"
  return position
}
