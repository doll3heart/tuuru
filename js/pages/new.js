import { createWork, WORK_TYPE } from "../data.js"
import { navigate } from "../router.js"
import { showToast } from "../app.js"
import { FEATURE_FLAGS } from "../feature-flags.js"
import { INTERACTIVE_EXPERIENCE_MODE } from "../interactive-experience.js"
import {
  createHomeWork,
  describeHomeMutationFailure,
  requireVerifiedHomeMutation,
} from "../home-work-mutations.js"

function normalizedText(value) {
  return typeof value === "string" ? value.trim() : ""
}

const CLEANUP_WARNING = "作品已经保存，但编辑锁清理未完成；请稍后刷新查看，不要重复操作。"
const POST_COMMIT_UI_WARNING = "作品已经保存，但页面更新未完成；请刷新查看，不要重复操作。"

export function createNewWorkController({
  flags,
  createLegacy,
  createReliable,
  notify,
  navigate: navigateTo,
  publish = () => {},
}) {
  const pending = new Map()
  const blocked = new Map()

  function submit({ type, title, desc, author, experienceMode }) {
    const interactiveExperience = type === WORK_TYPE.ARTICLE
      && experienceMode === INTERACTIVE_EXPERIENCE_MODE
    const creationKey = interactiveExperience ? INTERACTIVE_EXPERIENCE_MODE : type
    const data = {
      type,
      title: normalizedText(title) || (
        type === WORK_TYPE.PHONE
          ? "未命名小手机"
          : interactiveExperience ? "未命名 Mini文游" : "未命名互动文章"
      ),
      desc: normalizedText(desc),
      author: normalizedText(author),
      ...(interactiveExperience ? { experienceMode:INTERACTIVE_EXPERIENCE_MODE } : {}),
    }
    const routeFor = work => `/${type === WORK_TYPE.PHONE ? "phone" : "edit"}/${work.id}`

    if (!flags.reliableLocalWrites) {
      const work = createLegacy(data)
      notify("作品已创建")
      navigateTo(routeFor(work))
      return work
    }

    if (pending.has(creationKey)) return pending.get(creationKey)
    if (blocked.has(creationKey)) return blocked.get(creationKey)
    publish("create", creationKey, { status: "pending", pending: true, message: "正在创建…" })
    let task
    task = Promise.resolve()
      .then(() => createReliable(data))
      .then(outcome => requireVerifiedHomeMutation(outcome))
      .then(
        async outcome => {
          const cleanupWarning = Object.hasOwn(outcome, "cleanupError")
          if (cleanupWarning) {
            blocked.set(creationKey, task)
            publish("create", creationKey, {
              status: "warning",
              pending: false,
              blocked: true,
              persistent: true,
              message: CLEANUP_WARNING,
            })
            return outcome
          }
          publish("create", creationKey, {
            status: "success",
            pending: false,
            persistent: false,
            message: "",
          })
          try {
            notify("作品已创建")
            await navigateTo(routeFor(outcome.work))
          } catch (error) {
            publish("create", creationKey, {
              status: "warning",
              pending: false,
              persistent: true,
              message: POST_COMMIT_UI_WARNING,
              error,
            })
            throw error
          }
          return outcome
        },
        error => {
          publish("create", creationKey, {
            status: "error",
            pending: false,
            persistent: true,
            message: describeHomeMutationFailure(error),
            error,
          })
          throw error
        },
      )
      .finally(() => {
        if (pending.get(creationKey) === task) pending.delete(creationKey)
      })
    pending.set(creationKey, task)
    return task
  }

  return Object.freeze({ submit })
}

function publishNewWorkState(action, type, state) {
  if (action !== "create") return
  const prefix = type === WORK_TYPE.PHONE ? "phone" : type === INTERACTIVE_EXPERIENCE_MODE ? "interactive" : "article"
  const button = document.getElementById(`${prefix}CreateBtn`)
  const status = document.getElementById(`${prefix}CreateStatus`)
  if (button) button.disabled = state.pending === true || state.blocked === true
  if (status) status.textContent = state.message || ""
  if (state.status === "error") button?.focus()
}

const newWorkController = createNewWorkController({
  flags: FEATURE_FLAGS,
  createLegacy: createWork,
  createReliable: createHomeWork,
  notify: showToast,
  navigate,
  publish: publishNewWorkState,
})

