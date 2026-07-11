import { downloadBlob } from "./download.js"
import {
  LOCAL_DATABASE_KEY,
  prepareLocalDatabaseRestore,
  readLocalDatabaseBackupFile,
  restoreLocalDatabaseBackup,
} from "./storage.js"

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function startLocalLibraryRestore({
  storage = localStorage,
  documentObject = document,
  windowObject = window,
  modal,
  download = downloadBlob,
  notify = message => windowObject.alert(message),
  reload = () => windowObject.location.reload(),
  now = () => new Date(),
} = {}) {
  let activeSession = null
  let pendingRequest = null
  let generation = 0

  function notifySafely(message, type) {
    try {
      notify(message, type)
    } catch {
      // Notifications are secondary to the restore state machine.
    }
  }

  function releaseTrigger(trigger, restoreFocus = false) {
    if (!trigger) return
    trigger.disabled = false
    if (!restoreFocus || !trigger.isConnected || typeof trigger.focus !== "function") return
    try {
      trigger.focus({ preventScroll: true })
    } catch {
      trigger.focus()
    }
  }

  function detachStorageListener(session) {
    if (!session?.storageListening) return
    windowObject.removeEventListener("storage", session.onStorage)
    session.storageListening = false
  }

  function closeSession(session, { restoreFocus = true, force = false } = {}) {
    if (!session || session.closed) return true
    if (session.committing && !force) return false

    session.closed = true
    detachStorageListener(session)
    documentObject.removeEventListener("keydown", session.onKeydown, true)
    session.overlay?.removeEventListener("click", session.onOverlayClickCapture, true)
    if (session.overlay?.isConnected) session.overlay.remove()
    if (activeSession === session) activeSession = null
    releaseTrigger(session.trigger, restoreFocus)
    return true
  }

  function finishPendingRequest(requestId, restoreFocus = false) {
    if (pendingRequest?.id !== requestId) return
    const { trigger } = pendingRequest
    pendingRequest = null
    releaseTrigger(trigger, restoreFocus)
  }

  function cleanup() {
    generation += 1
    if (pendingRequest) {
      releaseTrigger(pendingRequest.trigger, true)
      pendingRequest = null
    }
    if (!activeSession) return
    if (!closeSession(activeSession)) activeSession.closeRequested = true
  }

  async function handleFile(file, trigger = null) {
    if (activeSession?.committing) {
      notifySafely("恢复正在进行，请稍候。", "info")
      return null
    }

    const requestId = ++generation
    if (pendingRequest) releaseTrigger(pendingRequest.trigger)
    pendingRequest = { id: requestId, trigger }
    if (activeSession) closeSession(activeSession, { restoreFocus: false })
    if (trigger) trigger.disabled = true

    let backup
    let plan
    try {
      backup = await readLocalDatabaseBackupFile(file)
      if (requestId !== generation) return null
      plan = prepareLocalDatabaseRestore(backup, storage, now())
    } catch (error) {
      if (requestId !== generation) return null
      finishPendingRequest(requestId, true)
      notifySafely(`备份检查失败：${error instanceof Error ? error.message : "无法读取文件"}`, "error")
      return null
    }
    if (requestId !== generation) return null
    pendingRequest = null

    const summary = plan.summary
    const recoveryRequired = Boolean(plan.recoveryArtifact)
    const currentDescription = plan.previousState === "valid"
      ? `当前创作库：作品 ${plan.currentSummary.workCount}；联系人 ${plan.currentSummary.contactCount}；分组 ${plan.currentSummary.groupCount}`
      : plan.previousState === "corrupt"
        ? "当前创作库：数据已损坏，无法安全读取数量。"
        : "当前创作库：当前没有创作库。"
    const backupDescription = `备份：作品 ${summary.workCount}；联系人 ${summary.contactCount}；分组 ${summary.groupCount}`
    const body = `
      <div class="library-restore-summary" style="display:flex;flex-direction:column;gap:12px">
        <p><strong>恢复将替换整个当前创作库。</strong></p>
        <p>文件：${escapeHtml(file.name)}</p>
        <p>备份格式版本：v${escapeHtml(backup.backupVersion)}</p>
        <p>备份时间：${escapeHtml(new Date(backup.exportedAt).toLocaleString())}</p>
        <p>${escapeHtml(currentDescription)}</p>
        <p>${escapeHtml(backupDescription)}</p>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" for="libraryRestorePhrase">输入 RESTORE 确认整库替换</label>
          <input id="libraryRestorePhrase" class="form-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="libraryRestoreStatus">
        </div>
        <p id="libraryRestoreStatus" class="text-muted" role="status" aria-live="polite">${recoveryRequired ? "请先发起下载当前数据的恢复副本。" : "当前没有已有创作库。"}</p>
      </div>`
    const footer = `
      ${recoveryRequired ? '<button type="button" class="btn btn-outline" id="libraryRestoreRecovery">下载当前数据</button>' : ""}
      <button type="button" class="btn btn-danger" id="libraryRestoreCommit" disabled>恢复并替换</button>
      <button type="button" class="btn btn-ghost" id="libraryRestoreCancel">取消</button>`
    const session = {
      id: requestId,
      trigger,
      overlay: null,
      invalidated: false,
      committing: false,
      settled: false,
      closed: false,
      closeRequested: false,
      recoveryStarted: !recoveryRequired,
      storageListening: false,
      onStorage: null,
      onKeydown: null,
      onOverlayClickCapture: null,
    }
    const overlay = modal("检查 / 恢复备份", body, footer, () => closeSession(session))
    session.overlay = overlay
    activeSession = session

    overlay.setAttribute("role", "dialog")
    overlay.setAttribute("aria-modal", "true")
    const title = overlay.querySelector(".modal-title, h1, h2, h3")
    if (title) {
      if (!title.id) title.id = "libraryRestoreTitle"
      overlay.setAttribute("aria-labelledby", title.id)
    } else {
      overlay.setAttribute("aria-label", "检查 / 恢复备份")
    }

    const phrase = overlay.querySelector("#libraryRestorePhrase")
    const commit = overlay.querySelector("#libraryRestoreCommit")
    const cancel = overlay.querySelector("#libraryRestoreCancel")
    const recovery = overlay.querySelector("#libraryRestoreRecovery")
    const status = overlay.querySelector("#libraryRestoreStatus")

    function updateGate() {
      commit.disabled = session.closed
        || session.invalidated
        || session.committing
        || session.settled
        || !session.recoveryStarted
        || phrase.value !== "RESTORE"
    }

    function invalidatePlan() {
      session.invalidated = true
      commit.disabled = true
      if (recovery) recovery.disabled = true
      status.textContent = "当前创作库已变化，请关闭窗口后重新检查备份。"
    }

    session.onStorage = event => {
      if (activeSession !== session || session.closed) return
      if (event.key !== LOCAL_DATABASE_KEY && event.key !== null) return
      invalidatePlan()
    }
    session.onKeydown = event => {
      if (activeSession !== session || session.closed || event.key !== "Escape") return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (session.committing) return
      closeSession(session)
    }
    session.onOverlayClickCapture = event => {
      if (!session.committing) return
      const target = event.target
      const isCloseAction = target === overlay
        || (typeof target?.closest === "function" && target.closest("#modalClose, #libraryRestoreCancel"))
      if (!isCloseAction) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    windowObject.addEventListener("storage", session.onStorage)
    session.storageListening = true
    documentObject.addEventListener("keydown", session.onKeydown, true)
    overlay.addEventListener("click", session.onOverlayClickCapture, true)

    phrase.addEventListener("input", updateGate)
    cancel.addEventListener("click", () => {
      if (!session.committing) closeSession(session)
    })

    if (recovery) {
      function recoverySucceeded() {
        if (activeSession !== session || session.closed || session.invalidated || session.committing) return
        session.recoveryStarted = true
        recovery.disabled = true
        recovery.textContent = "下载已发起"
        status.textContent = "恢复副本下载已发起；请确认文件后输入 RESTORE。"
        updateGate()
      }

      function recoveryFailed(error) {
        if (activeSession !== session || session.closed || session.invalidated || session.committing) return
        recovery.disabled = false
        status.textContent = "恢复副本下载失败，请重试；在下载成功前不能恢复。"
        notifySafely(error instanceof Error ? error.message : "恢复副本下载失败", "error")
        updateGate()
      }

      recovery.addEventListener("click", () => {
        if (activeSession !== session || session.closed || session.invalidated || session.committing || session.recoveryStarted) return
        recovery.disabled = true
        let result
        try {
          const artifact = plan.recoveryArtifact
          result = download(new Blob([artifact.contents], { type: artifact.mimeType }), artifact.filename)
        } catch (error) {
          recoveryFailed(error)
          return
        }
        if (result && typeof result.then === "function") {
          Promise.resolve(result).then(recoverySucceeded, recoveryFailed)
        } else {
          recoverySucceeded()
        }
      })
    }

    commit.addEventListener("click", () => {
      if (activeSession !== session || commit.disabled || session.committing || session.settled) return
      session.committing = true
      updateGate()

      try {
        restoreLocalDatabaseBackup(plan, storage)
      } catch (error) {
        session.committing = false
        const unchanged = error?.details?.commitState === "unchanged"
        const retryBlocked = error?.code === "restore-conflict" || !unchanged
        if (retryBlocked) {
          session.invalidated = true
          session.settled = true
        }
        status.textContent = error?.code === "restore-conflict"
          ? "当前创作库已变化，请关闭窗口后重新检查备份。"
          : unchanged
            ? "恢复未发生，原数据保持不变。"
            : "恢复结果无法确认，请重新加载检查；当前窗口不能再次提交。"
        notifySafely(error instanceof Error ? error.message : "恢复失败", "error")
        updateGate()
        if (session.closeRequested) closeSession(session)
        return
      }

      session.committing = false
      session.settled = true
      detachStorageListener(session)
      updateGate()
      status.textContent = "恢复成功，正在重新加载。"
      notifySafely("完整创作库已恢复", "success")
      try {
        reload()
      } catch {
        status.textContent = "恢复成功；请手动重新加载页面。"
      }
      if (session.closeRequested) closeSession(session)
    })

    try {
      phrase.focus({ preventScroll: true })
    } catch {
      phrase.focus()
    }
    updateGate()
    return { backup, plan, overlay }
  }

  function pickFile(trigger) {
    if (activeSession || trigger?.disabled) return null
    const input = documentObject.createElement("input")
    input.type = "file"
    input.accept = ".json,application/json"
    input.addEventListener("change", async () => {
      const file = input.files?.[0]
      if (!file) return
      if (trigger) trigger.disabled = true
      try {
        await handleFile(file, trigger)
      } finally {
        const ownsActiveSession = activeSession?.trigger === trigger
        const ownsPendingRequest = pendingRequest?.trigger === trigger
        if (trigger && !ownsActiveSession && !ownsPendingRequest) releaseTrigger(trigger)
      }
    }, { once: true })
    input.click()
    return input
  }

  return { handleFile, pickFile, dispose: cleanup }
}
