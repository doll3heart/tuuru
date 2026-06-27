// ==================== Simple Hash Router ====================
let routes = {}
let currentRoute = null
let currentParams = {}

function parseHash(){
  const hash = location.hash.slice(1)||"/"
  const [path, ...rest] = hash.split("?")
  const params = {}
  if(rest.length){
    rest.join("?").split("&").forEach(p=>{
      const [k,v]=p.split("=").map(decodeURIComponent)
      if(k) params[k]=v
    })
  }
  return {path:path||"/", params}
}

export function router(path, fn){routes[path]=fn}

export function navigate(path, params={}){
  const qs = Object.entries(params).map(([k,v])=>encodeURIComponent(k)+"="+encodeURIComponent(v)).join("&")
  location.hash = "#"+path+(qs?"?"+qs:"")
}

function matchRoute(path){
  // Exact match first
  if(routes[path]) return {route:routes[path], params:{}}
  // Pattern match :param
  for(const [pattern, fn] of Object.entries(routes)){
    const parts = pattern.split("/")
    const pathParts = path.split("/")
    if(parts.length!==pathParts.length) continue
    const params = {}
    let match = true
    for(let i=0;i<parts.length;i++){
      if(parts[i].startsWith(":")){
        params[parts[i].slice(1)] = decodeURIComponent(pathParts[i])
      }else if(parts[i]!==pathParts[i]){
        match = false; break
      }
    }
    if(match) return {route:fn, params}
  }
  return null
}

export function initRouter(container){
  function resolve(){
    const {path, params} = parseHash()
    currentParams = params
    const matched = matchRoute(path)
    if(matched){
      currentRoute = path
      container.innerHTML = ""
      matched.route(container, matched.params, params)
    }else{
      container.innerHTML = `<div class="empty-state"><div class="icon"></div><h3>页面不存在</h3><p>请检查链接是否正确</p></div>`
    }
  }
  window.addEventListener("hashchange", resolve)
  resolve()
  return ()=>window.removeEventListener("hashchange", resolve)
}

export function getParams(){return currentParams}
