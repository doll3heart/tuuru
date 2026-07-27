import { modal } from "./app.js"

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function openDeletionImpactDialog({
  title = "确认删除",
  itemName = "这项内容",
  references = [],
  onConfirm,
  onLocate,
  onCancel,
} = {}) {
  const safeReferences = Array.isArray(references) ? references : []
  const body = `<div class="deletion-impact">
    <p><strong>${esc(itemName)}</strong>仍被 ${safeReferences.length} 处内容使用。删除后这些位置可能失效；这里不会自动修改这些引用。</p>
    <ol class="deletion-impact-list">${safeReferences.slice(0, 20).map((reference, index) => `<li>
      <span><strong>${esc(reference.category)}</strong><small>${esc(reference.location)}</small></span>
      ${reference.sourceNodeId || reference.appType ? `<button type="button" class="btn btn-sm btn-outline deletion-impact-locate" data-deletion-impact-locate="${index}">去查看</button>` : ""}
    </li>`).join("")}</ol>
    ${safeReferences.length > 20 ? `<p class="deletion-impact-more">另有 ${safeReferences.length - 20} 处引用未在列表中展开。</p>` : ""}
  </div>`
  const overlay = modal(
    title,
    body,
    '<button type="button" class="btn btn-danger" id="deletionImpactConfirm">仍然删除</button><button type="button" class="btn btn-ghost" id="deletionImpactCancel">取消</button>',
    onCancel,
  )
  overlay.querySelector("#deletionImpactConfirm")?.addEventListener("click", () => {
    overlay.remove()
    onConfirm?.()
  })
  overlay.querySelector("#deletionImpactCancel")?.addEventListener("click", () => {
    overlay.remove()
    onCancel?.()
  })
  overlay.addEventListener("click", event => {
    const button = event.target.closest("[data-deletion-impact-locate]")
    if (!button) return
    const reference = safeReferences[Number(button.dataset.deletionImpactLocate)]
    if (!reference) return
    overlay.remove()
    onLocate?.(reference)
  })
  overlay.querySelector("#deletionImpactCancel")?.focus()
  return overlay
}
