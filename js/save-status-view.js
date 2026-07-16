import { downloadBlob } from "./download.js"

const PEER_WARNING = "其他标签页仍有只存在内存中的修改；紧急备份不会包含它们，请分别处理每个标签页。"
const PRIVATE_BACKUP_WARNING = "紧急备份包含完整创作库和私密编辑数据，仅用于恢复，不适合作为单篇作品分享。浏览器只能确认已发起下载，不能保证文件已经写入磁盘。"
const ACTION_FAILURE = "操作未完成，请重试。"
const UNKNOWN_SNAPSHOT = Object.freeze({
  state: "unknown",
  otherActiveEditors: Object.freeze([]),
})

function isFunction(value) {
  return typeof value === "function"
}

function setText(node, value) {
  const text = value ?? ""
  if (node.textContent !== text) node.textContent = text
}

function createElement(documentObject, name, className, attributes = {}) {
  const element = documentObject.createElement(name)
  if (className) element.className = className
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value)
  }
  return element
}

function persistentState(snapshot) {
  const state = snapshot?.state
  const errorCode = snapshot?.error?.code

  if (state === "clean") {
    return { copy: "已保存", kind: "quiet", detail: "", actions: [] }
  }
  if (state === "dirty") {
    return { copy: "未保存", kind: "quiet", detail: "", actions: [] }
  }
  if (state === "saving") {
    return { copy: "正在保存", kind: "quiet", detail: "", actions: [] }
  }
  if (state === "error-retryable") {
    return {
      copy: "保存失败，原数据未改变",
      kind: "error",
      detail: "最新修改还在本页，但没有写入浏览器。",
      actions: ["retry", "backup", "discard"],
    }
  }
  if (state === "error-invalid") {
    return {
      copy: "当前内容无法安全保存",
      kind: "error",
      detail: "修改没有写入；当前作品数据不符合保存要求。",
      actions: ["correct", "backup"],
    }
  }
  if (state === "error-unknown") {
    return {
      copy: "无法确认刚才是否保存",
      kind: "error",
      detail: "浏览器无法确认刚才是否写入成功。",
      actions: ["recheck", "backup"],
    }
  }
  if (state === "conflict") {
    return {
      copy: "本地创作库已发生冲突",
      kind: "error",
      detail: "本地创作库已被其他页面改变，本页已经停止保存。",
      actions: ["backup", "reload"],
    }
  }
  if (state === "lease-lost" && errorCode === "mutation-lease-lost") {
    return {
      copy: "此页面已失去编辑权",
      kind: "error",
      detail: "此作品已由另一个标签页接管，本页已经停止保存。",
      actions: ["backup", "leave", "takeover"],
    }
  }
  if (state === "lease-lost" && errorCode === "work-locked") {
    return {
      copy: "此作品正在另一个标签页编辑",
      kind: "error",
      detail: "另一个标签页仍持有有效编辑权。",
      actions: ["recheck-lock", "leave", "takeover"],
    }
  }
  if (state === "lease-lost" && errorCode === "mutation-lock-unavailable") {
    return {
      copy: "当前浏览器不能保证可靠本地保存",
      kind: "error",
      detail: "当前环境不能保证本地数据不会互相覆盖。",
      readonly: "保持只读",
      actions: ["export", "leave"],
    }
  }
  return {
    copy: "无法确认当前保存状态",
    kind: "error",
    detail: "请保留当前页面，避免继续修改。",
    actions: [],
  }
}

function normalizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return UNKNOWN_SNAPSHOT
  if (typeof snapshot.state !== "string" || snapshot.state.length === 0) return UNKNOWN_SNAPSHOT
  return snapshot
}

