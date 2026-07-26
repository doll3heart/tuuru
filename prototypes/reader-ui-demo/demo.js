(() => {
  function init() {
    const demo = document.querySelector("[data-shared-demo]")
    if (!demo || demo.dataset.bound === "true") return
    demo.dataset.bound = "true"

    const content = demo.querySelector("[data-shared-content]")
    const modeTitle = demo.querySelector("[data-mode-title]")
    const modeCopy = demo.querySelector("[data-mode-copy]")
    const toast = demo.querySelector(".demo-toast")
    let toastTimer
    let pendingApp = ""
    let draftContact = ""
    let activeMessageTab = "chats"

    const contactData = [
      {
        id: "gu",
        name: "顾逢川",
        alias: "阿川",
        note: "星光中学",
        msgId: "Aster",
        avatar: "顾",
        avatarColor: "#7b5963",
        messageAvatar: "A",
        messageAvatarColor: "#7b5963",
        pinned: true,
      },
      {
        id: "lin",
        name: "林晚",
        alias: "晚晚",
        note: "摄影社",
        msgId: "晚风",
        avatar: "林",
        avatarColor: "#b88794",
        messageAvatar: "晚",
        messageAvatarColor: "#b88794",
        pinned: false,
      },
      {
        id: "pei",
        name: "裴亦惜",
        alias: "小惜",
        note: "观星小组",
        msgId: "小惜",
        avatar: "裴",
        avatarColor: "#9b7d86",
        messageAvatar: "惜",
        messageAvatarColor: "#9b7d86",
        pinned: false,
      },
    ]

    const chatData = [
      {
        id: "chat-gu",
        contactId: "gu",
        preview: "我到天台了，你慢慢来。",
        time: "刚刚",
        pinned: true,
      },
      {
        id: "chat-group",
        groupName: "天台观星小组",
        groupAvatar: "群",
        groupColor: "#9b7d86",
        preview: "晚风：今晚云层很薄。",
        time: "20:16",
        pinned: false,
      },
      {
        id: "chat-lin",
        contactId: "lin",
        preview: "照片我晚点发你。",
        time: "昨天",
        pinned: false,
      },
    ]

    const momentData = [
      {
        id: "moment-lin",
        contactId: "lin",
        time: "8 分钟前",
        content: "天台今天能看到很完整的夏季大三角。带了相机，等云散。",
        images: 3,
        likes: 12,
      },
      {
        id: "moment-gu",
        contactId: "gu",
        time: "21 分钟前",
        content: "自动贩卖机最后一罐薄荷苏打，给某位迟到的人留着。",
        images: 0,
        likes: 4,
      },
    ]

    const scopedApps = new Set(["memo", "gallery", "browser", "shopping"])
    const appMeta = {
      memo: {
        label: "备忘录",
        editorLabel: "备忘录",
        description: "设备中包含一组可查看的备忘记录。",
      },
      gallery: {
        label: "相册",
        editorLabel: "相册",
        description: "设备中包含一组可查看的照片与相册。",
      },
      browser: {
        label: "浏览记录",
        editorLabel: "浏览记录",
        description: "设备中保留了一段可查看的浏览记录。",
      },
      shopping: {
        label: "购物清单",
        editorLabel: "购物清单",
        description: "设备中包含一组购物与订单记录。",
      },
    }
    const connectionState = Object.fromEntries(
      Array.from(scopedApps, (type) => [
        type,
        {
          contact: "顾逢川",
          avatar: "顾",
          prompt: "天台附近捕捉到一段来自对方设备的信号。",
        },
      ]),
    )

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
    }

    function contactById(id) {
      return contactData.find((contact) => contact.id === id)
    }

    function messageIdentity(contact) {
      return {
        name: contact?.msgId?.trim() || contact?.name || "未知联系人",
        avatar: contact?.messageAvatar?.trim() || contact?.avatar || "?",
        color: contact?.messageAvatarColor || contact?.avatarColor || "#9b7d86",
      }
    }

    function renderContactBook() {
      const list = demo.querySelector("[data-contact-list]")
      if (!list) return

      list.innerHTML = contactData.map((contact) => {
        const searchText = [contact.name, contact.alias, contact.note, contact.msgId].filter(Boolean).join(" ")
        return `
          <article
            class="ct-card"
            data-reader-contact="${escapeHtml(contact.name)}"
            data-contact-id="${escapeHtml(contact.id)}"
            data-contact-search="${escapeHtml(searchText)}"
          >
            <div class="ct-row">
              <div class="ct-avatar-wrap">
                <div class="ct-avatar" style="background:${escapeHtml(contact.avatarColor)}">${escapeHtml(contact.avatar)}</div>
                <div class="ct-avatar-badge" data-author-only>＋</div>
              </div>
              <input
                class="ct-name"
                value="${escapeHtml(contact.name)}"
                aria-label="联系人姓名"
                data-author-control
                data-contact-field="name"
              >
              <button class="ct-pin${contact.pinned ? " active" : ""}" type="button" data-author-only aria-label="${contact.pinned ? "取消置顶" : "置顶联系人"}">⌃</button>
              <button class="ct-drag" type="button" data-author-only aria-label="调整顺序">↕</button>
              <button class="ct-del" type="button" data-author-only aria-label="删除联系人">×</button>
            </div>
            <div class="ct-sub-row" data-author-only>
              <span class="ct-sub-label">别名</span>
              <input class="ct-sub-input" value="${escapeHtml(contact.alias)}" data-contact-field="alias" aria-label="${escapeHtml(contact.name)}的别名">
              <span class="ct-sub-label">备注</span>
              <input class="ct-sub-input" value="${escapeHtml(contact.note)}" data-contact-field="note" aria-label="${escapeHtml(contact.name)}的备注">
            </div>
            <div class="reader-contact-meta" data-reader-only>${escapeHtml(contact.alias)} · ${escapeHtml(contact.note)}</div>
          </article>
        `
      }).join("")
    }

    function renderChatSection() {
      const cards = chatData.map((chat) => {
        const contact = contactById(chat.contactId)
        const identity = contact ? messageIdentity(contact) : {
          name: chat.groupName,
          avatar: chat.groupAvatar,
          color: chat.groupColor,
        }
        return `
          <article class="forum-list-card message-chat-card${chat.pinned ? " is-pinned" : ""}" data-open-chat data-chat-id="${escapeHtml(chat.id)}">
            <div class="forum-list-avatar" style="background:${escapeHtml(identity.color)}">${escapeHtml(identity.avatar)}</div>
            <div class="forum-list-info">
              <div class="forum-list-title">${escapeHtml(identity.name)}${chat.pinned ? '<span class="message-chat-pinned-label">置顶</span>' : ""}</div>
              <div class="forum-list-meta">${escapeHtml(chat.preview)}</div>
            </div>
            <div class="message-chat-controls" data-author-only>
              <button class="message-chat-pin${chat.pinned ? " active" : ""}" type="button" aria-label="${chat.pinned ? "取消置顶" : "置顶会话"}">⌃</button>
              <button class="message-chat-drag" type="button" aria-label="调整顺序">↕</button>
              <button class="message-chat-delete" type="button" aria-label="删除会话">×</button>
            </div>
            <time class="reader-message-time" data-reader-only>${escapeHtml(chat.time)}</time>
          </article>
        `
      }).join("")

      return `
        <section class="message-section" data-message-section="chats"${activeMessageTab === "chats" ? "" : " hidden"}>
          <div class="forum-bar message-section-header">
            <span class="forum-bar-title">消息列表</span>
            <button class="btn btn-sm btn-outline" type="button" data-author-only data-message-create="chat">＋ 新建</button>
          </div>
          <div class="message-section-list">${cards}</div>
        </section>
      `
    }

    function renderMessageContactSection() {
      const rows = contactData.map((contact) => {
        const identity = messageIdentity(contact)
        return `
          <article
            class="forum-npc-row message-contact-row"
            data-message-contact
            data-contact-id="${escapeHtml(contact.id)}"
            data-open-contact-chat
            tabindex="0"
          >
            <div class="forum-npc-avatar" style="background:${escapeHtml(identity.color)}">${escapeHtml(identity.avatar)}</div>
            <div class="forum-npc-info">
              <div class="forum-npc-name" data-contact-display-name>${escapeHtml(identity.name)}</div>
              <div class="forum-npc-meta">消息身份 · ${escapeHtml(contact.name)}</div>
            </div>
            <span class="message-contact-arrow" aria-hidden="true">›</span>
          </article>
        `
      }).join("")

      return `
        <section class="message-section" data-message-section="contacts"${activeMessageTab === "contacts" ? "" : " hidden"}>
          <div class="forum-bar message-section-header">
            <span class="forum-bar-title">消息联系人</span>
            <button class="btn btn-sm btn-outline" type="button" data-author-only data-message-create="group">新建群聊</button>
          </div>
          <div class="message-contact-note">与联系人 App 共用人物资料；这里采用消息昵称和消息头像。</div>
          <div class="message-section-list">${rows}</div>
        </section>
      `
    }

    function renderMomentSection() {
      const cards = momentData.map((moment) => {
        const contact = contactById(moment.contactId)
        const identity = messageIdentity(contact)
        const images = Array.from({ length: moment.images }, (_, index) => `<span class="moment-demo-image moment-demo-image-${index + 1}"></span>`).join("")
        return `
          <article class="moment-card">
            <div class="moment-header">
              <div class="moment-avatar" style="background:${escapeHtml(identity.color)}">${escapeHtml(identity.avatar)}</div>
              <div>
                <div class="moment-user">${escapeHtml(identity.name)}</div>
                <time class="moment-time">${escapeHtml(moment.time)}</time>
              </div>
              <button class="browser-del moment-card-delete" type="button" data-author-only aria-label="删除动态">×</button>
            </div>
            <div class="moment-content">${escapeHtml(moment.content)}</div>
            ${images ? `<div class="moment-images">${images}</div>` : ""}
            <div class="moment-actions">
              <button class="moment-edit-btn" type="button" data-author-only>编辑</button>
              <button class="moment-edit-btn" type="button" data-reader-only data-reader-toast="已选择回复${escapeHtml(identity.name)}">回复</button>
              <button class="forum-comment-like-author" type="button" data-reader-only data-reader-like aria-pressed="false">
                <span class="forum-like-heart">♡</span><span data-like-count>${moment.likes}</span>
              </button>
            </div>
          </article>
        `
      }).join("")

      return `
        <section class="message-section" data-message-section="moments"${activeMessageTab === "moments" ? "" : " hidden"}>
          <div class="forum-bar message-section-header">
            <span class="forum-bar-title">动态</span>
            <button class="btn btn-sm btn-outline" type="button" data-author-only data-message-create="moment">＋ 发布</button>
          </div>
          <div class="message-section-list">${cards}</div>
        </section>
      `
    }

    function renderMessageSections() {
      const root = demo.querySelector("[data-message-section-root]")
      if (!root) return
      root.innerHTML = renderChatSection() + renderMessageContactSection() + renderMomentSection()
    }

    function setMessageTab(tab) {
      if (!["chats", "contacts", "moments"].includes(tab)) return
      activeMessageTab = tab
      demo.querySelectorAll("[data-message-tab]").forEach((button) => {
        const selected = button.dataset.messageTab === tab
        button.classList.toggle("active", selected)
        button.setAttribute("aria-selected", String(selected))
        button.tabIndex = selected ? 0 : -1
      })
      renderMessageSections()
    }

    function showToast(message) {
      clearTimeout(toastTimer)
      toast.textContent = message
      toast.hidden = false
      toast.classList.add("is-visible")
      toastTimer = setTimeout(() => {
        toast.classList.remove("is-visible")
        setTimeout(() => { toast.hidden = true }, 160)
      }, 1500)
    }

    function updateScopedPanelTitle(type, contact) {
      const title = demo.querySelector(`[data-phone-panel="${type}"] [data-scoped-app-title]`)
      if (title) title.textContent = `${contact} · ${appMeta[type].editorLabel}`
    }

    function renderAccessPanel(type) {
      const meta = appMeta[type]
      const saved = connectionState[type]
      if (!meta || !saved) return

      pendingApp = type
      draftContact = saved.contact
      demo.dataset.pendingApp = type

      const title = demo.querySelector("[data-access-title]")
      const prompt = demo.querySelector("[data-access-prompt]")
      if (title) title.textContent = `${meta.label} · 接入设置`
      if (prompt) prompt.value = saved.prompt

      demo.querySelectorAll("[data-access-contact]").forEach((option) => {
        const selected = option.dataset.accessContact === saved.contact
        option.classList.toggle("selected", selected)
        option.setAttribute("aria-pressed", String(selected))
        const count = option.querySelector(".character-access-copy small")
        const check = option.querySelector(".character-access-check")
        if (count) {
          const amount = option.dataset.accessContact === "裴亦惜" ? 1 : 2
          count.textContent = `${amount} 条内容 · ${selected ? "当前接入对象" : "可设为接入对象"}`
        }
        if (check) check.textContent = selected ? "✓" : "→"
      })

      const gateLabel = demo.querySelector("[data-connection-app-label]")
      const gateAvatar = demo.querySelector("[data-connection-avatar]")
      const gateName = demo.querySelector("[data-connection-device-name]")
      const gatePrompt = demo.querySelector("[data-connection-prompt]")
      const gateDescription = demo.querySelector("[data-connection-description]")
      if (gateLabel) gateLabel.textContent = meta.label
      if (gateAvatar) gateAvatar.textContent = saved.avatar
      if (gateName) gateName.textContent = `${saved.contact}的手机`
      if (gatePrompt) gatePrompt.textContent = saved.prompt
      if (gateDescription) gateDescription.textContent = `${meta.description}\n对方似乎没有察觉这次连接。`

      updateScopedPanelTitle(type, saved.contact)
    }

    function openPhoneApp(type) {
      if (scopedApps.has(type)) {
        renderAccessPanel(type)
        setView("access")
        return
      }
      pendingApp = ""
      delete demo.dataset.pendingApp
      setView(type)
    }

    function setMode(mode) {
      demo.dataset.mode = mode
      content.setAttribute("contenteditable", String(mode === "author"))
      demo.querySelectorAll("[data-reader-editable]").forEach((editable) => {
        editable.setAttribute("contenteditable", String(mode === "author"))
      })
      demo.querySelectorAll("[data-author-control]").forEach((control) => {
        control.disabled = mode !== "author"
      })
      demo.querySelectorAll("[data-set-mode]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.setMode === mode))
      })
      if (mode === "author") {
        modeTitle.textContent = "作者态："
        modeCopy.textContent = "显示同一组件上的编辑入口、时间和点赞设置。"
      } else {
        modeTitle.textContent = "读者态："
        modeCopy.textContent = "沿用作者设置好的排版与组件，隐藏编辑入口，保留剧情选择和作品内交互。"
      }
    }

    function setView(view) {
      demo.dataset.view = view
      demo.querySelectorAll("[data-demo-view]").forEach((screen) => {
        const views = screen.dataset.demoView.split(/\s+/)
        screen.classList.toggle("is-active", views.includes(view))
      })
      demo.querySelectorAll("[data-view-target]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.viewTarget === view))
      })
      demo.querySelectorAll("[data-phone-panel]").forEach((panel) => {
        const panelName = view === "article" ? "phone" : view
        panel.classList.toggle("is-active", panel.dataset.phonePanel === panelName)
      })
    }

    demo.addEventListener("click", (event) => {
      const modeButton = event.target.closest("[data-set-mode]")
      if (modeButton) {
        setMode(modeButton.dataset.setMode)
        return
      }

      const viewButton = event.target.closest("[data-view-target]")
      if (viewButton) {
        setView(viewButton.dataset.viewTarget)
        return
      }

      const appButton = event.target.closest("[data-app-type]")
      if (appButton) {
        openPhoneApp(appButton.dataset.appType)
        return
      }

      const messageTab = event.target.closest("[data-message-tab]")
      if (messageTab) {
        setMessageTab(messageTab.dataset.messageTab)
        return
      }

      const appJump = event.target.closest("[data-app-jump]")
      if (appJump) {
        setView(appJump.dataset.appJump)
        return
      }

      const accessContact = event.target.closest("[data-access-contact]")
      if (accessContact && demo.dataset.mode === "author") {
        draftContact = accessContact.dataset.accessContact
        demo.querySelectorAll("[data-access-contact]").forEach((option) => {
          const selected = option === accessContact
          option.classList.toggle("selected", selected)
          option.setAttribute("aria-pressed", String(selected))
          const count = option.querySelector(".character-access-copy small")
          const check = option.querySelector(".character-access-check")
          if (count) {
            const amount = option.dataset.accessContact === "裴亦惜" ? 1 : 2
            count.textContent = `${amount} 条内容 · ${selected ? "当前接入对象" : "可设为接入对象"}`
          }
          if (check) check.textContent = selected ? "✓" : "→"
        })
        return
      }

      if (event.target.closest("[data-access-continue]") && pendingApp && demo.dataset.mode === "author") {
        const prompt = demo.querySelector("[data-access-prompt]")
        const selected = demo.querySelector(`[data-access-contact="${draftContact}"]`)
        connectionState[pendingApp] = {
          contact: draftContact,
          avatar: selected?.dataset.accessAvatar || draftContact.charAt(0),
          prompt: prompt?.value.trim() || "剧情中出现了一段来自对方设备的信号。",
        }
        updateScopedPanelTitle(pendingApp, draftContact)
        setView(pendingApp)
        return
      }

      if (event.target.closest("[data-connection-confirm]") && pendingApp) {
        setView(pendingApp)
        return
      }

      if (event.target.closest("[data-connection-cancel]")) {
        pendingApp = ""
        delete demo.dataset.pendingApp
        setView("phone")
        return
      }

      if (event.target.closest("[data-phone-back]")) {
        pendingApp = ""
        delete demo.dataset.pendingApp
        setView("phone")
        return
      }

      if (event.target.closest("[data-open-chat]")) {
        if (demo.dataset.mode === "author" && event.target.closest("[data-author-only]")) return
        setView("chat")
        return
      }

      if (event.target.closest("[data-open-contact-chat]")) {
        setView("chat")
        return
      }

      const messageCreate = event.target.closest("[data-message-create]")
      if (messageCreate) {
        const labels = { chat: "新建会话", group: "新建群聊", moment: "发布动态" }
        showToast(`${labels[messageCreate.dataset.messageCreate]}沿用作者端编辑流程`)
        return
      }

      const likeButton = event.target.closest("[data-reader-like]")
      if (likeButton) {
        const pressed = likeButton.getAttribute("aria-pressed") === "true"
        const count = likeButton.querySelector("[data-like-count]")
        likeButton.setAttribute("aria-pressed", String(!pressed))
        likeButton.classList.toggle("is-liked", !pressed)
        count.textContent = String(Number(count.textContent) + (pressed ? -1 : 1))
        return
      }

      const choice = event.target.closest("[data-reader-choice]")
      if (choice && demo.dataset.mode === "reader") {
        choice.parentElement.querySelectorAll("[data-reader-choice]").forEach((button) => button.classList.remove("is-selected"))
        choice.classList.add("is-selected")
        showToast(`已选择：${choice.textContent.trim()}`)
        return
      }

      const reply = event.target.closest(".reader-reply-button")
      if (reply) {
        showToast("这里接入现有读者回复选项")
        return
      }

      const chatChoice = event.target.closest("[data-reader-chat-choice]")
      if (chatChoice) {
        const log = demo.querySelector("[data-chat-log]")
        const panel = demo.querySelector("[data-reader-chat-choice-panel]")
        const input = demo.querySelector("[data-reader-chat-input]")
        const toggle = demo.querySelector("[data-reader-chat-toggle]")
        const message = document.createElement("div")
        message.className = "chat-msg self"
        message.innerHTML = `<div class="chat-bubble">${chatChoice.dataset.readerChatChoice}</div>`
        log.appendChild(message)
        panel.querySelectorAll("[data-reader-chat-choice]").forEach((button) => {
          button.classList.add("used")
          button.disabled = true
        })
        panel.hidden = true
        input.value = ""
        input.placeholder = "回复已发送"
        toggle.setAttribute("aria-expanded", "false")
        showToast("回复已发送")
        return
      }

      const chatToggle = event.target.closest("[data-reader-chat-toggle], [data-reader-chat-input]")
      if (chatToggle && demo.dataset.mode === "reader") {
        const panel = demo.querySelector("[data-reader-chat-choice-panel]")
        const toggle = demo.querySelector("[data-reader-chat-toggle]")
        panel.hidden = !panel.hidden
        toggle.setAttribute("aria-expanded", String(!panel.hidden))
        return
      }

      const shopToggle = event.target.closest("[data-shop-toggle]")
      if (shopToggle) {
        const checked = shopToggle.getAttribute("aria-checked") === "true"
        shopToggle.setAttribute("aria-checked", String(!checked))
        shopToggle.classList.toggle("checked", !checked)
        return
      }

      const photo = event.target.closest("[data-reader-photo]")
      if (photo) {
        const pressed = photo.getAttribute("aria-pressed") === "true"
        photo.setAttribute("aria-pressed", String(!pressed))
        photo.classList.toggle("is-reader-selected", !pressed)
        return
      }

      const toastTrigger = event.target.closest("[data-reader-toast]")
      if (toastTrigger) {
        showToast(toastTrigger.dataset.readerToast)
      }
    })

    demo.addEventListener("input", (event) => {
      const field = event.target.closest("[data-contact-field]")
      if (!field) return
      const card = field.closest("[data-contact-id]")
      const contact = contactById(card?.dataset.contactId)
      if (!contact || !["name", "alias", "note"].includes(field.dataset.contactField)) return

      contact[field.dataset.contactField] = field.value
      card.dataset.readerContact = contact.name
      card.dataset.contactSearch = [contact.name, contact.alias, contact.note, contact.msgId].filter(Boolean).join(" ")
      const readerMeta = card.querySelector(".reader-contact-meta")
      if (readerMeta) readerMeta.textContent = `${contact.alias} · ${contact.note}`
      renderMessageSections()
    })

    renderContactBook()
    renderMessageSections()

    const contactSearch = demo.querySelector("[data-reader-contact-search]")
    contactSearch?.addEventListener("input", () => {
      const query = contactSearch.value.trim().toLocaleLowerCase("zh-CN")
      let visible = 0
      demo.querySelectorAll("[data-reader-contact]").forEach((card) => {
        const haystack = (card.dataset.contactSearch || card.dataset.readerContact).toLocaleLowerCase("zh-CN")
        const matches = haystack.includes(query)
        card.hidden = !matches
        if (matches) visible += 1
      })
      const empty = demo.querySelector("[data-reader-contact-empty]")
      if (empty) empty.hidden = visible > 0
      const count = demo.querySelector("[data-reader-contact-count]")
      if (count) count.textContent = `${visible} 人`
    })

    setMode("reader")
    setView("article")
  }

  window.SharedReaderDemo = { init }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true })
  } else {
    init()
  }
})()
