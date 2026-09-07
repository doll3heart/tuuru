import test from 'node:test'
import assert from 'node:assert/strict'
import { readAuthorPhoneExportSnapshot } from '../js/author-phone-snapshot.js'

const work = {id:'owned',type:'phone',title:'Authored',phoneData:{contacts:[],chats:[]}}
function memory(value) {
  const values = new Map([['tuuru_works', typeof value === 'string' ? value : JSON.stringify(value)], ['moirain_work_reader-only', JSON.stringify({...work,id:'reader-only'})]])
  return {getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value)}
}
test('reader-only records never authorize author export', () => {
  assert.throws(() => readAuthorPhoneExportSnapshot('reader-only',{storage:memory({works:[work]})}), /作品/)
})
test('missing duplicate and malformed canonical records fail closed', () => {
  for (const value of ['{bad', {}, {works:[work,work]}, {works:[{...work,phoneData:'bad'}]}, {works:[]}]) {
    assert.throws(() => readAuthorPhoneExportSnapshot('owned',{storage:memory(value)}), /作品/)
  }
})
test('snapshot clones canonical data and detects changes and deletion', () => {
  const storage = memory({works:[work]})
  const snapshot = readAuthorPhoneExportSnapshot('owned',{storage})
  assert.equal(typeof snapshot.token,'string')
  snapshot.work.title = 'Only the clone'
  snapshot.assertCurrent()
  storage.setItem('tuuru_works',JSON.stringify({works:[{...work,title:'Changed'}]}))
  assert.throws(() => snapshot.assertCurrent(), {name:'AuthorPhoneContextError'})
  storage.setItem('tuuru_works',JSON.stringify({works:[]}))
  assert.throws(() => snapshot.assertCurrent(), {name:'AuthorPhoneContextError'})
})

test('snapshot content and token come from one canonical storage read', () => {
  const oldRaw = JSON.stringify({works:[{...work,title:'OLD'}]})
  const newRaw = JSON.stringify({works:[{...work,title:'NEW'}]})
  let reads = 0
  const storage = {
    getItem(key) {
      assert.equal(key, 'tuuru_works')
      reads += 1
      return reads === 1 ? oldRaw : newRaw
    },
  }

  const snapshot = readAuthorPhoneExportSnapshot('owned', {storage})
  assert.equal(snapshot.work.title, 'OLD')
  assert.equal(JSON.parse(snapshot.token).title, 'OLD')
  assert.throws(() => snapshot.assertCurrent(), {name:'AuthorPhoneContextError'})
})
