const readerAppearanceWorkbenches = new WeakMap()

function getReaderAppearanceWorkbench(runtime) {
  if (!runtime || (typeof runtime !== 'object' && typeof runtime !== 'function')) {
    throw new TypeError('Reader appearance workbench requires a runtime adapter')
  }
  var cached = readerAppearanceWorkbenches.get(runtime)
  if (cached) return cached
  const {
    PHONE_CUSTOM_DECORATION_MAX_ITEMS,
    PHONE_CUSTOM_DECORATION_SIZES,
    PHONE_DESKTOP_WIDGET_FIELDS,
    PHONE_DESKTOP_WIDGET_PRODUCTS,
    PHONE_HOME_CELL_HEIGHT,
    PHONE_HOME_CELL_WIDTH,
    PHONE_HOME_COLUMNS,
    PHONE_HOME_MAX_PAGES,
    PHONE_HOME_ROWS,
    READER_CALL_BACKGROUND_DEFAULT,
    READER_CALL_BACKGROUND_PRESETS,
    READER_CUSTOM_CSS_MAX_LENGTH,
    _work,
    addReaderLocalFont,
    applyCompiledReaderStyle,
    applyCustomFonts,
    applyPhoneCustomCss,
    applyReaderAppCustomCss,
    avatarColor,
    bindReaderAppearancePackageTransfer,
    bindReaderAppearancePager,
    bindReaderAppearanceSectionStates,
    bindReaderAppearanceUndo,
    bindReaderPhoneHomePager,
    boundedReaderSetting,
    canonicalReaderCallBackgroundDataUrl,
    clearAppearanceDraft,
    compileScopedReaderCss,
    createReaderCustomDecorationId,
    cuCollapsibleSubsection,
    cuColorRow,
    cuRow,
    cuSettingsSection,
    cuSettingsSectionEnd,
    cuSettingsSectionStart,
    cuSettingsSubsection,
    cuShapeBtn,
    cuSliderRow,
    defaultReaderAppSettings,
    defaultReaderMessageSettings,
    deleteReaderLocalFont,
    enhanceReaderAppearanceRanges,
    esc,
    escapeHtmlAttribute,
    focusReaderAppearanceSection,
    getAppSettings,
    getPhoneCustom,
    inspectReaderAppearanceImage,
    isSafeImageUrl,
    movePhoneHomeItem,
    normalizeDynamicIslandStyle,
    normalizePhoneCustom,
    normalizePhoneDesktopWidgets,
    normalizePhoneHomeLayout,
    normalizedReaderBubbleFontWeight,
    normalizedReaderBubbleSkin,
    normalizedReaderCallBackgroundSettings,
    normalizedReaderChatAppearanceSettings,
    normalizedReaderGallerySettings,
    openCuModal,
    orderedForumPosts,
    phoneCustomDecorationSizeForDimensions,
    phoneHomeDefinitions,
    phoneHomeFootprint,
    phoneHomeItemStyle,
    readAppearanceDraft,
    readReaderCallBackgroundFile,
    readReaderCustomDecorationFile,
    readerAppCssType,
    readerAppearancePackageTransferMarkup,
    readerAppearancePagerMarkup,
    readerBubbleSkinClass,
    readerBubbleSkinVariables,
    readerCallBackgroundPresentation,
    readerChatReadabilityVariables,
    readerChatTonePresentation,
    readerColorInputValue,
    readerCustomDecorationName,
    readerImageAttributes,
    readerLocalFontFamily,
    readerOwnDataRecord,
    readerPhoneCustomDefaults,
    readerPhoneData,
    readerPhoneText,
    readerPhoneWidgetPreviewData,
    readerPlainRecord,
    readerReadableTextColor,
    readerThreadDisplayName,
    renameReaderLocalFont,
    renderCustomPage,
    renderPhoneCustomDecoration,
    renderPhoneDesktopWidgets,
    renderPhonePreview,
    renderPhoneShoppingList,
    renderPhoneShoppingTabs,
    renderReaderAppearanceImageChoice,
    replaceReaderLocalFont,
    safePhoneCustomFontFamily,
    sanitizeCssColor,
    savePhoneCustom,
    setPhoneHomePageCount,
    setReaderRangeOutput,
    shouldShowPhoneTimestamp,
    shouldUseMotion,
    showReaderToast,
    validatedReaderCallBackgroundCandidate,
    verifiedReaderCallBackgroundImages,
    verifiedReaderImageLuminance,
    verifyReaderCallBackgroundDataUrl,
    writeAppearanceDraft,
  } = runtime


function phoneAppearanceFontOptions(custom) {
  var fonts = [
    { label: '默认黑体', value: "'Noto Sans SC', sans-serif" },
    { label: '系统黑体', value: "'PingFang SC', 'Microsoft YaHei', sans-serif" },
    { label: '正文宋体', value: "'Noto Serif SC', serif" },
    { label: '手写楷体', value: "'KaiTi', serif" },
    { label: '英文衬线', value: "'Georgia', serif" }
  ]
  ;(custom.customFonts || []).forEach(function(font) {
    fonts.push({ label: font.name, value: '"' + font.name + '"' })
  })
  return fonts.map(function(font) {
    return '<option value="' + escapeHtmlAttribute(font.value) + '"' + (custom.fontFamily === font.value ? ' selected' : '') + '>' + esc(font.label) + '</option>'
  }).join('')
}

function phoneAppearanceRange(label, id, min, max, step, value, unit) {
  return '<label class="phone-appearance-range" for="' + id + '"><span>' + esc(label) + '<output id="' + id + 'Val">' + value + esc(unit || '') + '</output></span><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"></label>'
}

function phoneDesktopWidgetDefinition(productId) {
  return PHONE_DESKTOP_WIDGET_PRODUCTS.find(function(entry) { return entry.id === productId })
}

function phoneDesktopWidgetPreviewMarkup(candidate, sourceItem) {
  var config = normalizePhoneDesktopWidgets(candidate)
  config.items.forEach(function(item) { item.enabled = item.productId === sourceItem.productId })
  return '<div class="phone-widget-visual" aria-hidden="true">' + renderPhoneDesktopWidgets(config, readerPhoneWidgetPreviewData(), {
    workTitle:_work && _work.title || '正在阅读',
    progressLabel:'继续上次阅读',
    progressPercent:42,
    sealedLabel:'下一段剧情待开启',
    staticPreview:true,
  }) + '</div>'
}

function phoneDesktopWidgetPhotoControls(definition, item) {
  if (!definition.photoSlots) return ''
  return '<div class="phone-widget-photo-controls" aria-label="' + escapeHtmlAttribute(definition.label) + '照片设置">' + Array.from({ length:definition.photoSlots }, function(_, index) {
    var selected = !!item.photos[index]
    return '<div class="phone-widget-photo-control" data-cu-widget-photo-product="' + item.productId + '" data-cu-widget-photo-index="' + index + '"><span><strong>照片 ' + (index + 1) + '</strong><small>' + (selected ? '已选择' : '等待添加') + '</small></span><div><button type="button" data-cu-widget-photo-upload="' + item.productId + '" data-cu-widget-photo-index="' + index + '">' + (selected ? '更换' : '选择照片') + '</button>' + (selected ? '<button type="button" class="subtle" data-cu-widget-photo-clear="' + item.productId + '" data-cu-widget-photo-index="' + index + '">清除</button>' : '') + '</div></div>'
  }).join('') + '<p>照片只保存在这台设备的桌面设置里。</p></div>'
}

function phoneCustomDecorationSizeDefinition(sizeId) {
  return PHONE_CUSTOM_DECORATION_SIZES.find(function(size) { return size.id === sizeId }) || PHONE_CUSTOM_DECORATION_SIZES[1]
}

function phoneCustomDecorationPreviewMarkup(config, decoration) {
  return '<div class="phone-widget-visual phone-custom-widget-visual" aria-hidden="true">' + renderPhoneCustomDecoration(config, decoration.id) + '</div>'
}

function phoneCustomDecorationInstalledMarkup(config, decoration) {
  var size = phoneCustomDecorationSizeDefinition(decoration.size)
  var escapedId = escapeHtmlAttribute(decoration.id)
  return '<article class="phone-widget-installed phone-custom-widget-installed" data-cu-custom-widget-installed="' + escapedId + '">' +
    '<div class="phone-widget-installed-head"><div><strong>' + esc(decoration.name) + '</strong><span>' + size.label + ' · 根据图片比例自动匹配</span></div>' +
    '<div class="phone-desktop-widget-order"><span class="phone-widget-drag-note">在左侧拖动排屏</span><button type="button" class="phone-widget-remove" data-cu-custom-widget-remove="' + escapedId + '" aria-label="删除自定义装饰' + escapeHtmlAttribute(decoration.name) + '">删除</button></div></div>' +
    phoneCustomDecorationPreviewMarkup(config, decoration) +
    '<div class="phone-custom-widget-size-row"><span>占格大小</span><div class="phone-widget-size-switch" role="group" aria-label="' + escapeHtmlAttribute(decoration.name) + '占格大小">' + PHONE_CUSTOM_DECORATION_SIZES.map(function(option) {
      return '<button type="button" data-cu-custom-widget-size="' + escapedId + '" data-cu-custom-widget-size-value="' + option.id + '" aria-pressed="' + (option.id === decoration.size ? 'true' : 'false') + '">' + option.label + '</button>'
    }).join('') + '</div></div></article>'
}

function phoneCustomWidgetUploadActionMarkup(config) {
  var count = config.customDecorations.length
  var atLimit = count >= PHONE_CUSTOM_DECORATION_MAX_ITEMS
  return '<input type="file" accept="image/png,image/jpeg,image/webp" data-cu-custom-widget-file hidden>' +
    '<span class="sr-only" id="phoneCustomWidgetUploadHint">PNG、JPEG、WebP；自动匹配 2 × 2、4 × 3、8 × 3，占格后仍可调整。</span>' +
    '<button type="button" class="phone-custom-widget-upload-action" data-cu-custom-widget-upload aria-label="' + (atLimit ? '自定义装饰已达上限' : '上传装饰') + '" aria-describedby="phoneCustomWidgetUploadHint"' + (atLimit ? ' disabled' : '') + '>' + (atLimit ? '已满' : '上传') + '</button>'
}

function phoneDesktopWidgetInstalledMarkup(config, storeOpen) {
  var installed = config.items.filter(function(item) { return item.enabled })
  var customDecorations = config.customDecorations || []
  var storeLabel = storeOpen ? '收起组件商店' : '逛组件商店'
  if (!installed.length && !customDecorations.length) {
    return '<div class="phone-widget-empty"><strong>桌面还是空的</strong><p>去组件商店看看实物效果，喜欢哪个再添加哪个。</p><button type="button" class="rs-action-btn" data-cu-widget-store-toggle aria-expanded="' + (storeOpen ? 'true' : 'false') + '">' + storeLabel + '</button></div>'
  }
  var fixedMarkup = installed.map(function(item) {
    var definition = phoneDesktopWidgetDefinition(item.productId)
    return '<article class="phone-widget-installed" data-cu-widget-installed="' + item.productId + '">' +
      '<div class="phone-widget-installed-head"><div><strong>' + esc(definition.label) + '</strong><span>' + esc(definition.hint) + '</span></div>' +
      '<div class="phone-desktop-widget-order"><span class="phone-widget-drag-note">在左侧拖动排屏</span><button type="button" class="phone-widget-remove" data-cu-widget-remove="' + item.productId + '" aria-label="从桌面移除' + escapeHtmlAttribute(definition.label) + '">移除</button></div></div>' +
      phoneDesktopWidgetPreviewMarkup(config, item) +
      phoneDesktopWidgetPhotoControls(definition, item) + phoneDesktopWidgetFieldControls(definition, config) + '</article>'
  }).join('')
  var customMarkup = customDecorations.map(function(decoration) {
    return phoneCustomDecorationInstalledMarkup(config, decoration)
  }).join('')
  return '<div class="phone-widget-installed-list">' + fixedMarkup + customMarkup + '</div><div class="phone-widget-store-footer"><button type="button" class="rs-action-btn" data-cu-widget-store-toggle aria-expanded="' + (storeOpen ? 'true' : 'false') + '">' + storeLabel + '</button></div>'
}

function phoneDesktopWidgetFieldControls(definition, config) {
  var fieldDefinitions = PHONE_DESKTOP_WIDGET_FIELDS[definition.id] || []
  if (!fieldDefinitions.length) return ''
  var values = readerPlainRecord(config.fields && config.fields[definition.id])
  return '<div class="phone-widget-field-controls" aria-label="' + escapeHtmlAttribute(definition.label + '自定义内容') + '">' + fieldDefinitions.map(function(field) {
    var type = field.type === 'datetime-local' ? 'datetime-local' : 'text'
    return '<label><span>' + esc(field.label) + '</span><input class="rd-input" type="' + type + '" maxlength="120" data-cu-widget-field-product="' + escapeHtmlAttribute(definition.id) + '" data-cu-widget-field="' + escapeHtmlAttribute(field.key) + '" value="' + escapeHtmlAttribute(values[field.key] || '') + '"' + (field.placeholder ? ' placeholder="' + escapeHtmlAttribute(field.placeholder) + '"' : '') + '></label>'
  }).join('') + '</div>'
}

function phoneDesktopWidgetCategoryLabel(category) {
  return category === 'function' ? '功能' : category === 'photo' ? '照片' : '纯装饰'
}

function phoneDesktopWidgetStoreMarkup(config, activeFilter) {
  var filter = ['function', 'photo', 'decor'].includes(activeFilter) ? activeFilter : 'all'
  var visibleProducts = PHONE_DESKTOP_WIDGET_PRODUCTS.filter(function(product) { return filter === 'all' || product.category === filter })
  var filterButtons = [
    { id:'all', label:'全部' }, { id:'function', label:'功能' }, { id:'photo', label:'照片' }, { id:'decor', label:'纯装饰' }
  ].map(function(option) {
    return '<button type="button" data-cu-widget-filter="' + option.id + '" aria-pressed="' + (filter === option.id ? 'true' : 'false') + '">' + option.label + '</button>'
  }).join('')
  return '<div class="phone-widget-store" aria-label="组件商店"><div class="phone-widget-store-intro"><div><strong>组件商店</strong><p>26 款均来自通过校稿的 V7 系列；添加后就是左侧真实效果。</p></div><span>' + PHONE_DESKTOP_WIDGET_PRODUCTS.length + ' 款</span></div>' +
    '<div class="phone-widget-store-filters" role="group" aria-label="筛选组件类型">' + filterButtons + '</div>' +
    '<div class="phone-widget-store-grid">' + visibleProducts.map(function(definition) {
      var item = config.items.find(function(entry) { return entry.productId === definition.id })
      var installed = !!item.enabled
      return '<article class="phone-widget-store-card" data-cu-widget-store-card="' + item.productId + '">' +
        phoneDesktopWidgetPreviewMarkup(config, item) +
        '<div class="phone-widget-store-card-copy"><div><strong>' + esc(definition.label) + '</strong><span>' + phoneDesktopWidgetCategoryLabel(definition.category) + '</span><p>' + esc(definition.hint) + '</p></div>' +
        '<button type="button" data-cu-widget-add="' + item.productId + '"' + (installed ? ' disabled aria-label="' + escapeHtmlAttribute(definition.label) + '已添加"' : '') + '>' + (installed ? '已添加' : '添加') + '</button></div></article>'
    }).join('') + '</div></div>'
}

function phoneDesktopWidgetWorkspaceMarkup(candidate, options) {
  var config = normalizePhoneDesktopWidgets(candidate)
  var state = options || {}
  var installedCount = config.items.filter(function(item) { return item.enabled }).length + config.customDecorations.length
  return '<div class="phone-widget-workspace-head"><div><strong>我的桌面</strong><span>' + installedCount + ' 个组件</span></div><div class="phone-widget-workspace-actions">' + phoneCustomWidgetUploadActionMarkup(config) + '</div></div>' +
    '<div class="phone-widget-installed-region">' + phoneDesktopWidgetInstalledMarkup(config, state.storeOpen) + '</div>' +
    (state.storeOpen ? phoneDesktopWidgetStoreMarkup(config, state.storeFilter) : '')
}

function openReaderCustomizePanel(triggerElement) {
  var persistedPhoneAppearance = getPhoneCustom()
  var restoredPhoneAppearanceDraft = readAppearanceDraft('phone-appearance')
  var ct = normalizePhoneCustom(Object.assign(
    {},
    persistedPhoneAppearance,
    restoredPhoneAppearanceDraft || {},
  ))
  var persistedPhoneAppearanceSignature = JSON.stringify(persistedPhoneAppearance)
  var wallpaperPresets = [
    { name:'极昼白', color:'#f5f0e8' }, { name:'水色', color:'#d0e8f5' },
    { name:'樱粉', color:'#f5e8f0' }, { name:'薄荷', color:'#e8f5f0' },
    { name:'奶油', color:'#faf5ed' }, { name:'薰衣草', color:'#ede8f5' },
    { name:'浅灰', color:'#e8e8e8' }, { name:'暗夜', color:'#1a1a2e' }
  ]
  var body = readerAppearancePagerMarkup() +
    '<div class="phone-appearance-layout appearance-workbench-pages" data-appearance-active-page="preview">'
  body += '<aside class="phone-appearance-preview-pane appearance-workbench-page" data-appearance-page="preview"><div id="phoneAppearancePreview"></div><p class="phone-appearance-status" id="cuLiveStatus" role="status" aria-live="polite">按住任意 App 或组件拖动 · 到边缘换屏</p></aside>'
  body += '<div class="phone-appearance-controls appearance-workbench-page" data-appearance-page="controls">'

  body += cuSettingsSectionStart('cuPhoneWallpaper', '壁纸与边框', true)
  body += '<div class="rs-group-heading"><small>颜色会即时映射到左侧手机</small></div>'
  body += '<div class="phone-appearance-swatches" role="group" aria-label="壁纸预设">'
  wallpaperPresets.forEach(function(preset) {
    body += '<button type="button" class="phone-appearance-swatch' + (ct.wallpaper === preset.color && ct.wallpaperType !== 'image' ? ' active' : '') + '" data-cu-color="' + preset.color + '" aria-label="' + preset.name + '" aria-pressed="' + (ct.wallpaper === preset.color && ct.wallpaperType !== 'image' ? 'true' : 'false') + '"><span style="background:' + preset.color + '"></span></button>'
  })
  body += '</div><div class="rs-color-controls phone-appearance-colors">'
  body += '<label class="rs-color-control">壁纸色<input type="color" class="rs-color-input" id="cuWallpaperColor" value="' + escapeHtmlAttribute(ct.wallpaper) + '"></label>'
  body += '<label class="rs-color-control">边框色<input type="color" class="rs-color-input" id="cuFrameColor" value="' + escapeHtmlAttribute(ct.frameColor) + '"></label>'
  body += '<label class="rs-color-control">系统标记<input type="color" class="rs-color-input" id="cuTimeColor" value="' + escapeHtmlAttribute(ct.timeColor) + '"></label></div>'
  body += '<div class="phone-appearance-image-row"><input type="url" class="rd-input" id="cuWpUrl" value="' + escapeHtmlAttribute(ct.wallpaperType === 'image' && ct.wallpaperImage && !/^data:/i.test(ct.wallpaperImage) ? ct.wallpaperImage : '') + '" placeholder="背景图片地址"><button type="button" class="rs-action-btn" id="cuApplyBg">应用</button><button type="button" class="rs-action-btn" id="cuUploadBg">本地图片</button><button type="button" class="rs-action-btn subtle" id="cuClearBg">清除</button></div>'
  body += '<p id="cuPhoneWallpaperState" class="cu-chat-background-state" aria-live="polite"></p><p class="rs-field-error" id="cuBgError" role="alert" hidden></p>' + cuSettingsSectionEnd()

  body += cuSettingsSectionStart('cuPhoneWidgets', '桌面组件', false)
  body += '<div class="rs-group-heading"><small>App 和组件都可在左侧直接拖动；拖到边缘可换屏或新建下一屏，照片仍由你逐格选择</small></div>'
  body += '<div class="phone-widget-workspace" id="cuWidgetWorkspace">' + phoneDesktopWidgetWorkspaceMarkup(ct.desktopWidgets, { storeOpen:false, storeFilter:'all' }) + '</div>'
  body += cuSettingsSectionEnd()

  body += cuSettingsSectionStart('cuPhoneDimensions', '尺寸与材质', false)
  body += '<div class="rs-group-heading"><small>边框圆角在宽屏手机框和预览中显示</small></div><div class="phone-appearance-range-grid">'
  body += phoneAppearanceRange('机身圆角', 'cuRadius', 0, 40, 1, ct.borderRadius, 'px')
  body += phoneAppearanceRange('界面字号', 'cuFontSize', 9, 20, 1, ct.fontSize, 'px')
  body += phoneAppearanceRange('图标圆角', 'cuIconRadius', 0, 27, 1, ct.iconBorderRadius, 'px')
  body += phoneAppearanceRange('材质透明度', 'cuMaterialOpacity', 20, 100, 1, ct.materialOpacity, '%')
  body += '</div>' + cuSettingsSectionEnd()

  body += cuSettingsSectionStart('cuPhoneSystem', '字体与系统组件', false)
  body += '<div class="rs-group-heading"><small>这些设置同时作用于桌面和已接入 App</small></div>'
  body += '<label class="phone-appearance-select-label" for="cuFontFamily">手机字体<select class="rd-input" id="cuFontFamily">' + phoneAppearanceFontOptions(ct) + '</select></label>'
  body += '<div class="phone-appearance-font-actions"><button type="button" class="rs-action-btn subtle" id="cuUploadFont">上传字体</button><div id="cuFontList"></div></div>'
  body += '<div class="phone-appearance-toggles">'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuIsland"' + (ct.showDynamicIsland ? ' checked' : '') + '> 灵动岛</label>'
  body += '<label class="phone-appearance-select-label" for="cuIslandStyle">灵动岛形状<select class="rd-input" id="cuIslandStyle"><option value="pill"' + (normalizeDynamicIslandStyle(ct.dynamicIslandStyle) === 'pill' ? ' selected' : '') + '>苹果圆角胶囊</option><option value="circle"' + (normalizeDynamicIslandStyle(ct.dynamicIslandStyle) === 'circle' ? ' selected' : '') + '>小圆形开孔</option></select></label>'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuLabels"' + (ct.showAppLabels ? ' checked' : '') + '> App 名称</label>'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuHome"' + (ct.showHomeIndicator ? ' checked' : '') + '> Home 指示条</label>'
  body += '<label class="rd-checkbox"><input type="checkbox" id="cuShadow"' + (ct.showIconShadow ? ' checked' : '') + '> 图标阴影</label>'
  body += '</div>' + cuSettingsSectionEnd()

  body += cuSettingsSectionStart('cuPhoneCss', '高级 CSS', false, 'rs-css-section')
  body += '<div class="rs-group-heading"><small>只作用于手机框内部，输入时即时校验</small></div>'
  body += '<textarea id="cuCustomCss" class="rs-css-editor" maxlength="' + READER_CUSTOM_CSS_MAX_LENGTH + '" spellcheck="false" aria-describedby="cuCssHint cuCssError" placeholder=".phone-profile { box-shadow: none; }">' + esc(ct.customCss || '') + '</textarea>'
  body += '<div class="rs-css-meta"><p class="rs-field-hint" id="cuCssHint">支持普通选择器与属性；外链、@ 规则、固定定位和覆盖点击会被拦截。</p><span id="cuCssCount">' + (ct.customCss || '').length + ' / ' + READER_CUSTOM_CSS_MAX_LENGTH + '</span></div>'
  body += '<p class="rs-field-error" id="cuCssError" role="alert" hidden></p><div class="rs-css-actions"><button type="button" class="rs-action-btn subtle" id="cuCssExample">填入示例</button><button type="button" class="rs-action-btn subtle" id="cuClearCss">清空 CSS</button></div>' + cuSettingsSectionEnd()
  body += cuSettingsSection('cuPhoneTransfer', '外观迁移', readerAppearancePackageTransferMarkup(), false)
  body += '<div class="phone-appearance-reset"><button type="button" class="rs-reset-btn" id="cuAppearanceReset">恢复手机外观默认值</button></div>'
  body += '</div></div>'

  var ov = openCuModal('手机外观', body, function() {
    var cssDraft = ov.querySelector('#cuCustomCss')
    var validation = compileScopedReaderCss(cssDraft ? cssDraft.value : ct.customCss, '.reader-phone-css-scope')
    if (!validation.ok) throw new Error(validation.error)
    ct.customCss = cssDraft ? cssDraft.value : ct.customCss
    ct = savePhoneCustom(ct)
    clearAppearanceDraft('phone-appearance')
    applyCustomFonts()
    applyPhoneCustomCss(ct)
    renderCustomPage()
    showReaderToast('手机外观已保存')
  }, triggerElement)
  var dialog = ov.querySelector('.cu-modal')
  dialog.classList.add('phone-appearance-workbench')
  bindReaderAppearancePager(ov)
  var previewHost = ov.querySelector('#phoneAppearancePreview')
  var saveButton = ov.querySelector('#cuModalSave')
  var cancelButton = ov.querySelector('#cuModalCancel')
  var phoneHomeViewState = { activePage:0 }
  var appearanceUndo = null
  saveButton.id = 'cuSave'
  cancelButton.id = 'cuCancel'
  bindReaderAppearancePackageTransfer(ov, {
    onImported:function() {
      clearAppearanceDraft('phone-appearance')
      ov.forceCloseReaderModal()
      renderCustomPage()
      var nextTrigger = document.querySelector('[data-reader-phone-control="appearance"]')
      openReaderCustomizePanel(nextTrigger)
    }
  })

  function renderFontList() {
    var select = ov.querySelector('#cuFontFamily')
    if (select) {
      var selected = ct.fontFamily
      select.innerHTML = phoneAppearanceFontOptions(ct)
      select.value = selected
    }
    var list = ov.querySelector('#cuFontList')
    if (!list) return
    list.innerHTML = (ct.customFonts || []).map(function(font, index) {
      return '<div class="rs-local-font-row phone-appearance-font-row"><input class="rd-input" data-cu-font-name="' + index + '" value="' + escapeHtmlAttribute(font.name) + '" aria-label="字体名称"><button type="button" class="rs-action-btn subtle" data-cu-rename-font="' + index + '">保存名称</button><button type="button" class="rs-action-btn subtle" data-cu-replace-font="' + index + '">替换文件</button><button type="button" class="rs-delete-font-btn" data-cu-del-font="' + index + '">删除</button></div>'
    }).join('')
  }

  function setSaveEnabled(enabled) {
    saveButton.disabled = !enabled
    saveButton.setAttribute('aria-disabled', enabled ? 'false' : 'true')
  }

  function renderDraftPreview() {
    var result = compileScopedReaderCss(ct.customCss || '', '.reader-phone-css-preview-scope')
    var style = result.ok && result.css
      ? '<style id="reader-phone-preview-user-css">' + result.css + '</style>'
      : '<style id="reader-phone-preview-user-css"></style>'
    previewHost.innerHTML = renderPhonePreview(ct, {
      scopeClass: 'reader-phone-css-preview-scope',
      applyGlobalCss: false,
      editable:true,
      activePage:phoneHomeViewState.activePage,
    }) + style
    bindReaderPhoneHomePager(previewHost)
    bindPhoneHomeEditor()
  }

  function setLiveMessage(message, isError) {
    var status = ov.querySelector('#cuLiveStatus')
    if (status) {
      status.textContent = message
      status.classList.toggle('is-error', !!isError)
    }
  }

  function setCssDraft(rawCss) {
    var count = ov.querySelector('#cuCssCount')
    var error = ov.querySelector('#cuCssError')
    if (count) count.textContent = rawCss.length + ' / ' + READER_CUSTOM_CSS_MAX_LENGTH
    var previewResult = compileScopedReaderCss(rawCss, '.reader-phone-css-preview-scope')
    var actualResult = compileScopedReaderCss(rawCss, '.reader-phone-css-scope')
    var result = previewResult.ok ? actualResult : previewResult
    if (!result.ok) {
      if (error) {
        error.textContent = result.error
        error.hidden = false
      }
      setSaveEnabled(false)
      setLiveMessage('CSS 暂未应用 · 请按提示修改', true)
      return false
    }
    if (error) {
      error.textContent = ''
      error.hidden = true
    }
    ct.customCss = rawCss
    setSaveEnabled(true)
    renderDraftPreview()
    setLiveMessage('按住任意 App 或组件拖动 · 保存后保留', false)
    return true
  }

  function syncPresetButtons() {
    ov.querySelectorAll('[data-cu-color]').forEach(function(button) {
      var active = ct.wallpaperType !== 'image' && button.dataset.cuColor === ct.wallpaper
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', active ? 'true' : 'false')
    })
  }

  function updateDraft(callback) {
    if (callback) callback()
    ct = normalizePhoneCustom(ct)
    renderDraftPreview()
    setLiveMessage('按住任意 App 或组件拖动 · 保存后保留', false)
  }

  function currentHomeDefinitions() {
    return phoneHomeDefinitions(ct.desktopWidgets)
  }

  function currentHomeLayout() {
    return normalizePhoneHomeLayout(ct.homeLayout, currentHomeDefinitions())
  }

  function showEditableHomePage(home, page) {
    var pageCount = Math.max(1, Number(home.dataset.phoneHomePages) || 1)
    var maxRenderedPage = Math.min(PHONE_HOME_MAX_PAGES - 1, pageCount)
    var active = Math.min(Math.max(0, page), maxRenderedPage)
    phoneHomeViewState.activePage = active
    home.dataset.phoneHomeActive = String(active)
    var track = home.querySelector('.phone-home-track')
    if (track) track.style.transform = 'translateX(-' + (active * 100) + '%)'
    home.querySelectorAll('[data-phone-home-page]').forEach(function(dot) {
      var selected = Number(dot.dataset.phoneHomePage) === active
      dot.classList.toggle('is-active', selected)
      dot.setAttribute('aria-current', selected ? 'page' : 'false')
    })
    var label = home.querySelector('.phone-home-screen-label')
    if (label) label.textContent = active >= pageCount ? '松手新建第 ' + (active + 1) + ' 屏' : '第 ' + (active + 1) + ' / ' + pageCount + ' 屏'
  }

  function moveHomeItem(key, target, message) {
    var definitions = currentHomeDefinitions()
    ct.homeLayout = movePhoneHomeItem(currentHomeLayout(), definitions, key, target)
    phoneHomeViewState.activePage = Math.min(target.page, ct.homeLayout.pageCount - 1)
    updateDraft()
    var focusTarget = previewHost.querySelector('[data-phone-home-key="' + key + '"]')
    if (focusTarget) focusTarget.focus({ preventScroll:true })
    setLiveMessage(message || '桌面位置已更新 · 可继续拖动或保存', false)
  }

  function bindPhoneHomeEditor() {
    var home = previewHost.querySelector('.phone-home.is-editable')
    if (!home) return
    home.addEventListener('click', function(event) {
      if (event.target.closest('[data-phone-home-add-page]')) {
        if (appearanceUndo) appearanceUndo.remember()
        var definitions = currentHomeDefinitions()
        var layout = currentHomeLayout()
        ct.homeLayout = setPhoneHomePageCount(layout, definitions, layout.pageCount + 1)
        phoneHomeViewState.activePage = ct.homeLayout.pageCount - 1
        updateDraft()
        setLiveMessage('已新建第 ' + ct.homeLayout.pageCount + ' 屏 · 可以把 App 或组件拖进来', false)
        return
      }
      var pageControl = event.target.closest('[data-phone-home-page], [data-phone-home-prev], [data-phone-home-next]')
      if (pageControl) phoneHomeViewState.activePage = Number(home.dataset.phoneHomeActive) || 0
    })

    home.addEventListener('keydown', function(event) {
      var item = event.target.closest('[data-phone-home-key]')
      if (!item) return
      var direction = {
        ArrowLeft:[-1, 0], ArrowRight:[1, 0], ArrowUp:[0, -1], ArrowDown:[0, 1],
      }[event.key]
      if (!direction && !['PageUp', 'PageDown'].includes(event.key)) return
      event.preventDefault()
      var key = item.dataset.phoneHomeKey
      var definitions = currentHomeDefinitions()
      var definition = definitions.find(function(entry) { return entry.key === key })
      var layout = currentHomeLayout()
      var current = layout.items.find(function(entry) { return entry.key === key })
      if (!definition || !current) return
      var footprint = phoneHomeFootprint(definition)
      var target = { page:current.page, x:current.x, y:current.y }
      if (event.key === 'PageUp') target.page -= 1
      else if (event.key === 'PageDown') target.page += 1
      else {
        target.x += direction[0]
        target.y += direction[1]
        if (target.x < 0 && target.page > 0) { target.page -= 1; target.x = PHONE_HOME_COLUMNS - footprint.width }
        if (target.x + footprint.width > PHONE_HOME_COLUMNS && target.page < PHONE_HOME_MAX_PAGES - 1) { target.page += 1; target.x = 0 }
      }
      target.page = Math.min(PHONE_HOME_MAX_PAGES - 1, Math.max(0, target.page))
      target.x = Math.min(PHONE_HOME_COLUMNS - footprint.width, Math.max(0, target.x))
      target.y = Math.min(PHONE_HOME_ROWS - footprint.height, Math.max(0, target.y))
      if (appearanceUndo) appearanceUndo.remember()
      moveHomeItem(key, target, '已移动 · 方向键微调，Page Up / Page Down 跨屏')
    })

    home.addEventListener('pointerdown', function(event) {
      if (event.button !== undefined && event.button !== 0) return
      if (event.target.closest('.phone-home-pager')) return
      var item = event.target.closest('[data-phone-home-key]')
      if (!item) return
      var key = item.dataset.phoneHomeKey
      var definitions = currentHomeDefinitions()
      var definition = definitions.find(function(entry) { return entry.key === key })
      if (!definition) return
      event.preventDefault()
      if (appearanceUndo) appearanceUndo.remember()
      var startX = event.clientX
      var startY = event.clientY
      var activePage = Number(home.dataset.phoneHomeActive) || 0
      var edgeLatch = ''
      var dragging = false
      var ghost = null
      var marker = null
      var offsetX = 0
      var offsetY = 0
      var lastTarget = null
      var itemRect = item.getBoundingClientRect()
      offsetX = startX - itemRect.left
      offsetY = startY - itemRect.top
      if (typeof item.setPointerCapture === 'function' && event.pointerId !== undefined) {
        try { item.setPointerCapture(event.pointerId) } catch (_) {}
      }

      function updateTarget(clientX, clientY) {
        var viewport = home.querySelector('.phone-home-viewport')
        var viewportRect = viewport.getBoundingClientRect()
        var pageCount = Math.max(1, Number(home.dataset.phoneHomePages) || 1)
        var atLeftEdge = clientX <= viewportRect.left + 28
        var atRightEdge = clientX >= viewportRect.right - 28
        if (!atLeftEdge && !atRightEdge) edgeLatch = ''
        if (atLeftEdge && edgeLatch !== 'left' && activePage > 0) {
          activePage -= 1
          edgeLatch = 'left'
          showEditableHomePage(home, activePage)
        } else if (atRightEdge && edgeLatch !== 'right' && activePage < Math.min(PHONE_HOME_MAX_PAGES - 1, pageCount)) {
          activePage += 1
          edgeLatch = 'right'
          showEditableHomePage(home, activePage)
        }
        var page = home.querySelector('[data-phone-home-page-index="' + activePage + '"]')
        if (!page) return
        var pageRect = page.getBoundingClientRect()
        var footprint = phoneHomeFootprint(definition)
        var renderedCellWidth = pageRect.width / PHONE_HOME_COLUMNS
        var renderedCellHeight = pageRect.height / PHONE_HOME_ROWS
        var x = Math.round((clientX - pageRect.left - offsetX) / renderedCellWidth)
        var y = Math.round((clientY - pageRect.top - offsetY) / renderedCellHeight)
        x = Math.min(PHONE_HOME_COLUMNS - footprint.width, Math.max(0, x))
        y = Math.min(PHONE_HOME_ROWS - footprint.height, Math.max(0, y))
        lastTarget = { page:activePage, x:x, y:y }
        if (marker) marker.remove()
        marker = document.createElement('span')
        marker.className = 'phone-home-drop-marker'
        marker.style.cssText = phoneHomeItemStyle(lastTarget) + 'width:' + (footprint.width * PHONE_HOME_CELL_WIDTH) + 'px;height:' + (footprint.height * PHONE_HOME_CELL_HEIGHT) + 'px'
        page.appendChild(marker)
      }

      function onMove(moveEvent) {
        if (!dragging && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 5) return
        if (!dragging) {
          dragging = true
          item.classList.add('is-dragging')
          ghost = item.cloneNode(true)
          ghost.className = 'phone-home-drag-ghost'
          ghost.removeAttribute('tabindex')
          ghost.style.width = itemRect.width + 'px'
          ghost.style.height = itemRect.height + 'px'
          document.body.appendChild(ghost)
        }
        ghost.style.left = (moveEvent.clientX - offsetX) + 'px'
        ghost.style.top = (moveEvent.clientY - offsetY) + 'px'
        updateTarget(moveEvent.clientX, moveEvent.clientY)
      }

      function finish(upEvent) {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', finish)
        window.removeEventListener('pointercancel', cancel)
        if (ghost) ghost.remove()
        if (marker) marker.remove()
        item.classList.remove('is-dragging')
        if (!dragging || !lastTarget) return
        phoneHomeViewState.suppressClick = true
        globalThis.setTimeout(function() { phoneHomeViewState.suppressClick = false }, 0)
        moveHomeItem(key, lastTarget, '已放到第 ' + (lastTarget.page + 1) + ' 屏 · 位置会随保存保留')
      }

      function cancel() {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', finish)
        window.removeEventListener('pointercancel', cancel)
        if (ghost) ghost.remove()
        if (marker) marker.remove()
        item.classList.remove('is-dragging')
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', finish)
      window.addEventListener('pointercancel', cancel)
    })
  }

  renderFontList()
  renderDraftPreview()
  if (restoredPhoneAppearanceDraft) {
    setLiveMessage('已恢复刚才未保存的调整', false)
  }
  ov.setReaderBeforeClose(function() {
    if (JSON.stringify(ct) === persistedPhoneAppearanceSignature) {
      clearAppearanceDraft('phone-appearance')
      return true
    }
    writeAppearanceDraft('phone-appearance', ct)
    showReaderToast('已暂存刚才的手机外观调整')
    return true
  })

  ov.querySelectorAll('[data-cu-color]').forEach(function(button) {
    button.onclick = function() {
      updateDraft(function() {
        ct.wallpaper = button.dataset.cuColor
        ct.wallpaperType = 'color'
        ct.wallpaperImage = null
      })
      var colorInput = ov.querySelector('#cuWallpaperColor')
      if (colorInput) colorInput.value = ct.wallpaper
      syncPresetButtons()
    }
  })
  var wallpaperColor = ov.querySelector('#cuWallpaperColor')
  if (wallpaperColor) wallpaperColor.oninput = function() {
    updateDraft(function() {
      ct.wallpaper = wallpaperColor.value
      ct.wallpaperType = 'color'
      ct.wallpaperImage = null
    })
    syncPresetButtons()
  }
  var frameColor = ov.querySelector('#cuFrameColor')
  if (frameColor) frameColor.oninput = function() {
    updateDraft(function() { ct.frameColor = frameColor.value })
  }
  var timeColor = ov.querySelector('#cuTimeColor')
  if (timeColor) timeColor.oninput = function() {
    updateDraft(function() { ct.timeColor = timeColor.value })
  }

  var widgetViewState = { storeOpen:false, storeFilter:'all' }
  var widgetWorkspace = ov.querySelector('#cuWidgetWorkspace')
  function renderWidgetWorkspace() {
    if (widgetWorkspace) widgetWorkspace.innerHTML = phoneDesktopWidgetWorkspaceMarkup(ct.desktopWidgets, widgetViewState)
  }
  function syncWidgetControls() {
    renderWidgetWorkspace()
  }
  function importCustomDecorationFile(file) {
    if (!file) return
    readReaderCustomDecorationFile(file).then(function(result) {
      if (ct.desktopWidgets.customDecorations.length >= PHONE_CUSTOM_DECORATION_MAX_ITEMS) {
        setLiveMessage('最多添加 ' + PHONE_CUSTOM_DECORATION_MAX_ITEMS + ' 个自定义装饰', true)
        return
      }
      var customId = createReaderCustomDecorationId(ct.desktopWidgets)
      var customSize = phoneCustomDecorationSizeForDimensions(result.width, result.height)
      updateDraft(function() {
        ct.desktopWidgets.customDecorations.push({
          id:customId,
          name:readerCustomDecorationName(file),
          image:result.dataUrl,
          size:customSize,
        })
        ct.desktopWidgets.enabled = true
        ct.homeLayout = normalizePhoneHomeLayout(ct.homeLayout, phoneHomeDefinitions(ct.desktopWidgets))
        var addedHomeItem = ct.homeLayout.items.find(function(entry) { return entry.key === 'custom:' + customId })
        if (addedHomeItem) phoneHomeViewState.activePage = addedHomeItem.page
      })
      renderWidgetWorkspace()
      var sizeLabel = phoneCustomDecorationSizeDefinition(customSize).label
      setLiveMessage('已按图片比例匹配为 ' + sizeLabel + ' · 左侧可继续拖动', false)
    }).catch(function(error) {
      setLiveMessage((error && error.message) || '图片读取失败，请换一张再试。', true)
    })
  }
  if (widgetWorkspace) {
    widgetWorkspace.oninput = function(event) {
      var input = event.target.closest('[data-cu-widget-field-product][data-cu-widget-field]')
      if (!input) return
      var productId = input.dataset.cuWidgetFieldProduct
      var field = input.dataset.cuWidgetField
      updateDraft(function() {
        if (!ct.desktopWidgets.fields || typeof ct.desktopWidgets.fields !== 'object') ct.desktopWidgets.fields = {}
        if (!ct.desktopWidgets.fields[productId]) ct.desktopWidgets.fields[productId] = {}
        ct.desktopWidgets.fields[productId][field] = input.value
      })
      setLiveMessage('组件内容已更新 · 只保存在本机', false)
    }
    widgetWorkspace.onchange = function(event) {
      var customFileInput = event.target.closest('[data-cu-custom-widget-file]')
      if (!customFileInput) return
      importCustomDecorationFile(customFileInput.files && customFileInput.files[0])
    }
    widgetWorkspace.onclick = function(event) {
      var storeToggle = event.target.closest('[data-cu-widget-store-toggle]')
      if (storeToggle) {
        widgetViewState.storeOpen = !widgetViewState.storeOpen
        renderWidgetWorkspace()
        setLiveMessage(widgetViewState.storeOpen ? '组件商店已打开 · 选择喜欢的样式添加' : '已返回我的桌面', false)
        return
      }

      var filterButton = event.target.closest('[data-cu-widget-filter]')
      if (filterButton) {
        widgetViewState.storeFilter = filterButton.dataset.cuWidgetFilter
        renderWidgetWorkspace()
        return
      }

      var customUploadButton = event.target.closest('[data-cu-custom-widget-upload]')
      if (customUploadButton && !customUploadButton.disabled) {
        var customInput = widgetWorkspace.querySelector('[data-cu-custom-widget-file]')
        if (!customInput) return
        customInput.value = ''
        customInput.click()
        return
      }

      var customSizeButton = event.target.closest('[data-cu-custom-widget-size][data-cu-custom-widget-size-value]')
      if (customSizeButton) {
        var customSizeId = customSizeButton.dataset.cuCustomWidgetSize
        var nextCustomSize = customSizeButton.dataset.cuCustomWidgetSizeValue
        if (!PHONE_CUSTOM_DECORATION_SIZES.some(function(size) { return size.id === nextCustomSize })) return
        updateDraft(function() {
          var decoration = ct.desktopWidgets.customDecorations.find(function(item) { return item.id === customSizeId })
          if (!decoration) return
          decoration.size = nextCustomSize
          ct.homeLayout = normalizePhoneHomeLayout(ct.homeLayout, phoneHomeDefinitions(ct.desktopWidgets))
        })
        renderWidgetWorkspace()
        setLiveMessage('占格已改为 ' + phoneCustomDecorationSizeDefinition(nextCustomSize).label + ' · 位置已自动避让', false)
        return
      }

      var customRemoveButton = event.target.closest('[data-cu-custom-widget-remove]')
      if (customRemoveButton) {
        var customRemoveId = customRemoveButton.dataset.cuCustomWidgetRemove
        updateDraft(function() {
          ct.desktopWidgets.customDecorations = ct.desktopWidgets.customDecorations.filter(function(item) { return item.id !== customRemoveId })
          ct.homeLayout = normalizePhoneHomeLayout(ct.homeLayout, phoneHomeDefinitions(ct.desktopWidgets))
        })
        renderWidgetWorkspace()
        setLiveMessage('自定义装饰及其本机图片已删除', false)
        return
      }

      var addButton = event.target.closest('[data-cu-widget-add]')
      if (addButton && !addButton.disabled) {
        var addProductId = addButton.dataset.cuWidgetAdd
        updateDraft(function() {
          var item = ct.desktopWidgets.items.find(function(entry) { return entry.productId === addProductId })
          if (!item) return
          item.enabled = true
          ct.desktopWidgets.enabled = true
          var items = ct.desktopWidgets.items.filter(function(entry) { return entry.productId !== addProductId })
          var lastInstalled = -1
          items.forEach(function(entry, index) { if (entry.enabled) lastInstalled = index })
          items.splice(lastInstalled + 1, 0, item)
          ct.desktopWidgets.items = items
          ct.homeLayout = normalizePhoneHomeLayout(ct.homeLayout, phoneHomeDefinitions(ct.desktopWidgets))
          var addedHomeItem = ct.homeLayout.items.find(function(entry) { return entry.key === 'widget:' + addProductId })
          if (addedHomeItem) phoneHomeViewState.activePage = addedHomeItem.page
        })
        renderWidgetWorkspace()
        var addedDefinition = phoneDesktopWidgetDefinition(addProductId)
        setLiveMessage('已添加“' + addedDefinition.label + '” · 左侧正在显示真实效果', false)
        return
      }

      var removeButton = event.target.closest('[data-cu-widget-remove]')
      if (removeButton) {
        var removeProductId = removeButton.dataset.cuWidgetRemove
        updateDraft(function() {
          var item = ct.desktopWidgets.items.find(function(entry) { return entry.productId === removeProductId })
          if (item) item.enabled = false
        })
        renderWidgetWorkspace()
        setLiveMessage('组件已从桌面移除', false)
        return
      }

      var clearPhotoButton = event.target.closest('[data-cu-widget-photo-clear]')
      if (clearPhotoButton) {
        var clearProductId = clearPhotoButton.dataset.cuWidgetPhotoClear
        var clearPhotoIndex = Number(clearPhotoButton.dataset.cuWidgetPhotoIndex)
        updateDraft(function() {
          var item = ct.desktopWidgets.items.find(function(entry) { return entry.productId === clearProductId })
          if (item && clearPhotoIndex >= 0 && clearPhotoIndex < item.photos.length) item.photos[clearPhotoIndex] = null
        })
        renderWidgetWorkspace()
        setLiveMessage('照片已从这个组件中清除', false)
        return
      }

      var uploadPhotoButton = event.target.closest('[data-cu-widget-photo-upload]')
      if (uploadPhotoButton) {
        var uploadProductId = uploadPhotoButton.dataset.cuWidgetPhotoUpload
        var uploadPhotoIndex = Number(uploadPhotoButton.dataset.cuWidgetPhotoIndex)
        var photoInput = document.createElement('input')
        photoInput.type = 'file'
        photoInput.accept = 'image/png,image/jpeg,image/webp'
        photoInput.onchange = function() {
          var file = photoInput.files && photoInput.files[0]
          if (!file) return
          readReaderCallBackgroundFile(file).then(function(dataUrl) {
            updateDraft(function() {
              var item = ct.desktopWidgets.items.find(function(entry) { return entry.productId === uploadProductId })
              if (item && uploadPhotoIndex >= 0 && uploadPhotoIndex < item.photos.length) item.photos[uploadPhotoIndex] = dataUrl
            })
            renderWidgetWorkspace()
            setLiveMessage('照片已添加 · 左侧组件同步更新', false)
          }).catch(function(error) {
            setLiveMessage((error && error.message) || '图片读取失败，请换一张再试。', true)
          })
        }
        photoInput.click()
        return
      }

    }
  }

  function bindAppearanceRange(id, key, unit) {
    var input = ov.querySelector('#' + id)
    var output = ov.querySelector('#' + id + 'Val')
    if (!input) return
    input.oninput = function() {
      updateDraft(function() { ct[key] = Number(input.value) })
      if (output) setReaderRangeOutput(output, input.value + (unit || ''))
    }
  }
  bindAppearanceRange('cuRadius', 'borderRadius', 'px')
  bindAppearanceRange('cuFontSize', 'fontSize', 'px')
  bindAppearanceRange('cuIconRadius', 'iconBorderRadius', 'px')
  bindAppearanceRange('cuMaterialOpacity', 'materialOpacity', '%')

  var fontSelect = ov.querySelector('#cuFontFamily')
  if (fontSelect) fontSelect.onchange = function() {
    updateDraft(function() { ct.fontFamily = fontSelect.value })
  }
  var islandStyleSelect = ov.querySelector('#cuIslandStyle')
  if (islandStyleSelect) islandStyleSelect.onchange = function() {
    updateDraft(function() { ct.dynamicIslandStyle = normalizeDynamicIslandStyle(islandStyleSelect.value) })
  }
  ;[
    ['cuIsland', 'showDynamicIsland'],
    ['cuLabels', 'showAppLabels'],
    ['cuHome', 'showHomeIndicator'],
    ['cuShadow', 'showIconShadow']
  ].forEach(function(binding) {
    var input = ov.querySelector('#' + binding[0])
    if (input) input.onchange = function() {
      updateDraft(function() { ct[binding[1]] = input.checked })
    }
  })

  function setBackgroundError(message) {
    var error = ov.querySelector('#cuBgError')
    if (!error) return
    error.textContent = message || ''
    error.hidden = !message
  }
  function applyWallpaperImage(value) {
    var raw = String(value || '').trim()
    if (raw && !isSafeImageUrl(raw)) {
      setBackgroundError('请选择本地图片，或输入安全的 HTTPS / 相对图片地址。')
      return false
    }
    setBackgroundError('')
    updateDraft(function() {
      ct.wallpaperImage = raw || null
      ct.wallpaperType = raw ? 'image' : 'color'
    })
    syncPresetButtons()
    return true
  }
  var backgroundUrl = ov.querySelector('#cuWpUrl')
  ov.querySelector('#cuApplyBg').onclick = function() {
    applyWallpaperImage(backgroundUrl && backgroundUrl.value)
  }
  ov.querySelector('#cuClearBg').onclick = function() {
    if (backgroundUrl) backgroundUrl.value = ''
    applyWallpaperImage('')
  }
  ov.querySelector('#cuUploadBg').onclick = function() {
    var input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/webp'
    input.onchange = function() {
      var file = input.files && input.files[0]
      if (!file) return
      readReaderCallBackgroundFile(file).then(function(dataUrl) {
        if (backgroundUrl) backgroundUrl.value = ''
        applyWallpaperImage(dataUrl)
        return inspectReaderAppearanceImage(dataUrl, file.size)
      }).then(function(meta) {
        if (!meta || !ov.isConnected) return
        renderReaderAppearanceImageChoice(ov.querySelector('#cuPhoneWallpaperState'), meta, function(nextUrl, nextMeta) {
          applyWallpaperImage(nextUrl)
          renderReaderAppearanceImageChoice(ov.querySelector('#cuPhoneWallpaperState'), nextMeta, null)
          var section = ov.querySelector('#cuPhoneWallpaper')
          if (section) section.dataset.appearanceManualVersion = String(Number(section.dataset.appearanceManualVersion || 0) + 1)
          if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
        })
      }).catch(function(error) {
        setBackgroundError((error && error.message) || '图片读取失败，请换一张再试。')
      })
    }
    input.click()
  }

  var cssInput = ov.querySelector('#cuCustomCss')
  if (cssInput) cssInput.oninput = function() { setCssDraft(cssInput.value) }
  ov.querySelector('#cuCssExample').onclick = function() {
    cssInput.value = ':scope { --phone-system-accent: #c58fa0; }\n.phone-profile { box-shadow: none; }\n.phone-icon-label { letter-spacing: .04em; }'
    setCssDraft(cssInput.value)
    cssInput.focus()
  }
  ov.querySelector('#cuClearCss').onclick = function() {
    cssInput.value = ''
    setCssDraft('')
    cssInput.focus()
  }

  ov.querySelector('#cuUploadFont').onclick = function() {
    var input = document.createElement('input')
    input.type = 'file'
    input.accept = '.ttf,.otf,.woff,.woff2'
    input.onchange = function() {
      var file = input.files && input.files[0]
      if (!file) return
      var name = prompt('字体名称:', file.name.replace(/\.[^.]+$/, '') || '自定义字体')
      if (!name) return
      var reader = new FileReader()
      reader.onload = function() {
        try {
          ct.customFonts = addReaderLocalFont(ct.customFonts, { name:name, data:reader.result })
          ct.fontFamily = readerLocalFontFamily(ct.customFonts[ct.customFonts.length - 1].name)
          renderFontList()
          renderDraftPreview()
        } catch (error) {
          showReaderToast(error.message || '字体保存失败')
        }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }
  var fontList = ov.querySelector('#cuFontList')
  if (fontList) fontList.onclick = function(event) {
    var button = event.target.closest('[data-cu-del-font],[data-cu-rename-font],[data-cu-replace-font]')
    if (!button) return
    var rawIndex = button.dataset.cuDelFont ?? button.dataset.cuRenameFont ?? button.dataset.cuReplaceFont
    var index = parseInt(rawIndex, 10)
    var current = ct.customFonts && ct.customFonts[index]
    if (button.dataset.cuRenameFont !== undefined) {
      var nameInput = fontList.querySelector('[data-cu-font-name="' + index + '"]')
      try {
        ct.customFonts = renameReaderLocalFont(ct.customFonts, index, nameInput && nameInput.value)
        if (current && ct.fontFamily === readerLocalFontFamily(current.name)) {
          ct.fontFamily = readerLocalFontFamily(ct.customFonts[index].name)
        }
        renderFontList()
        renderDraftPreview()
      } catch (error) {
        showReaderToast(error.message || '字体改名失败')
      }
      return
    }
    if (button.dataset.cuReplaceFont !== undefined) {
      var replacementInput = document.createElement('input')
      replacementInput.type = 'file'
      replacementInput.accept = '.ttf,.otf,.woff,.woff2'
      replacementInput.onchange = function() {
        var replacementFile = replacementInput.files && replacementInput.files[0]
        if (!replacementFile) return
        var replacementReader = new FileReader()
        replacementReader.onload = function() {
          try {
            ct.customFonts = replaceReaderLocalFont(ct.customFonts, index, replacementReader.result)
            renderDraftPreview()
          } catch (error) {
            showReaderToast(error.message || '字体替换失败')
          }
        }
        replacementReader.readAsDataURL(replacementFile)
      }
      replacementInput.click()
      return
    }
    ct.customFonts = deleteReaderLocalFont(ct.customFonts, index)
    if (current && ct.fontFamily === readerLocalFontFamily(current.name)) ct.fontFamily = readerPhoneCustomDefaults().fontFamily
    renderFontList()
    renderDraftPreview()
  }

  ov.querySelector('#cuAppearanceReset').onclick = function() {
    var defaults = readerPhoneCustomDefaults()
    ct = normalizePhoneCustom(Object.assign({}, defaults, {
      readerId: ct.readerId,
      readerAvatar: ct.readerAvatar,
      readerSignature: ct.readerSignature,
      topBgImage: ct.topBgImage,
      appBgs: ct.appBgs,
      appSettings: ct.appSettings,
      customFonts: ct.customFonts,
      customIcons: ct.customIcons
    }))
    ov.querySelector('#cuWallpaperColor').value = ct.wallpaper
    ov.querySelector('#cuFrameColor').value = ct.frameColor
    ov.querySelector('#cuTimeColor').value = ct.timeColor
    ov.querySelector('#cuWpUrl').value = ''
    ;[
      ['cuRadius', ct.borderRadius, 'px'],
      ['cuFontSize', ct.fontSize, 'px'],
      ['cuIconRadius', ct.iconBorderRadius, 'px'],
      ['cuMaterialOpacity', ct.materialOpacity, '%']
    ].forEach(function(item) {
      ov.querySelector('#' + item[0]).value = item[1]
      setReaderRangeOutput(ov.querySelector('#' + item[0] + 'Val'), item[1] + item[2])
    })
    ov.querySelector('#cuIsland').checked = ct.showDynamicIsland
    ov.querySelector('#cuIslandStyle').value = normalizeDynamicIslandStyle(ct.dynamicIslandStyle)
    ov.querySelector('#cuLabels').checked = ct.showAppLabels
    ov.querySelector('#cuHome').checked = ct.showHomeIndicator
    ov.querySelector('#cuShadow').checked = ct.showIconShadow
    ov.querySelector('#cuCustomCss').value = ''
    syncWidgetControls()
    renderFontList()
    syncPresetButtons()
    setCssDraft('')
  }

  function applyPhoneAppearanceSnapshot(snapshot) {
    ct = normalizePhoneCustom(snapshot)
    ov.querySelector('#cuWallpaperColor').value = ct.wallpaper
    ov.querySelector('#cuFrameColor').value = ct.frameColor
    ov.querySelector('#cuTimeColor').value = ct.timeColor
    ov.querySelector('#cuWpUrl').value = ct.wallpaperType === 'image' && ct.wallpaperImage && !/^data:/i.test(ct.wallpaperImage) ? ct.wallpaperImage : ''
    ;[
      ['cuRadius', ct.borderRadius, 'px'],
      ['cuFontSize', ct.fontSize, 'px'],
      ['cuIconRadius', ct.iconBorderRadius, 'px'],
      ['cuMaterialOpacity', ct.materialOpacity, '%']
    ].forEach(function(item) {
      var range = ov.querySelector('#' + item[0])
      if (range) range.value = item[1]
      setReaderRangeOutput(ov.querySelector('#' + item[0] + 'Val'), item[1] + item[2])
    })
    ov.querySelector('#cuIsland').checked = ct.showDynamicIsland
    ov.querySelector('#cuIslandStyle').value = normalizeDynamicIslandStyle(ct.dynamicIslandStyle)
    ov.querySelector('#cuLabels').checked = ct.showAppLabels
    ov.querySelector('#cuHome').checked = ct.showHomeIndicator
    ov.querySelector('#cuShadow').checked = ct.showIconShadow
    ov.querySelector('#cuCustomCss').value = ct.customCss || ''
    syncWidgetControls()
    renderFontList()
    syncPresetButtons()
    setCssDraft(ct.customCss || '')
  }

  enhanceReaderAppearanceRanges(ov)
  bindReaderAppearanceSectionStates(ov)
  appearanceUndo = bindReaderAppearanceUndo(ov, {
    capture:function() { return JSON.parse(JSON.stringify(ct)) },
    restore:applyPhoneAppearanceSnapshot
  })
  previewHost.addEventListener('click', function(event) {
    if (phoneHomeViewState.suppressClick) return
    var sectionId = event.target.closest('.phone-story-widget') ? 'cuPhoneWidgets'
      : (event.target.closest('.phone-profile') ? 'cuPhoneWallpaper'
      : (event.target.closest('.phone-icon-body, .phone-icon-label') ? 'cuPhoneDimensions'
        : (event.target.closest('.dynamic-island, .phone-home-indicator') ? 'cuPhoneSystem' : 'cuPhoneWallpaper')))
    focusReaderAppearanceSection(ov, sectionId, null, event.detail === 0)
  })
}

function openReaderProfilePanel(triggerElement) {
  var persistedProfileAppearance = getPhoneCustom()
  var restoredProfileAppearanceDraft = readAppearanceDraft('profile-appearance')
  var ct = normalizePhoneCustom(Object.assign(
    {},
    persistedProfileAppearance,
    restoredProfileAppearanceDraft || {},
  ))
  var persistedProfileAppearanceSignature = JSON.stringify(persistedProfileAppearance)
  var identitySettings = cuRow('昵称',
    '<input class="rd-input" id="rpName" value="' + escapeHtmlAttribute(ct.readerId || '') + '" placeholder="默认使用作品昵称">') +
    cuRow('签名', '<input class="rd-input" id="rpSignature" maxlength="120" value="' + escapeHtmlAttribute(ct.readerSignature || '') + '" placeholder="留空则不显示">')
  var avatarSettings = cuRow('头像',
    '<div class="rd-input-row"><input class="rd-input" id="rpAvatarUrl" value="' + escapeHtmlAttribute(ct.readerAvatar || '') + '" placeholder="输入头像 URL"><button type="button" class="rs-action-btn subtle" id="rpUploadAv">上传</button></div>') +
    '<div class="rd-preview-img" id="rpAvatarPreview"' + (ct.readerAvatar ? '' : ' hidden') + '><img id="rpAvatarPreviewImage" src="' + escapeHtmlAttribute(ct.readerAvatar || '') + '" alt="" style="border-radius:50%"><button type="button" class="rs-action-btn subtle" id="rpClearAv">清除</button></div>'
  var coverSettings = cuRow('顶部背景图',
    '<div class="rd-input-row"><input class="rd-input" id="rpTopBgUrl" value="' + escapeHtmlAttribute(ct.topBgImage || '') + '" placeholder="输入图片 URL"><button type="button" class="rs-action-btn subtle" id="rpUploadTop">上传</button></div>') +
    '<div class="rd-preview-img" id="rpTopBgPreview"' + (ct.topBgImage ? '' : ' hidden') + '><img id="rpTopBgPreviewImage" src="' + escapeHtmlAttribute(ct.topBgImage || '') + '" alt=""><button type="button" class="rs-action-btn subtle" id="rpClearTop">清除</button></div>'

  var controls = cuSettingsSection('cuProfileIdentity', '基本信息', identitySettings, true) +
    cuSettingsSection('cuProfileAvatar', '头像', avatarSettings, false) +
    cuSettingsSection('cuProfileCover', '顶部背景', coverSettings, false)
  var body = readerAppearancePagerMarkup() +
    '<div class="profile-appearance-layout appearance-workbench-pages" data-appearance-active-page="preview">' +
    '<aside class="profile-appearance-preview-pane appearance-workbench-page" data-appearance-page="preview"><div id="profileAppearancePreview"></div><p class="phone-appearance-status">实时预览 · 保存后应用</p></aside>' +
    '<div class="profile-appearance-controls appearance-workbench-page" data-appearance-page="controls">' + controls + '</div></div>'

  var ov = openCuModal('个人信息', body, function(modal) {
    var nameInput = modal.querySelector('#rpName')
    var signatureInput = modal.querySelector('#rpSignature')
    var avatarInput = modal.querySelector('#rpAvatarUrl')
    var coverInput = modal.querySelector('#rpTopBgUrl')
    ct.readerId = nameInput && nameInput.value.trim() ? nameInput.value.trim() : ct.readerId
    ct.readerSignature = signatureInput ? signatureInput.value.trim() : ''
    ct.readerAvatar = avatarInput && avatarInput.value.trim() ? avatarInput.value.trim() : null
    ct.topBgImage = coverInput && coverInput.value.trim() ? coverInput.value.trim() : null
    savePhoneCustom(ct)
    clearAppearanceDraft('profile-appearance')
    renderCustomPage()
    showReaderToast('个人信息已保存')
  }, triggerElement)
  var dialog = ov.querySelector('.cu-modal')
  dialog.classList.add('profile-appearance-workbench')
  var saveButton = ov.querySelector('#cuModalSave')
  var cancelButton = ov.querySelector('#cuModalCancel')
  var closeButton = ov.querySelector('.cu-modal-close')
  if (saveButton) saveButton.id = 'rpSave'
  if (cancelButton) cancelButton.id = 'rpCancel'
  if (closeButton) closeButton.id = 'rpCloseX'
  bindReaderAppearancePager(ov)

  function currentProfileDraft() {
    var draft = readerOwnDataRecord(ct)
    var nameInput = ov.querySelector('#rpName')
    var signatureInput = ov.querySelector('#rpSignature')
    var avatarInput = ov.querySelector('#rpAvatarUrl')
    var coverInput = ov.querySelector('#rpTopBgUrl')
    draft.readerId = nameInput && nameInput.value.trim() ? nameInput.value.trim() : ct.readerId
    draft.readerSignature = signatureInput ? signatureInput.value.trim() : ct.readerSignature
    draft.readerAvatar = avatarInput && avatarInput.value.trim() ? avatarInput.value.trim() : null
    draft.topBgImage = coverInput && coverInput.value.trim() ? coverInput.value.trim() : null
    return draft
  }

  function renderProfilePreview() {
    var host = ov.querySelector('#profileAppearancePreview')
    if (!host) return
    var draft = currentProfileDraft()
    var profileLayout = normalizePhoneHomeLayout(draft.homeLayout, phoneHomeDefinitions(draft.desktopWidgets))
    var profilePage = profileLayout.items.find(function(item) { return item.key === 'profile:identity' })?.page || 0
    host.innerHTML = renderPhonePreview(draft, {
      scopeClass:'reader-profile-preview-scope',
      applyGlobalCss:false,
      activePage:profilePage,
    })
    bindReaderPhoneHomePager(host)
  }

  ;['#rpName', '#rpSignature', '#rpAvatarUrl', '#rpTopBgUrl'].forEach(function(selector) {
    var input = ov.querySelector(selector)
    if (input) input.addEventListener('input', renderProfilePreview)
  })
  function setProfileImageDraft(inputId, previewId, imageId, value) {
    var nextValue = String(value || '')
    var input = ov.querySelector(inputId)
    var preview = ov.querySelector(previewId)
    var image = ov.querySelector(imageId)
    if (input) input.value = nextValue
    if (image) image.src = nextValue
    if (preview) preview.hidden = !nextValue
    renderProfilePreview()
  }
  // Upload buttons
  function bindUpload(btnId, setter) {
    var btn = ov.querySelector(btnId); if (!btn) return
    btn.onclick = function() {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
      inp.onchange = function() { var file = inp.files[0]; if (!file) return; var r = new FileReader(); r.onload = function() { setter(r.result) }; r.readAsDataURL(file) }; inp.click()
    }
  }
  bindUpload('#rpUploadAv', function(v) { setProfileImageDraft('#rpAvatarUrl', '#rpAvatarPreview', '#rpAvatarPreviewImage', v) })
  bindUpload('#rpUploadTop', function(v) { setProfileImageDraft('#rpTopBgUrl', '#rpTopBgPreview', '#rpTopBgPreviewImage', v) })
  var clearAv = ov.querySelector('#rpClearAv'); if (clearAv) clearAv.onclick = function() { setProfileImageDraft('#rpAvatarUrl', '#rpAvatarPreview', '#rpAvatarPreviewImage', null) }
  var clearTop = ov.querySelector('#rpClearTop'); if (clearTop) clearTop.onclick = function() { setProfileImageDraft('#rpTopBgUrl', '#rpTopBgPreview', '#rpTopBgPreviewImage', null) }
  renderProfilePreview()
  if (restoredProfileAppearanceDraft) {
    var restoredStatus = ov.querySelector('.phone-appearance-status')
    if (restoredStatus) restoredStatus.textContent = '已恢复刚才未保存的调整'
  }
  ov.setReaderBeforeClose(function() {
    var draft = currentProfileDraft()
    if (JSON.stringify(draft) === persistedProfileAppearanceSignature) {
      clearAppearanceDraft('profile-appearance')
      return true
    }
    writeAppearanceDraft('profile-appearance', draft)
    showReaderToast('已暂存刚才的个人信息调整')
    return true
  })
  bindReaderAppearanceSectionStates(ov)
  bindReaderAppearanceUndo(ov, {
    capture:currentProfileDraft,
    restore:function(snapshot) {
      var name = ov.querySelector('#rpName')
      if (name) name.value = snapshot.readerId || ''
      var signature = ov.querySelector('#rpSignature')
      if (signature) signature.value = snapshot.readerSignature || ''
      setProfileImageDraft('#rpAvatarUrl', '#rpAvatarPreview', '#rpAvatarPreviewImage', snapshot.readerAvatar)
      setProfileImageDraft('#rpTopBgUrl', '#rpTopBgPreview', '#rpTopBgPreviewImage', snapshot.topBgImage)
    }
  })
  var profilePreview = ov.querySelector('#profileAppearancePreview')
  if (profilePreview) profilePreview.addEventListener('click', function(event) {
    var sectionId = event.target.closest('.phone-avatar') ? 'cuProfileAvatar'
      : (event.target.closest('.phone-profile') ? 'cuProfileCover' : 'cuProfileIdentity')
    focusReaderAppearanceSection(ov, sectionId, 'input', event.detail === 0)
  })
}

// ====== Preview Panel ======
function renderCuPreviewLegacy(type, s) {
  var h = '<div class="cu-preview" id="cuPreview">'
  h += '<div class="cu-preview-label">预览</div>'

  if (type === 'messages') {
    var avRadius = s.avatarShape === 'circle' ? '50%' : (s.avatarShape === 'rounded' ? '8px' : '2px')
    var avSz = (s.avatarSize || 36) + 'px'
    var selfBg = s.selfBubbleBg || '#555'
    var selfText = s.selfBubbleText || '#fff'
    var selfRad = (s.selfBubbleRadius || 8) + 'px'
    var otherBg = s.otherBubbleBg || '#fff'
    var otherText = s.otherBubbleText || '#333'
    var otherRad = (s.otherBubbleRadius || 8) + 'px'
    var fs = (s.bubbleFontSize || 13) + 'px'
    var tc = s.timeColor || '#b0b8c4'
    h += '<div class="cu-preview-msg" style="border:1px solid #e0e0e0;overflow:hidden">'
    h += '<div style="background:#fff;padding:3px 8px;font-size:.6rem;color:#888;border-bottom:1px solid #eee;display:flex;align-items:center"><span style="flex:1">← 消息</span></div>'
    h += '<div style="display:flex;gap:6px;padding:5px 8px;border-bottom:1px solid #eee;align-items:center">'
    h += '<div style="width:' + avSz + ';height:' + avSz + ';border-radius:' + avRadius + ';background:#6366f1;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.55rem;font-weight:600">A</div>'
    h += '<div style="flex:1;min-width:0"><div style="font-size:.6rem;font-weight:500;color:#555">示例联系人</div></div>'
    h += '</div>'
    h += '<div style="display:flex;gap:6px;padding:5px 8px;align-items:center">'
    h += '<div style="width:' + avSz + ';height:' + avSz + ';border-radius:' + avRadius + ';background:#10b981;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.55rem;font-weight:600">群</div>'
    h += '<div style="flex:1;min-width:0"><div style="font-size:.6rem;font-weight:500;color:#555">示例群聊</div></div>'
    h += '</div>'
    h += '<div style="background:' + (s.chatBg || '#f0f0f0') + ';padding:4px 8px">'
    h += '<div style="text-align:center;font-size:.48rem;color:' + tc + ';padding:2px 0">12:30</div>'
    h += '<div style="display:flex;gap:6px;margin-bottom:4px;align-items:flex-start">'
    h += '<div style="width:24px;height:24px;border-radius:' + avRadius + ';background:#6366f1;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.5rem">A</div>'
    h += '<div style="max-width:65%;padding:4px 7px;font-size:' + fs + ';line-height:1.4;background:' + otherBg + ';color:' + otherText + ';border-radius:' + otherRad + ' ' + otherRad + ' ' + otherRad + ' 2px;word-break:break-word">你好！</div>'
    h += '</div>'
    h += '<div style="display:flex;gap:6px;align-items:flex-start;flex-direction:row-reverse">'
    h += '<div style="max-width:65%;padding:4px 7px;font-size:' + fs + ';line-height:1.4;background:' + selfBg + ';color:' + selfText + ';border-radius:' + selfRad + ' ' + selfRad + ' 2px ' + selfRad + ';word-break:break-word">周末见！</div>'
    h += '</div>'
    h += '</div></div>'
  } else if (type === 'forum') {
    var avRadius = s.avatarShape === 'circle' ? '50%' : (s.avatarShape === 'rounded' ? '8px' : '2px')
    h += '<div class="cu-preview-forum" style="border:1px solid #e0e0e0;overflow:hidden">'
    h += '<div style="background:#fff;padding:3px 8px;font-size:.6rem;color:#888;border-bottom:1px solid #eee;display:flex;align-items:center"><span style="flex:1">← 论坛</span></div>'
    h += '<div style="padding:6px 8px;background:' + (s.cardBg || '#fff') + '">'
    h += '<div style="display:flex;gap:6px;padding:4px 0;border-bottom:1px solid #eee;align-items:center">'
    h += '<div style="width:28px;height:28px;border-radius:' + avRadius + ';background:#8b5cf6;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.5rem;font-weight:600">B</div>'
    h += '<div style="flex:1;min-width:0"><div style="font-size:' + (s.titleSize || 13) + 'px;font-weight:' + (s.titleWeight || '500') + ';color:' + (s.titleColor || '#555') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">示例帖子标题</div><div style="font-size:.45rem;color:' + (s.timeColor || '#999') + '">用户A · 12:30</div></div>'
    h += '</div>'
    h += '<div style="display:flex;gap:6px;padding:4px 0;align-items:center">'
    h += '<div style="width:28px;height:28px;border-radius:' + avRadius + ';background:#d946ef;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.5rem;font-weight:600">C</div>'
    h += '<div style="flex:1;min-width:0"><div style="font-size:' + (s.titleSize || 13) + 'px;font-weight:' + (s.titleWeight || '500') + ';color:' + (s.titleColor || '#555') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">另一个话题</div><div style="font-size:.45rem;color:' + (s.timeColor || '#999') + '">用户B · 11:20</div></div>'
    h += '</div>'
    h += '</div></div>'
  } else if (type === 'memo') {
    var memoBg = s.cardBg || '#fff'
    var memoBorder = s.cardBorder || '#eee'
    var memoRad = (s.cardRadius || 4) + 'px'
    if (s.cardStyle === 'sticky') { memoBg = '#fef9e7'; memoBorder = '#e8d5a0' }
    if (s.cardStyle === 'vintage') { memoBg = '#f5e6c8'; memoBorder = '#d4c4a0'; memoRad = '2px' }
    h += '<div class="cu-preview-memo" style="border:1px solid #e0e0e0;overflow:hidden">'
    h += '<div style="background:#fff;padding:3px 8px;font-size:.6rem;color:#888;border-bottom:1px solid #eee;display:flex;align-items:center"><span style="flex:1">← 备忘录</span></div>'
    h += '<div style="padding:6px 8px">'
    h += '<div style="padding:6px 8px;margin-bottom:4px;background:' + memoBg + ';border:1px solid ' + memoBorder + ';border-radius:' + memoRad + ';font-size:' + (s.fontSize || 12) + 'px;color:' + (s.textColor || '#333') + ';line-height:' + (s.lineHeight || 1.6) + '">记得买牛奶和面包</div>'
    h += '<div style="padding:6px 8px;background:' + memoBg + ';border:1px solid ' + memoBorder + ';border-radius:' + memoRad + ';font-size:' + (s.fontSize || 12) + 'px;color:' + (s.textColor || '#333') + ';line-height:' + (s.lineHeight || 1.6) + '">周三下午三点小组会议</div>'
    h += '</div></div>'
  } else if (type === 'gallery') {
    var gallerySettings = normalizedReaderGallerySettings(s)
    var cols = gallerySettings.columns
    var imgRad = gallerySettings.imageRadius + 'px'
    var gap = gallerySettings.gap + 'px'
    var swatches = ['#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f59e0b', '#10b981']
    h += '<div class="cu-preview-gallery" style="border:1px solid #e0e0e0;overflow:hidden">'
    h += '<div style="background:#fff;padding:3px 8px;font-size:.6rem;color:#888;border-bottom:1px solid #eee;display:flex;align-items:center"><span style="flex:1">← 相册</span></div>'
    h += '<div style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:' + gap + ';padding:6px">'
    for (var gi = 0; gi < (cols * 2); gi++) {
      h += '<div style="aspect-ratio:1;background:' + swatches[gi % swatches.length] + ';border-radius:' + imgRad + ';opacity:.6"></div>'
    }
    h += '</div></div>'
  } else if (type === 'browser') {
    h += '<div class="cu-preview-browser" style="border:1px solid #e0e0e0;overflow:hidden">'
    h += '<div style="background:#fff;padding:3px 8px;font-size:.6rem;color:#888;border-bottom:1px solid #eee;display:flex;align-items:center"><span style="flex:1">← 浏览记录</span></div>'
    h += '<div style="padding:2px 8px">'
    h += '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid #eee">'
    h += '<div style="width:6px;height:6px;border-radius:50%;background:#6366f1;flex-shrink:0"></div>'
    h += '<div style="flex:1;min-width:0"><div style="font-size:' + (s.titleSize || 12) + 'px;font-weight:500;color:' + (s.titleColor || '#555') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">示例网页标题</div><div style="font-size:.48rem;color:' + (s.urlColor || '#999') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">https://example.com</div></div>'
    h += '<span style="font-size:.45rem;color:' + (s.timeColor || '#999') + ';white-space:nowrap">12:30</span>'
    h += '</div>'
    h += '<div style="display:flex;align-items:center;gap:6px;padding:5px 0">'
    h += '<div style="width:6px;height:6px;border-radius:50%;background:#f59e0b;flex-shrink:0"></div>'
    h += '<div style="flex:1;min-width:0"><div style="font-size:' + (s.titleSize || 12) + 'px;font-weight:500;color:' + (s.titleColor || '#555') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">另一个记录</div><div style="font-size:.48rem;color:' + (s.urlColor || '#999') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">https://example.org</div></div>'
    h += '<span style="font-size:.45rem;color:' + (s.timeColor || '#999') + ';white-space:nowrap">11:05</span>'
    h += '</div>'
    h += '</div></div>'
  } else if (type === 'shopping') {
    h += '<div class="cu-preview-shop" style="border:1px solid #e0e0e0;overflow:hidden">'
    h += '<div style="background:#fff;padding:3px 8px;font-size:.6rem;color:#888;border-bottom:1px solid #eee;display:flex;align-items:center"><span style="flex:1">← 购物清单</span></div>'
    h += '<div style="padding:4px 8px">'
    h += '<div style="display:flex;gap:6px;padding:3px 0;border-bottom:1px solid #eee;align-items:flex-start">'
    h += '<div style="width:34px;height:34px;background:#e8ebf0;border:1px solid #eee;flex-shrink:0"></div>'
    h += '<div style="flex:1"><div style="font-size:' + (s.nameSize || 12) + 'px;font-weight:500;color:' + (s.nameColor || '#333') + '">示例商品A</div><div style="font-size:.6rem;color:' + (s.priceColor || '#a3bded') + '">¥99.00</div></div>'
    h += '</div>'
    h += '<div style="display:flex;gap:6px;padding:3px 0;align-items:flex-start">'
    h += '<div style="width:34px;height:34px;background:#e8ebf0;border:1px solid #eee;flex-shrink:0"></div>'
    h += '<div style="flex:1"><div style="font-size:' + (s.nameSize || 12) + 'px;font-weight:500;color:' + (s.nameColor || '#333') + '">示例商品B</div><div style="font-size:.6rem;color:' + (s.priceColor || '#a3bded') + '">¥199.00</div></div>'
    h += '</div>'
    h += '</div></div>'
  } else if (type === 'contacts') {
    var avRadius = s.avatarShape === 'circle' ? '50%' : (s.avatarShape === 'rounded' ? '8px' : '2px')
    h += '<div class="cu-preview-contact" style="border:1px solid #e0e0e0;overflow:hidden">'
    h += '<div style="background:#fff;padding:3px 8px;font-size:.6rem;color:#888;border-bottom:1px solid #eee;display:flex;align-items:center"><span style="flex:1">← 联系人</span></div>'
    h += '<div style="padding:4px 8px">'
    h += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #eee">'
    h += '<div style="width:28px;height:28px;border-radius:' + avRadius + ';background:' + avatarColor('demo1') + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.55rem;font-weight:600">C</div>'
    h += '<div style="font-size:' + (s.nameSize || 13) + 'px;font-weight:' + (s.nameWeight || '500') + ';color:' + (s.nameColor || '#555') + '">示例联系人A</div>'
    h += '</div>'
    h += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0">'
    h += '<div style="width:28px;height:28px;border-radius:' + avRadius + ';background:' + avatarColor('demo2') + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.55rem;font-weight:600">D</div>'
    h += '<div style="font-size:' + (s.nameSize || 13) + 'px;font-weight:' + (s.nameWeight || '500') + ';color:' + (s.nameColor || '#555') + '">示例联系人B</div>'
    h += '</div>'
    h += '</div></div>'
  }
  h += '</div>'
  return h
}

function readerAppPreviewFrameStyle(custom) {
  var ct = normalizePhoneCustom(custom)
  var style = '--phone-bg:' + sanitizeCssColor(ct.wallpaper) +
    ';--phone-radius:' + ct.borderRadius + 'px' +
    ';--phone-font:' + safePhoneCustomFontFamily(ct.fontFamily, readerPhoneCustomDefaults().fontFamily) +
    ';--phone-fontsize:' + ct.fontSize + 'px' +
    ';--phone-frame:' + sanitizeCssColor(ct.frameColor) +
    ';--phone-icon-radius:' + ct.iconBorderRadius + 'px' +
    ';--phone-material-opacity:' + ct.materialOpacity + '%' +
    ';--phone-time-color:' + sanitizeCssColor(ct.timeColor)
  if (ct.wallpaperType === 'image' && ct.wallpaperImage) {
    style += ';background-image:url("' + escapeHtmlAttribute(ct.wallpaperImage) + '");background-size:cover;background-position:center'
  }
  return style
}

function readerAppPreviewData() {
  var pd = readerPhoneData(_work && _work.phoneData)
  var contacts = Array.isArray(pd.contacts) ? pd.contacts : []
  var contact = contacts[0] || { id: 'preview-contact', name: '林晚', avatarUrl: '' }
  return { phone: pd, contacts: contacts, contact: contact, hasWork: !!(_work && _work.phoneData) }
}

function readerAppPreviewAvatar(contact, className, fallbackColor) {
  var name = String(contact && contact.name || '林晚')
  var h = '<span class="' + className + '" style="--rd-avatar-bg:' + sanitizeCssColor(fallbackColor || avatarColor(contact && contact.id || 'preview-contact')) + '">'
  if (contact && contact.avatarUrl) h += '<img src="' + escapeHtmlAttribute(contact.avatarUrl) + '" alt="">'
  else h += esc(name.charAt(0) || '林')
  return h + '</span>'
}

function readerAppPreviewBody(type, settings) {
  var data = readerAppPreviewData()
  var pd = data.phone
  var contact = data.contact
  var s = readerOwnDataRecord(settings)
  var shape = s.avatarShape === 'square' ? '2px' : (s.avatarShape === 'rounded' ? '8px' : '50%')

  if (type === 'messages') {
    var chatBg = sanitizeCssColor(s.chatBg || '#f0f0f0')
    var chatBgImage = validatedReaderCallBackgroundCandidate(s.chatBgImage)
    var chatImageValue = chatBgImage ? 'url("' + chatBgImage.dataUrl + '")' : 'none'
    var otherBg = sanitizeCssColor(s.otherBubbleBg || '#fff')
    var otherText = sanitizeCssColor(s.otherBubbleText || '#333')
    var selfBg = sanitizeCssColor(s.selfBubbleBg || '#555')
    var selfText = sanitizeCssColor(s.selfBubbleText || '#fff')
    var avatarSize = boundedReaderSetting(s.avatarSize, 36, 24, 56)
    var bubbleSize = boundedReaderSetting(s.bubbleFontSize, 13, 10, 18)
    var bubbleWeight = normalizedReaderBubbleFontWeight(s.bubbleFontWeight)
    var otherBubbleSkinClass = readerBubbleSkinClass(s, 'other')
    var selfBubbleSkinClass = readerBubbleSkinClass(s, 'self')
    var sendButtonBg = sanitizeCssColor(s.sendButtonBg, { fallback: '#cda9b1' })
    var chatAppearance = normalizedReaderChatAppearanceSettings(s)
    var chatTone = readerChatTonePresentation(chatAppearance.chatBgTone)
    var otherRadius = boundedReaderSetting(s.otherBubbleRadius, 8, 0, 20)
    var selfRadius = boundedReaderSetting(s.selfBubbleRadius, 8, 0, 20)
    var chat = Array.isArray(pd.chats) && pd.chats[0] ? pd.chats[0] : null
    var rounds = chat && Array.isArray(chat.rounds) ? chat.rounds : []
    var messages = rounds.flatMap(function(round) { return Array.isArray(round.messages) ? round.messages : [] })
      .filter(function(message) { return message && message.type !== 'time' && message.type !== 'call' })
    var otherMessage = messages.find(function(message) { return message.senderId !== 'self' && typeof message.text === 'string' })
    var selfMessage = messages.find(function(message) { return message.senderId === 'self' && typeof message.text === 'string' })
    var otherCopy = otherMessage ? readerPhoneText(otherMessage.text) : '我到天台了，你慢慢来。'
    var selfCopy = selfMessage ? readerPhoneText(selfMessage.text) : '风是不是很大？'
    var readerCustom = getPhoneCustom()
    var readerName = readerThreadDisplayName(pd, readerCustom)
    var authoredReaderAvatar = pd.skin && typeof pd.skin.readerAvatar === 'string' && isSafeImageUrl(pd.skin.readerAvatar)
      ? pd.skin.readerAvatar.trim()
      : ''
    var readerAvatar = readerCustom.readerAvatar || authoredReaderAvatar
    var h = '<div class="rd-app-preview-chat chat-author-shell chat-reader-shell" data-chat-background-image="' + (chatBgImage ? 'true' : 'false') + '" style="display:flex;flex-direction:column;height:100%;--chat-editor-screen:' + chatBg + ';--chat-editor-image:' + escapeHtmlAttribute(chatImageValue) + ';--chat-bg-size:' + chatAppearance.chatBgFit + ';--chat-bg-position:' + chatAppearance.chatBgPositionX + '% ' + chatAppearance.chatBgPositionY + '%;--chat-bg-overlay-color:' + chatTone.color + ';--chat-bg-overlay-opacity:' + chatTone.opacity + ';--chat-bubble-weight:' + bubbleWeight + ';--chat-editor-pink:' + selfBg + ';--chat-send-bg:' + sendButtonBg + ';--chat-send-ink:' + readerReadableTextColor(sendButtonBg) + ';' + readerBubbleSkinVariables(s) + readerChatReadabilityVariables(readerOwnDataRecord(s, chatAppearance)) + '">'
    h += '<div class="chat-round-header"><span class="chat-round-control" aria-hidden="true">‹</span><div class="chat-round-title"><strong>' + esc(contact.name || '林晚') + '</strong></div><span class="chat-round-control" aria-hidden="true"></span></div>'
    h += '<div class="chat-msg-area">' + (shouldShowPhoneTimestamp(pd, '今天 20:41') ? '<div class="rd-chat-time" style="text-align:center;padding:6px 0;font-size:.62rem;color:var(--chat-time-color,#b0b8c4)">今天 20:41</div>' : '')
    h += '<div class="chat-msg rd-chat-message other is-other' + otherBubbleSkinClass + '"><span class="chat-avatar" style="width:' + avatarSize + 'px;height:' + avatarSize + 'px;flex-basis:' + avatarSize + 'px;border-radius:' + shape + ';background:' + sanitizeCssColor(avatarColor(contact.id)) + '">' + esc(String(contact.name || '林').charAt(0)) + '</span><div class="rd-chat-message-body"><div class="chat-bubble' + otherBubbleSkinClass + '" style="font-size:' + bubbleSize + 'px;background:' + otherBg + ';color:' + otherText + ';border-radius:' + otherRadius + 'px ' + otherRadius + 'px ' + otherRadius + 'px 2px">' + esc(otherCopy) + '</div></div></div>'
    h += '<div class="chat-msg rd-chat-message self is-self' + selfBubbleSkinClass + '"><span class="chat-avatar rd-reader-chat-avatar" aria-label="' + escapeHtmlAttribute(readerName) + '" style="width:' + avatarSize + 'px;height:' + avatarSize + 'px;flex-basis:' + avatarSize + 'px;border-radius:' + shape + ';background:' + sanitizeCssColor(avatarColor('reader-' + readerName)) + '">'
    if (readerAvatar) h += '<img src="' + escapeHtmlAttribute(readerAvatar) + '" alt="">'
    else h += esc((readerName || '我').charAt(0))
    h += '</span><div class="rd-chat-message-body"><div class="chat-bubble' + selfBubbleSkinClass + '" style="font-size:' + bubbleSize + 'px;background:' + selfBg + ';color:' + selfText + ';border-radius:' + selfRadius + 'px ' + selfRadius + 'px 2px ' + selfRadius + 'px">' + esc(selfCopy) + '</div></div></div></div>'
    h += '<div class="chat-input-bar chat-composer rd-chat-composer has-choices"><input id="chatInput" class="rd-chat-choice-trigger" readonly value="" placeholder="点击选择回复..."><button type="button" id="chatSendBtn" class="chat-send-btn rd-chat-choice-toggle" tabindex="-1">▶</button></div></div>'
    return h
  }

  if (type === 'forum') {
    var posts = orderedForumPosts(pd.forumPosts).slice(0, 3)
    if (posts.length === 0) posts = [
      { id: 'preview-post-1', title: '今晚观星天气', contactName: contact.name || '林晚', time: '20:14', pinned: true },
      { id: 'preview-post-2', title: '夏季大三角', contactName: 'MAY', time: '昨天' }
    ]
    var forumVars = '--rd-forum-card:' + sanitizeCssColor(s.cardBg || '#fff') +
      ';--rd-forum-radius:' + boundedReaderSetting(s.cardRadius, 0, 0, 16) + 'px' +
      ';--rd-forum-avatar-radius:' + shape +
      ';--rd-forum-title:' + sanitizeCssColor(s.titleColor || '#555') +
      ';--rd-forum-title-size:' + boundedReaderSetting(s.titleSize, 13, 10, 18) + 'px' +
      ';--rd-forum-time:' + sanitizeCssColor(s.timeColor || '#999')
    return posts.map(function(post, index) {
      var postContact = data.contacts.find(function(candidate) { return candidate.id === post.contactId }) || { id: post.contactId || 'preview-' + index, name: post.contactName || contact.name || '林晚' }
      var row = '<button type="button" class="rd-post-card" tabindex="-1" style="' + forumVars + '">'
      row += readerAppPreviewAvatar(postContact, 'rd-forum-avatar')
      row += '<span class="rd-forum-copy"><span class="rd-forum-title-line"><span class="rd-forum-title">' + esc(post.title || '未命名帖子') + '</span><span class="rd-forum-post-states">'
      if (post.pinned) row += '<span class="rd-forum-post-state rd-forum-post-pinned">置顶</span>'
      row += '</span></span><span class="rd-forum-meta">' + esc(postContact.name || '角色') + (shouldShowPhoneTimestamp(pd, post.time) ? ' / ' + esc(post.time) : '') + '</span></span></button>'
      return row
    }).join('')
  }

  if (type === 'memo') {
    var memos = (Array.isArray(pd.memos) ? pd.memos : []).slice(0, 2)
    if (memos.length === 0) memos = [{ content: '记得带上相机和备用电池。' }, { content: '周三下午三点，小组会议。' }]
    var memoStyle = ['plain', 'sticky', 'vintage'].includes(s.cardStyle) ? s.cardStyle : 'plain'
    var memoBg = memoStyle === 'sticky' ? '#fef9e7' : (memoStyle === 'vintage' ? '#f5e6c8' : sanitizeCssColor(s.cardBg || '#fff'))
    var memoBorder = memoStyle === 'sticky' ? '#e8d5a0' : (memoStyle === 'vintage' ? '#d4c4a0' : sanitizeCssColor(s.cardBorder || '#eee'))
    var memoVars = '--rd-memo-bg:' + memoBg +
      ';--rd-memo-border:' + memoBorder +
      ';--rd-memo-radius:' + (memoStyle === 'vintage' ? 2 : boundedReaderSetting(s.cardRadius, 4, 0, 16)) + 'px' +
      ';--rd-memo-text:' + sanitizeCssColor(s.textColor || '#333') +
      ';--rd-memo-font-size:' + boundedReaderSetting(s.fontSize, 12, 10, 16) + 'px' +
      ';--rd-memo-line-height:' + boundedReaderSetting(s.lineHeight, 1.6, 1.2, 2.4)
    return '<div class="rd-memo-stack rd-memo-style-' + memoStyle + '" style="' + memoVars + '">' + memos.map(function(memo) {
      var foot = shouldShowPhoneTimestamp(pd, memo.time) ? '<div class="memo-card-foot"><time class="memo-time-reader">' + esc(memo.time) + '</time></div>' : ''
      return '<article class="memo-card rd-memo-note"><div class="memo-card-inner"><div class="memo-editor" contenteditable="false">' + (memo.content || '空白备忘') + '</div>' + foot + '</div></article>'
    }).join('') + '</div>'
  }

  if (type === 'gallery') {
    var photos = (Array.isArray(pd.photos) ? pd.photos : []).slice(0, 6)
    if (photos.length === 0) photos = [
      { caption: '天台' }, { caption: '晚霞' }, { caption: '街灯' },
      { caption: '云层' }, { caption: '车窗' }, { caption: '海面' }
    ]
    var gallerySettings = normalizedReaderGallerySettings(s)
    var galleryVars = '--rd-gallery-columns:' + gallerySettings.columns + ';--rd-gallery-radius:' + gallerySettings.imageRadius + 'px;--rd-gallery-gap:' + gallerySettings.gap + 'px'
    return '<div class="gallery-bar"><span class="gallery-bar-title">最近项目 (' + photos.length + ')</span></div><div class="gallery-grid rd-gallery-grid" style="' + galleryVars + '">' + photos.map(function(photo) {
      var cell = '<button type="button" class="gallery-photo-card rd-gallery-photo" tabindex="-1" aria-pressed="false">'
      if (photo.imageUrl) cell += '<img src="' + escapeHtmlAttribute(photo.imageUrl) + '" alt=""' + readerImageAttributes() + '>'
      else cell += '<span class="gallery-photo-placeholder rd-gallery-photo-placeholder"><span class="gallery-photo-text">' + esc(photo.caption || '照片') + '</span></span>'
      return cell + '</button>'
    }).join('') + '</div>'
  }

  if (type === 'browser') {
    var history = (Array.isArray(pd.browserHistory) ? pd.browserHistory : []).slice(0, 3)
    if (history.length === 0) history = [
      { id: 'preview-history-1', contactId: contact.id, title: '今晚观星天气', url: 'weather.local/tonight', time: '20:14' },
      { id: 'preview-history-2', contactId: contact.id, title: '夏季大三角', url: 'stars.local/guide', time: '昨天' }
    ]
    var browserVars = '--rd-browser-entry:' + sanitizeCssColor(s.entryBg || 'transparent') +
      ';--rd-browser-radius:' + boundedReaderSetting(s.entryRadius, 0, 0, 12) + 'px' +
      ';--rd-browser-title:' + sanitizeCssColor(s.titleColor || '#555') +
      ';--rd-browser-title-size:' + boundedReaderSetting(s.titleSize, 12, 10, 16) + 'px' +
      ';--rd-browser-url:' + sanitizeCssColor(s.urlColor || '#999') +
      ';--rd-browser-time:' + sanitizeCssColor(s.timeColor || '#999')
    var browser = '<div class="browser-search-bar rd-browser-address"><span class="browser-search-icon rd-browser-search" aria-hidden="true">⌕</span><span class="browser-search-placeholder">搜索或输入网址</span></div><div class="browser-demo-body rd-browser-history" style="' + browserVars + '">'
    history.forEach(function(item) {
      browser += '<div class="browser-row rd-browser-entry"><span class="browser-dot rd-browser-marker" style="--rd-marker:' + sanitizeCssColor(avatarColor(item.contactId || contact.id)) + '"></span><span class="browser-info rd-browser-copy"><span class="browser-title rd-browser-title">' + esc(item.title || '未命名记录') + '</span><span class="browser-url rd-browser-url">' + esc(item.url || '') + '</span></span>' + (shouldShowPhoneTimestamp(pd, item.time) ? '<span class="browser-right"><time class="browser-time rd-browser-time">' + esc(String(item.time).replace(/\s.*$/, '')) + '</time></span>' : '') + '</div>'
    })
    return browser + '</div>'
  }

  if (type === 'shopping') {
    var items = (Array.isArray(pd.shoppingItems) ? pd.shoppingItems : []).slice(0, 3)
    if (!data.hasWork && items.length === 0) items = [{ name: '热饮', price: 18, style: '热', shop: '天台便利店' }, { name: '星图册', price: 42, shop: '旧书店' }]
    var previewCartItems = items.filter(function(item) { return item.status !== 'order' })
    var previewOrderItems = items.filter(function(item) { return item.status === 'order' })
    var previewActiveTab = previewCartItems.length > 0 || previewOrderItems.length === 0 ? 'cart' : 'order'
    var shopVars = '--rd-shop-card:' + sanitizeCssColor(s.cardBg || 'transparent') +
      ';--rd-shop-radius:' + boundedReaderSetting(s.cardRadius, 0, 0, 16) + 'px' +
      ';--rd-shop-name:' + sanitizeCssColor(s.nameColor || '#333') +
      ';--rd-shop-name-size:' + boundedReaderSetting(s.nameSize, 12, 10, 16) + 'px' +
      ';--rd-shop-price:' + sanitizeCssColor(s.priceColor || '#a3bded')
    var previewTabs = renderPhoneShoppingTabs({
      activeTab: previewActiveTab,
      idPrefix: 'rdShopPreview',
      cartPanelId: 'rdShopPreviewCart',
      orderPanelId: 'rdShopPreviewOrder',
      tabListClass: 'rd-shop-tabs',
      tabClass: 'rd-shop-tab'
    })
    var previewCart = renderPhoneShoppingList(previewCartItems, {
      mode: 'cart',
      surface: 'reader',
      style: shopVars,
      showTimestamp: function(value) { return shouldShowPhoneTimestamp(pd, value) }
    })
    var previewOrders = renderPhoneShoppingList(previewOrderItems, {
      mode: 'order',
      surface: 'reader',
      style: shopVars,
      showTimestamp: function(value) { return shouldShowPhoneTimestamp(pd, value) }
    })
    return previewTabs + '<div class="shop-body-inner">' +
      '<div class="rd-shop-panel" id="rdShopPreviewCart"' + (previewActiveTab === 'cart' ? '' : ' hidden') + '>' + previewCart + '</div>' +
      '<div class="rd-shop-panel" id="rdShopPreviewOrder"' + (previewActiveTab === 'order' ? '' : ' hidden') + '>' + previewOrders + '</div></div>'
  }

  var contacts = data.contacts.slice(0, 4)
  if (contacts.length === 0) contacts = [contact, { id: 'preview-contact-2', name: 'MAY' }, { id: 'preview-contact-3', name: '陈泊' }]
  var contactVars = '--rd-contact-radius:' + shape +
    ';--rd-contact-name:' + sanitizeCssColor(s.nameColor || '#555') +
    ';--rd-contact-name-size:' + boundedReaderSetting(s.nameSize, 13, 10, 18) + 'px' +
    ';--rd-contact-name-weight:' + (['600', '700'].includes(String(s.nameWeight)) ? s.nameWeight : '500')
  return '<div class="rd-contact-book" style="' + contactVars + '">' + contacts.map(function(item) {
    return '<div class="rd-contact-entry">' + readerAppPreviewAvatar(item, 'rd-contact-avatar') + '<div class="rd-contact-name">' + esc(item.name || '未命名') + '</div></div>'
  }).join('') + '</div>'
}

function renderCuPreview(type, settings) {
  var safeType = readerAppCssType(type) || 'browser'
  var labels = { messages:'消息', forum:'论坛', memo:'备忘录', gallery:'相册', browser:'浏览记录', shopping:'购物清单', contacts:'联系人' }
  var previewData = readerAppPreviewData()
  var scopedTypes = ['memo', 'gallery', 'browser', 'shopping']
  var previewTitle = labels[safeType]
  if (scopedTypes.includes(safeType) && previewData.contact) {
    previewTitle = (previewData.contact.name || '未命名') + ' · ' + previewTitle
  }
  var custom = getPhoneCustom()
  applyCompiledReaderStyle(custom.customCss, '.reader-phone-css-preview-scope', 'reader-app-phone-preview-user-css')
  var frameStyle = readerAppPreviewFrameStyle(custom)
  var body = readerAppPreviewBody(safeType, settings)
  var h = '<div class="cu-preview" id="cuPreview">'
  h += '<div class="cu-preview-label"><span>实时预览</span><small>使用当前作品与实际 App 组件</small></div>'
  h += '<div class="rd-phone-preview"><div class="phone-frame reader-app-preview-frame reader-phone-css-preview-scope" tabindex="0" aria-label="应用效果预览；按住可查看修改前效果" style="' + escapeHtmlAttribute(frameStyle) + '">'
  h += '<div class="cu-panel cu-panel-embedded rd-phone-app-panel rd-phone-app-' + safeType + ' reader-app-preview-scope">'
  h += '<div class="cu-header rd-phone-app-header"><span class="rd-back-btn" aria-hidden="true">←</span><span class="cu-title">' + esc(previewTitle) + '</span><span class="rd-back-spacer" aria-hidden="true"></span></div>'
  h += '<div class="cu-body rd-phone-app-body">' + body + '</div></div></div></div></div>'
  return h
}

function assignFiniteSetting(settings, key, value) {
  var number = Number(value)
  if (Number.isFinite(number)) settings[key] = number
}

function readCurrentSettings(modal, type) {
  var s = getAppSettings(type)
  // Read sliders
  var sliderMap = {
    cuMsgAvSize: 'avatarSize', cuSelfRadius: 'selfBubbleRadius', cuOtherRadius: 'otherBubbleRadius',
    cuSelfBubbleSkinSize: 'selfBubbleSkinSize', cuOtherBubbleSkinSize: 'otherBubbleSkinSize',
    cuSelfBubbleSkinSlice: 'selfBubbleSkinSlice', cuSelfBubbleSkinPadding: 'selfBubbleSkinPadding',
    cuOtherBubbleSkinSlice: 'otherBubbleSkinSlice', cuOtherBubbleSkinPadding: 'otherBubbleSkinPadding',
    cuBubbleFs: 'bubbleFontSize', cuCardRadius: 'cardRadius', cuTitleSize: 'titleSize',
    cuFontSize: 'fontSize', cuLineHeight: 'lineHeight', cuImgRadius: 'imageRadius',
    cuGap: 'gap', cuEntryRadius: 'entryRadius', cuNameSize: 'nameSize',
    cuComposerInputRadius: 'composerInputRadius',
    cuChatBgPosX: 'chatBgPositionX', cuChatBgPosY: 'chatBgPositionY', cuChatBgTone: 'chatBgTone'
  }
  for (var id in sliderMap) {
    var el = modal.querySelector('#' + id)
    if (el) assignFiniteSetting(s, sliderMap[id], el.value)
  }
  // Read active color buttons
  var colorBtnMap = {
    'cu-self-bg': 'selfBubbleBg', 'cu-self-text': 'selfBubbleText',
    'cu-other-bg': 'otherBubbleBg', 'cu-other-text': 'otherBubbleText',
    'cu-chat-bg': 'chatBg', 'cu-time-color': 'timeColor', 'cu-send-bg': 'sendButtonBg',
    'cu-composer-bg': 'composerBg', 'cu-composer-input-bg': 'composerInputBg',
    'cu-composer-input-text': 'composerInputText', 'cu-composer-input-border': 'composerInputBorder',
    'cu-card-bg': 'cardBg', 'cu-title-color': 'titleColor',
    'cu-text-color': 'textColor', 'cu-url-color': 'urlColor',
    'cu-name-color': 'nameColor', 'cu-price-color': 'priceColor'
  }
  for (var attr in colorBtnMap) {
    var btn = modal.querySelector('.cu-color-btn.active[data-' + attr + ']')
    if (btn) { s[colorBtnMap[attr]] = btn.getAttribute('data-' + attr); continue }
    var picker = modal.querySelector('.cu-color-picker[data-' + attr + '-picker]')
    if (picker && picker.value) {
      s[colorBtnMap[attr]] = picker.getAttribute('data-' + attr + '-picker') || picker.value
    }
  }
  // Read active shape button
  var shapeBtn = modal.querySelector('.cu-shape-btn.active')
  if (shapeBtn && shapeBtn.dataset.cuShape) s.avatarShape = shapeBtn.dataset.cuShape
  // Read active style buttons
  var memoStyle = modal.querySelector('.cu-style-btn.active[data-cu-memo-style]')
  if (memoStyle) s.cardStyle = memoStyle.dataset.cuMemoStyle
  var galleryCol = modal.querySelector('.cu-style-btn.active[data-cu-gallery-cols]')
  if (galleryCol) s.columns = parseInt(galleryCol.dataset.cuGalleryCols) || 3
  var bubbleWeight = modal.querySelector('.cu-style-btn.active[data-cu-bubble-weight]')
  if (bubbleWeight) s.bubbleFontWeight = normalizedReaderBubbleFontWeight(bubbleWeight.dataset.cuBubbleWeight)
  modal.querySelectorAll('.cu-style-btn.active[data-cu-bubble-skin-mode]').forEach(function(button) {
    var prefix = button.dataset.cuBubbleSkinSide === 'self' ? 'self' : 'other'
    s[prefix + 'BubbleSkinMode'] = button.dataset.cuBubbleSkinMode === 'slice' ? 'slice' : 'full'
  })
  var chatBgFit = modal.querySelector('.cu-style-btn.active[data-cu-chat-bg-fit]')
  if (chatBgFit) s.chatBgFit = chatBgFit.dataset.cuChatBgFit === 'contain' ? 'contain' : 'cover'
  var customCss = modal.querySelector('#cuAppCustomCss')
  s.customCss = customCss && typeof customCss.value === 'string'
    ? customCss.value.slice(0, READER_CUSTOM_CSS_MAX_LENGTH)
    : (typeof s.customCss === 'string' ? s.customCss.slice(0, READER_CUSTOM_CSS_MAX_LENGTH) : '')
  if (type === 'messages' && Object.prototype.hasOwnProperty.call(modal, '_readerChatBgImageDraft')) {
    s.chatBgImage = modal._readerChatBgImageDraft || null
    s.chatBgLuminance = Number.isFinite(modal._readerChatBgLuminanceDraft)
      ? modal._readerChatBgLuminanceDraft
      : null
    var readabilityToggle = modal.querySelector('#cuChatAutoReadability')
    s.chatAutoReadability = readabilityToggle ? readabilityToggle.checked : s.chatAutoReadability !== false
    var composerReadabilityToggle = modal.querySelector('#cuComposerAutoReadability')
    s.composerAutoReadability = composerReadabilityToggle
      ? composerReadabilityToggle.checked
      : s.composerAutoReadability !== false
    if (modal._readerBubbleSkinDraft) {
      s.selfBubbleSkinImage = modal._readerBubbleSkinDraft.self || null
      s.otherBubbleSkinImage = modal._readerBubbleSkinDraft.other || null
    }
  }
  return s
}

function syncReaderAppCssFeedback(modal, type, settings) {
  var rawCss = typeof settings.customCss === 'string' ? settings.customCss : ''
  var result = applyReaderAppCustomCss(type, settings, { preview: true })
  var error = modal.querySelector('#cuAppCssError')
  var count = modal.querySelector('#cuAppCssCount')
  var status = modal.querySelector('#cuAppLiveStatus')
  var save = modal.querySelector('#cuModalSave')
  var dirty = typeof modal._readerAppDraftDirty === 'function'
    ? modal._readerAppDraftDirty(settings)
    : true
  if (count) count.textContent = rawCss.length + ' / ' + READER_CUSTOM_CSS_MAX_LENGTH
  if (error) {
    error.hidden = result.ok
    error.textContent = result.ok ? '' : result.error
  }
  if (status) {
    status.classList.toggle('is-error', !result.ok)
    status.textContent = result.ok
      ? (dirty
        ? '有未保存修改 · 按住预览可对比原效果'
        : '尚未修改 · 按住预览可查看原效果')
      : 'CSS 有误，已保留上一次可用预览'
  }
  if (save) save.disabled = !dirty || !result.ok || save.dataset.readerAsyncPending === 'true'
  return result
}

function updateCuPreview(modal, type) {
  var preview = modal.querySelector('#cuPreview')
  if (!preview) return
  var s = readCurrentSettings(modal, type)
  preview.innerHTML = renderCuPreview(type, s).replace(/^<div class="cu-preview"[^>]*>/, '').replace(/<\/div>$/, '')
  syncReaderAppCssFeedback(modal, type, s)
}

function readerCallBackgroundPreviewMarkup(background) {
  var presentation = readerCallBackgroundPresentation(background)
  return '<div id="cuCallBackgroundPreview" class="cu-call-background-preview' + presentation.className + '" data-call-background="' + presentation.attribute + '"' + (presentation.style ? ' style="' + escapeHtmlAttribute(presentation.style) + '"' : '') + '><span>通话背景预览</span></div>'
}

function readerCallBackgroundControls(background) {
  var buttons = Object.keys(READER_CALL_BACKGROUND_PRESETS).map(function(key) {
    var pressed = background.callBackgroundType === 'preset' && background.callBackgroundPreset === key
    return '<button type="button" class="cu-call-background-preset' + (pressed ? ' active' : '') + '" data-cu-call-background-preset="' + key + '" aria-label="选择' + READER_CALL_BACKGROUND_PRESETS[key] + '通话背景" aria-pressed="' + (pressed ? 'true' : 'false') + '">' + READER_CALL_BACKGROUND_PRESETS[key] + '</button>'
  }).join('')
  return '<div class="cu-call-background-presets" role="group" aria-label="通话背景预设">' + buttons + '</div>' +
    readerCallBackgroundPreviewMarkup(background) +
    '<div class="cu-call-background-actions"><button type="button" id="cuCallBackgroundUpload">选择本地图片</button><input type="file" id="cuCallBackgroundFile" accept="image/png,image/jpeg,image/webp" hidden><button type="button" id="cuCallBackgroundRestore">恢复默认</button></div>' +
    '<p id="cuCallBackgroundState" class="cu-chat-background-state" aria-live="polite"></p>' +
    '<p id="cuCallBackgroundError" class="cu-call-background-error" role="alert" hidden></p>'
}

function readerBubbleSkinControls(side, settings) {
  var isSelf = side === 'self'
  var key = isSelf ? 'Self' : 'Other'
  var skin = normalizedReaderBubbleSkin(settings, side)
  return '<div class="cu-bubble-skin-control" data-cu-bubble-skin-side="' + side + '">' +
    '<div class="cu-call-background-actions cu-bubble-skin-actions">' +
      '<button type="button" id="cu' + key + 'BubbleSkinUpload">选择图片</button>' +
      '<input type="file" id="cu' + key + 'BubbleSkinFile" accept="image/png,image/jpeg,image/webp" hidden>' +
      '<button type="button" id="cu' + key + 'BubbleSkinClear"' + (skin.image ? '' : ' disabled') + '>清除</button>' +
    '</div>' +
    '<p id="cu' + key + 'BubbleSkinState" class="cu-bubble-skin-state" aria-live="polite">' +
      (skin.image ? '已使用本地素材，可继续调整显示方式和大小。' : '未使用，继续显示背景色与圆角。') +
    '</p>' +
    '<p id="cu' + key + 'BubbleSkinError" class="cu-call-background-error" role="alert" hidden></p>' +
  '</div>'
}

function readerBubbleSkinModeControls(side, settings) {
  var skin = normalizedReaderBubbleSkin(settings, side)
  return '<div class="cu-shape-group cu-bubble-skin-mode" role="group" aria-label="' + (side === 'self' ? '我方' : '对方') + '气泡素材显示方式">' +
    '<button type="button" class="cu-style-btn' + (skin.mode === 'full' ? ' active' : '') + '" data-cu-bubble-skin-mode="full" data-cu-bubble-skin-side="' + side + '">完整素材</button>' +
    '<button type="button" class="cu-style-btn' + (skin.mode === 'slice' ? ' active' : '') + '" data-cu-bubble-skin-mode="slice" data-cu-bubble-skin-side="' + side + '">切片拉伸</button>' +
  '</div>'
}

function syncReaderCallBackgroundControls(modal, background) {
  modal.querySelectorAll('.cu-call-background-preset').forEach(function(button) {
    var pressed = background.callBackgroundType === 'preset' && button.dataset.cuCallBackgroundPreset === background.callBackgroundPreset
    button.classList.toggle('active', pressed)
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false')
  })
  var preview = modal.querySelector('#cuCallBackgroundPreview')
  if (preview) preview.outerHTML = readerCallBackgroundPreviewMarkup(background)
}

function bindReaderAppPreviewAutoScale(overlay) {
  var modal = overlay.querySelector('.app-appearance-workbench')
  var modalBody = modal && modal.querySelector('.cu-modal-body')
  var previewPane = modal && modal.querySelector('.app-appearance-preview-pane')
  var previewWrap = previewPane && previewPane.querySelector('.rd-phone-preview')
  var previewFrame = previewPane && previewPane.querySelector('.reader-app-preview-frame')
  var previewLabel = previewPane && previewPane.querySelector('.cu-preview-label')
  var previewStatus = previewPane && previewPane.querySelector('.phone-appearance-status')
  if (!modal || !modalBody || !previewWrap || !previewFrame) return

  var lastScale = ''
  var lastHeight = ''
  var resizeObserver = null
  var removalObserver = null
  var resizeTarget = globalThis.window && typeof globalThis.window.addEventListener === 'function'
    ? globalThis.window
    : (typeof globalThis.addEventListener === 'function' ? globalThis : null)

  function clearPreviewScale() {
    lastScale = ''
    lastHeight = ''
    modal.style.removeProperty('--reader-app-preview-scale')
    previewWrap.style.removeProperty('height')
    previewWrap.style.removeProperty('overflow')
  }

  function syncPreviewScale() {
    if (!overlay.isConnected) return
    var viewportWidth = Number(resizeTarget && resizeTarget.innerWidth) ||
      Number(globalThis.innerWidth) ||
      document.documentElement.clientWidth ||
      0
    if (viewportWidth <= 860) {
      clearPreviewScale()
      return
    }
    var availableBodyHeight = modalBody.clientHeight
    if (!availableBodyHeight) return
    var naturalHeight = previewFrame.offsetHeight || 640
    var fixedChromeHeight = (previewLabel ? previewLabel.offsetHeight : 0) +
      (previewStatus ? previewStatus.offsetHeight : 0) + 52
    var availablePreviewHeight = Math.max(0, availableBodyHeight - fixedChromeHeight)
    var scale = Math.max(0.42, Math.min(1, availablePreviewHeight / naturalHeight))
    var scaleText = String(Number(scale.toFixed(3)))
    var heightText = Math.round(naturalHeight * scale) + 'px'
    if (scaleText !== lastScale) {
      modal.style.setProperty('--reader-app-preview-scale', scaleText)
      lastScale = scaleText
    }
    if (heightText !== lastHeight) {
      previewWrap.style.height = heightText
      previewWrap.style.overflow = 'hidden'
      lastHeight = heightText
    }
  }

  function cleanupPreviewScale() {
    if (resizeTarget) resizeTarget.removeEventListener('resize', syncPreviewScale)
    if (resizeObserver) resizeObserver.disconnect()
    if (removalObserver) removalObserver.disconnect()
  }

  if (resizeTarget) resizeTarget.addEventListener('resize', syncPreviewScale)
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(syncPreviewScale)
    resizeObserver.observe(modalBody)
  }
  if (typeof MutationObserver === 'function' && document.body) {
    removalObserver = new MutationObserver(function() {
      if (overlay.isConnected) return
      cleanupPreviewScale()
    })
    removalObserver.observe(document.body, { childList: true })
  }
  requestAnimationFrame(syncPreviewScale)
}

// ====== Per-App Settings Panel ======
function openReaderAppSettings(type, trigger) {
  var ct = getPhoneCustom()
  var labels = { messages:'消息', forum:'论坛', memo:'备忘录', gallery:'相册', browser:'浏览记录', shopping:'购物', contacts:'联系人' }
  var title = '美化 - ' + (labels[type] || 'App')

  var persistedSettings = getAppSettings(type)
  var s = JSON.parse(JSON.stringify(persistedSettings))
  var initialSettingsSnapshot = JSON.parse(JSON.stringify(persistedSettings))
  var appIconDraft = ct.customIcons[type] || ''
  var initialIconSnapshot = appIconDraft
  var appAppearanceDraftKey = 'app-appearance:' + type
  var restoredAppAppearanceDraft = readAppearanceDraft(appAppearanceDraftKey)
  if (restoredAppAppearanceDraft && readerPlainRecord(restoredAppAppearanceDraft.settings)) {
    s = Object.assign({}, s, restoredAppAppearanceDraft.settings)
    if (typeof restoredAppAppearanceDraft.icon === 'string') {
      appIconDraft = restoredAppAppearanceDraft.icon
    }
  }
  var callBackgroundDraft = type === 'messages'
    ? normalizedReaderCallBackgroundSettings(s)
    : null
  var pendingPersistedCallBackground = null
  var pendingPersistedFallbackDraft = null
  if (type === 'messages') {
    var storedMessageSettings = readerPlainRecord(readerPlainRecord(ct.appSettings).messages)
    if (storedMessageSettings.callBackgroundType === 'image' && typeof storedMessageSettings.callBackgroundImage === 'string') {
      var storedImageUrl = canonicalReaderCallBackgroundDataUrl(storedMessageSettings.callBackgroundImage)
      if (!verifiedReaderCallBackgroundImages.has(storedImageUrl)) {
        pendingPersistedCallBackground = {
          callBackgroundType: 'image',
          callBackgroundPreset: callBackgroundDraft.callBackgroundPreset,
          callBackgroundImage: storedMessageSettings.callBackgroundImage
        }
        callBackgroundDraft = {
          callBackgroundType: 'preset',
          callBackgroundPreset: pendingPersistedCallBackground.callBackgroundPreset,
          callBackgroundImage: null
        }
        pendingPersistedFallbackDraft = callBackgroundDraft
      }
    }
  }
  if (type === 'gallery') {
    var normalizedGallery = normalizedReaderGallerySettings(s)
    s.columns = normalizedGallery.columns
    s.imageRadius = normalizedGallery.imageRadius
    s.gap = normalizedGallery.gap
  }
  var body = ''

  if (type === 'messages') {
    var shapes = ['circle', 'rounded', 'square']
    var bubbleSettings =
      cuCollapsibleSubsection('cuMessageAvatar', '头像',
      cuRow('形状', '<div class="cu-shape-group">' + shapes.map(function(sh) { return cuShapeBtn(sh, s.avatarShape === sh) }).join('') + '</div>') +
      cuSliderRow('尺寸', 'cuMsgAvSize', 24, 56, 2, s.avatarSize, 'px'),
      false
      ) +
      cuCollapsibleSubsection('cuMessageSelfBubble', '我方气泡',
      cuColorRow('背景色', [], s.selfBubbleBg, 'cu-self-bg') +
      cuColorRow('文字色', [], s.selfBubbleText, 'cu-self-text') +
      cuSliderRow('圆角', 'cuSelfRadius', 0, 20, 1, s.selfBubbleRadius, 'px') +
      cuRow('气泡皮肤', readerBubbleSkinControls('self', s)) +
      cuRow('显示方式', readerBubbleSkinModeControls('self', s)) +
      cuSliderRow('整体大小', 'cuSelfBubbleSkinSize', 70, 220, 5, s.selfBubbleSkinSize, '%') +
      '<div data-cu-bubble-skin-slice-row="self"' + (s.selfBubbleSkinMode === 'slice' ? '' : ' hidden') + '>' +
        cuSliderRow('边缘保留', 'cuSelfBubbleSkinSlice', 4, 40, 1, s.selfBubbleSkinSlice, 'px') +
      '</div>' +
      cuSliderRow('文字留白', 'cuSelfBubbleSkinPadding', 4, 32, 1, s.selfBubbleSkinPadding, 'px') +
      '<div class="cu-bubble-copy-row"><button type="button" class="rs-action-btn subtle" data-cu-copy-bubble-style="self-to-other">复制到对方气泡</button></div>',
      true
      ) +
      cuCollapsibleSubsection('cuMessageOtherBubble', '对方气泡',
      cuColorRow('背景色', [], s.otherBubbleBg, 'cu-other-bg') +
      cuColorRow('文字色', [], s.otherBubbleText, 'cu-other-text') +
      cuSliderRow('圆角', 'cuOtherRadius', 0, 20, 1, s.otherBubbleRadius, 'px') +
      cuRow('气泡皮肤', readerBubbleSkinControls('other', s)) +
      cuRow('显示方式', readerBubbleSkinModeControls('other', s)) +
      cuSliderRow('整体大小', 'cuOtherBubbleSkinSize', 70, 220, 5, s.otherBubbleSkinSize, '%') +
      '<div data-cu-bubble-skin-slice-row="other"' + (s.otherBubbleSkinMode === 'slice' ? '' : ' hidden') + '>' +
        cuSliderRow('边缘保留', 'cuOtherBubbleSkinSlice', 4, 40, 1, s.otherBubbleSkinSlice, 'px') +
      '</div>' +
      cuSliderRow('文字留白', 'cuOtherBubbleSkinPadding', 4, 32, 1, s.otherBubbleSkinPadding, 'px') +
      '<p class="cu-settings-hint">完整素材不会裁边；只有专门的九宫格素材才需要切片拉伸。图片只保存在当前浏览器。</p>' +
      '<div class="cu-bubble-copy-row"><button type="button" class="rs-action-btn subtle" data-cu-copy-bubble-style="other-to-self">复制到我方气泡</button></div>',
      false
      ) +
      cuCollapsibleSubsection('cuMessageTypography', '文字与时间',
      cuSliderRow('字号', 'cuBubbleFs', 10, 18, 1, s.bubbleFontSize, 'px') +
      cuRow('字重', '<div class="cu-shape-group">' +
        '<button type="button" class="cu-style-btn' + (s.bubbleFontWeight === 400 ? ' active' : '') + '" data-cu-bubble-weight="400">常规</button>' +
        '<button type="button" class="cu-style-btn' + (s.bubbleFontWeight === 500 ? ' active' : '') + '" data-cu-bubble-weight="500">中等</button>' +
        '<button type="button" class="cu-style-btn' + (s.bubbleFontWeight === 800 ? ' active' : '') + '" data-cu-bubble-weight="800">加粗</button>' +
        '</div>') +
      cuColorRow('时间颜色', [], s.timeColor, 'cu-time-color'),
      false
      )
    body += cuSettingsSection('cuMessageBubbles', '气泡与文字', bubbleSettings, true, 'bubbles')

    var backgroundSettings =
      cuColorRow('背景色', [], s.chatBg, 'cu-chat-bg') +
      cuRow('背景图', '<div class="cu-call-background-actions"><button type="button" id="cuChatBackgroundUpload">选择本地图片</button><input type="file" id="cuChatBackgroundFile" accept="image/png,image/jpeg,image/webp" hidden><button type="button" id="cuChatBackgroundClear">清除图片</button></div><p id="cuChatBackgroundState" class="cu-chat-background-state" aria-live="polite"></p><p id="cuChatBackgroundError" class="cu-call-background-error" role="alert" hidden></p>') +
      cuRow('清晰保护', '<label class="rd-checkbox cu-readability-toggle"><input type="checkbox" id="cuChatAutoReadability"' + (s.chatAutoReadability !== false ? ' checked' : '') + '> 自动保障文字清晰</label>') +
      cuRow('填充方式', '<div class="cu-shape-group">' +
        '<button type="button" class="cu-style-btn' + (s.chatBgFit === 'cover' ? ' active' : '') + '" data-cu-chat-bg-fit="cover">铺满</button>' +
        '<button type="button" class="cu-style-btn' + (s.chatBgFit === 'contain' ? ' active' : '') + '" data-cu-chat-bg-fit="contain">完整显示</button>' +
        '</div>') +
      cuSliderRow('明暗', 'cuChatBgTone', -50, 50, 5, s.chatBgTone, '%') +
      cuSliderRow('水平焦点', 'cuChatBgPosX', 0, 100, 1, s.chatBgPositionX, '%') +
      cuSliderRow('垂直焦点', 'cuChatBgPosY', 0, 100, 1, s.chatBgPositionY, '%') +
      '<p class="cu-settings-hint">负数压暗、正数提亮；上传壁纸后也可以直接拖动左侧预览调整焦点。</p>'
    body += cuSettingsSection('cuMessageBackground', '聊天背景', backgroundSettings, false, 'background')

    body += cuSettingsSection('cuMessageActions', '底部操作',
      cuRow('自动适配', '<label class="rd-checkbox cu-readability-toggle"><input type="checkbox" id="cuComposerAutoReadability"' + (s.composerAutoReadability !== false ? ' checked' : '') + '> 跟随聊天背景自动适配</label>') +
      cuColorRow('操作栏背景', [], s.composerBg, 'cu-composer-bg') +
      cuColorRow('输入框背景', [], s.composerInputBg, 'cu-composer-input-bg') +
      cuColorRow('输入框文字', [], s.composerInputText, 'cu-composer-input-text') +
      cuColorRow('输入框边框', [], s.composerInputBorder, 'cu-composer-input-border') +
      cuSliderRow('输入框圆角', 'cuComposerInputRadius', 0, 18, 1, s.composerInputRadius, 'px') +
      cuColorRow('播放 / 回复按钮', [], s.sendButtonBg, 'cu-send-bg') +
      '<div class="cu-message-css-shortcut"><p class="cu-settings-hint">调节以上任一项会切换为自定义；更细的样式可以继续使用当前消息 App 的高级 CSS。</p><button type="button" class="rs-action-btn subtle" id="cuMessageActionsCss">用 CSS 微调</button></div>'
    , false, 'actions')
    body += cuSettingsSection('cuMessageCall', '通话界面',
      '<div id="cuCallBackgroundCard">' + readerCallBackgroundControls(callBackgroundDraft) + '</div>'
    , false, 'call')
  } else if (type === 'forum') {
    var shapes = ['circle', 'rounded', 'square']
    body += cuSettingsSection('cuForumAvatar', '头像',
      cuRow('形状', '<div class="cu-shape-group">' + shapes.map(function(sh) { return cuShapeBtn(sh, s.avatarShape === sh) }).join('') + '</div>')
    , true)
    body += cuSettingsSection('cuForumCards', '帖子卡片',
      cuColorRow('背景色', ['#fff', '#f8f8f8', '#e8f0f8', '#fef9e7'], s.cardBg, 'cu-card-bg') +
      cuSliderRow('圆角', 'cuCardRadius', 0, 16, 1, s.cardRadius, 'px')
    , false)
    body += cuSettingsSection('cuForumTypography', '标题与时间',
      cuColorRow('颜色', ['#555', '#333', '#1a1a2e', '#6366f1'], s.titleColor, 'cu-title-color') +
      cuSliderRow('字号', 'cuTitleSize', 10, 18, 1, s.titleSize, 'px') +
      cuColorRow('时间颜色', ['#999', '#666', '#b0b8c4'], s.timeColor, 'cu-time-color')
    , false)
  } else if (type === 'memo') {
    body += cuSettingsSection('cuMemoStyle', '卡片风格',
      cuRow('样式', '<div class="cu-shape-group">' +
        '<button class="cu-style-btn' + (s.cardStyle === 'plain' ? ' active' : '') + '" data-cu-memo-style="plain">简洁</button>' +
        '<button class="cu-style-btn' + (s.cardStyle === 'sticky' ? ' active' : '') + '" data-cu-memo-style="sticky">便签</button>' +
        '<button class="cu-style-btn' + (s.cardStyle === 'vintage' ? ' active' : '') + '" data-cu-memo-style="vintage">复古</button>' +
        '</div>')
    , true)
    body += cuSettingsSection('cuMemoAppearance', '外观与文字',
      cuColorRow('背景色', ['#fff', '#fef9e7', '#f5e6c8', '#e8f4e8'], s.cardBg, 'cu-card-bg') +
      cuSliderRow('圆角', 'cuCardRadius', 0, 16, 1, s.cardRadius, 'px') +
      cuColorRow('颜色', ['#333', '#555', '#4a3a2a', '#1a1a2e'], s.textColor, 'cu-text-color') +
      cuSliderRow('字号', 'cuFontSize', 10, 16, 1, s.fontSize, 'px') +
      cuSliderRow('行间距', 'cuLineHeight', 1.2, 2.4, 0.1, s.lineHeight, '')
    , false)
  } else if (type === 'gallery') {
    body += cuSettingsSection('cuGalleryGrid', '网格',
      cuRow('列数', '<div class="cu-shape-group">' +
        '<button class="cu-style-btn' + (s.columns === 2 ? ' active' : '') + '" data-cu-gallery-cols="2">2列</button>' +
        '<button class="cu-style-btn' + (s.columns === 3 ? ' active' : '') + '" data-cu-gallery-cols="3">3列</button>' +
        '<button class="cu-style-btn' + (s.columns === 4 ? ' active' : '') + '" data-cu-gallery-cols="4">4列</button>' +
        '</div>')
    , true)
    body += cuSettingsSection('cuGalleryAppearance', '图片外观',
      cuSliderRow('图片圆角', 'cuImgRadius', 0, 16, 1, s.imageRadius, 'px') +
      cuSliderRow('间距', 'cuGap', 2, 16, 2, s.gap, 'px')
    , false)
  } else if (type === 'browser') {
    body += cuSettingsSection('cuBrowserTypography', '标题与 URL',
      cuColorRow('颜色', ['#555', '#333', '#6366f1', '#1a1a2e'], s.titleColor, 'cu-title-color') +
      cuSliderRow('字号', 'cuTitleSize', 10, 16, 1, s.titleSize, 'px') +
      cuColorRow('URL 颜色', ['#999', '#666', '#888'], s.urlColor, 'cu-url-color')
    , true)
    body += cuSettingsSection('cuBrowserEntries', '时间与条目',
      cuColorRow('时间颜色', ['#999', '#666', '#b0b8c4'], s.timeColor, 'cu-time-color') +
      cuSliderRow('圆角', 'cuEntryRadius', 0, 12, 1, s.entryRadius, 'px')
    , false)
  } else if (type === 'shopping') {
    body += cuSettingsSection('cuShoppingNames', '商品名称',
      cuColorRow('颜色', ['#333', '#555', '#1a1a2e'], s.nameColor, 'cu-name-color') +
      cuSliderRow('字号', 'cuNameSize', 10, 16, 1, s.nameSize, 'px')
    , true)
    body += cuSettingsSection('cuShoppingPrices', '价格',
      cuColorRow('颜色', ['#a3bded', '#ef4444', '#f59e0b', '#10b981'], s.priceColor, 'cu-price-color')
    , false)
  } else if (type === 'contacts') {
    var shapes = ['circle', 'rounded', 'square']
    body += cuSettingsSection('cuContactsAvatar', '头像',
      cuRow('形状', '<div class="cu-shape-group">' + shapes.map(function(sh) { return cuShapeBtn(sh, s.avatarShape === sh) }).join('') + '</div>')
    , true)
    body += cuSettingsSection('cuContactsNames', '名称',
      cuColorRow('颜色', ['#555', '#333', '#6366f1', '#1a1a2e'], s.nameColor, 'cu-name-color') +
      cuSliderRow('字号', 'cuNameSize', 10, 18, 1, s.nameSize, 'px')
    , false)
  }

  // Icon card - for all app types
  ct.customIcons = ct.customIcons || {}
  var curIcon = appIconDraft
  var iconSettings = cuRow('自定义', '<div style="display:flex;gap:6px;align-items:center">' +
      '<input class="rd-input rd-input-sm" id="cuIconUrl" value="' + esc(curIcon) + '" placeholder="输入图标URL或上传...">' +
      '<button style="padding:4px 10px;font-size:.7rem;border:1px solid var(--c-primary-hover);background:transparent;color:var(--c-primary-hover);cursor:pointer;white-space:nowrap" id="cuIconUpload">上传</button>' +
      (curIcon ? '<button style="padding:4px 10px;font-size:.7rem;border:1px solid #D9A0B3;background:transparent;color:#D9A0B3;cursor:pointer;white-space:nowrap" id="cuIconClear">清除</button>' : '') +
      '</div>')
  if (curIcon) iconSettings += '<div class="rd-preview-img"><img src="' + esc(curIcon) + '" style="max-height:40px;border-radius:4px"></div>'

  var advancedCssSettings = '<div class="rs-css-section">' +
      '<textarea id="cuAppCustomCss" class="rs-css-editor" maxlength="' + READER_CUSTOM_CSS_MAX_LENGTH + '" spellcheck="false" aria-describedby="cuAppCssHint cuAppCssError" placeholder=".rd-phone-app-body { padding: 14px; }">' + esc(s.customCss || '') + '</textarea>' +
      '<div class="rs-css-meta"><p class="rs-field-hint" id="cuAppCssHint">只作用于当前 App；外链、@ 规则、固定定位和覆盖点击会被拦截。</p><span id="cuAppCssCount">' + String((s.customCss || '').length) + ' / ' + READER_CUSTOM_CSS_MAX_LENGTH + '</span></div>' +
      '<p class="rs-css-error" id="cuAppCssError" role="alert" hidden></p>' +
      '<div class="rs-css-actions"><button type="button" class="rs-action-btn subtle" id="cuAppCssSample">填入示例</button><button type="button" class="rs-action-btn subtle" id="cuAppCssClear">清空 CSS</button></div>' +
    '</div>'
  if (type === 'messages') {
    body += cuSettingsSection('cuMessageMore', '应用与高级',
      cuSettingsSubsection('应用图标', iconSettings) +
      cuSettingsSubsection('高级 CSS', advancedCssSettings),
    false)
  } else {
    body += cuSettingsSection('cuAppMore', '应用与高级',
      cuSettingsSubsection('应用图标', iconSettings) +
      cuSettingsSubsection('高级 CSS', advancedCssSettings),
    false)
  }

  body += '<div style="text-align:center;padding-top:8px"><button class="cu-reset-btn" id="cuAppReset">恢复默认</button></div>'

  body = readerAppearancePagerMarkup() +
    '<div class="app-appearance-layout appearance-workbench-pages" data-appearance-active-page="preview">' +
    '<aside class="app-appearance-preview-pane appearance-workbench-page" data-appearance-page="preview">' +
    renderCuPreview(type, s) +
    '<p class="phone-appearance-status" id="cuAppLiveStatus" role="status" aria-live="polite">实时预览 · 保存后应用到实际 App</p>' +
    '</aside><div class="app-appearance-controls appearance-workbench-page" data-appearance-page="controls">' + body + '</div></div>'

  var ov = openCuModal(title, body, function(modal) {
    // Helper: read color from active button or from picker
    function readColor(attr, key) {
      var btn = modal.querySelector('.cu-color-btn.active[data-' + attr + ']')
      if (btn) { s[key] = btn.getAttribute('data-' + attr); return }
      var picker = modal.querySelector('.cu-color-picker[data-' + attr + '-picker]')
      if (picker && picker.value) {
        s[key] = picker.getAttribute('data-' + attr + '-picker') || picker.value
      }
    }
    readColor('cu-self-bg', 'selfBubbleBg')
    readColor('cu-self-text', 'selfBubbleText')
    readColor('cu-other-bg', 'otherBubbleBg')
    readColor('cu-other-text', 'otherBubbleText')
    readColor('cu-chat-bg', 'chatBg')
    readColor('cu-time-color', 'timeColor')
    readColor('cu-send-bg', 'sendButtonBg')
    readColor('cu-composer-bg', 'composerBg')
    readColor('cu-composer-input-bg', 'composerInputBg')
    readColor('cu-composer-input-text', 'composerInputText')
    readColor('cu-composer-input-border', 'composerInputBorder')
    readColor('cu-card-bg', 'cardBg')
    readColor('cu-title-color', 'titleColor')
    readColor('cu-text-color', 'textColor')
    readColor('cu-url-color', 'urlColor')
    readColor('cu-name-color', 'nameColor')
    readColor('cu-price-color', 'priceColor')
    var shapeBtns = modal.querySelectorAll('.cu-shape-btn.active')
    shapeBtns.forEach(function(b) {
      if (b.dataset.cuShape) s.avatarShape = b.dataset.cuShape
    })
    // Sliders
    function readSlider(id, key) {
      var el = modal.querySelector('#' + id)
      if (el) assignFiniteSetting(s, key, el.value)
    }
    readSlider('cuMsgAvSize', 'avatarSize')
    readSlider('cuSelfRadius', 'selfBubbleRadius')
    readSlider('cuOtherRadius', 'otherBubbleRadius')
    readSlider('cuSelfBubbleSkinSize', 'selfBubbleSkinSize')
    readSlider('cuOtherBubbleSkinSize', 'otherBubbleSkinSize')
    readSlider('cuSelfBubbleSkinSlice', 'selfBubbleSkinSlice')
    readSlider('cuSelfBubbleSkinPadding', 'selfBubbleSkinPadding')
    readSlider('cuOtherBubbleSkinSlice', 'otherBubbleSkinSlice')
    readSlider('cuOtherBubbleSkinPadding', 'otherBubbleSkinPadding')
    readSlider('cuBubbleFs', 'bubbleFontSize')
    readSlider('cuCardRadius', 'cardRadius')
    readSlider('cuTitleSize', 'titleSize')
    readSlider('cuFontSize', 'fontSize')
    readSlider('cuLineHeight', 'lineHeight')
    readSlider('cuImgRadius', 'imageRadius')
    readSlider('cuGap', 'gap')
    readSlider('cuEntryRadius', 'entryRadius')
    readSlider('cuNameSize', 'nameSize')
    readSlider('cuChatBgPosX', 'chatBgPositionX')
    readSlider('cuChatBgPosY', 'chatBgPositionY')
    readSlider('cuChatBgTone', 'chatBgTone')
    readSlider('cuComposerInputRadius', 'composerInputRadius')
    var readabilityToggle = modal.querySelector('#cuChatAutoReadability')
    if (readabilityToggle) s.chatAutoReadability = readabilityToggle.checked
    var composerReadabilityToggle = modal.querySelector('#cuComposerAutoReadability')
    if (composerReadabilityToggle) s.composerAutoReadability = composerReadabilityToggle.checked
    // Style buttons
    var memoStyleBtn = modal.querySelector('.cu-style-btn.active[data-cu-memo-style]')
    if (memoStyleBtn) s.cardStyle = memoStyleBtn.dataset.cuMemoStyle
    var galleryColBtn = modal.querySelector('.cu-style-btn.active[data-cu-gallery-cols]')
    if (galleryColBtn) s.columns = parseInt(galleryColBtn.dataset.cuGalleryCols) || 3
    var bubbleWeightBtn = modal.querySelector('.cu-style-btn.active[data-cu-bubble-weight]')
    if (bubbleWeightBtn) s.bubbleFontWeight = normalizedReaderBubbleFontWeight(bubbleWeightBtn.dataset.cuBubbleWeight)
    modal.querySelectorAll('.cu-style-btn.active[data-cu-bubble-skin-mode]').forEach(function(button) {
      var prefix = button.dataset.cuBubbleSkinSide === 'self' ? 'self' : 'other'
      s[prefix + 'BubbleSkinMode'] = button.dataset.cuBubbleSkinMode === 'slice' ? 'slice' : 'full'
    })
    var chatBgFitBtn = modal.querySelector('.cu-style-btn.active[data-cu-chat-bg-fit]')
    if (chatBgFitBtn) s.chatBgFit = chatBgFitBtn.dataset.cuChatBgFit === 'contain' ? 'contain' : 'cover'
    var customCssInput = modal.querySelector('#cuAppCustomCss')
    s.customCss = customCssInput && typeof customCssInput.value === 'string'
      ? customCssInput.value.slice(0, READER_CUSTOM_CSS_MAX_LENGTH)
      : ''
    var customCssValidation = compileScopedReaderCss(s.customCss, '.rd-phone-app-' + readerAppCssType(type))
    if (!customCssValidation.ok) throw new Error(customCssValidation.error)
    // Read icon URL
    var iconUrlEl = modal.querySelector('#cuIconUrl')
    appIconDraft = iconUrlEl ? iconUrlEl.value.trim() : appIconDraft
    if (appIconDraft) ct.customIcons[type] = appIconDraft
    else delete ct.customIcons[type]
    if (type === 'messages') {
      Object.assign(s, normalizedReaderCallBackgroundSettings(callBackgroundDraft))
      s.chatBgImage = ov._readerChatBgImageDraft || null
      s.chatBgLuminance = Number.isFinite(ov._readerChatBgLuminanceDraft)
        ? ov._readerChatBgLuminanceDraft
        : null
      s.selfBubbleSkinImage = ov._readerBubbleSkinDraft.self || null
      s.otherBubbleSkinImage = ov._readerBubbleSkinDraft.other || null
    }
    ct.appSettings[type] = s
    try {
      savePhoneCustom(ct)
      clearAppearanceDraft(appAppearanceDraftKey)
    } catch (error) {
      var callBackgroundStorageError = modal.querySelector('#cuCallBackgroundError')
      if (callBackgroundStorageError) {
        callBackgroundStorageError.textContent = '通话背景保存失败，请检查浏览器存储空间后重试。'
        callBackgroundStorageError.hidden = false
      }
      throw error
    }
    applyReaderAppCustomCss(type, s)
    renderCustomPage()
    showReaderToast((labels[type] || 'App') + '美化已保存')
  }, trigger)
  var appAppearanceDialog = ov.querySelector('.cu-modal')
  if (appAppearanceDialog) appAppearanceDialog.classList.add('app-appearance-workbench')
  if (type === 'messages' && appAppearanceDialog) appAppearanceDialog.classList.add('is-message-appearance')
  bindReaderAppearancePager(ov)
  bindReaderAppPreviewAutoScale(ov)
  if (type === 'messages') {
    ov._readerChatBgImageDraft = s.chatBgImage || null
    ov._readerChatBgLuminanceDraft = Number.isFinite(s.chatBgLuminance)
      ? s.chatBgLuminance
      : null
    ov._readerBubbleSkinDraft = {
      self: s.selfBubbleSkinImage || null,
      other: s.otherBubbleSkinImage || null
    }
  }

  function readerAppDraftSnapshot(settings) {
    var draft = JSON.parse(JSON.stringify(settings || readCurrentSettings(ov, type)))
    if (type === 'messages') {
      Object.assign(draft, normalizedReaderCallBackgroundSettings(callBackgroundDraft))
      draft.chatBgImage = ov._readerChatBgImageDraft || null
      draft.chatBgLuminance = Number.isFinite(ov._readerChatBgLuminanceDraft)
        ? ov._readerChatBgLuminanceDraft
        : null
      draft.selfBubbleSkinImage = ov._readerBubbleSkinDraft.self || null
      draft.otherBubbleSkinImage = ov._readerBubbleSkinDraft.other || null
      var readabilityToggle = ov.querySelector('#cuChatAutoReadability')
      draft.chatAutoReadability = readabilityToggle ? readabilityToggle.checked : draft.chatAutoReadability !== false
      var composerReadabilityToggle = ov.querySelector('#cuComposerAutoReadability')
      draft.composerAutoReadability = composerReadabilityToggle
        ? composerReadabilityToggle.checked
        : draft.composerAutoReadability !== false
    }
    var iconInput = ov.querySelector('#cuIconUrl')
    return {
      settings: draft,
      icon: iconInput ? iconInput.value.trim() : appIconDraft
    }
  }

  var initialDraftSignature = JSON.stringify({
    settings: initialSettingsSnapshot,
    icon: initialIconSnapshot
  })
  ov._readerAppDraftDirty = function(settings) {
    return JSON.stringify(readerAppDraftSnapshot(settings)) !== initialDraftSignature
  }
  ov.setReaderBeforeClose(function() {
    if (!ov._readerAppDraftDirty()) {
      clearAppearanceDraft(appAppearanceDraftKey)
      return true
    }
    writeAppearanceDraft(appAppearanceDraftKey, readerAppDraftSnapshot())
    showReaderToast('已暂存刚才的 ' + (labels[type] || 'App') + ' 美化调整')
    return true
  })
  if (restoredAppAppearanceDraft) {
    showReaderToast('已恢复刚才未保存的 ' + (labels[type] || 'App') + ' 美化调整')
  }

  function showOriginalReaderAppPreview() {
    if (!ov.isConnected || appAppearanceDialog.classList.contains('is-comparing-original')) return
    var preview = ov.querySelector('#cuPreview')
    if (!preview) return
    preview.innerHTML = renderCuPreview(type, initialSettingsSnapshot)
      .replace(/^<div class="cu-preview"[^>]*>/, '')
      .replace(/<\/div>$/, '')
    appAppearanceDialog.classList.add('is-comparing-original')
  }

  function restoreReaderAppDraftPreview() {
    if (!appAppearanceDialog.classList.contains('is-comparing-original')) return
    appAppearanceDialog.classList.remove('is-comparing-original')
    updateCuPreview(ov, type)
  }

  var comparisonTimer = null
  var comparisonPointerId = null
  var comparisonStartX = 0
  var comparisonStartY = 0

  function clearComparisonPointer() {
    if (comparisonTimer !== null) globalThis.clearTimeout(comparisonTimer)
    comparisonTimer = null
    comparisonPointerId = null
    document.removeEventListener('pointermove', moveReaderAppComparison)
    document.removeEventListener('pointerup', finishReaderAppComparison)
    document.removeEventListener('pointercancel', finishReaderAppComparison)
  }

  function moveReaderAppComparison(event) {
    if (comparisonPointerId !== null && event.pointerId !== comparisonPointerId) return
    if (appAppearanceDialog.classList.contains('is-comparing-original')) return
    if (Math.max(
      Math.abs(event.clientX - comparisonStartX),
      Math.abs(event.clientY - comparisonStartY)
    ) <= 6) return
    clearComparisonPointer()
  }

  function finishReaderAppComparison(event) {
    if (comparisonPointerId !== null && event.pointerId !== undefined && event.pointerId !== comparisonPointerId) return
    clearComparisonPointer()
    restoreReaderAppDraftPreview()
  }

  ov.addEventListener('pointerdown', function(event) {
    var frame = event.target.closest && event.target.closest('.reader-app-preview-frame')
    if (!frame || event.button !== 0 || comparisonPointerId !== null) return
    comparisonPointerId = event.pointerId
    comparisonStartX = event.clientX
    comparisonStartY = event.clientY
    comparisonTimer = globalThis.setTimeout(function() {
      comparisonTimer = null
      showOriginalReaderAppPreview()
    }, 220)
    document.addEventListener('pointermove', moveReaderAppComparison)
    document.addEventListener('pointerup', finishReaderAppComparison)
    document.addEventListener('pointercancel', finishReaderAppComparison)
  })

  ov.addEventListener('keydown', function(event) {
    if (event.key !== ' ' || event.repeat || !event.target.closest('.reader-app-preview-frame')) return
    event.preventDefault()
    showOriginalReaderAppPreview()
  })
  function releaseReaderAppComparison(event) {
    if (!ov.isConnected) {
      document.removeEventListener('keyup', releaseReaderAppComparison)
      return
    }
    if (event.key !== ' ') return
    restoreReaderAppDraftPreview()
  }
  document.addEventListener('keyup', releaseReaderAppComparison)
  if (typeof MutationObserver === 'function' && document.body) {
    var comparisonRemovalObserver = new MutationObserver(function() {
      if (ov.isConnected) return
      clearComparisonPointer()
      document.removeEventListener('keyup', releaseReaderAppComparison)
      comparisonRemovalObserver.disconnect()
    })
    comparisonRemovalObserver.observe(document.body, { childList:true })
  }

  var messageSettingsSections = Array.from(ov.querySelectorAll('.app-appearance-controls > .cu-settings-section'))

  function revealMessageSettingsSection(sectionId, moveFocus) {
    var section = ov.querySelector('#' + sectionId)
    if (!section) return
    messageSettingsSections.forEach(function(candidate) {
      candidate.open = candidate === section
      if (candidate !== section) candidate.classList.remove('is-preview-targeted')
    })
    section.classList.add('is-preview-targeted')
    globalThis.setTimeout(function() {
      if (section.isConnected) section.classList.remove('is-preview-targeted')
    }, 650)
    var summary = section.querySelector('summary')
    if (moveFocus && summary && typeof summary.focus === 'function') summary.focus({ preventScroll: true })
    if (typeof section.scrollIntoView === 'function') {
      section.scrollIntoView({
        behavior: shouldUseMotion() ? 'smooth' : 'auto',
        block: 'start'
      })
    }
    var settingsPage = ov.querySelector('[data-appearance-page-target="controls"]')
    if (settingsPage) settingsPage.click()
  }

  function revealMessageBubbleSubsection(subsectionId) {
    var bubbleSection = ov.querySelector('#cuMessageBubbles')
    if (!bubbleSection) return
    bubbleSection.querySelectorAll('.cu-settings-subsection-collapsible').forEach(function(subsection) {
      subsection.open = subsection.id === subsectionId
    })
  }

  messageSettingsSections.forEach(function(section) {
    section.addEventListener('toggle', function() {
      if (!section.open) return
      messageSettingsSections.forEach(function(candidate) {
        if (candidate !== section) candidate.open = false
      })
    })
  })

  if (type === 'messages') {
    ov.addEventListener('click', function(event) {
      var previewChat = event.target.closest && event.target.closest('.rd-app-preview-chat')
      if (!previewChat) return
      if (event.target.closest('#chatSendBtn, .chat-composer')) {
        event.preventDefault()
        revealMessageSettingsSection('cuMessageActions', event.detail === 0)
        return
      }
      if (event.target.closest('.chat-avatar')) {
        event.preventDefault()
        revealMessageSettingsSection('cuMessageBubbles', event.detail === 0)
        revealMessageBubbleSubsection('cuMessageAvatar')
        return
      }
      if (event.target.closest('.chat-bubble')) {
        event.preventDefault()
        revealMessageSettingsSection('cuMessageBubbles', event.detail === 0)
        revealMessageBubbleSubsection(event.target.closest('.chat-msg.self') ? 'cuMessageSelfBubble' : 'cuMessageOtherBubble')
        return
      }
      if (event.target.closest('.rd-chat-time')) {
        event.preventDefault()
        revealMessageSettingsSection('cuMessageBubbles', event.detail === 0)
        revealMessageBubbleSubsection('cuMessageTypography')
        return
      }
      if (event.target.closest('.chat-msg-area')) {
        event.preventDefault()
        revealMessageSettingsSection('cuMessageBackground', event.detail === 0)
      }
    })

    ov.addEventListener('pointerdown', function(event) {
      var area = event.target.closest && event.target.closest('.rd-app-preview-chat .chat-msg-area')
      if (!area || event.target !== area) return
      var previewChat = area.closest('.rd-app-preview-chat')
      if (!previewChat || previewChat.dataset.chatBackgroundImage !== 'true') return
      var rect = area.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      var startX = event.clientX
      var startY = event.clientY
      var moved = false
      var pointerId = event.pointerId

      function updateWallpaperFocus(pointerEvent) {
        var deltaX = Math.abs(pointerEvent.clientX - startX)
        var deltaY = Math.abs(pointerEvent.clientY - startY)
        if (!moved && Math.max(deltaX, deltaY) < 4) return
        moved = true
        var x = Math.max(0, Math.min(100, Math.round((pointerEvent.clientX - rect.left) / rect.width * 100)))
        var y = Math.max(0, Math.min(100, Math.round((pointerEvent.clientY - rect.top) / rect.height * 100)))
        var positionX = ov.querySelector('#cuChatBgPosX')
        var positionY = ov.querySelector('#cuChatBgPosY')
        var positionXValue = ov.querySelector('#cuChatBgPosXVal')
        var positionYValue = ov.querySelector('#cuChatBgPosYVal')
        if (positionX) positionX.value = String(x)
        if (positionY) positionY.value = String(y)
        setReaderRangeOutput(positionXValue, x + '%')
        setReaderRangeOutput(positionYValue, y + '%')
        previewChat.classList.add('is-wallpaper-dragging')
        previewChat.style.setProperty('--chat-bg-position', x + '% ' + y + '%')
        pointerEvent.preventDefault()
      }

      function finishWallpaperFocus(pointerEvent) {
        if (pointerEvent.pointerId !== undefined && pointerId !== undefined && pointerEvent.pointerId !== pointerId) return
        document.removeEventListener('pointermove', updateWallpaperFocus)
        document.removeEventListener('pointerup', finishWallpaperFocus)
        document.removeEventListener('pointercancel', finishWallpaperFocus)
        previewChat.classList.remove('is-wallpaper-dragging')
        if (moved && ov.isConnected) {
          revealMessageSettingsSection('cuMessageBackground', false)
          updateCuPreview(ov, type)
        }
      }

      document.addEventListener('pointermove', updateWallpaperFocus)
      document.addEventListener('pointerup', finishWallpaperFocus)
      document.addEventListener('pointercancel', finishWallpaperFocus)
    })
  } else {
    var previewSectionTargets = {
      forum:[
        ['.rd-forum-avatar', 'cuForumAvatar'],
        ['.rd-forum-title, .rd-forum-meta', 'cuForumTypography'],
        ['.rd-post-card', 'cuForumCards']
      ],
      memo:[
        ['.rd-memo-note', 'cuMemoAppearance'],
        ['.rd-memo-stack', 'cuMemoStyle']
      ],
      gallery:[
        ['.rd-gallery-photo', 'cuGalleryAppearance'],
        ['.rd-gallery-grid, .gallery-bar', 'cuGalleryGrid']
      ],
      browser:[
        ['.rd-browser-title, .rd-browser-url', 'cuBrowserTypography'],
        ['.rd-browser-entry, .rd-browser-time', 'cuBrowserEntries']
      ],
      shopping:[
        ['.rd-shop-name', 'cuShoppingNames'],
        ['.rd-shop-price', 'cuShoppingPrices']
      ],
      contacts:[
        ['.rd-forum-avatar, .rd-contact-avatar', 'cuContactsAvatar'],
        ['.rd-contact-row, .rd-contact-name', 'cuContactsNames']
      ]
    }
    ov.addEventListener('click', function(event) {
      var previewFrame = event.target.closest && event.target.closest('.reader-app-preview-frame')
      if (!previewFrame) return
      var targets = previewSectionTargets[type] || []
      for (var targetIndex = 0; targetIndex < targets.length; targetIndex++) {
        if (!event.target.closest(targets[targetIndex][0])) continue
        event.preventDefault()
        revealMessageSettingsSection(targets[targetIndex][1], event.detail === 0)
        return
      }
    })
  }

  var bubbleSkinOperationVersion = { self:0, other:0 }
  var bubbleSkinPending = { self:false, other:false }
  var bubbleSkinMeta = { self:null, other:null }

  function readerBubbleSkinKey(side) {
    return side === 'self' ? 'Self' : 'Other'
  }

  function showReaderBubbleSkinError(side, message) {
    var error = ov.querySelector('#cu' + readerBubbleSkinKey(side) + 'BubbleSkinError')
    if (!error) return
    error.hidden = !message
    error.textContent = message || ''
  }

  function syncReaderBubbleSkinControls(side) {
    var key = readerBubbleSkinKey(side)
    var hasImage = !!(ov._readerBubbleSkinDraft && ov._readerBubbleSkinDraft[side])
    var clear = ov.querySelector('#cu' + key + 'BubbleSkinClear')
    var state = ov.querySelector('#cu' + key + 'BubbleSkinState')
    var size = ov.querySelector('#cu' + key + 'BubbleSkinSize')
    var slice = ov.querySelector('#cu' + key + 'BubbleSkinSlice')
    var padding = ov.querySelector('#cu' + key + 'BubbleSkinPadding')
    var modeButtons = ov.querySelectorAll('[data-cu-bubble-skin-mode][data-cu-bubble-skin-side="' + side + '"]')
    var activeMode = ov.querySelector('.active[data-cu-bubble-skin-mode][data-cu-bubble-skin-side="' + side + '"]')
    var mode = activeMode && activeMode.dataset.cuBubbleSkinMode === 'slice' ? 'slice' : 'full'
    var sliceRow = ov.querySelector('[data-cu-bubble-skin-slice-row="' + side + '"]')
    if (clear) clear.disabled = !hasImage
    if (size) size.disabled = !hasImage
    if (slice) slice.disabled = !hasImage || mode !== 'slice'
    if (padding) padding.disabled = !hasImage
    modeButtons.forEach(function(button) { button.disabled = !hasImage })
    if (sliceRow) sliceRow.hidden = mode !== 'slice'
    if (state) {
      state.textContent = hasImage
        ? (mode === 'full'
          ? '完整显示整张素材；可继续调整大小与文字留白。'
          : '切片拉伸边缘；适合中心区域可以延展的素材。')
        : '未使用，继续显示背景色与圆角。'
      if (hasImage && bubbleSkinMeta[side]) {
        renderReaderAppearanceImageChoice(state, bubbleSkinMeta[side], function(nextUrl, nextMeta) {
          ov._readerBubbleSkinDraft[side] = nextUrl
          bubbleSkinMeta[side] = nextMeta
          var section = ov.querySelector('#cuMessageBubbles')
          if (section) section.dataset.appearanceManualVersion = String(Number(section.dataset.appearanceManualVersion || 0) + 1)
          syncReaderBubbleSkinControls(side)
          updateCuPreview(ov, type)
          if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
        })
      }
    }
  }

  function syncReaderBubbleSkinPending() {
    var save = ov.querySelector('#cuModalSave')
    if (!save) return
    if (bubbleSkinPending.self || bubbleSkinPending.other) save.dataset.readerAsyncPending = 'true'
    else delete save.dataset.readerAsyncPending
    syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
  }

  function bindReaderBubbleSkinControls(side) {
    var key = readerBubbleSkinKey(side)
    var upload = ov.querySelector('#cu' + key + 'BubbleSkinUpload')
    var fileInput = ov.querySelector('#cu' + key + 'BubbleSkinFile')
    var clear = ov.querySelector('#cu' + key + 'BubbleSkinClear')
    if (upload && fileInput) {
      upload.onclick = function() { fileInput.click() }
      fileInput.onchange = function() {
        var file = fileInput.files && fileInput.files[0]
        if (!file) return
        fileInput.value = ''
        var operationVersion = ++bubbleSkinOperationVersion[side]
        showReaderBubbleSkinError(side, '')
        bubbleSkinPending[side] = true
        syncReaderBubbleSkinPending()
        readReaderCallBackgroundFile(file).then(function(dataUrl) {
          if (!ov.isConnected || operationVersion !== bubbleSkinOperationVersion[side]) return
          ov._readerBubbleSkinDraft[side] = dataUrl
          syncReaderBubbleSkinControls(side)
          updateCuPreview(ov, type)
          inspectReaderAppearanceImage(dataUrl, file.size).then(function(meta) {
            if (!meta || !ov.isConnected || operationVersion !== bubbleSkinOperationVersion[side]) return
            bubbleSkinMeta[side] = meta
            syncReaderBubbleSkinControls(side)
            var section = ov.querySelector('#cuMessageBubbles')
            if (section) section.dataset.appearanceManualVersion = String(Number(section.dataset.appearanceManualVersion || 0) + 1)
            if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
          })
        }).catch(function(error) {
          if (!ov.isConnected || operationVersion !== bubbleSkinOperationVersion[side]) return
          showReaderBubbleSkinError(side, error && error.message ? error.message : '图片无法使用')
        }).finally(function() {
          if (!ov.isConnected || operationVersion !== bubbleSkinOperationVersion[side]) return
          bubbleSkinPending[side] = false
          syncReaderBubbleSkinPending()
        })
      }
    }
    if (clear) clear.onclick = function() {
      bubbleSkinOperationVersion[side] += 1
      bubbleSkinPending[side] = false
      ov._readerBubbleSkinDraft[side] = null
      bubbleSkinMeta[side] = null
      showReaderBubbleSkinError(side, '')
      syncReaderBubbleSkinControls(side)
      syncReaderBubbleSkinPending()
      updateCuPreview(ov, type)
    }
    syncReaderBubbleSkinControls(side)
  }

  if (type === 'messages') {
    bindReaderBubbleSkinControls('self')
    bindReaderBubbleSkinControls('other')
  }

  var chatBackgroundSaveButton = ov.querySelector('#cuModalSave')
  var chatBackgroundError = ov.querySelector('#cuChatBackgroundError')
  var chatBackgroundState = ov.querySelector('#cuChatBackgroundState')
  var chatBackgroundClear = ov.querySelector('#cuChatBackgroundClear')
  var chatBackgroundOperationVersion = 0
  var chatBackgroundMeta = null

  function syncReaderChatBackgroundControls() {
    var hasImage = !!ov._readerChatBgImageDraft
    if (chatBackgroundClear) chatBackgroundClear.disabled = !hasImage
    if (chatBackgroundState) {
      chatBackgroundState.textContent = hasImage
        ? '已选择本地图片；可以拖动左侧预览调整壁纸焦点。'
        : '当前使用背景色。'
      if (hasImage && chatBackgroundMeta) {
        renderReaderAppearanceImageChoice(chatBackgroundState, chatBackgroundMeta, function(nextUrl, nextMeta) {
          ov._readerChatBgImageDraft = nextUrl
          chatBackgroundMeta = nextMeta
          var section = ov.querySelector('#cuMessageBackground')
          if (section) section.dataset.appearanceManualVersion = String(Number(section.dataset.appearanceManualVersion || 0) + 1)
          syncReaderChatBackgroundControls()
          updateCuPreview(ov, type)
          if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
        })
      }
    }
  }

  function showReaderChatBackgroundError(message) {
    if (!chatBackgroundError) return
    chatBackgroundError.hidden = !message
    chatBackgroundError.textContent = message || ''
  }

  function finishReaderChatBackgroundOperation(version) {
    if (!ov.isConnected || version !== chatBackgroundOperationVersion) return
    if (chatBackgroundSaveButton) {
      delete chatBackgroundSaveButton.dataset.readerAsyncPending
      syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
    }
  }

  var chatBackgroundUpload = ov.querySelector('#cuChatBackgroundUpload')
  var chatBackgroundFile = ov.querySelector('#cuChatBackgroundFile')
  if (chatBackgroundUpload && chatBackgroundFile) {
    chatBackgroundUpload.onclick = function() { chatBackgroundFile.click() }
    chatBackgroundFile.onchange = function() {
      var file = chatBackgroundFile.files && chatBackgroundFile.files[0]
      if (!file) return
      chatBackgroundFile.value = ''
      var operationVersion = ++chatBackgroundOperationVersion
      showReaderChatBackgroundError('')
      if (chatBackgroundSaveButton) {
        chatBackgroundSaveButton.dataset.readerAsyncPending = 'true'
        chatBackgroundSaveButton.disabled = true
      }
      readReaderCallBackgroundFile(file).then(function(dataUrl) {
        if (!ov.isConnected || operationVersion !== chatBackgroundOperationVersion) return
        ov._readerChatBgImageDraft = dataUrl
        ov._readerChatBgLuminanceDraft = verifiedReaderImageLuminance.has(dataUrl)
          ? verifiedReaderImageLuminance.get(dataUrl)
          : null
        syncReaderChatBackgroundControls()
        updateCuPreview(ov, type)
        inspectReaderAppearanceImage(dataUrl, file.size).then(function(meta) {
          if (!meta || !ov.isConnected || operationVersion !== chatBackgroundOperationVersion) return
          chatBackgroundMeta = meta
          syncReaderChatBackgroundControls()
          var section = ov.querySelector('#cuMessageBackground')
          if (section) section.dataset.appearanceManualVersion = String(Number(section.dataset.appearanceManualVersion || 0) + 1)
          if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
        })
      }).catch(function(error) {
        if (!ov.isConnected || operationVersion !== chatBackgroundOperationVersion) return
        showReaderChatBackgroundError(error && error.message ? error.message : '图片无法使用')
      }).finally(function() {
        finishReaderChatBackgroundOperation(operationVersion)
      })
    }
  }
  if (chatBackgroundClear) chatBackgroundClear.onclick = function() {
    chatBackgroundOperationVersion += 1
    ov._readerChatBgImageDraft = null
    ov._readerChatBgLuminanceDraft = null
    chatBackgroundMeta = null
    showReaderChatBackgroundError('')
    syncReaderChatBackgroundControls()
    updateCuPreview(ov, type)
  }
  syncReaderChatBackgroundControls()

  var callBackgroundSaveButton = ov.querySelector('#cuModalSave')
  var callBackgroundError = ov.querySelector('#cuCallBackgroundError')
  var callBackgroundState = ov.querySelector('#cuCallBackgroundState')
  var callBackgroundOperationVersion = 0
  var callBackgroundMeta = null

  function clearReaderCallBackgroundError() {
    if (!callBackgroundError) return
    callBackgroundError.hidden = true
    callBackgroundError.textContent = ''
  }

  function showReaderCallBackgroundError(message) {
    if (!callBackgroundError) return
    callBackgroundError.textContent = message
    callBackgroundError.hidden = false
  }

  function invalidateReaderCallBackgroundOperation() {
    callBackgroundOperationVersion += 1
    if (callBackgroundSaveButton) {
      delete callBackgroundSaveButton.dataset.readerAsyncPending
      syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
    }
  }

  ov.querySelectorAll('.cu-call-background-preset').forEach(function(button) {
    button.onclick = function() {
      invalidateReaderCallBackgroundOperation()
      clearReaderCallBackgroundError()
      callBackgroundMeta = null
      if (callBackgroundState) callBackgroundState.textContent = ''
      callBackgroundDraft = {
        callBackgroundType: 'preset',
        callBackgroundPreset: button.dataset.cuCallBackgroundPreset,
        callBackgroundImage: null
      }
      syncReaderCallBackgroundControls(ov, callBackgroundDraft)
      syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
    }
  })
  var callBackgroundRestore = ov.querySelector('#cuCallBackgroundRestore')
  if (callBackgroundRestore) callBackgroundRestore.onclick = function() {
    invalidateReaderCallBackgroundOperation()
    clearReaderCallBackgroundError()
    callBackgroundMeta = null
    if (callBackgroundState) callBackgroundState.textContent = ''
    callBackgroundDraft = Object.assign({}, READER_CALL_BACKGROUND_DEFAULT)
    syncReaderCallBackgroundControls(ov, callBackgroundDraft)
    syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
  }

  if (pendingPersistedCallBackground) {
    var persistedOperationVersion = ++callBackgroundOperationVersion
    if (callBackgroundSaveButton) {
      callBackgroundSaveButton.dataset.readerAsyncPending = 'true'
      callBackgroundSaveButton.disabled = true
    }
    clearReaderCallBackgroundError()
    verifyReaderCallBackgroundDataUrl(pendingPersistedCallBackground.callBackgroundImage).then(function(dataUrl) {
      if (!ov.isConnected || persistedOperationVersion !== callBackgroundOperationVersion || callBackgroundDraft !== pendingPersistedFallbackDraft) return
      callBackgroundDraft = {
        callBackgroundType: 'image',
        callBackgroundPreset: pendingPersistedCallBackground.callBackgroundPreset,
        callBackgroundImage: dataUrl
      }
      syncReaderCallBackgroundControls(ov, callBackgroundDraft)
      syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
    }).catch(function() {
      if (!ov.isConnected || persistedOperationVersion !== callBackgroundOperationVersion || callBackgroundDraft !== pendingPersistedFallbackDraft) return
      showReaderCallBackgroundError('之前保存的通话背景无法使用，已改用安全预设。')
    }).finally(function() {
      if (ov.isConnected && persistedOperationVersion === callBackgroundOperationVersion && callBackgroundSaveButton) {
        delete callBackgroundSaveButton.dataset.readerAsyncPending
        syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
      }
    })
  }

  var callBackgroundUpload = ov.querySelector('#cuCallBackgroundUpload')
  var callBackgroundFile = ov.querySelector('#cuCallBackgroundFile')
  if (callBackgroundUpload && callBackgroundFile) {
    callBackgroundUpload.onclick = function() { callBackgroundFile.click() }
    callBackgroundFile.onchange = function() {
      var file = callBackgroundFile.files && callBackgroundFile.files[0]
      if (!file) return
      callBackgroundFile.value = ''
      var draftBeforeUpload = callBackgroundDraft
      var uploadOperationVersion = ++callBackgroundOperationVersion
      clearReaderCallBackgroundError()
      if (callBackgroundSaveButton) {
        callBackgroundSaveButton.dataset.readerAsyncPending = 'true'
        callBackgroundSaveButton.disabled = true
      }
      readReaderCallBackgroundFile(file).then(function(dataUrl) {
        if (!ov.isConnected || uploadOperationVersion !== callBackgroundOperationVersion || callBackgroundDraft !== draftBeforeUpload) return
        callBackgroundDraft = {
          callBackgroundType: 'image',
          callBackgroundPreset: draftBeforeUpload.callBackgroundPreset,
          callBackgroundImage: dataUrl
        }
        syncReaderCallBackgroundControls(ov, callBackgroundDraft)
        syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
        inspectReaderAppearanceImage(dataUrl, file.size).then(function(meta) {
          if (!meta || !ov.isConnected || uploadOperationVersion !== callBackgroundOperationVersion) return
          callBackgroundMeta = meta
          renderReaderAppearanceImageChoice(callBackgroundState, meta, function(nextUrl, nextMeta) {
            callBackgroundDraft = {
              callBackgroundType:'image',
              callBackgroundPreset:callBackgroundDraft.callBackgroundPreset,
              callBackgroundImage:nextUrl
            }
            callBackgroundMeta = nextMeta
            syncReaderCallBackgroundControls(ov, callBackgroundDraft)
            renderReaderAppearanceImageChoice(callBackgroundState, nextMeta, null)
            var section = ov.querySelector('#cuMessageCall')
            if (section) section.dataset.appearanceManualVersion = String(Number(section.dataset.appearanceManualVersion || 0) + 1)
            if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
          })
          var section = ov.querySelector('#cuMessageCall')
          if (section) section.dataset.appearanceManualVersion = String(Number(section.dataset.appearanceManualVersion || 0) + 1)
          if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
        })
      }).catch(function(error) {
        if (!ov.isConnected || uploadOperationVersion !== callBackgroundOperationVersion || callBackgroundDraft !== draftBeforeUpload) return
        showReaderCallBackgroundError(error && error.message ? error.message : '图片无法使用')
      }).finally(function() {
        if (ov.isConnected && uploadOperationVersion === callBackgroundOperationVersion) {
          if (callBackgroundSaveButton) {
            delete callBackgroundSaveButton.dataset.readerAsyncPending
            syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
          }
          callBackgroundFile.value = ''
        }
      })
    }
  }

  // Bind slider displays
  bindCuSliders(ov)

  function readerColorPickerValue(value) {
    return readerColorInputValue(value)
  }

  function setMessageSliderControl(id, value) {
    var input = ov.querySelector('#' + id)
    var output = ov.querySelector('#' + id + 'Val')
    if (input) input.value = String(value)
    if (output) {
      var unitNode = output.querySelector && output.querySelector('.appearance-range-value-unit')
      var unit = unitNode ? unitNode.textContent : output.textContent.replace(/^-?[\d.]+/, '')
      setReaderRangeOutput(output, String(value) + unit)
    }
  }

  function setMessageColorControl(attribute, value) {
    ov.querySelectorAll('.cu-color-btn[data-' + attribute + ']').forEach(function(button) {
      var active = button.getAttribute('data-' + attribute) === value
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', active ? 'true' : 'false')
    })
    var picker = ov.querySelector('.cu-color-picker[data-' + attribute + '-picker]')
    if (picker) {
      picker.value = readerColorPickerValue(value)
      picker.setAttribute('data-' + attribute + '-picker', value)
    }
  }

  function setMessageStyleControl(selector, attribute, value) {
    ov.querySelectorAll(selector).forEach(function(button) {
      button.classList.toggle('active', button.getAttribute(attribute) === String(value))
    })
  }

  function applyReaderAppDraftSettings(nextSettings, nextIcon) {
    var next = JSON.parse(JSON.stringify(nextSettings || defaultReaderAppSettings(type)))
    var sliderSettings = {
      cuMsgAvSize:'avatarSize', cuSelfRadius:'selfBubbleRadius', cuOtherRadius:'otherBubbleRadius',
      cuSelfBubbleSkinSize:'selfBubbleSkinSize', cuOtherBubbleSkinSize:'otherBubbleSkinSize',
      cuSelfBubbleSkinSlice:'selfBubbleSkinSlice', cuSelfBubbleSkinPadding:'selfBubbleSkinPadding',
      cuOtherBubbleSkinSlice:'otherBubbleSkinSlice', cuOtherBubbleSkinPadding:'otherBubbleSkinPadding',
      cuBubbleFs:'bubbleFontSize', cuCardRadius:'cardRadius', cuTitleSize:'titleSize',
      cuFontSize:'fontSize', cuLineHeight:'lineHeight', cuImgRadius:'imageRadius',
      cuGap:'gap', cuEntryRadius:'entryRadius', cuNameSize:'nameSize',
      cuChatBgPosX:'chatBgPositionX', cuChatBgPosY:'chatBgPositionY', cuChatBgTone:'chatBgTone',
      cuComposerInputRadius:'composerInputRadius'
    }
    Object.keys(sliderSettings).forEach(function(id) {
      var key = sliderSettings[id]
      if (next[key] !== undefined) setMessageSliderControl(id, next[key])
    })
    var colorSettings = {
      'cu-self-bg':'selfBubbleBg', 'cu-self-text':'selfBubbleText',
      'cu-other-bg':'otherBubbleBg', 'cu-other-text':'otherBubbleText',
      'cu-chat-bg':'chatBg', 'cu-time-color':'timeColor', 'cu-send-bg':'sendButtonBg',
      'cu-composer-bg':'composerBg', 'cu-composer-input-bg':'composerInputBg',
      'cu-composer-input-text':'composerInputText', 'cu-composer-input-border':'composerInputBorder',
      'cu-card-bg':'cardBg', 'cu-title-color':'titleColor', 'cu-text-color':'textColor',
      'cu-url-color':'urlColor', 'cu-name-color':'nameColor', 'cu-price-color':'priceColor'
    }
    Object.keys(colorSettings).forEach(function(attribute) {
      var key = colorSettings[attribute]
      if (next[key] !== undefined) setMessageColorControl(attribute, next[key])
    })
    setMessageStyleControl('.cu-shape-btn[data-cu-shape]', 'data-cu-shape', next.avatarShape)
    setMessageStyleControl('.cu-style-btn[data-cu-memo-style]', 'data-cu-memo-style', next.cardStyle)
    setMessageStyleControl('.cu-style-btn[data-cu-gallery-cols]', 'data-cu-gallery-cols', next.columns)
    setMessageStyleControl('.cu-style-btn[data-cu-bubble-weight]', 'data-cu-bubble-weight', normalizedReaderBubbleFontWeight(next.bubbleFontWeight))
    setMessageStyleControl('.cu-style-btn[data-cu-chat-bg-fit]', 'data-cu-chat-bg-fit', next.chatBgFit)
    setMessageStyleControl('.cu-style-btn[data-cu-bubble-skin-side="self"]', 'data-cu-bubble-skin-mode', next.selfBubbleSkinMode)
    setMessageStyleControl('.cu-style-btn[data-cu-bubble-skin-side="other"]', 'data-cu-bubble-skin-mode', next.otherBubbleSkinMode)
    var customCssInput = ov.querySelector('#cuAppCustomCss')
    if (customCssInput) customCssInput.value = next.customCss || ''
    var iconInput = ov.querySelector('#cuIconUrl')
    if (iconInput && nextIcon !== undefined) {
      appIconDraft = nextIcon || ''
      iconInput.value = appIconDraft
    }
    if (type === 'messages') {
      chatBackgroundOperationVersion += 1
      chatBackgroundMeta = null
      bubbleSkinOperationVersion.self += 1
      bubbleSkinOperationVersion.other += 1
      bubbleSkinPending.self = false
      bubbleSkinPending.other = false
      pendingPersistedCallBackground = null
      pendingPersistedFallbackDraft = null
      invalidateReaderCallBackgroundOperation()
      ov._readerChatBgImageDraft = next.chatBgImage || null
      ov._readerChatBgLuminanceDraft = Number.isFinite(next.chatBgLuminance)
        ? next.chatBgLuminance
        : null
      var readabilityToggle = ov.querySelector('#cuChatAutoReadability')
      if (readabilityToggle) readabilityToggle.checked = next.chatAutoReadability !== false
      var composerReadabilityToggle = ov.querySelector('#cuComposerAutoReadability')
      if (composerReadabilityToggle) composerReadabilityToggle.checked = next.composerAutoReadability !== false
      ov._readerBubbleSkinDraft.self = next.selfBubbleSkinImage || null
      ov._readerBubbleSkinDraft.other = next.otherBubbleSkinImage || null
      bubbleSkinMeta.self = null
      bubbleSkinMeta.other = null
      callBackgroundDraft = normalizedReaderCallBackgroundSettings(next)
      showReaderBubbleSkinError('self', '')
      showReaderBubbleSkinError('other', '')
      syncReaderBubbleSkinControls('self')
      syncReaderBubbleSkinControls('other')
      syncReaderBubbleSkinPending()
      syncReaderChatBackgroundControls()
      syncReaderCallBackgroundControls(ov, callBackgroundDraft)
    }
    updateCuPreview(ov, type)
  }

  function resetReaderMessageSection(sectionKey, button) {
    var defaults = defaultReaderMessageSettings()
    if (sectionKey === 'bubbles') {
      bubbleSkinOperationVersion.self += 1
      bubbleSkinOperationVersion.other += 1
      bubbleSkinPending.self = false
      bubbleSkinPending.other = false
      setMessageStyleControl('.cu-shape-btn[data-cu-shape]', 'data-cu-shape', defaults.avatarShape)
      setMessageSliderControl('cuMsgAvSize', defaults.avatarSize)
      setMessageColorControl('cu-self-bg', defaults.selfBubbleBg)
      setMessageColorControl('cu-self-text', defaults.selfBubbleText)
      setMessageSliderControl('cuSelfRadius', defaults.selfBubbleRadius)
      setMessageSliderControl('cuSelfBubbleSkinSize', defaults.selfBubbleSkinSize)
      setMessageSliderControl('cuSelfBubbleSkinSlice', defaults.selfBubbleSkinSlice)
      setMessageSliderControl('cuSelfBubbleSkinPadding', defaults.selfBubbleSkinPadding)
      setMessageColorControl('cu-other-bg', defaults.otherBubbleBg)
      setMessageColorControl('cu-other-text', defaults.otherBubbleText)
      setMessageSliderControl('cuOtherRadius', defaults.otherBubbleRadius)
      setMessageSliderControl('cuOtherBubbleSkinSize', defaults.otherBubbleSkinSize)
      setMessageSliderControl('cuOtherBubbleSkinSlice', defaults.otherBubbleSkinSlice)
      setMessageSliderControl('cuOtherBubbleSkinPadding', defaults.otherBubbleSkinPadding)
      setMessageSliderControl('cuBubbleFs', defaults.bubbleFontSize)
      setMessageStyleControl('.cu-style-btn[data-cu-bubble-weight]', 'data-cu-bubble-weight', defaults.bubbleFontWeight)
      setMessageColorControl('cu-time-color', defaults.timeColor)
      setMessageStyleControl('.cu-style-btn[data-cu-bubble-skin-side="self"]', 'data-cu-bubble-skin-mode', defaults.selfBubbleSkinMode)
      setMessageStyleControl('.cu-style-btn[data-cu-bubble-skin-side="other"]', 'data-cu-bubble-skin-mode', defaults.otherBubbleSkinMode)
      ov._readerBubbleSkinDraft.self = null
      ov._readerBubbleSkinDraft.other = null
      bubbleSkinMeta.self = null
      bubbleSkinMeta.other = null
      showReaderBubbleSkinError('self', '')
      showReaderBubbleSkinError('other', '')
      syncReaderBubbleSkinControls('self')
      syncReaderBubbleSkinControls('other')
      syncReaderBubbleSkinPending()
    } else if (sectionKey === 'background') {
      chatBackgroundOperationVersion += 1
      chatBackgroundMeta = null
      ov._readerChatBgImageDraft = null
      ov._readerChatBgLuminanceDraft = null
      showReaderChatBackgroundError('')
      setMessageColorControl('cu-chat-bg', defaults.chatBg)
      var readabilityToggle = ov.querySelector('#cuChatAutoReadability')
      if (readabilityToggle) readabilityToggle.checked = defaults.chatAutoReadability
      setMessageStyleControl('.cu-style-btn[data-cu-chat-bg-fit]', 'data-cu-chat-bg-fit', defaults.chatBgFit)
      setMessageSliderControl('cuChatBgTone', defaults.chatBgTone)
      setMessageSliderControl('cuChatBgPosX', defaults.chatBgPositionX)
      setMessageSliderControl('cuChatBgPosY', defaults.chatBgPositionY)
      syncReaderChatBackgroundControls()
    } else if (sectionKey === 'actions') {
      setMessageColorControl('cu-send-bg', defaults.sendButtonBg)
      setMessageColorControl('cu-composer-bg', defaults.composerBg)
      setMessageColorControl('cu-composer-input-bg', defaults.composerInputBg)
      setMessageColorControl('cu-composer-input-text', defaults.composerInputText)
      setMessageColorControl('cu-composer-input-border', defaults.composerInputBorder)
      setMessageSliderControl('cuComposerInputRadius', defaults.composerInputRadius)
      var composerReadabilityToggle = ov.querySelector('#cuComposerAutoReadability')
      if (composerReadabilityToggle) composerReadabilityToggle.checked = defaults.composerAutoReadability
    } else if (sectionKey === 'call') {
      pendingPersistedCallBackground = null
      pendingPersistedFallbackDraft = null
      invalidateReaderCallBackgroundOperation()
      clearReaderCallBackgroundError()
      callBackgroundDraft = normalizedReaderCallBackgroundSettings(defaults)
      syncReaderCallBackgroundControls(ov, callBackgroundDraft)
    } else {
      return
    }
    updateCuPreview(ov, type)
    if (button) {
      var previousLabel = button.textContent
      button.textContent = '已恢复'
      globalThis.setTimeout(function() {
        if (button.isConnected) button.textContent = previousLabel
      }, 900)
    }
  }

  ov.querySelectorAll('[data-cu-reset-message-section]').forEach(function(button) {
    button.onclick = function() {
      resetReaderMessageSection(button.dataset.cuResetMessageSection, button)
    }
  })

  // Icon upload / clear handlers (need ov to be created)
  var iconUploadBtn = ov.querySelector('#cuIconUpload')
  if (iconUploadBtn) iconUploadBtn.onclick = function() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
    inp.onchange = function() {
      var file = inp.files[0]; if (!file) return
      var r = new FileReader()
      r.onload = function() {
        appIconDraft = r.result
        ov.querySelector('#cuIconUrl').value = r.result
        updateCuPreview(ov, type)
      }
      r.readAsDataURL(file)
    }
    inp.click()
  }
  var iconClearBtn = ov.querySelector('#cuIconClear')
  if (iconClearBtn) iconClearBtn.onclick = function() {
    appIconDraft = ''
    var urlEl = ov.querySelector('#cuIconUrl'); if (urlEl) urlEl.value = ''
    var preview = ov.querySelector('.rd-preview-img'); if (preview) preview.remove()
    syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
  }
  var iconDraftInput = ov.querySelector('#cuIconUrl')
  if (iconDraftInput) iconDraftInput.addEventListener('input', function() {
    appIconDraft = iconDraftInput.value.trim()
    syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
  })
  // Read icon URL on save (via onSave callback above already reads from ct.customIcons)
  // Real-time preview updates
  ov.querySelectorAll('.cu-slider').forEach(function(sl) {
    sl.addEventListener('input', function() {
      if (sl.id === 'cuComposerInputRadius') {
        var composerAuto = ov.querySelector('#cuComposerAutoReadability')
        if (composerAuto) composerAuto.checked = false
      }
      updateCuPreview(ov, type)
    })
  })
  ov.querySelectorAll('.cu-color-picker').forEach(function(p) {
    p.addEventListener('input', function() {
      if (p.closest('#cuMessageActions')) {
        var composerAuto = ov.querySelector('#cuComposerAutoReadability')
        if (composerAuto) composerAuto.checked = false
      }
      Array.from(p.attributes).forEach(function(attribute) {
        if (/^data-cu-.*-picker$/.test(attribute.name)) {
          p.setAttribute(attribute.name, p.value)
        }
      })
      var group = p.parentElement
      if (group) {
        group.querySelectorAll('.cu-color-btn').forEach(function(button) {
          button.classList.remove('active')
          button.setAttribute('aria-pressed', 'false')
        })
      }
      updateCuPreview(ov, type)
    })
  })
  var appCssInput = ov.querySelector('#cuAppCustomCss')
  if (appCssInput) {
    appCssInput.addEventListener('input', function() { updateCuPreview(ov, type) })
  }
  var chatAutoReadability = ov.querySelector('#cuChatAutoReadability')
  if (chatAutoReadability) {
    chatAutoReadability.addEventListener('change', function() { updateCuPreview(ov, type) })
  }
  var composerAutoReadability = ov.querySelector('#cuComposerAutoReadability')
  if (composerAutoReadability) {
    composerAutoReadability.addEventListener('change', function() { updateCuPreview(ov, type) })
  }
  var appCssSample = ov.querySelector('#cuAppCssSample')
  if (appCssSample && appCssInput) appCssSample.onclick = function() {
    appCssInput.value = type === 'messages'
      ? '.chat-input-bar { padding: 6px 8px !important; }\n#chatInput { font-size: 11px; }\n#chatSendBtn { border-radius: 8px; }'
      : ':scope { --phone-system-accent: #9f6678; }\n.rd-phone-app-body { padding: 14px; }'
    updateCuPreview(ov, type)
    appCssInput.focus()
  }
  var messageActionsCss = ov.querySelector('#cuMessageActionsCss')
  if (messageActionsCss && appCssInput) messageActionsCss.onclick = function() {
    var moreSection = ov.querySelector('#cuMessageMore')
    if (moreSection) moreSection.open = true
    appCssInput.focus()
  }
  var appCssClear = ov.querySelector('#cuAppCssClear')
  if (appCssClear && appCssInput) appCssClear.onclick = function() {
    appCssInput.value = ''
    updateCuPreview(ov, type)
    appCssInput.focus()
  }
  // Bind color buttons
  ov.querySelectorAll('.cu-color-btn').forEach(function(b) {
    b.onclick = function() {
      var group = b.parentElement
      if (!group) return
      group.querySelectorAll('.cu-color-btn').forEach(function(x) {
        x.classList.remove('active')
        x.setAttribute('aria-pressed', 'false')
      })
      b.classList.add('active')
      b.setAttribute('aria-pressed', 'true')
      updateCuPreview(ov, type)
    }
  })
  // Bind shape buttons
  ov.querySelectorAll('.cu-shape-btn').forEach(function(b) {
    b.onclick = function() {
      var group = b.parentElement
      if (!group) return
      group.querySelectorAll('.cu-shape-btn').forEach(function(x) { x.classList.remove('active') })
      b.classList.add('active')
      updateCuPreview(ov, type)
    }
  })
  // Bind style buttons
  ov.querySelectorAll('.cu-style-btn').forEach(function(b) {
    b.onclick = function() {
      var group = b.parentElement
      if (!group) return
      group.querySelectorAll('.cu-style-btn').forEach(function(x) { x.classList.remove('active') })
      b.classList.add('active')
      if (b.dataset.cuBubbleSkinMode) syncReaderBubbleSkinControls(b.dataset.cuBubbleSkinSide)
      updateCuPreview(ov, type)
    }
  })
  enhanceReaderAppearanceRanges(ov)
  bindReaderAppearanceSectionStates(ov)
  var appearanceUndo = bindReaderAppearanceUndo(ov, {
    capture:function() { return readerAppDraftSnapshot() },
    restore:function(snapshot) {
      applyReaderAppDraftSettings(snapshot.settings, snapshot.icon)
    }
  })
  ov.querySelectorAll('[data-cu-copy-bubble-style]').forEach(function(button) {
    button.onclick = function() {
      var direction = button.dataset.cuCopyBubbleStyle
      var from = direction === 'other-to-self' ? 'other' : 'self'
      var to = from === 'self' ? 'other' : 'self'
      var snapshot = readerAppDraftSnapshot()
      var next = snapshot.settings
      ;['BubbleBg', 'BubbleText', 'BubbleRadius', 'BubbleSkinImage', 'BubbleSkinMode', 'BubbleSkinSize', 'BubbleSkinSlice', 'BubbleSkinPadding'].forEach(function(suffix) {
        next[to + suffix] = next[from + suffix]
      })
      applyReaderAppDraftSettings(next, snapshot.icon)
      revealMessageSettingsSection('cuMessageBubbles', false)
      revealMessageBubbleSubsection(to === 'self' ? 'cuMessageSelfBubble' : 'cuMessageOtherBubble')
      if (ov._refreshAppearanceSectionStates) ov._refreshAppearanceSectionStates()
      showReaderToast((from === 'self' ? '我方' : '对方') + '气泡样式已复制')
    }
  })
  syncReaderAppCssFeedback(ov, type, readCurrentSettings(ov, type))
  // Reset
  var resetBtn = ov.querySelector('#cuAppReset')
  if (resetBtn) resetBtn.onclick = function() {
    var previous = readerAppDraftSnapshot()
    applyReaderAppDraftSettings(defaultReaderAppSettings(type), previous.icon)
    showReaderToast((labels[type] || 'App') + '已恢复默认，保存后生效', 'success', {
      actionLabel:'撤销',
      duration:5000,
      onAction:function() {
        if (ov.isConnected) applyReaderAppDraftSettings(previous.settings, previous.icon)
      }
    })
  }
}

function bindCuSliders(ov) {
  ov.querySelectorAll('.cu-slider').forEach(function(sl) {
    var valEl = ov.querySelector('#' + sl.id + 'Val')
    sl.oninput = function() {
      if (valEl) {
        var unitNode = valEl.querySelector && valEl.querySelector('.appearance-range-value-unit')
        var unit = unitNode ? unitNode.textContent : (valEl.textContent.replace(/[\d.]+/, '') || '')
        setReaderRangeOutput(valEl, this.value + unit)
      }
    }
  })
}

  cached = {
    openPhoneAppearance:openReaderCustomizePanel,
    openReaderProfile:openReaderProfilePanel,
    openPerAppAppearance:openReaderAppSettings,
  }
  readerAppearanceWorkbenches.set(runtime, cached)
  return cached
}

export function openPhoneAppearance(runtime, triggerElement) {
  return getReaderAppearanceWorkbench(runtime).openPhoneAppearance(triggerElement)
}

export function openReaderProfile(runtime, triggerElement) {
  return getReaderAppearanceWorkbench(runtime).openReaderProfile(triggerElement)
}

export function openPerAppAppearance(runtime, type, triggerElement) {
  return getReaderAppearanceWorkbench(runtime).openPerAppAppearance(type, triggerElement)
}
