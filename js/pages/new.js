import { createWork, WORK_TYPE } from "../data.js"
import { navigate } from "../router.js"
import { showToast } from "../app.js"

export function renderNew(){
  return `
    <h2 style="font-size:1.3rem;font-weight:600;margin-bottom:24px;text-align:center">新建作品</h2>
    
    <div class="grid-2">
      <div class="card" style="cursor:pointer;text-align:center;padding:40px 20px" onclick="document.getElementById('articleForm').style.display='block';this.style.borderColor='var(--c-primary)'">
        <div style="font-size:3rem;margin-bottom:12px">RW</div>
        <h3 style="font-weight:600;margin-bottom:8px">互动文章</h3>
        <p style="font-size:.85rem;color:var(--c-text2)">节点式分支故事，每节末尾设置选项跳转</p>
        <div style="margin-top:12px">
          <div class="badge badge-primary">占位符替换</div>
          <div class="badge badge-primary">分支选项</div>
        </div>
      </div>
      
      <div class="card" style="cursor:pointer;text-align:center;padding:40px 20px" onclick="document.getElementById('phoneForm').style.display='block';this.style.borderColor='var(--c-primary)'">
        <div style="font-size:3rem;margin-bottom:12px"></div>
        <h3 style="font-weight:600;margin-bottom:8px">小手机</h3>
        <p style="font-size:.85rem;color:var(--c-text2)">模拟手机界面：短信、群聊、朋友圈、论坛</p>
        <div style="margin-top:12px">
          <div class="badge badge-primary">短信/群聊</div>
          <div class="badge badge-primary">朋友圈</div>
          <div class="badge badge-primary">论坛</div>
        </div>
      </div>
    </div>
    
    <div id="articleForm" style="display:none" class="mt-4 card">
      <h3 style="font-weight:600;margin-bottom:16px">创建互动文章</h3>
      <div class="form-group">
        <label class="form-label">作品标题</label>
        <input class="form-input" id="artTitle" placeholder="输入作品标题">
      </div>
      <div class="form-group">
        <label class="form-label">作品描述</label>
        <input class="form-input" id="artDesc" placeholder="简短描述">
      </div>
      <div class="form-group">
        <label class="form-label">作者署名</label>
        <input class="form-input" id="artAuthor" placeholder="作者名称（可选）">
      </div>
      <button class="btn btn-primary" onclick="createArticle()">创建作品</button>
    </div>
    
    <div id="phoneForm" style="display:none" class="mt-4 card">
      <h3 style="font-weight:600;margin-bottom:16px">创建小手机</h3>
      <div class="form-group">
        <label class="form-label">作品标题</label>
        <input class="form-input" id="phTitle" placeholder="输入作品标题">
      </div>
      <div class="form-group">
        <label class="form-label">作品描述</label>
        <input class="form-input" id="phDesc" placeholder="简短描述">
      </div>
      <div class="form-group">
        <label class="form-label">作者署名</label>
        <input class="form-input" id="phAuthor" placeholder="作者名称（可选）">
      </div>
      <button class="btn btn-primary" onclick="createPhone()">创建作品</button>
    </div>
  `
}

window.createArticle = function(){
  const title = document.getElementById("artTitle")?.value.trim()||"未命名互动文章"
  const desc = document.getElementById("artDesc")?.value.trim()||""
  const author = document.getElementById("artAuthor")?.value.trim()||""
  const work = createWork({type:WORK_TYPE.ARTICLE, title, desc, author})
  showToast("作品已创建")
  navigate("/edit/"+work.id)
}

window.createPhone = function(){
  const title = document.getElementById("phTitle")?.value.trim()||"未命名小手机"
  const desc = document.getElementById("phDesc")?.value.trim()||""
  const author = document.getElementById("phAuthor")?.value.trim()||""
  const work = createWork({type:WORK_TYPE.PHONE, title, desc, author})
  showToast("作品已创建")
  navigate("/phone/"+work.id)
}
