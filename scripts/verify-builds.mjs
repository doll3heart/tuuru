import { build as viteBuild } from "vite"
import { mkdtemp, realpath, rm } from "node:fs/promises"
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
  const isDirectChild = Boolean(relative) && (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative) &&
    path.dirname(relative) === "."
  )

  const overlapsRepository = (
    isWithin(repoRoot, resolvedRoot) ||
    isWithin(resolvedRoot, repoRoot)
  )

  if (!isDirectChild || !path.basename(resolvedRoot).startsWith(TEMP_PREFIX) || overlapsRepository) {
    throw new Error("Build verification output must stay in a unique temporary directory outside the repository")
  }

  return resolvedRoot
}

function assertSafeTempParent({ repoRoot, tempParent }) {
  if (isWithin(repoRoot, tempParent)) {
    throw new Error("Build verification output must stay outside the repository")
  }
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
      name: "app",
      configFile: path.join(resolvedRepoRoot, "vite.config.ts"),
      outDir: path.join(safeTempRoot, "app"),
    },
  ]
}

export async function runBuildValidation({
  repoRoot = DEFAULT_REPO_ROOT,
  tempParent = tmpdir(),
  makeTempDir = mkdtemp,
  build = viteBuild,
  remove = rm,
  canonicalize = realpath,
} = {}) {
  const canonicalRepoRoot = path.resolve(await canonicalize(path.resolve(repoRoot)))
  const canonicalTempParent = path.resolve(await canonicalize(path.resolve(tempParent)))
  assertSafeTempParent({
    repoRoot: canonicalRepoRoot,
    tempParent: canonicalTempParent,
  })

  const createdTempRoot = await makeTempDir(path.join(canonicalTempParent, TEMP_PREFIX))
  const canonicalTempRoot = path.resolve(await canonicalize(path.resolve(createdTempRoot)))
  const plan = createBuildPlan({
    repoRoot: canonicalRepoRoot,
    tempParent: canonicalTempParent,
    tempRoot: canonicalTempRoot,
  })
  let buildError
  let cleanupError
  let buildFailed = false
  let cleanupFailed = false

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
    buildFailed = true
    buildError = error
  }

  try {
    await remove(canonicalTempRoot, { recursive: true, force: true })
  } catch (error) {
    cleanupFailed = true
    cleanupError = error
  }

  if (buildFailed && cleanupFailed) {
    throw new AggregateError(
      [buildError, cleanupError],
      "Build validation and temporary cleanup both failed",
    )
  }
  if (buildFailed) throw buildError
  if (cleanupFailed) throw cleanupError
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
