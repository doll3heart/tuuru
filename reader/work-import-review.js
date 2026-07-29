import { classifyWorkRelease } from "../js/work-release.js"
import { summarizeReaderWorkUpdate } from "./work-update-analysis.js"

const SHARED_READER_SUMMARY = "保留存档、身份、占位符与书签"

const RELEASE_REVIEWS = Object.freeze({
  newer: Object.freeze({
    label: "发现作品更新",
    contentSummary: "更新为作者新发布的版本",
    readerSummary: SHARED_READER_SUMMARY,
    note: "确认后会继续使用原来的阅读记录；若作者删除了原剧情节点，失效位置会安全回到开头。",
    confirmLabel: "更新作品",
    primaryAction: "replace",
    secondaryLabel: "返回选择",
    secondaryAction: "cancel",
  }),
  same: Object.freeze({
    label: "当前版本已在书架",
    contentSummary: "内容与书架中的版本一致",
    readerSummary: SHARED_READER_SUMMARY,
    note: "通常无需重复导入；如果想重新写入正文缓存，可以继续。",
    confirmLabel: "继续阅读",
    primaryAction: "continue",
    secondaryLabel: "重新写入缓存",
    secondaryAction: "replace",
  }),
  older: Object.freeze({
    label: "这是较早的版本",
    contentSummary: "将用较早版本替换当前正文",
    readerSummary: SHARED_READER_SUMMARY,
    note: "阅读记录会保留，但新版本中才有的剧情位置可能失效。只有确定需要回退时再继续。",
    confirmLabel: "仍要替换",
    primaryAction: "replace",
    secondaryLabel: "仅本次打开",
    secondaryAction: "preview",
  }),
  conflict: Object.freeze({
    label: "版本标记存在冲突",
    contentSummary: "版本号相同，但内容不同",
    readerSummary: SHARED_READER_SUMMARY,
    note: "文件可能被手动修改或异常导出。阅读器不会静默覆盖；确认后才会替换正文。",
    confirmLabel: "仍要导入",
    primaryAction: "replace",
    secondaryLabel: "仅本次打开",
    secondaryAction: "preview",
  }),
  unknown: Object.freeze({
    label: "检测到已有作品",
    contentSummary: "更新为这次导入的版本",
    readerSummary: SHARED_READER_SUMMARY,
    note: "旧格式作品没有发布版本标记，无法判断新旧；确认后才会替换正文。",
    confirmLabel: "更新作品",
    primaryAction: "replace",
    secondaryLabel: "返回选择",
    secondaryAction: "cancel",
  }),
  recovery: Object.freeze({
    label: "恢复书架内容",
    contentSummary: "重新保存到这台设备",
    readerSummary: "接回原来的存档、身份、占位符与书签",
    note: "确认后会回到上次阅读位置；如果原位置已失效，会从作品开头继续。",
    confirmLabel: "恢复并继续",
    primaryAction: "replace",
    secondaryLabel: "返回选择",
    secondaryAction: "cancel",
  }),
})

export function readerWorkImportReview(incoming, existingCache, options = {}) {
  const recovering = options.hasBook === true && !existingCache
  const state = recovering
    ? "recovery"
    : options.releaseIntegrity === false
      ? "conflict"
      : classifyWorkRelease(incoming, existingCache, { verifyContent:false })
  const normalizedState = Object.hasOwn(RELEASE_REVIEWS, state) ? state : "unknown"
  return {
    state: normalizedState,
    ...RELEASE_REVIEWS[normalizedState],
    changeSummary:normalizedState === "newer"
      ? summarizeReaderWorkUpdate(existingCache, incoming)
      : [],
  }
}
