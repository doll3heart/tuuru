// Only packaged into the isolated acceptance artifact, never a production entry.
import { RELEASE_ANNOUNCEMENT_STORAGE_KEY } from '../../js/release-announcement.js'

export function previewStarterHtml() {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>作者小手机导出验收 · Tuuru</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#EEE6E7;color:#40383B;font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:660px;margin:0 auto;padding:48px 24px}h1{font-size:1.6rem;line-height:1.4;margin:0 0 20px}p{margin:12px 0}ol{padding-left:24px;margin:24px 0}li{margin:12px 0}button,a{font:inherit}button{display:block;width:100%;min-height:48px;padding:12px 20px;margin:24px 0 12px;border:1px solid #6F4A55;border-radius:6px;background:#6F4A55;color:#fff;cursor:pointer}button:hover{background:#40383B}button:disabled{opacity:.65;cursor:wait}button:focus-visible,a:focus-visible{outline:3px solid #8F4D60;outline-offset:3px}a{color:#6F4A55}#status{min-height:2em;color:#66585D}.note{border-top:1px solid #C8B6BA;padding-top:16px;font-size:.9rem}@media(max-width:440px){main{padding-top:28px}h1{font-size:1.35rem}}
</style></head><body><main>
<h1>作者小手机图片导出验收</h1>
<p>请用 iPad 的 Safari 打开。这是独立作者测试库，正式站没有更新；读者端不提供任何导出。</p>
<p>按钮仅向此预览域名的作者测试库放入虚构作品，不创建或导入读者书籍，不读取正式站数据。</p>
<ol><li>点击下方按钮，进入作者首页，找到“iPad 作者图片导出测试”。</li><li>打开作品菜单的“导出”，选择“小手机图片”。先试默认分支（不含读者选择），再试全部分支。</li><li>在“文件”中解压 ZIP，检查转账重叠、文字越框、分页和阴影。</li></ol>
<button id="start" type="button">载入作者测试样例</button>
<a href="/">已有样例？直接打开作者端</a>
<p id="status" role="status" aria-live="polite"></p>
<p class="note">这是公开验收样例，不是原作者身份认证。已有创作或阅读数据时拒绝覆盖；保存失败会回滚。Safari 文字与阴影保真仍待实机验收，不能保证已修复。</p>
</main><script>
const start=document.querySelector('#start'),status=document.querySelector('#status');
start.addEventListener('click',async()=>{
  start.disabled=true;status.textContent='正在准备作者测试样例…';
  try{
    const host=location.hostname;
    if(!['127.0.0.1','localhost'].includes(host)&&!host.endsWith('.tuuru.pages.dev'))throw new Error('此入口仅供独立验收预览使用。');
    const response=await fetch('/phone-export-sample.json',{cache:'no-store'});
    if(!response.ok)throw new Error('测试样例读取失败，请刷新后重试。');
    const seed=await response.json();
    const keys=Object.keys(seed);
    const allowed=['tuuru_works',${JSON.stringify(RELEASE_ANNOUNCEMENT_STORAGE_KEY)}];
    if(keys.length!==allowed.length||!keys.every(key=>allowed.includes(key)&&typeof seed[key]==='string'))throw new Error('无效的作者测试样例。');
    const db=JSON.parse(seed.tuuru_works);
    if(db.version!==1||!Array.isArray(db.works)||db.works.length!==1||!db.works[0].phoneData)throw new Error('无效的作者测试库。');
    if(Object.keys(localStorage).some(key=>key==='tuuru_works'||key.startsWith('moirain_work_')||['moirain_recent','moirain_readerLibrary','moirain_phoneCustom'].includes(key))){
      throw new Error('已检测到预览数据，为避免覆盖，不再载入。请点击“直接打开作者端”继续。');
    }
    const previous=Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]));
    const written=[];
    try{for(const key of keys){localStorage.setItem(key,seed[key]);written.push(key);}}
    catch(error){for(const key of written.reverse()){if(previous[key]===null)localStorage.removeItem(key);else localStorage.setItem(key,previous[key]);}throw error;}
    location.assign('/');
  }catch(error){status.textContent=error.message||'无法保存测试样例，请检查 Safari 是否允许网站存储。';start.disabled=false;}
});
</script></body></html>`
}
