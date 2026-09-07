import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {runInNewContext} from 'node:vm'

test('first offline author image export opens the precached renderer instead of the author app',async()=>{
  const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8')
  const handlers=new Map()
  const responses=new Map()
  const cache={
    async addAll(paths){for(const pathname of paths)responses.set(pathname,new Response(pathname==='/author-phone-render.html'?'AUTHOR_RENDER_DOCUMENT':'OTHER_DOCUMENT'))},
    async match(request){return responses.get(typeof request==='string'?request:new URL(request.url).pathname)?.clone()},
  }
  runInNewContext(source,{
    self:{location:{origin:'https://tuuru.test'},addEventListener:(name,handler)=>handlers.set(name,handler),skipWaiting(){}},
    caches:{open:async()=>cache},
    fetch:async()=>{throw new Error('offline')},
    Response,URL,
  })
  let installed
  handlers.get('install')({waitUntil:promise=>{installed=promise}})
  await installed
  let result
  handlers.get('fetch')({request:{method:'GET',mode:'navigate',url:'https://tuuru.test/author-phone-render.html'},respondWith:promise=>{result=promise}})
  assert.equal(await (await result).text(),'AUTHOR_RENDER_DOCUMENT')
})

test('both author renderer document URLs explicitly revalidate on Cloudflare',async()=>{
  const headers=await readFile(new URL('../public/_headers',import.meta.url),'utf8')
  for(const route of ['/author-phone-render','/author-phone-render.html']) {
    const escaped=route.replaceAll('.','\\.')
    assert.match(headers,new RegExp(`(?:^|\\n)${escaped}\\s*\\n\\s+Cache-Control: public, no-cache, must-revalidate`))
  }
})