export function renderNew(){
  return `
    <h2 style="font-size:1.3rem;font-weight:600;margin-bottom:24px;text-align:center">新建作品</h2>
    
    <div class="grid-2 new-work-kind-grid">
      <div class="card" style="cursor:pointer;text-align:center;padding:40px 20px" onclick="document.getElementById('articleForm').style.display='block';this.style.borderColor='var(--c-primary)'">
        <h3 style="font-weight:600;margin-bottom:8px">互动文章</h3>
        <p style="font-size:.85rem;color:var(--c-text2)">节点式分支故事，每节末尾设置选项跳转</p>
        <div style="margin-top:12px">
          <div class="badge badge-primary">占位符替换</div>
          <div class="badge badge-primary">分支选项</div>
        </div>
      </div>

      <div class="card" style="cursor:pointer;text-align:center;padding:40px 20px" onclick="document.getElementById('interactiveForm').style.display='block';this.style.borderColor='var(--c-primary)'">
        <h3 style="font-weight:600;margin-bottom:8px">Mini文游</h3>
        <p style="font-size:.85rem;color:var(--c-text2)">适合短篇、固定顺序的画面互动与对话推进</p>
        <div style="margin-top:12px">
          <div class="badge badge-primary">固定顺序画面</div>
          <div class="badge badge-primary">画面特殊 BGM</div>
        </div>
      </div>
      
      <div class="card" style="cursor:pointer;text-align:center;padding:40px 20px" onclick="document.getElementById('phoneForm').style.display='block';this.style.borderColor='var(--c-primary)'">
        <h3 style="font-weight:600;margin-bottom:8px">小手机</h3>
        <p style="font-size:.85rem;color:var(--c-text2)">模拟手机界面：短信、群聊、朋友圈、论坛</p>
        <div style="margin-top:12px">
          <div class="badge badge-primary">短信/群聊</div>
          <div class="badge badge-primary">朋友圈</div>
          <div class="badge badge-primary">论坛</div>
        </div>
      </div>
    </div>

    <div id="interactiveForm" style="display:none" class="mt-4 card">
      <h3 style="font-weight:600;margin-bottom:16px">创建 Mini文游</h3>
      <div class="form-group"><label class="form-label">作品标题</label><input class="form-input" id="igTitle" placeholder="输入作品标题"></div>
      <div class="form-group"><label class="form-label">作品描述</label><input class="form-input" id="igDesc" placeholder="简短描述"></div>
      <div class="form-group"><label class="form-label">作者署名</label><input class="form-input" id="igAuthor" placeholder="作者名称（可选）"></div>
      <button class="btn btn-primary" id="interactiveCreateBtn" onclick="createInteractiveExperience()">创建作品</button>
      <div id="interactiveCreateStatus" role="status" aria-live="polite" style="margin-top:8px;color:var(--c-accent3);font-size:.8rem"></div>
    </div>
    
    <div id="articleForm" style="display:none" class="mt-4 card">
      <h3 style="font-weight:600;margin-bottom:16px">创建互动文章</h3>
      <div class="form-group">
        <label class="form-label">作品标题</label>
        <input class="form-input" id="artTitle" placeholder="输入作品标题">
      </div>
      <div class="form-group">
        <label class="form-label">作品描述</label>
        <input class="form-input" id="artDesc" placeholder="简短描述">
      </div>
      <div class="form-group">
        <label class="form-label">作者署名</label>
        <input class="form-input" id="artAuthor" placeholder="作者名称（可选）">
      </div>
      <button class="btn btn-primary" id="articleCreateBtn" onclick="createArticle()">创建作品</button>
      <div id="articleCreateStatus" role="status" aria-live="polite" style="margin-top:8px;color:var(--c-accent3);font-size:.8rem"></div>
    </div>
    
    <div id="phoneForm" style="display:none" class="mt-4 card">
      <h3 style="font-weight:600;margin-bottom:16px">创建小手机</h3>
      <div class="form-group">
        <label class="form-label">作品标题</label>
        <input class="form-input" id="phTitle" placeholder="输入作品标题">
      </div>
      <div class="form-group">
        <label class="form-label">作品描述</label>
        <input class="form-input" id="phDesc" placeholder="简短描述">
      </div>
      <div class="form-group">
        <label class="form-label">作者署名</label>
        <input class="form-input" id="phAuthor" placeholder="作者名称（可选）">
      </div>
      <button class="btn btn-primary" id="phoneCreateBtn" onclick="createPhone()">创建作品</button>
      <div id="phoneCreateStatus" role="status" aria-live="polite" style="margin-top:8px;color:var(--c-accent3);font-size:.8rem"></div>
    </div>
  `
}

window.createArticle = function(){
  const result = newWorkController.submit({
    type: WORK_TYPE.ARTICLE,
    title: document.getElementById("artTitle")?.value,
    desc: document.getElementById("artDesc")?.value,
    author: document.getElementById("artAuthor")?.value,
  })
  if (result instanceof Promise) result.catch(() => {})
  return result
}

window.createPhone = function(){
  const result = newWorkController.submit({
    type: WORK_TYPE.PHONE,
    title: document.getElementById("phTitle")?.value,
    desc: document.getElementById("phDesc")?.value,
    author: document.getElementById("phAuthor")?.value,
  })
  if (result instanceof Promise) result.catch(() => {})
  return result
}

window.createInteractiveExperience = function(){
  const result = newWorkController.submit({
    type: WORK_TYPE.ARTICLE,
    experienceMode: INTERACTIVE_EXPERIENCE_MODE,
    title: document.getElementById("igTitle")?.value,
    desc: document.getElementById("igDesc")?.value,
    author: document.getElementById("igAuthor")?.value,
  })
  if (result instanceof Promise) result.catch(() => {})
  return result
}
