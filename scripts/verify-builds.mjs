import { build as viteBuild } from "vite"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const TEMP_PREFIX = "tuuru-build-"
const DEFAULT_REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)))

function isWithin(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate))
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )
}

function assertSafeTempRoot({ repoRoot, tempParent, tempRoot }) {
  const resolvedParent = path.resolve(tempParent)
  const resolvedRoot = path.resolve(tempRoot)
  const relative = path.relative(resolvedParent, resolvedRoot)
  const isChild = Boolean(relative) && (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )

  if (!isChild || !path.basename(resolvedRoot).startsWith(TEMP_PREFIX) || isWithin(repoRoot, resolvedRoot)) {
    throw new Error("Build verification output must stay in a unique temporary directory outside the repository")
  }

  return resolvedRoot
}

export function createBuildPlan({ repoRoot, tempParent, tempRoot }) {
  const resolvedRepoRoot = path.resolve(repoRoot)
  const safeTempRoot = assertSafeTempRoot({
    repoRoot: resolvedRepoRoot,
    tempParent,
    tempRoot,
  })

  return [
    {
      name: "editor",
      configFile: path.join(resolvedRepoRoot, "vite.config.ts"),
      outDir: path.join(safeTempRoot, "editor"),
    },
    {
      name: "reader",
      configFile: path.join(resolvedRepoRoot, "vite.reader.config.ts"),
      outDir: path.join(safeTempRoot, "reader"),
    },
  ]
}

export async function runBuildValidation({
  repoRoot = DEFAULT_REPO_ROOT,
  tempParent = tmpdir(),
  makeTempDir = mkdtemp,
  build = viteBuild,
  remove = rm,
} = {}) {
  const resolvedTempParent = path.resolve(tempParent)
  const tempRoot = await makeTempDir(path.join(resolvedTempParent, TEMP_PREFIX))
  const plan = createBuildPlan({ repoRoot, tempParent: resolvedTempParent, tempRoot })
  let buildError
  let cleanupError

  try {
    for (const target of plan) {
      await build({
        configFile: target.configFile,
        build: {
          outDir: target.outDir,
          emptyOutDir: true,
        },
      })
    }
  } catch (error) {
    buildError = error
  }

  try {
    await remove(tempRoot, { recursive: true, force: true })
  } catch (error) {
    cleanupError = error
  }

  if (buildError && cleanupError) {
    throw new AggregateError(
      [buildError, cleanupError],
      "Build validation and temporary cleanup both failed",
    )
  }
  if (buildError) throw buildError
  if (cleanupError) throw cleanupError
}

const isDirectExecution = Boolean(process.argv[1]) && (
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
)

if (isDirectExecution) {
  runBuildValidation().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
