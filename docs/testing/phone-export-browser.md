# 小手机图片导出：真实浏览器回归验收

## 当前权限与入口（作者迁移，2026-09-08）

只有唯一、有效的本地 `tuuru_works` 作者作品记录可导出；这不是账号认证或原创身份认证。读者书架、作者名、编辑租约和 URL 参数不授予导出权限。普通读者和作者阅读预览均不提供数据 JSON、美化 JSON 或 PNG/ZIP 导出；阅读、恢复与本地美化继续保留。

下方运行命令已迁移到作者首页的真实作品导出菜单，再进入“导出小手机图片”。`current` 参数名称保留，但产品含义是“默认分支”：不恢复读者私有的 A→A1 选择，默认导出没有选择回复。`all` 仍独立枚举 A→A1、A→A2、B 结束话题三条路线。

旧的 `4cf222a1.tuuru.pages.dev/phone-export-test.html` **已过时，不能作为当前作者权限验收入口**；本文末尾的已发布读者预览仅保留作历史记录。本轮只构建新的本地隔离静态产物，不部署。生成与验证：

```sh
node browser-tests/phone-export/prepare-preview.mjs
node browser-tests/phone-export/verify-preview.mjs artifacts/phone-export-browser/preview-author-实际后缀
```

新启动页明确标为“作者测试库”，只写作者数据库和公告状态两个键，不创建/导入读者作品。已有作者数据库或阅读创作数据时拒绝覆盖；第二次写入模拟配额失败时回滚第一次写入并恢复旧公告。静态验证还检查生产 iframe 入口、7 张 PNG / 三分支 / 联系人一次、390×640 下操作按钮可见、导出不读读者数据、不写任何存储，以及真实阅读页的伪造参数/旧控件负向检查。

当前本地静态产物为 `artifacts/phone-export-browser/preview-author-Jolwqh/`，验证记录为 `preview-check-LUve4R/report.json`。Chromium 完整作者验收 `run-G2FAU3/report.json`：13/13、41 张场景 PNG，另有 3 张打码对照 PNG；最大单页差异 0.320%，三个破坏性负向对照全部生效。旧读者基线的 42 张图片不是迁移后的计数。

Windows WebKit 首先发现离屏 iframe 不执行动画帧，导致作者导出停在渲染阶段；已通过共享的可取消布局等待修正为由可见作者父页面提供时钟，真实 DOM 测量仍在 iframe。没有移动生产 iframe、调整字号阴影或放宽像素阈值。修改后 `run-jmQqdw` 完成 12 项实际导出检查 / 38 张 PNG：五个资源失败处理场景通过，七个正常输出场景仍因原有文字/阴影保真失败。字体场景因验收种子重复存储大字体触发 WebKit 配额；改为小型独立读者污染记录后，单独 `run-hOdXlB` 成功输出 3 张字体场景 PNG，只有 1.17% 的页面保真失败，无页面异常。两个报告合计覆盖 13 项，但不是一份全量通过报告；真实 iPad Safari 仍待实机验收。

## 运行

### Linux CI 文字抗锯齿对齐（2026-09-24）

两个 Chromium 验收 runner 共用测试专用启动配置 `browser-options.mjs`，通过 `--disable-lcd-text` 使用灰度文字抗锯齿，并通过 `--disable-font-subpixel-positioning` 对齐不同缩放环境下的文字定位策略。启动参数同时写入 `report.json` 以便追溯。此配置不进入生产包，不修改作者字体、字号、排版或导出器，也不传给 WebKit。

本项仍须在临时验证分支完成 Linux 回归后才能确认关闭 CI 故障。原有 1% 整页、2.5% 局部、0.15 颜色阈值及破坏性负向对照保持不变。

本地 Windows Chromium 验证：15/15 定向 Node 测试通过；`run-gEZHfT` 四场景 / 22 张 PNG、三个负向对照通过，全部单页像素差为 0；`text-rYzgdP` 八场景 / 18 张 PNG 及字形溢出负向对照通过。22 张核心场景的实际导出 PNG 与修改前 `run-oqTYWH` 逐一 SHA-256 相同，改变的是参考截图的文字绘制方式，而不是导出内容。

