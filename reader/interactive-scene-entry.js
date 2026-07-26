import { escapeHtmlAttribute } from "../js/sanitize.js"
import { substitutePlaceholders } from "../js/placeholders.js"

function escapeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function readerInteractiveSceneById(work, sceneId) {
  return (Array.isArray(work?.interactiveScenes) ? work.interactiveScenes : [])
    .find(scene => String(scene?.id || "") === String(sceneId || "")) || null
}

export function replaceInteractiveSceneCards(content, work) {
  return String(content || "").replace(
    /<div class="interactive-scene-card"[^>]*data-is-id="([^"]+)"[^>]*>[\s\S]*?<\/div>/gi,
    (_, sceneId) => {
      const scene = readerInteractiveSceneById(work, sceneId)
      if (!scene) return ""
      const label = substitutePlaceholders(
        scene.title || "进入互动场景",
        work?.placeholders || [],
        {
          valuesMap: work?.readerPhValues || {},
          usePlaceholderMode: false,
        },
      )
      return `<button type="button" class="rd-interactive-scene-trigger" data-interactive-scene="${escapeHtmlAttribute(scene.id)}"><span aria-hidden="true">◎</span><span>${escapeText(label)}</span><small>进入互动</small></button>`
    },
  )
}
