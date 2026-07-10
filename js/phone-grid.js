export const PHONE_GRID_METRICS = Object.freeze({
  columns: 4,
  rows: 4,
  iconWidth: 72,
  cellWidth: 80,
  cellHeight: 95,
  offsetY: 36,
  minOriginX: 0,
  legacyOriginX: 20,
  originRampStart: 330,
  halfGridSpan: 156,
})

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export function getPhoneGridOrigin(containerWidth) {
  const width = finiteNumber(containerWidth)
  const centeredOrigin = width / 2 - PHONE_GRID_METRICS.halfGridSpan
  const legacyRampOrigin = width - PHONE_GRID_METRICS.originRampStart
  return Math.min(
    PHONE_GRID_METRICS.legacyOriginX,
    Math.max(PHONE_GRID_METRICS.minOriginX, centeredOrigin, legacyRampOrigin),
  )
}

export function getPhoneGridItemOffset(desktopX = 0, desktopY = 0) {
  return {
    left: finiteNumber(desktopX) * PHONE_GRID_METRICS.cellWidth,
    top: PHONE_GRID_METRICS.offsetY + finiteNumber(desktopY) * PHONE_GRID_METRICS.cellHeight,
  }
}

export function getPhoneGridPosition(containerWidth, desktopX = 0, desktopY = 0) {
  const offset = getPhoneGridItemOffset(desktopX, desktopY)
  return {
    left: getPhoneGridOrigin(containerWidth) + offset.left,
    top: offset.top,
  }
}

export function getPhoneGridCell(containerWidth, left = 0, top = 0) {
  return {
    x: Math.round((finiteNumber(left) - getPhoneGridOrigin(containerWidth)) / PHONE_GRID_METRICS.cellWidth),
    y: Math.round((finiteNumber(top) - PHONE_GRID_METRICS.offsetY) / PHONE_GRID_METRICS.cellHeight),
  }
}

export function phoneGridContainerStyle() {
  return `--phone-grid-origin-x:clamp(${PHONE_GRID_METRICS.minOriginX}px,max(calc(50% - ${PHONE_GRID_METRICS.halfGridSpan}px),calc(100% - ${PHONE_GRID_METRICS.originRampStart}px)),${PHONE_GRID_METRICS.legacyOriginX}px);`
}

export function phoneGridItemStyle(desktopX = 0, desktopY = 0) {
  const offset = getPhoneGridItemOffset(desktopX, desktopY)
  return `--phone-grid-x:${offset.left}px;--phone-grid-y:${offset.top}px;`
}
