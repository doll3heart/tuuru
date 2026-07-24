import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import { visiblePhoneModuleContacts } from "../js/phone-module-draft.js"

test("article phone modules exclude later global contacts from the reader contact scope", async () => {
  const article = {
    phoneData: {
      contacts: [
        { id:"contact-1", name:"已登场" },
        { id:"contact-secret", name:"尚未登场" },
      ],
    },
  }
  const moduleData = {
    contacts: article.phoneData.contacts,
    visibleContactIds: ["contact-1"],
  }

  assert.deepEqual(visiblePhoneModuleContacts(moduleData), [
    { id:"contact-1", name:"已登场" },
  ])

  const reader = await readFile(new URL("../reader/reader.js", import.meta.url), "utf8")
  const triggerStart = reader.indexOf("var triggers = document.querySelectorAll('.rd-pm-trigger')")
  const triggerEnd = reader.indexOf("\nfunction readerPhoneFlowCueHtml", triggerStart)
  const triggerSource = reader.slice(triggerStart, triggerEnd)

  assert.notEqual(triggerStart, -1)
  assert.notEqual(triggerEnd, -1)
  assert.match(triggerSource, /visiblePhoneModuleContacts\s*\(\s*d\s*\)/)
  assert.doesNotMatch(
    triggerSource,
    /var contacts = \(_work\.phoneData && Array\.isArray\(_work\.phoneData\.contacts\)\)/,
  )
})
