import test from "node:test"
import assert from "node:assert/strict"
import {
  renderPhoneShoppingList,
  renderPhoneShoppingTabs,
} from "../js/phone-shopping-view.js"

const order = {
  id: "order-1",
  name: "情趣内衣",
  price: 20.98,
  actualPay: 20.98,
  style: "白色 S 码",
  shop: "嘿嘿嘿情趣内衣社",
  imageUrl: "",
  status: "order",
  logistics: "已发货 · 顺丰 SF123",
  time: "2026/6/26 23:13:25",
}

test("author and reader shopping use the same complete order-card structure", () => {
  const author = renderPhoneShoppingList([order], {
    mode: "order",
    surface: "author",
    showTimestamp: () => true,
  })
  const reader = renderPhoneShoppingList([order], {
    mode: "order",
    surface: "reader",
    showTimestamp: () => true,
  })

  for (const html of [author, reader]) {
    assert.match(html, /shop-card-block/)
    assert.match(html, /shop-card-row/)
    assert.match(html, /shop-card-img/)
    assert.match(html, /shop-card-name/)
    assert.match(html, /情趣内衣/)
    assert.match(html, /款式：白色 S 码/)
    assert.match(html, /店铺：嘿嘿嘿情趣内衣社/)
    assert.match(html, /时间：2026\/6\/26 23:13:25/)
    assert.match(html, /shop-badge-success/)
    assert.match(html, /交易成功/)
    assert.match(html, /shop-order-foot/)
    assert.match(html, /实付款 ¥20\.98/)
  }

  assert.match(author, /data-more="order-1"/)
  assert.match(author, /data-logistics="order-1"/)
  assert.doesNotMatch(reader, /data-more=/)
  assert.match(reader, /data-logistics-view="order-1"/)
})

test("the reader can hide timestamps without changing the rest of the shared card", () => {
  const html = renderPhoneShoppingList([order], {
    mode: "order",
    surface: "reader",
    showTimestamp: () => false,
  })

  assert.doesNotMatch(html, /2026\/6\/26/)
  assert.match(html, /交易成功/)
  assert.match(html, /查看物流/)
  assert.match(html, /实付款 ¥20\.98/)
})

test("shared tabs keep one semantic structure for author and reader", () => {
  const author = renderPhoneShoppingTabs({ activeTab: "cart", idPrefix: "shop" })
  const reader = renderPhoneShoppingTabs({ activeTab: "order", idPrefix: "rdShop" })

  for (const html of [author, reader]) {
    assert.match(html, /role="tablist"/)
    assert.equal((html.match(/role="tab"/g) || []).length, 2)
    assert.match(html, /购物车/)
    assert.match(html, /我的订单/)
  }
  assert.match(author, /id="shopTabCart"[^>]*aria-selected="true"/)
  assert.match(reader, /id="rdShopTabOrder"[^>]*aria-selected="true"/)
})