export function mountSaveStatus({
  container,
  runtime = null,
  initialSnapshot = null,
  onReload,
  onLeave,
  onDiscardAndLeave,
  onCorrectInvalid,
  confirmDiscard,
  onRecheckLock,
  onTakeover,
  onExportWork,
  download,
} = {}) {
  if (!container?.ownerDocument || !isFunction(container.appendChild)) {
    throw new TypeError("container must be a DOM element")
  }

  const documentObject = container.ownerDocument
  const root = createElement(documentObject, "div", "save-status", {
    "data-save-state": "unknown",
    "data-save-kind": "error",
  })
  const summary = createElement(documentObject, "div", "save-status__summary")
  const mark = createElement(documentObject, "span", "save-status__mark", { "aria-hidden": "true" })
  const label = createElement(documentObject, "span", "save-status__label")
  const live = createElement(documentObject, "div", "save-status__live", {
    role: "status",
    "aria-live": "polite",
    "aria-atomic": "true",
  })
  const peerNote = createElement(documentObject, "p", "save-status__peer-note")
  const alert = createElement(documentObject, "div", "save-status__alert", {
    role: "alert",
    "aria-atomic": "true",
    tabindex: "-1",
  })
  const message = createElement(documentObject, "p", "save-status__message")
  const detail = createElement(documentObject, "p", "save-status__detail")
  const backupNote = createElement(documentObject, "p", "save-status__backup-note")
  const preparedBackupNote = createElement(documentObject, "p", "save-status__prepared-note")
  const feedback = createElement(documentObject, "p", "save-status__action-feedback")
  const actions = createElement(documentObject, "div", "save-status__actions", {
    role: "group",
    "aria-label": "保存恢复操作",
    "aria-busy": "false",
  })

  summary.append(mark, label)
  alert.append(message, detail, backupNote, preparedBackupNote, feedback, actions)
  peerNote.hidden = true
  alert.hidden = true
  root.append(summary, live, peerNote, alert)
  container.appendChild(root)

  const downloadArtifact = isFunction(download) ? download : downloadBlob
  let currentSnapshot = null
  let removeRuntimeSubscription = null
  let disposed = false
  let actionPending = false
  let actionFeedback = ""
  let failedActionKey = ""
  let backupWarning = ""
  let lastViewKey = ""
  let lastActionSignature = ""
  let announcedDirty = false
  let announcedFirstClean = false
  let recoveryPending = false
  let activeErrorKey = ""

  function setBusyState(nextBusy) {
    actionPending = nextBusy
    actions.setAttribute("aria-busy", String(nextBusy))
    root.setAttribute("aria-busy", String(nextBusy))
    for (const button of actions.querySelectorAll("button")) {
      button.disabled = nextBusy
    }
  }

  function updateQuietAnnouncement(snapshot, config) {
    if (config.kind === "error") {
      const errorKey = snapshot.state + ":" + (snapshot.error?.code || "")
      if (activeErrorKey !== errorKey) {
        activeErrorKey = errorKey
        setText(live, "")
      }
      recoveryPending = true
      return
    }
    activeErrorKey = ""
    if (recoveryPending) {
      if (snapshot.state === "clean") {
        recoveryPending = false
        if (announcedDirty) announcedFirstClean = true
        setText(live, "保存已恢复")
      }
      return
    }
    if (snapshot.state === "dirty" && !announcedDirty) {
      announcedDirty = true
      setText(live, "未保存")
      return
    }
    if (snapshot.state !== "clean") return
    if (announcedDirty && !announcedFirstClean) {
      announcedFirstClean = true
      setText(live, "已保存")
    }
  }

  function actionDefinitions(config) {
    const definitions = []
    const add = (key, text, invoke) => {
      if (isFunction(invoke)) definitions.push({ key, text, invoke })
    }

    for (const action of config.actions) {
      if (action === "retry" && isFunction(runtime?.retry)) {
        add("retry", "重试", () => runtime.retry())
      } else if (action === "recheck" && isFunction(runtime?.recheck)) {
        add("recheck", "重新检查", () => runtime.recheck())
      } else if (action === "recheck-lock") {
        add("recheck-lock", "重新检查", onRecheckLock)
      } else if (action === "correct" && isFunction(runtime?.recoveryMaterial) && isFunction(onCorrectInvalid)) {
        add("correct", "纠正内容", () => {
          const material = runtime.recoveryMaterial()
          return onCorrectInvalid(material)
        })
      } else if (action === "backup" && isFunction(runtime?.prepareEmergencyBackup)) {
        add("backup", "下载紧急备份", async () => {
          const prepared = runtime.prepareEmergencyBackup()
          backupWarning = prepared?.warning?.message || PRIVATE_BACKUP_WARNING
          const artifacts = Array.isArray(prepared?.artifacts) ? prepared.artifacts : []
          const BlobConstructor = globalThis.Blob ?? documentObject.defaultView?.Blob
          if (!isFunction(BlobConstructor)) throw new TypeError("Blob is unavailable")
          for (const artifact of artifacts) {
            const blob = new BlobConstructor([artifact.contents], { type: artifact.mimeType })
            await Promise.resolve(downloadArtifact(blob, artifact.filename))
          }
        })
      } else if (action === "discard" && isFunction(confirmDiscard) && isFunction(onDiscardAndLeave)) {
        add("discard", "放弃修改并离开", async () => {
          const confirmed = await Promise.resolve(confirmDiscard())
          if (confirmed === true) return onDiscardAndLeave()
          return undefined
        })
      } else if (action === "reload") {
        add("reload", "重新加载", onReload)
      } else if (action === "leave") {
        add("leave", "返回作品列表", onLeave)
      } else if (action === "takeover"
        && currentSnapshot?.availability?.canTakeover === true) {
        add("takeover", "确认接管", onTakeover)
      } else if (action === "export") {
        add("export", "导出已有作品", onExportWork)
      }
    }
    return definitions
  }

  function renderActions(config) {
    const definitions = actionDefinitions(config)
    const signature = JSON.stringify({
      readonly: config.readonly || "",
      actions: definitions.map(item => [item.key, item.text]),
    })
    if (signature === lastActionSignature) return
    lastActionSignature = signature
    actions.replaceChildren()

    if (config.readonly) {
      const readonly = createElement(documentObject, "span", "save-status__readonly")
      readonly.textContent = config.readonly
      actions.appendChild(readonly)
    }
    for (const definition of definitions) {
      const button = createElement(documentObject, "button", "btn btn-sm save-status-action", {
        type: "button",
        "data-save-action": definition.key,
      })
      button.textContent = definition.text
      button.disabled = actionPending
      button.addEventListener("click", () => {
        void runAction(definition, button)
      })
      actions.appendChild(button)
    }
  }

  function renderSnapshot(snapshot) {
    if (disposed) return
    const normalizedSnapshot = normalizeSnapshot(snapshot)
    currentSnapshot = normalizedSnapshot
    const config = persistentState(normalizedSnapshot)
    const viewKey = normalizedSnapshot.state + ":" + (normalizedSnapshot.error?.code || "")
    if (viewKey !== lastViewKey) {
      lastViewKey = viewKey
      if (!actionPending && !actionFeedback) backupWarning = ""
    }

    root.dataset.saveState = normalizedSnapshot.state
    root.dataset.saveKind = config.kind
    setText(label, config.copy)
    updateQuietAnnouncement(normalizedSnapshot, config)

    const otherEditors = Array.isArray(normalizedSnapshot.otherActiveEditors)
      ? normalizedSnapshot.otherActiveEditors
      : []
    peerNote.hidden = otherEditors.length === 0
    setText(peerNote, otherEditors.length > 0 ? PEER_WARNING : "")

    const saveErrorVisible = config.kind === "error"
    const actionFailureVisible = Boolean(actionFeedback)
    alert.hidden = !saveErrorVisible && !actionFailureVisible
    if (saveErrorVisible) {
      setText(message, config.copy)
      setText(detail, config.detail)
      const offersBackup = config.actions.includes("backup")
      const showBackupWarning = offersBackup
        || (failedActionKey === "backup" && Boolean(backupWarning))
      setText(backupNote, showBackupWarning ? PRIVATE_BACKUP_WARNING : "")
      backupNote.hidden = !showBackupWarning
      setText(preparedBackupNote, showBackupWarning ? backupWarning : "")
      preparedBackupNote.hidden = !showBackupWarning || !backupWarning
      setText(feedback, actionFeedback)
      feedback.hidden = !actionFeedback
    } else if (actionFailureVisible) {
      setText(message, ACTION_FAILURE)
      setText(detail, "当前保存状态未改变。")
      const showBackupWarning = failedActionKey === "backup" && Boolean(backupWarning)
      setText(backupNote, showBackupWarning ? PRIVATE_BACKUP_WARNING : "")
      backupNote.hidden = !showBackupWarning
      setText(preparedBackupNote, showBackupWarning ? backupWarning : "")
      preparedBackupNote.hidden = !showBackupWarning
      setText(feedback, "")
      feedback.hidden = true
    } else {
      setText(message, "")
      setText(detail, "")
      setText(backupNote, "")
      backupNote.hidden = true
      setText(preparedBackupNote, "")
      preparedBackupNote.hidden = true
      setText(feedback, "")
      feedback.hidden = true
    }
    renderActions(config)
    setBusyState(actionPending)
  }

  async function runAction(definition, sourceButton) {
    if (disposed || actionPending) return
    actionFeedback = ""
    failedActionKey = ""
    if (definition.key === "backup") {
      backupWarning = ""
      setText(preparedBackupNote, "")
      preparedBackupNote.hidden = true
    }
    setText(feedback, "")
    feedback.hidden = true
    setBusyState(true)
    try {
      const result = definition.invoke()
      await Promise.resolve(result)
      if (disposed) return
      setBusyState(false)
      renderSnapshot(currentSnapshot)
    } catch {
      if (disposed) return
      actionFeedback = ACTION_FAILURE
      failedActionKey = definition.key
      setBusyState(false)
      renderSnapshot(currentSnapshot)
      const target = sourceButton.isConnected
        ? sourceButton
        : actions.querySelector('[data-save-action="' + definition.key + '"]')
      target?.focus()
    }
  }

  function render(snapshot) {
    renderSnapshot(snapshot)
  }

  function focusError() {
    if (disposed || alert.hidden || !alert.isConnected) return false
    alert.focus()
    return documentObject.activeElement === alert
  }

  function dispose() {
    if (disposed) return
    disposed = true
    try {
      removeRuntimeSubscription?.()
    } catch {
      // View cleanup must remain idempotent even if an observer misbehaves.
    }
    removeRuntimeSubscription = null
    root.remove()
  }

  if (isFunction(runtime?.subscribe)) {
    removeRuntimeSubscription = runtime.subscribe(renderSnapshot)
  } else {
    renderSnapshot(initialSnapshot)
  }

  return Object.freeze({ render, focusError, dispose })
}