仅灰度抗锯齿的首次 Linux 试验（930e9b4 / run 35891487232）仍失败：整页差异由 2.38% 降至 2.01%，系统事件局部由 4.86% 降至 4.46%；22 张实际导出图也与修改前完全相同。因此不能仅凭 Windows 通过宣称解决；后续单独加入无 hinting 设置进行远端验证。机制参考 Chromium 的 [Linux 字体参数实现](https://raw.githubusercontent.com/chromium/chromium/main/ui/gfx/font_render_params_linux.cc) 与 [headless hinting 开关](https://chromium.googlesource.com/chromium/src/+/e1b855d4545dc4fff19cee500d7ce105126f3bd2)。

无 hinting 试验（8734abf / run 35892339478）也未解决，未保留该参数。分阶段诊断（35cbe16 / run 35892929659）证明两张聊天页 native→serialized 均 0%，serialized→PNG 分别 1.972% / 0.802%。首次灰度试验中的系统事件字形仅向下偏移 2 个输出像素，平移对照可达到完全一致。因此下一项独立实验回到灰度基线，仅增加禁止按设备缩放启用字体子像素定位的开关；仍须等 Linux 验证，不预先认定通过。

5cf915c / run 35893884369 已证明两项启动参数解决核心 Linux 差异：四个场景 / 22 张实际 PNG 全部 0%，分阶段对照也是 0%，所有负向对照通过。但此前跳过的短文字测试继续暴露了真实换行问题，因此这次工作流仍失败，不能算全部通过。

### 祖先 CSS 缩放隔离（2026-09-24，临时验证分支）

短文字失败证据显示：zoom 1.1 时“引用消息”的复制宽度不足 28px，变成两行；分数字号 / zoom 0.9 时短句需要 121.078125px，复制内容宽度只有 121px，最后字符溢出。原导出树受文档祖先 zoom 影响，SVG 却不包含这些祖先，所以字号相同仍会发生测量差异。

仅在一次性导出 stage 上抵消祖先 CSS zoom，先统一测量比例再准备资源、文字约束和分页；stage 不进入 SVG，原文档、作者字体与气泡样式不变。对于支持 `currentCSSZoom` 的浏览器，额外处理双层缩放浮点乘法略低于 1 导致的 1/64px 宽度损失；不支持该属性的旧浏览器仍执行基本隔离，但此精度边界尚未验证。该属性的语义参考 [CSSOM View 草案](https://drafts.csswg.org/cssom-view/#dom-element-currentcsszoom)。

新增五组真实浏览器缩放隔离契约，以及第九个实际 PNG 场景（html 1.1 × body 0.9 + 分数字号），短文字套件现为九场景 / 20 张 PNG。检查导出前后视口均为 360px，保留所有行数、字体、文字边界、像素阈值和字形溢出负向对照。撤掉修复的新契约会报 324px ≠ 360px，证明没有空跑。

Windows 核心套件 `run-VGMrFp` 四场景 / 22 张 PNG、三个负向对照通过，所有像素差异 0%；46 项导出相关 Node 测试通过，全量 Node 2504/2504 通过。完整 Linux 流程仍需用新提交复验。这里只覆盖 CSS 祖先缩放，不等同于浏览器页面缩放、CSS transform 或真实 iPad Safari 验收；未合并、未部署正式站。

### 短文字序列化回归（2026-09-17）

```sh
npm run test:phone-export:text
node scripts/run-phone-export-text-browser.mjs --browser=chromium
node scripts/run-phone-export-text-browser.mjs --browser=webkit
```

`npm run test:phone-export:text -- --browser=webkit` 也可传参；若 Windows PowerShell/npm 输出的实际脚本命令丢失了参数，使用上面的直接 Node 命令，并确认 `report.json` 的 `engine`。结果与 ZIP、序列化 SVG、原生副本截图、真实 PNG 和差异图保存在 `artifacts/phone-export-browser/text-*/`，成功时也保留。

`npm run verify:phone-export` 和现有 `.github/workflows/phone-export-browser.yml` 已加入这项 Chromium 短文字回归；CI 路径触发条件涵盖新 runner、测试及共享样例。原有 `test:phone-export:browser` 的参数与场景保持不变。

此回归仍从作者首页的作品菜单进入真实导出，只写测试 `tuuru_works`，不开放读者导出。两侧短句包括 `……？`、`是不小心按错了吗？`、`你真的考虑清楚了吗？`、`我在资料室里等你`、`还是说...要我过去找你？`、`你好`、`你好。`、英文和 emoji，并穿插多行、引用、图片。作者 iframe 文档分别施加 CSS zoom 0.9 / 1 / 1.1 / 1.25；另外两项分数字号和两项皮肤属于仅测试服务器注入的渲染压力，不是新增作者功能。启用 reduced-motion，覆盖全局极短 CSS transition 对约束测量的影响。

测试专用 Vite 观察器调用真实 `toSvg`，在无 zoom 的干净页面重新挂载其 `foreignObject`，检查实际序列化文本非空、内容、行数、字体、气泡约束和每行边界，再将这个副本的原生截图与实际下载 ZIP 中的 PNG 比较。不会把缩放后的源 DOM 尺寸误当成最终 PNG 尺寸。局部像素检查包含紧贴气泡的区域及下方 16px 溢出条带，沿用 1% 整页、2.5% 局部、0.15 颜色差阈值。负向对照把一个真实字形大小的像素块移动到气泡下方：它必须通过整页阈值，却被局部检查拒绝。

修复只在一次性导出树上将纯文字气泡的像素边框盒约束转换为内容盒约束（包括皮肤最小高度），再将新布局的内容宽度向上取整为指定 `min-width`。固定的内联像素尺寸保留，图片/语音/SVG/媒体气泡和其他卡片不变；精确字号仍由既有流程保留。仅这些副本文字气泡禁用 transition-property，避免转换值短暂插值导致分页测量失真。正常编辑器、阅读器样式、内容与分页策略没有改变。

本地验证记录：

- 修复前 Chromium `text-lvZl0d`：真实作者短句在 zoom 1.1 / 1.25 的序列化副本中由 1 行变成 2 行，命令退出 1。
- 修复后 Chromium `text-z4J696`：8/8 场景、18 张实际 PNG、文字几何与字形溢出负向对照通过，退出 0。
- Windows WebKit `text-soL326`：8 场景、18 张 PNG 全部完成，序列化文字几何和负向对照通过；最终 PNG 保真仍未通过，整页差异约 1.06%–2.63%，另有皮肤局部溢出条带 3.02%。命令如实退出 1，未放宽阈值，不能称 WebKit/Safari 全部通过。
- 原有独立皮肤检查：`run-uPohX1`（full-skin，3 张 PNG）与 `run-zKdJGH`（slice-skin，9 张 PNG / 3 路线）通过，包括原有分页和三个负向对照。

CSS zoom 是本地已证明的触发条件，不代表已确认反馈设备开启了缩放。反馈来源设备未知；上述 Playwright 测试不是实际 iPad/iPhone Safari 验收。旧的 Windows WebKit 文字/阴影栅格差异仍是独立的兼容性缺口。

首次安装（CI / Linux 用 `npx playwright install --with-deps chromium`）：

```sh
npm ci
npx playwright install chromium
npm run test:phone-export:browser
```

常规检查（Node 测试、双端构建、原有四个 Chromium 浏览器导出场景）：

```sh
npm run verify:phone-export
```

工作流 `.github/workflows/phone-export-browser.yml` 会在相关文件的 push / pull request 以及手动触发时运行 Chromium 验收；失败证据保存 7 天。工作流需提交推送后才会在远端生效。本地的普通 `npm test` 不会下载或启动浏览器。

调试单个场景并保留图片：

```sh
node scripts/run-phone-export-browser.mjs --case=desktop-current --keep-artifacts
```

其他场景名：`narrow-all`、`full-skin`、`slice-skin`。成功默认删除本次生成的图片；失败自动保留 `artifacts/phone-export-browser/run-*/` 中的 ZIP、实际 PNG、原生截图、差异图及 `report.json`。输出目录已被 Git 忽略。仅清理本进程创建的运行目录，不碰其他验收资料。

补测全部场景 / WebKit（Windows WebKit 的文字与阴影保真仍未修复，失败不能跳过或放宽阈值）：

```sh
npx playwright install webkit
node scripts/run-phone-export-browser.mjs --suite=all --keep-artifacts
node scripts/run-phone-export-browser.mjs --browser=webkit --suite=all --keep-artifacts
```

`--suite=edge` 运行九个边界场景：`oversized-message`、`image-404`、`image-timeout`、`image-cors`、`image-cors-allowed`、`image-all-failed`、`css-image-cors`、`css-image-cors-allowed`、`font-complex-css`，也可与 `--case=` 联用。`--suite=all` 共十三个场景。默认命令和现有 CI 仍仅运行原有四个 Chromium 场景，不能把它们通过等同于全部兼容性通过。

## 检查内容

- 从合成的作者作品库，经真实作者作品导出菜单下载 ZIP，不替换 PNG 生成器。独立的读者记录仅是污染/隔离对照，不是导出源。
- 桌面 / 窄屏、单聊 / 群聊、默认分支 / 全部分支。整图 / 九宫格气泡皮肤及复杂 CSS 是验收服务器专用渲染压力输入，不是新增加的作者产品字段。
- 压力 CSS 的气泡装饰小字（伪元素独立字号）；字体通过真实 `editorSettings.customFonts`，壁纸通过真实 `phoneData.skin`。
- 长中文和混排文本、转账、红包、图片、语音、链接、亲属卡、外卖、位置、联系人名片、文件、音乐、转发、日程、通话、时间和系统事件。
- 三条条件分支，包括二级选项、回复追加消息与结束话题；断言分支内容不混入、页码独立、非聊天模块只导出一次。
- 消息与卡片的真实 DOM 边界、相邻消息重叠、文字越出气泡、图片解码、分页连续性及普通高度消息的完整性。
- 解压实际下载图片并检查尺寸；与同一次所选浏览器的原生截图逐页、逐消息区域对比。没有跨操作系统的固定金图。
- 导出前后全部 localStorage 一致、父页面与 iframe 中私有读者读取/所有写入守卫、临时渲染树清除、无页面异常或意外外网请求。
- 每次命令额外执行普通读者及作者阅读预览的伪造 URL / 旧导出控件负向检查、真实栅格边界取消检查和占位文本/文件名/读者头像打码检查；打码单独下载 3 张 PNG 的 ZIP，不计入十三个像素场景的 41 张图片。
- 404、超时、禁止跨站读取的消息图片必须触发“部分导出”及自动展开的失败清单，ZIP 只能包含未受影响的联系人页；全部失败时显示错误且不下载。
- 允许跨站读取的消息图片与壁纸必须在实际生成 PNG 前变成可解码的内嵌图片。所有本地图片服务器请求须保留原始查询参数，不能加入时间戳或重复 HTML 转义。
- 三个负向对照：人为引入支付卡重叠、PNG 内容移位、消息分页破坏；必须被相应断言拒绝，避免断言空跑。

## 测试边界

测试服务器仅监听本机端口，使用独立临时浏览器上下文、固定时间数据和内嵌图片，不访问用户书架、登录信息或下载目录。边界场景额外启动随机端口的 loopback 图片服务器，模拟不同源图片的 404、永不返回、禁止/允许跨域读取；不访问公共图片 CDN。字体场景只读取本机已安装字体作为自定义字体导入，不把字体文件复制进仓库或分发。Windows 使用 Arial，Linux 使用 DejaVu Sans / Liberation Sans，macOS 使用 Arial；缺失会明确报错。

浏览器视窗高度设为 1800 CSS px，保证原生截图容纳单张导出页。WebKit 配置 iPhone 13 user agent、移动端与触摸参数，但仍是 Windows Playwright WebKit 26.6，不是真实 iPhone Safari。Playwright 官方也说明其 WebKit 为打过补丁的版本，不能直接控制 Safari，平台之间存在差异：[浏览器说明](https://playwright.dev/docs/browsers#webkit)、[设备模拟说明](https://playwright.dev/docs/emulation)。

仅测试服务器会注入观察器，在真实 `html-to-image` 调用前读取导出 DOM 并截图。正常构建不包含观察器。栅格模块在作者父页面导入，但观察器从 `node.ownerDocument.defaultView` 调用绑定，以 Playwright `source.frame` 找到真实 iframe。截图时同时短暂移动 iframe 与导出容器，背景与 PNG 同为 `#fffafa`，等待两个动画帧，截取真实 viewport 矩形并恢复两层样式；不缩放布局。旧皮肤/CSS 压力注入只替换验收服务器里的作者渲染分支，生产源文件中没有此入口；匹配失效时测试会明确失败。

原生截图不是独立设计稿：视觉对比负责发现 DOM → PNG 的偏移，DOM 几何和内容断言负责发现渲染 / 分页本身的错误。整体像素差阈值为 1%，单消息区域为 2.5%，像素颜色阈值为 0.15；忽略抗锯齿差异但不允许局部卡片错位被大面积背景稀释。

补测覆盖一条 180 行、实测约 7038 CSS px 高的消息，检查跨页内容完整、无重复/缺失、面板原点及逐条消息的几何保持稳定，并保留普通消息完整性要求。另检查真实导入字体、分数字号、字间距、渐变、阴影和前后伪元素内容/字号。仍不覆盖任意作者 CSS、所有图片/字体服务、真实 iPhone Safari、Firefox 和所有聊天状态组合。相关新问题应追加最小固定样例，不能只调宽阈值来让失败消失。

## 首次接入发现的问题与修复（2026-09-07）

首次接入时，4 个场景 / 22 张 PNG 均存在像素差异。位置卡片图片变高，推移后续联系人卡片并在页末截断；联系人页圆形头像被压扁，标题栏变矮；文字和语音波形也有偏差。原始失败证据保留于 `artifacts/phone-export-browser/run-TGMb6s/`。

根因在导出样式复制：全局排除高度导致固定尺寸丢失，依赖库会缩小像素字号，并且不会复制 SVG 后代的样式。修复保留高度、在副本上冻结精确字号与 SVG 样式，同时保留伪元素独立字号，未更改实际阅读界面、用户设置或依赖库文件。

修复后 `node scripts/run-phone-export-browser.mjs --keep-artifacts` 退出码为 0：4 个场景 / 22 张 PNG 全部通过，最大单页像素差异约 0.137%；三项负向对照仍全部生效。最终证据在 `artifacts/phone-export-browser/run-tgmeKD/`。所有阈值保持不变；仅纠正了原生截图圆角外背景不一致的验收误差，并补充二级选项节点的存在性检查。

最终 `npm run verify` 通过：2431 项 Node 测试、TypeScript 检查与生产构建全部成功。本次修复尚未提交、推送或部署。

## 边界与 WebKit 补测（2026-09-07，测试未通过项保留）

本轮只增加/强化测试与文档，没有修改生产代码，没有提交、推送或部署。

| 引擎 | 场景 / 实际下载 PNG | 结果 |
| --- | --- | --- |
| Chromium 153 | 10 / 45 | 9 个场景通过；禁止跨域的外链图片丢失 |
| Windows WebKit 26.6（移动端模拟） | 10 / 45 | 10 个场景均未达到完整图像保真验收要求；导出 ZIP 可完成 |

### 确认：禁止跨域的图片静默丢失

聊天原生渲染能看到图片，但 `html-to-image` 为嵌入图片发起的 fetch 被 CORS 限制。依赖库 `resourceToDataURL()` 捕获失败，使用导出选项里的透明占位图；因此导出仍提示完成，但 PNG 中图片为空白。相同图片字节仅增加 `Access-Control-Allow-Origin: *` 后通过，支持上述归因。

Chromium 禁止跨域场景单页差异约 1.82%，图片消息区域约 26.02%；允许跨域场景最大单页差异约 0.133%。404 与加载超时场景能够完成导出且未出现相邻消息重叠；超长消息与字体/CSS 场景也通过。WebKit 禁止跨域场景同时记录到访问控制错误，不作为额外独立业务错误计数。

### 未通过：WebKit 图像还原

排除原生参考截图合成层刷新问题后，同一 WebKit 原生截图与实际 PNG 仍有文字及阴影形状差异。普通场景单页差异约 1.38%–2.11%；皮肤场景中部分通话消息区域差异约 3.28%。消息几何、路由内容、连续分页和本地存储隔离检查未报告对应失败，但 PNG 保真检查未过。这是当前 Windows WebKit 环境的兼容性验收缺口，不能外推为真实 iPhone Safari 已确认故障，也不能宣布 Safari 通过。尚未实施兼容性修复。

### 证据与验证

- Chromium 完整复测：`artifacts/phone-export-browser/run-njL5j0/report.json`，退出码 1（保留真实失败）。
- WebKit 同步刷新参考截图后的完整复测：`artifacts/phone-export-browser/run-NN6E8q/report.json`，退出码 1。
- 每次完整复测均解压 45 张真实 PNG，保留 ZIP、原生截图、导出图与差异图；两引擎共 90 张实际导出图片。
- `run-0eumr6` 是发现参考截图刷新问题的诊断记录，不能用其中 50%–97% 的差异作为导出缺陷结论。`run-fGlRzg` 是补充同步后的单场景确认。
- 加强后的超长分页断言已重新校验以上两份完整报告的实际几何，均通过。人为重叠、PNG 移位、错误分页的三个浏览器负向对照仍生效。
- 定向 Node 测试：66 项全部通过（导出单元/集成测试与补测断言）。测试代码经独立只读审查，关闭了跨页内容或整个面板移位可能被遗漏的断言缺口。
- 最终 `npm run verify` 退出码 0：2443 项 Node 测试全部通过，TypeScript 与生产构建通过。`git diff --check` 与测试脚本语法检查通过。这些通过项不替代仍然失败的浏览器保真验收。
- 加强断言后的新鲜超长用例运行：`run-frHjXO`，7 张 PNG、三个浏览器负向对照均通过，退出码 0。

## 外链图片失败处理修复（2026-09-07）

本轮针对上面的“禁止跨域图片静默丢失”修复生产逻辑。历史失败记录保留，不代表修复后的结果。

- 在已打码的临时导出副本上，先读取并解码外部消息图片、头像及 CSS 图片，再转为内嵌数据。保持原 URL 的查询参数，不添加时间戳、不使用代理、不绕过跨站读取限制。
- 每个资源的请求、响应体读取与解码共用 2500 ms 上限；支持取消，同一副本内去重。任一资源失败即丢弃该聊天/模块的整项输出，其余项照常生成 ZIP，并明确显示“部分导出”、未导出数量及展开的原因清单。全部失败则不下载。
- 图片服务器拒绝跨站读取时，客户端不能凭空取得图片字节；此时提示检查网络，或保存图片后重新上传，再重试。这个修复不意味着所有外链都可导出。
- 带签名参数的壁纸地址另有重复 HTML 转义问题：实际请求曾把 `&` 改成 `&amp;`。已统一阅读界面和导出预览的壁纸 URL 序列化，先转义 CSS 字符串，再仅转义一次 HTML 属性；不改变保存的数据。
- 独立审查还关闭了两处边界：CSS 文字内容中的 `url(...)` 不再误判为图片；浏览器验收提前订阅的下载事件，即使导出异常结束也不会产生未处理的 Promise 拒绝。

### 本轮验收记录

- 定向 Node 验收 90/90 通过，涵盖资源错误、空响应、解码失败、响应体/解码超时、取消与清理、CSS 图片、原树隔离、失败后重试、链接参数，以及原有分页/分支/PNG 对比断言。
- 独立生产与集成审查已通过。
- 最终 Chromium 全量命令 `node scripts/run-phone-export-browser.mjs --suite=all --keep-artifacts` 退出码 0：13/13 场景通过，实际解压检查 42 张 PNG，最大单页差异约 0.320%；转账重叠、PNG 移位、分页破坏三个负向对照仍全部生效。证据：`artifacts/phone-export-browser/run-g7LyHh/report.json`。像素/消息区域阈值未放宽。
- Windows WebKit 定向 `image-cors` 通过：仅下载未受影响的联系人 PNG，明确提示部分导出，最大单页差异 0.057%；证据 `run-kCyVBO`。预期访问控制诊断保留在 `securityDiagnostics`，仅按受控服务器的具体 host、资源路径及 CORS 标记区分，不忽略其他页面错误。
- WebKit `image-all-failed` 两次（`run-qyuYyK`、`run-yI0Y1X`）、`css-image-cors` 一次（`run-D6G7pL`）在初始页面导航的 `DOMContentLoaded` 等待处超时，尚未执行到导出点击；这两项没有验收结论，不计通过，也不据此认定为导出功能失败。
- Windows WebKit 文字/阴影保真问题未在本轮修改，真实 iPhone Safari 仍待实机验收。
- 最终串行 `npm run verify` 退出码 0：2464/2464 项 Node 测试、TypeScript 检查和生产构建通过。生产/测试脚本语法检查与 `git diff --check` 通过。当前改动仅在本地，未提交、推送或部署。

## WebKit 启动修复与绘制边界定位（2026-09-07，后续处理）

本轮修复的是验收工具，不是再次修改聊天布局或生产导出器；上轮外链图片修复保持不变。Windows WebKit 的文字／阴影保真仍有未通过项。

### 已修复的验收问题

- 启动卡顿来自 Vite/chokidar 为整个工作区创建文件监听器。CPU profile 显示约 8.28 秒耗在 `FSWatcher` 创建；本地工具链和验收图片目录也被扫描。移除 loopback 请求拦截并不能改善，不能归因于作品加载或导出交互。
- 在仅由验收服务器加载的 `exportProbePlugin.configResolved` 中设置 `server.watch = null`。单纯在合并前传入 null 会被当前 Vite 的配置合并忽略；新测试验证真正创建了 `NoopWatcher` 并关闭服务器。对照 `startup-XvMOZC` 导航 400 ms、Node 最长阻塞 73 ms，之前分别为 8–9 秒、5.5–5.9 秒。正常开发的 Vite/HMR 配置未改，超时限制未延长。
- 404 图片服务器原本同时拒绝跨站读取，导致用例混入 CORS 故障。现在受控 404 响应允许跨站读取，使导出器确实检查到 HTTP 失败；专门的 CORS 拒绝场景保持原状。响应头测试先失败、修复后通过。
- 原诊断过滤中的 `/cors/` 路径可能被当成 CORS 错误文字，误放过包含同一 URL 的其他异常。已缩小为 WebKit 已知完整错误形式，精确匹配受控主机、端口、文件路径及查询参数；匹配项仍存入 `securityDiagnostics`，其他错误仍使验收失败。新增反例先复现该误判，再修复通过。
- 两组独立只读审查均无遗留问题；相关 Node 验收 20/20 通过。

### 已定位但未修复：SVG 转 PNG 的文字／阴影差异

隔离样例 `browser-tests/phone-export/webkit-raster-diagnostic.mjs` 不加载作品或用户数据，分别比较原生 HTML、序列化后的 HTML 副本与实际 SVG 栅格图。结果见 `raster-probe-X19JzM/report.json`：

- 原始页面与重新挂载的序列化 HTML：Chromium 0 个差异像素，WebKit 1 个；WebKit 转成 PNG 后则为 5,488 个。精确字号、行高、圆角和阴影值一致，差异发生在 SVG 图片绘制阶段，不是样式复制丢失或消息移动。
- 将 SVG 固有尺寸加倍而保持 viewBox 不变，结果完全不变；内部 CSS zoom 加倍使两种引擎都更差。这两种实验没有进入生产代码，原作者字号和阴影保持不变。
- 独立 CSS 分辨率探针显示，两种引擎的原生 DPR2 页面与内部 SVG 图片页面对 `min-resolution:1.5dppx` 的结果不同。它证明绘制环境不同，但不能单独证明 WebKit 特有故障。
- 当前 WebKit 源码的文本基线按文档设备缩放取整，而 SVG 内部 Page 默认缩放为 1，绘制时另外缩放画布；这支持“分数行高导致隔行约 1 输出像素偏差”的推断，但不是对本机精确引擎修订版及阴影机制的完整证明。依据：[TextBoxPainter.cpp](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/rendering/TextBoxPainter.cpp)、[Page.h](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/page/Page.h)、[SVGImage.cpp](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/svg/graphics/SVGImage.cpp)。

没有足够证据支持继续给样式复制打补丁。下一步需要真实 iPhone／Mac Safari 验收，确认是否复现及可见影响后，再决定是否需要更换客户端图片生成方案。没有实机结果前不宣布 Safari 通过或故障已确认，也没有增加外部截图服务、上传数据或替换依赖。

### 本轮最终验证

- Windows WebKit 全量：`artifacts/phone-export-browser/run-NsbUzN/report.json`，13 个场景全部完成导出测试，无初始导航超时；42 张真实 PNG。5 个失败处理场景通过（404、超时、禁止跨域、全部失败、CSS 图片禁止跨域）；另外 8 个场景只因原有文字／阴影保真检查失败，命令如实返回退出码 1。普通聊天最大单页差异约 2.11%，皮肤场景通话区域约 3.28%；几何、分支、分页及状态隔离未发现新的失败。
- 初次完整运行 `run-p8gGG8` 保留了 404 混合 CORS 的验收失败，供追溯；不能用它替代修正用例后的最终报告。
- Chromium 最终全量：`artifacts/phone-export-browser/run-AHsPsG/report.json`，退出码 0，13/13 场景、42 张 PNG 通过，最大单页差异约 0.320%；转账重叠、PNG 移位和错误分页三个负向对照全部生效。
- 最终串行 `npm run verify` 退出码 0：2466/2466 项 Node 测试通过，无失败／跳过，TypeScript 检查及生产构建通过。测试脚本语法检查与 `git diff --check` 通过。
- 未更改像素阈值、屏蔽失败场景或弱化负向对照；本轮未提交、推送、部署。

## 历史：已过时的读者 iPad 验收预览（2026-09-07）

旧入口：[已过时的读者图片导出预览](https://4cf222a1.tuuru.pages.dev/phone-export-test.html)。它使用已移除的读者导出路径，不能用于当前权限/作者验收。以下是旧发布记录，不是当前操作指南；没有在本轮更新或部署此网址。

- 只上传新鲜构建的静态输出 `preview-FFDXlr`，另附预览专用启动页和合成样例。没有改正常 Vite 入口、生产聊天代码或正式站设置。验收样例只在点击按钮后写入该预览域名的本地存储；已有书架／作品／美化数据时拒绝覆盖，写入失败回滚。
- 该预览网址可公开访问，带 `noindex`；它不是有登录保护的私密分享。不包含真实作品、凭据、测试日志或私有文件。不要混用预览别名与上述固定域名，否则书架存储会分别独立。
- Cloudflare deployment `4cf222a1-cb7c-4d1a-9bb6-22d60f493cf2`：`preview` 环境、`codex/phone-export-preview-20260907` 分支、发布成功。注意正式分支是 `codex/phone-runtime-overhaul`（也是当前本地分支），这次明确覆盖为独立预览分支；没有 Git 提交／推送。
- 发布前后正式 deployment 均为 `e57b5d1c-ff06-4908-bd60-e8d95e403522`，`tuuru.chat` 没有更新。
- 本轮 TypeScript 与生产打包通过。独立审查无阻塞问题，生产域名拒绝、已有数据保护、正常载入和配额失败回滚等五项隔离用例通过。
- 本地与已发布网址分别完成 Chromium 操作验收：入口加载、实际下载 7 张 PNG 的三分支 ZIP、联系人仅一次、已有数据不覆盖、部分写入回滚，且无页面异常。证据 `preview-check-wfA1Mi` / `preview-check-cfFCFZ`。HTTPS 入口另确认 200 及 `X-Robots-Tag: noindex`。
- 这些只证明预览可用，不能替代真实 iPad Safari 验收，也不关闭前述 Windows WebKit 文字／阴影保真失败。
