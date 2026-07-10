import { escapeHtmlAttribute } from "../js/sanitize.js"

export function buildReaderPhoneModuleTrigger({
  pmid,
  type,
  label = "模块",
  trustedIconHtml = "?",
  hasUnread = false,
} = {}) {
  const actionLabel = "查看" + (String(label || "").trim() || "模块")
  const accessibleLabel = hasUnread ? actionLabel + "，未读" : actionLabel

  return '<button type="button" class="rd-pm-trigger" data-pm-id="' + escapeHtmlAttribute(pmid) +
    '" data-pm-type="' + escapeHtmlAttribute(type) + '" data-read-label="' + escapeHtmlAttribute(actionLabel) +
    '" aria-label="' + escapeHtmlAttribute(accessibleLabel) + '">' +
    '<span class="rd-pm-dot' + (hasUnread ? ' has-unread' : '') + '" aria-hidden="true"></span>' +
    '<span class="rd-pm-trigger-icon" aria-hidden="true">' + (trustedIconHtml || '?') + '</span>' +
    '<span class="rd-pm-trigger-label">' + escapeHtmlAttribute(actionLabel) + '</span></button>'
}

export function markReaderPhoneModuleTriggerRead(trigger) {
  if (!trigger || typeof trigger.querySelector !== "function") return false

  trigger.querySelector(".rd-pm-dot")?.classList.remove("has-unread")
  const readLabel = trigger.dataset?.readLabel
  if (readLabel) trigger.setAttribute("aria-label", readLabel)
  return true
}
