// ==================== Simple Hash Router ====================
let routes = {}
let currentRoute = null
let currentParams = {}

function safeDecode(value){
  try{return decodeURIComponent(value)}catch{return value}
}

export function parseHash(hashValue=location.hash){
  const hash = (hashValue.startsWith("#")?hashValue.slice(1):hashValue)||"/"
  const queryStart = hash.indexOf("?")
  const path = queryStart >= 0 ? hash.slice(0,queryStart) : hash
  const query = queryStart >= 0 ? hash.slice(queryStart+1) : ""
  const params = {}
  if(query){
    query.split("&").forEach(part=>{
      if(!part)return
      const separator = part.indexOf("=")
      const rawKey = separator >= 0 ? part.slice(0,separator) : part
      const rawValue = separator >= 0 ? part.slice(separator+1) : ""
      const key = safeDecode(rawKey)
      if(key) params[key]=safeDecode(rawValue)
    })
  }
  return {path:path||"/", params}
}

export function router(path, fn){routes[path]=fn}

export function navigate(path, params={}){
  const qs = Object.entries(params).map(([k,v])=>encodeURIComponent(k)+"="+encodeURIComponent(v)).join("&")
  location.hash = "#"+path+(qs?"?"+qs:"")
}

export function matchRoutePattern(pattern,path){
  const parts = pattern.split("/")
  const pathParts = path.split("/")
  if(parts.length!==pathParts.length)return null
  const params = {}
  for(let i=0;i<parts.length;i++){
    if(parts[i].startsWith(":")){
      params[parts[i].slice(1)] = safeDecode(pathParts[i])
    }else if(parts[i]!==pathParts[i]){
      return null
    }
  }
  return params
}

function matchRoute(path){
  // Exact match first
  if(routes[path]) return {route:routes[path], params:{}}
  // Pattern match :param
  for(const [pattern, fn] of Object.entries(routes)){
    const params = matchRoutePattern(pattern,path)
    if(params) return {route:fn, params}
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
