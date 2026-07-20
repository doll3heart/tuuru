if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then(registration => {
        registration.update().catch(() => {})
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") registration.update().catch(() => {})
        })
      })
      .catch(error => {
        console.warn("Tuuru 离线服务注册失败", error)
      })
  }, { once: true })
}
