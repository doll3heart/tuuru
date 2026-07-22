# Tuuru 全功能展示文章

这是一个没有故事情节的功能展板作品。JSON 与 PNG 包含相同作品数据，都可以直接导入 Tuuru 读者端。

- 作品：`《Tuuru 全功能展示》`
- 阅读密码：`2026`
- 推荐占位符：姓名 `小桃`、昵称 `桃桃`、网名 `桃子汽水`
- 覆盖：4 章、13 个节点、富文本、图片、作者水印、分支/汇流/回环、上一节返回，以及消息、论坛、备忘录、相册、浏览器、购物、联系人七类文章手机模块。
- 消息模块额外覆盖：逐条对话、图片、语音、完整回复选项、后续消息、转账、红包和语音通话。

重新生成作品：

```powershell
node scripts/generate-showcase-article.mjs
```

重新捕获移动端截图：

```powershell
node scripts/capture-showcase-article.mjs
```

截图会写入 `samples/showcase/screenshots/`：其中包含 26 张 `390 × 844` 的移动端页面、`manifest.json` 截图索引，以及方便一次查看全部页面的 `contact-sheet.png` 总览图。
