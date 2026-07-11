# 构建验证卫生设计

## 背景

仓库当前有两类构建行为：

- 正式编辑器构建写入 `dist-editor/`；该目录包含 Git 已跟踪的历史发布产物。
- 正式阅读器构建写入 `dist-reader/`；该目录当前不存在且没有被 Git 忽略。

因此，直接运行 `npm run build` 会改写已跟踪的编辑器产物，并创建未跟踪的阅读器产物。现有移动端设计与实施文档已经约定验证构建写入系统临时目录，但仓库没有可复用的命令来执行这个约定，导致每次验证都需要人工恢复和删除构建产物。

仓库没有部署文档、CI 配置或其他证据证明 `dist-editor/` 可以安全停止跟踪。本阶段必须保留正式构建与预览行为。

## 目标

- 提供一个跨平台、可重复执行的构建验证命令。
- 验证现有编辑器和阅读器 Vite 配置，而不写入工作树的正式产物目录。
- 顺序执行两个 Vite 构建，避免 Windows 下并行加载配置时发生竞争。
- 无论构建成功或失败，都清理本次创建的唯一临时目录。
- 提供一个统一命令运行完整测试、TypeScript 验证和临时 Vite 构建。
- 执行验证前后保持 Git 可见状态完全一致。

## 非目标

- 不改变 `npm run build`、`build:editor`、`build:reader`、`preview` 或 `preview:reader` 的行为。
- 不改变 `dist-editor/`、`dist-reader/`、Vite `base`、reader `root` 或正式入口文件。
- 不停止跟踪、刷新或提交任何正式构建产物。
- 不增加 CI、部署、服务端、上传、遥测、远程数据库或网络功能。
- 不清理验证开始前已经存在的工作树文件。

## 方案

### 命令入口

在 `package.json` 中增加：

- `build:verify`：先执行 TypeScript 项目验证，再运行临时 Vite 构建脚本。
- `verify`：先运行完整 Node 测试，再运行 `build:verify`。

现有正式构建和预览脚本保持逐字不变。

### 临时构建脚本

新增 `scripts/verify-builds.mjs`，使用 Node ESM 和 Vite 公共 `build()` API：

1. 先规范化仓库根目录和现有临时父目录；若临时父目录位于仓库内，则在创建任何目录前拒绝执行。
2. 以规范化后的 `os.tmpdir()` 为父目录调用 `mkdtemp()`，获得本次执行专属的绝对临时根目录。
3. 规范化返回路径，并确认它是临时父目录的直接、带 `tuuru-build-` 前缀的子目录，且与仓库在两个方向上都不重叠。
4. 顺序构建编辑器和阅读器。
5. 每个构建继续加载仓库现有的真实 `configFile`，只以内联配置覆盖绝对 `build.outDir` 和 `emptyOutDir: true`。
6. 编辑器写入临时根目录下的 `editor/`，阅读器写入 `reader/`。
7. 在清理路径中只递归删除已经通过规范化和边界验证的临时根目录。

脚本不得推导、删除或恢复工作树内的 `dist-editor/`、`dist-reader/` 或其他路径。

### 可测试边界

脚本将路径规划与实际 I/O 分开：

- 纯路径规划负责返回仓库配置路径和临时输出路径。
- 执行层接收 Vite 构建函数、临时目录创建函数和删除函数，生产环境使用 Node/Vite 默认依赖，测试可以注入记录器或失败桩。
- 模块只在作为命令入口直接执行时启动真实构建；被测试导入时不产生副作用。

该边界使成功顺序、失败传播、一次性清理和路径范围都能在不真正构建的单元测试中验证，同时仍由 `npm run build:verify` 做真实集成验证。

## 数据流

```text
npm run verify
  -> npm test
  -> npm run build:verify
       -> tsc -b --pretty false
       -> scripts/verify-builds.mjs
            -> mkdtemp(os.tmpdir()/tuuru-build-*)
            -> vite.build(editor config -> temp/editor)
            -> vite.build(reader config -> temp/reader)
            -> remove(temp root)
```

正式 `npm run build` 继续走原有 `dist-editor/` 与 `dist-reader/` 路径，不经过该验证脚本。

## 错误处理

- 任一 Vite 构建失败时，停止后续构建并返回非零状态。
- 构建失败后仍必须尝试清理临时目录。
- 单独清理失败时返回非零状态并报告清理错误。
- 构建和清理同时失败时，同时保留两项错误信息，不能用清理错误掩盖原始构建错误。
- 使用显式失败标记保存异常状态，不能因依赖抛出 `undefined`、`null`、`0` 或空字符串而误判成功。
- 临时父目录的规范化和仓库边界检查必须发生在 `mkdtemp()` 之前；未通过完整边界验证的返回路径不得进入递归删除。
- 只有由本次 `mkdtemp()` 返回的路径可以传给递归删除函数。
- TypeScript 或 Node 测试失败时，后续验证阶段不运行，沿用 npm 的非零退出状态。

## 测试策略

新增 `tests/build-verification.test.mjs`，覆盖：

- 编辑器与阅读器使用各自现有配置文件。
- 两个绝对输出路径位于唯一临时根目录内且不位于仓库内。
- 编辑器先于阅读器构建。
- 成功时临时根目录恰好清理一次。
- 编辑器失败时阅读器不启动，但临时根目录仍清理。
- 阅读器失败时临时根目录仍清理。
- 构建与清理同时失败时两项错误都可见。
- 临时父目录位于仓库内或通过符号链接／目录联接指向仓库内时，在创建目录前失败。
- 缺少前缀、不是临时父目录直接子项、位于父目录外或与仓库互为祖先的返回路径均被拒绝且不会递归删除。
- 即使构建或清理依赖抛出 falsy 值，验证仍以失败结束。
- 受控延迟第一个构建时，阅读器构建不会提前启动。
- 作为模块导入时不执行真实构建。
- `package.json` 新增验证命令，但现有正式构建和预览命令保持原样。

真实集成验证：

1. 记录 `git status --porcelain=v2 --untracked-files=all`。
2. 运行 `npm run build:verify`。
3. 再次记录 Git 状态并确认完全一致。
4. 确认 `git diff --exit-code -- dist-editor` 通过。
5. 确认工作树中的 `dist-reader/` 存在状态与执行前相同。
6. 运行 `npm run verify`，证明完整测试、TypeScript 与两个临时生产构建全部通过。

## 提交与回滚

- 设计文档单独提交。
- 实现以一个原子 Conventional Commit 提交，范围仅包括 `package.json`、验证脚本和对应测试。
- 若实现有害，只回滚该实现提交；正式构建配置和正式产物不会随之变化。

## 成功标准

- `npm run build:verify` 和 `npm run verify` 均成功。
- 完整 Node 测试、TypeScript 验证、编辑器构建和阅读器构建全部通过。
- 验证命令执行前后的 Git 可见状态完全一致。
- 没有生成或改写工作树内的正式构建产物。
- 正式构建、预览、纯前端和纯本地架构保持不变。
