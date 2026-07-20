const RECOVERY_ATTRIBUTES = `data-tuuru-stylesheet onerror="if(!this.dataset.retry){this.dataset.retry='1';this.href=this.href.split('?')[0]+'?tuuru-style-retry='+Date.now()}"`

export function addStylesheetRecovery(html) {
  return html.replace(
    /<link\b(?![^>]*\bdata-tuuru-stylesheet\b)(?=[^>]*\brel=(['"])stylesheet\1)[^>]*>/gi,
    link => link.replace(/^<link\b/i, `<link ${RECOVERY_ATTRIBUTES}`),
  )
}

export function tuuruStylesheetRecovery() {
  return {
    name: "tuuru-stylesheet-recovery",
    transformIndexHtml: {
      order: "post",
      handler: addStylesheetRecovery,
    },
  }
}
