# 文章手机模块草稿隔离设计

## 背景与目标

Tuuru 是纯前端、纯本地应用。文章编辑器允许作者在正文中插入手机 App 卡片，但当前实现为了复用手机编辑器，会先把卡片草稿写入正式 `work.phoneData`，关闭弹窗后再尝试恢复。

文章作品通常没有 `phoneData`。旧实现把这种状态记录为 `null`，恢复逻辑却只处理非 `null` 的原值，因此一次普通的文章手机模块编辑就可能永久留下临时 `phoneData`。刷新、崩溃、快速关闭和多弹窗还会绕过基于 200ms 定时器与 `MutationObserver` 的回滚。

本设计的目标是：文章手机模块编辑期间，手机编辑器无法获得写入正式作品的能力；独立手机作品的现有持久化行为保持不变。

## 已批准的约束

- 应用继续保持纯前端、纯本地，不引入服务器、社区或数据库服务。
- 不改变现有作品数据格式，不迁移用户数据。
- 不一次重写 `js/pages/phone.js`；通过小型兼容边界渐进迁移。
- 关闭按钮和点击遮罩继续沿用现有“保存并关闭”语义，本阶段不新增破坏现有习惯的交互。
- 每个逻辑改进独立提交，并在提交前后验证测试与两个 Vite 入口构建。
- 任何虚拟草稿 ID 在会话结束后必须失效，不能回退到正式数据层。

## 方案比较

### 方案 A：虚拟作品 ID 与内存访问层（采用）

`phone.js` 把 `getWork`/`updateWork` 改为从一个兼容访问层导入。真实作品 ID 原样委托现有 `data.js`；文章模块获得唯一的 `phone-draft:<id>`，其读写只进入内存中的深拷贝。

优点是 33 个现有读写调用都能在一个边界上被接管，无需同时修改 4000 多行 App 编辑器；不同草稿使用不同 ID，不会互相覆盖；未知或已释放的虚拟 ID 可以直接拒绝。代价是访问层在迁移期间仍是一层兼容设施，长期应由显式 session 参数取代。

### 方案 B：给所有手机函数传递 session

这是长期最清晰的接口，但需要同时改动消息、论坛、联系人、备忘、相册、浏览和购物等大量嵌套函数，无法形成小提交，回归面过大。

### 方案 C：为文章模块复制一套编辑器

它能避开正式存储，但会进一步扩大编辑器与阅读器的功能漂移，因此拒绝。

## 架构

### `js/phone-work-access.js`

该模块提供一个可注入、可单元测试的访问器：

```js
createPhoneWorkAccess({ readStoredWork, updateStoredWork, createSessionId, now })
```

返回以下接口：

```js
getPhoneWork(id)
updatePhoneWork(id, patch)
createPhoneWorkDraft(initialWork)
```

`createPhoneWorkDraft` 返回 `{ id, snapshot, dispose }`。草稿在创建、读取、写入和取快照时都经过 JSON 深拷贝，以模拟当前 localStorage 每次读取都会得到新对象的语义。真实 ID 的读写不增加克隆或转换，保持现有行为。

模块同时导出绑定到 `data.js` 的默认单例。`phone.js` 以别名方式导入默认单例的 `getPhoneWork` 与 `updatePhoneWork`，其余常量继续来自 `data.js`，不会产生循环依赖。

### `js/phone-modal-lifecycle.js`

该模块提供一次性关闭控制器：

```js
createPhoneModalCloseController({ beforeClose, remove, afterClose })
```

关闭按钮和遮罩都调用同一个控制器。`beforeClose` 返回 `false` 时保留弹窗，适用于最终 localStorage 提交失败；成功时先执行 `remove`，再把 `beforeClose` 的结果传给 `afterClose`。重复关闭只结算一次。

### `js/phone-module-draft.js`

该模块负责纯数据操作：补齐手机编辑器所需集合、从草稿投影当前模块的数据、判断模块是否为空。它不导入 `data.js`，也不访问 DOM 或 localStorage。

文章编辑器的数据流为：

1. 从正式文章与现有模块深拷贝出临时 `phoneData`。
2. 用文章快照创建唯一虚拟草稿作品。
3. 以虚拟 ID 调用 `openPhoneAppModal`。
4. 手机 App 内部所有保存都由访问层写入内存草稿。
5. 用户关闭时同步读取草稿快照，并只提交 `phoneModules` 中当前模块的数据。
6. 正式提交成功后释放草稿并关闭弹窗；提交失败则保留弹窗与草稿并显示错误。

在整个流程中，不调用 `updateWork(wid, { phoneData: tempPd })`，正式文章的 `phoneData` 与 `updatedAt` 不会因预览或草稿编辑而变化。

## 错误与并发处理

- 每个草稿使用唯一虚拟 ID；同一文章可创建互不共享对象的独立会话。
- 未注册或已释放的 `phone-draft:` ID 返回 `null`，永不委托正式数据层。
- 正式模块提交失败时，`beforeClose` 返回 `false`，弹窗不关闭、草稿不释放。
- `dispose` 幂等；迟到的手机保存只能命中失效虚拟 ID，并返回 `null`。
- 弹窗关闭不再依赖定时器、全局 `querySelector` 或 DOM 删除观察器，因此快速关闭与选择错误弹窗的路径被移除。

## 测试策略

- 单元测试真实 ID 委托保持不变。
- 单元测试草稿读写不调用正式 writer，且不会给原文章增加 `phoneData`。
- 单元测试读、写、快照的嵌套对象彼此隔离。
- 单元测试两个草稿互不覆盖，释放后虚拟 ID 失败关闭。
- 单元测试关闭前拒绝、成功顺序与重复关闭。
- 单元测试模块数据补全、投影与空内容判断。
- 每个提交运行 `node --test`、编辑器临时目录构建和阅读器临时目录构建。

## 本阶段边界

本阶段不改变手机视觉设计、不迁移旧内置阅读器、不解决正文卡片与 `phoneModules` 的原子双写，也不新增显式“保存/取消”按钮。这些问题保持在后续独立阶段，避免扩大首个数据安全修复的回归面。
