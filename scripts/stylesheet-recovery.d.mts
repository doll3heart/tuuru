export function addStylesheetRecovery(html: string): string

export function tuuruStylesheetRecovery(): {
  name: string
  transformIndexHtml: {
    order: "post"
    handler: typeof addStylesheetRecovery
  }
}
