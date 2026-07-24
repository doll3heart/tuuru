import { escapeHtmlAttribute, isSafeImageUrl } from "./sanitize.js"

function esc(value) {
  return escapeHtmlAttribute(value)
}

export function formatPhoneShoppingPrice(value) {
  const number = Number(value)
  return (Number.isFinite(number) ? Math.round(number * 100) / 100 : 0).toFixed(2)
}

function shoppingEmptyHtml(mode, surface) {
  const orderMode = mode === "order"
  const readerClass = surface === "reader" ? " rd-shop-empty rd-app-empty" : ""
  return '<div class="phone-shop-empty pf-empty' + readerClass + '">' +
    '<strong>' + (orderMode ? "暂无订单" : "购物车为空") + '</strong>' +
    '<small>' + (orderMode ? "这里还没有订单记录" : "这里还没有加入商品") + '</small>' +
    '</div>'
}

function shoppingImageHtml(item) {
  const url = String(item?.imageUrl || "").trim()
  let html = '<div class="shop-card-img">'
  if (url && isSafeImageUrl(url)) {
    html += '<img src="' + esc(url) + '" alt="" loading="lazy">'
  } else {
    html += '<div class="shop-card-img-placeholder" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5">' +
      '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>' +
      '<polyline points="21 15 16 10 5 21"/></svg></div>'
  }
  return html + '</div>'
}

function renderShoppingCard(item, options) {
  const mode = options.mode
  const surface = options.surface
  const orderMode = mode === "order"
  const itemId = String(item?.id || "")
  const showTimestamp = typeof options.showTimestamp === "function"
    ? options.showTimestamp(item?.time, item)
    : Boolean(item?.time)
  const flowTarget = options.flowItemId != null && itemId === String(options.flowItemId)
  const cardClass = "shop-card-block" + (flowTarget ? " is-flow-target" : "")

  const readerItemAttribute = surface === "reader" ? ' data-shopping-id="' + esc(itemId) + '"' : ""
  let html = '<div class="' + cardClass + '" data-item-id="' + esc(itemId) + '"' + readerItemAttribute + ' data-mode="' + mode + '">'
  html += '<div class="shop-card-row">'
  html += shoppingImageHtml(item)
  html += '<div class="shop-card-info">'
  html += '<div class="shop-card-name">' + esc(item?.name || "商品") + '</div>'
  html += '<div class="shop-card-price">¥' + formatPhoneShoppingPrice(item?.price) + '</div>'
  if (item?.style) html += '<div class="shop-card-meta">款式：' + esc(item.style) + '</div>'
  if (item?.shop) html += '<div class="shop-card-meta">店铺：' + esc(item.shop) + '</div>'
  if (orderMode && showTimestamp) html += '<div class="shop-card-meta shop-card-time">时间：' + esc(item.time) + '</div>'
  html += '</div>'

  if (!orderMode && options.showCartSelection === true) {
    const checked = item?.checked === true
    html += '<button type="button" class="shop-circle' + (checked ? " checked" : "") + '" data-toggle="' + esc(itemId) + '" role="checkbox" aria-checked="' + (checked ? "true" : "false") + '" aria-label="' + esc("选择" + String(item?.name || "商品")) + '"></button>'
  }
  if (orderMode) {
    html += '<div class="shop-badge-success">' + esc(item?.statusText || "交易成功") + '</div>'
  }
  html += '</div>'

  if (orderMode) {
    html += '<div class="shop-order-foot">'
    if (surface === "author") {
      html += '<button type="button" class="shop-order-btn" data-more="' + esc(itemId) + '">更多</button>'
      html += '<button type="button" class="shop-order-btn" data-logistics="' + esc(itemId) + '">查看物流</button>'
    } else if (item?.logistics) {
      html += '<button type="button" class="shop-order-btn" data-logistics-view="' + esc(itemId) + '" aria-expanded="false">查看物流</button>'
    }
    html += '<span class="shop-order-paid">实付款 ¥' + formatPhoneShoppingPrice(item?.actualPay || item?.price) + '</span>'
    html += '</div>'
    if (surface === "author" && item?.logistics) {
      html += '<div class="shop-logistics">' + esc(item.logistics) + '</div>'
    } else if (surface === "reader" && item?.logistics) {
      html += '<div class="shop-logistics" data-logistics-content="' + esc(itemId) + '" hidden>' + esc(item.logistics) + '</div>'
    }
  }

  return html + '</div>'
}

export function renderPhoneShoppingList(items, options = {}) {
  const mode = options.mode === "order" ? "order" : "cart"
  const source = Array.isArray(items) ? items.filter(Boolean) : []
  const style = options.style ? ' style="' + esc(options.style) + '"' : ""
  let html = '<div class="shop-list-area"' + style + '>'
  if (source.length === 0) return html + shoppingEmptyHtml(mode, options.surface) + '</div>'

  if (mode === "order") {
    source.slice().sort((a, b) => String(b?.time || "").localeCompare(String(a?.time || "")))
      .forEach(item => { html += renderShoppingCard(item, { ...options, mode }) })
    return html + '</div>'
  }

  const groups = new Map()
  source.forEach(item => {
    const shop = String(item?.shop || "未分类")
    if (!groups.has(shop)) groups.set(shop, [])
    groups.get(shop).push(item)
  })
  groups.forEach((groupItems, shop) => {
    html += '<section class="shop-group">'
    html += '<div class="shop-group-head">' + esc(shop) + ' (' + groupItems.length + ')</div>'
    groupItems.forEach(item => { html += renderShoppingCard(item, { ...options, mode }) })
    html += '</section>'
  })
  return html + '</div>'
}

export function renderPhoneShoppingTabs(options = {}) {
  const activeTab = options.activeTab === "order" ? "order" : "cart"
  const prefix = String(options.idPrefix || "shop").replace(/[^a-z0-9_-]/gi, "") || "shop"
  const cartId = options.cartTabId || prefix + "TabCart"
  const orderId = options.orderTabId || prefix + "TabOrder"
  const cartPanelId = options.cartPanelId || prefix + "Cart"
  const orderPanelId = options.orderPanelId || prefix + "Order"
  const tabClass = options.tabClass ? " " + String(options.tabClass).replace(/[^a-z0-9 _-]/gi, "") : ""
  const tabListClass = options.tabListClass ? " " + String(options.tabListClass).replace(/[^a-z0-9 _-]/gi, "") : ""

  return '<div class="shop-tabs' + tabListClass + '" role="tablist" aria-label="购物内容">' +
    '<button type="button" class="shop-tab' + tabClass + (activeTab === "cart" ? " active" : "") + '" id="' + cartId + '" role="tab" aria-controls="' + esc(cartPanelId) + '" aria-selected="' + (activeTab === "cart" ? "true" : "false") + '" tabindex="' + (activeTab === "cart" ? "0" : "-1") + '" data-tab="cart">购物车</button>' +
    '<button type="button" class="shop-tab' + tabClass + (activeTab === "order" ? " active" : "") + '" id="' + orderId + '" role="tab" aria-controls="' + esc(orderPanelId) + '" aria-selected="' + (activeTab === "order" ? "true" : "false") + '" tabindex="' + (activeTab === "order" ? "0" : "-1") + '" data-tab="order">我的订单</button>' +
    '</div>'
}
