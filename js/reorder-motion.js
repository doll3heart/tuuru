export function refreshReorderedContent({
  container,
  selector,
  key,
  update,
  animate = true,
  duration = 180,
} = {}) {
  if (!container?.querySelectorAll || typeof update !== "function") {
    throw new TypeError("reordered content refresh requires a container and update callback")
  }
  const identify = typeof key === "function"
    ? key
    : element => element.getAttribute(String(key || "data-id"))
  const before = new Map()
  Array.from(container.querySelectorAll(selector)).forEach(element => {
    const id = identify(element)
    if (id) before.set(id, element.getBoundingClientRect())
  })

  update()

  if (!animate) return 0
  let animated = 0
  Array.from(container.querySelectorAll(selector)).forEach(element => {
    const id = identify(element)
    const previous = id && before.get(id)
    if (!previous || typeof element.animate !== "function") return
    const current = element.getBoundingClientRect()
    const x = previous.left - current.left
    const y = previous.top - current.top
    if (!x && !y) return
    element.animate(
      [
        {transform:`translate(${x}px, ${y}px)`},
        {transform:"translate(0, 0)"},
      ],
      {
        duration,
        easing:"cubic-bezier(.22, 1, .36, 1)",
      },
    )
    animated += 1
  })
  return animated
}
