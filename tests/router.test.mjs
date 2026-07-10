import test from "node:test"
import assert from "node:assert/strict"

import { matchRoutePattern, parseHash } from "../js/router.js"

test("empty hashes resolve to the home route", () => {
  assert.deepEqual(parseHash(""), { path: "/", params: {} })
  assert.deepEqual(parseHash("#"), { path: "/", params: {} })
})

test("query parameters are decoded without losing equals signs", () => {
  assert.deepEqual(parseHash("#/read/work?name=%E5%B0%8F%E6%98%8E&token=a=b=c"), {
    path: "/read/work",
    params: { name: "小明", token: "a=b=c" },
  })
})

test("parameters without values remain available as empty strings", () => {
  assert.deepEqual(parseHash("#/new?draft&source="), {
    path: "/new",
    params: { draft: "", source: "" },
  })
})

test("malformed percent encoding cannot crash hash parsing", () => {
  assert.deepEqual(parseHash("#/read?broken=%E0%A4%A"), {
    path: "/read",
    params: { broken: "%E0%A4%A" },
  })
})

test("route patterns extract decoded dynamic segments", () => {
  assert.deepEqual(matchRoutePattern("/edit/:id", "/edit/work%201"), { id: "work 1" })
  assert.deepEqual(matchRoutePattern("/read/:id", "/read/%E0%A4%A"), { id: "%E0%A4%A" })
})

test("route patterns reject different static paths and segment counts", () => {
  assert.equal(matchRoutePattern("/edit/:id", "/read/1"), null)
  assert.equal(matchRoutePattern("/edit/:id", "/edit/1/extra"), null)
})
