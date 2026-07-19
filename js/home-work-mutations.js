import {
  PHONE_APP_DEFS,
  PHONE_READER_OWNED_CONTROL_TYPES,
  WORK_TYPE,
  createWorkRecord,
  uid,
} from "./data.js"
import {
  commitLocalDatabaseMutation,
  createJsonToken,
} from "./local-database-mutation.js"
import { createWebLocksAdapter } from "./local-locks.js"
import { readLocalDatabase } from "./storage.js"
import { runWithWorkEditSession } from "./work-edit-session.js"
import { normalizeWorkWatermark } from "./work-watermark.js"

const HOME_INFO_FIELDS = Object.freeze([
  "title",
  "author",
  "authorNote",
  "password",
  "locked",
  "watermark",
])

const NO_CLEANUP_ERROR = Symbol("no-cleanup-error")

function isVerifiedAtomicCommit(commit) {
  return commit !== null
    && typeof commit === "object"
    && commit.ok === true
    && typeof commit.operationId === "string"
    && commit.operationId.length > 0
    && typeof commit.raw === "string"
    && commit.database !== null
    && typeof commit.database === "object"
    && !Array.isArray(commit.database)
    && Array.isArray(commit.database.works)
    && typeof commit.workToken === "string"
    && commit.workToken.length > 0
}

export function requireVerifiedHomeMutation(outcome, { expectDeleted = false } = {}) {
  const commit = outcome?.commit
  const work = outcome?.work
  const matchingWorks = isVerifiedAtomicCommit(commit) && work !== null && typeof work === "object"
    ? commit.database.works.filter(candidate => candidate.id === work.id)
    : []
  const verifiedWork = expectDeleted
    ? work === null && commit?.workToken === createJsonToken(null)
    : work !== null
      && typeof work === "object"
      && !Array.isArray(work)
      && typeof work.id === "string"
      && work.id.length > 0
      && matchingWorks.length === 1
      && createJsonToken(matchingWorks[0]) === createJsonToken(work)
  if (
    outcome !== null
    && typeof outcome === "object"
    && outcome.ok === true
    && Object.hasOwn(outcome, "work")
    && isVerifiedAtomicCommit(commit)
    && verifiedWork
  ) {
    return outcome
  }
  if (outcome?.error instanceof Error && outcome.error.code === outcome.code) {
    throw outcome.error
  }
  const error = new Error("The guarded home mutation did not verify successfully")
  error.name = "HomeWorkMutationError"
  error.code = typeof outcome?.code === "string" ? outcome.code : "home-mutation-failed"
  if (outcome?.error !== undefined && outcome.error !== null) error.cause = outcome.error
  throw error
}

export function describeHomeMutationFailure(error) {
  const code = error?.code
  if (code === "work-locked") {
    return "该作品正在另一个标签页中打开，请先关闭那个编辑页后再试。"
  }
  if (code === "mutation-lock-unavailable") {
    return "当前浏览器环境无法提供可靠的本地锁，作品库已保持只读。"
  }
  if (code === "mutation-conflict" || code === "work-missing") {
    return "作品已变化或不存在，请刷新作品列表后重试。"
  }
  if (
    code === "mutation-readback-failed"
    || code === "mutation-verification-failed"
    || error?.details?.commitState === "unknown"
  ) {
    return "浏览器无法确认刚才的写入结果，请先重新检查，不要重复操作。"
  }
  return "操作没有保存，请检查本地存储后重试。"
}

function assertRecord(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`)
  }
}

function assertIdentifier(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`)
  }
}

function resolveDependencies(dependencies) {
  assertRecord(dependencies, "dependencies")
  const storage = dependencies.storage ?? globalThis.localStorage
  const lockManager = dependencies.lockManager ?? createWebLocksAdapter()
  const scheduler = dependencies.scheduler
  const now = dependencies.now ?? Date.now
  const createId = dependencies.createId ?? (() => uid())
  if (storage === null || typeof storage !== "object") {
    throw new TypeError("storage must be an object")
  }
  if (lockManager === null || typeof lockManager !== "object") {
    throw new TypeError("lockManager must be an object")
  }
  if (typeof now !== "function") throw new TypeError("now must be a function")
  if (typeof createId !== "function") throw new TypeError("createId must be a function")
  return { storage, lockManager, scheduler, now, createId }
}

function readTimestamp(now) {
  const value = now()
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("now must return a non-negative safe integer")
  }
  return value
}

function createPreparedId(createId, kind) {
  const value = createId(kind)
  assertIdentifier(value, `${kind} id`)
  return value
}

function sessionOptions(workId, dependencies) {
  const options = {
    workId,
    storage: dependencies.storage,
    lockManager: dependencies.lockManager,
    now: dependencies.now,
    createId: dependencies.createId,
  }
  if (dependencies.scheduler !== undefined) options.scheduler = dependencies.scheduler
  return options
}

function commitDependencies(session, dependencies) {
  return {
    storage: dependencies.storage,
    lockManager: dependencies.lockManager,
    assertSessionAdmission: () => session.assertSessionAdmission(),
    assertOwnerFence: () => session.assertOwnerFence(),
  }
}

function commitArgs(session, operationId, workId, expectedWorkToken, apply) {
  return {
    operationId,
    workId,
    ownerId: session.ownerId,
    leaseId: session.leaseId,
    restoreGeneration: session.restoreGeneration,
    expectedWorkToken,
    apply,
  }
}

async function runHomeMutationSession(workId, dependencies, callback) {
  let verifiedCommit
  try {
    const sessionResult = await runWithWorkEditSession(
      sessionOptions(workId, dependencies),
      async session => {
        const value = await callback(session)
        if (isVerifiedAtomicCommit(value)) verifiedCommit = value
        return value
      },
    )
    return { sessionResult, cleanupError: NO_CLEANUP_ERROR }
  } catch (error) {
    if (!isVerifiedAtomicCommit(verifiedCommit)) throw error
    return {
      sessionResult: Object.freeze({ ok: true, value: verifiedCommit }),
      cleanupError: error,
    }
  }
}

function uniqueWork(database, workId) {
  const matches = database.works.filter(work => work.id === workId)
  if (matches.length !== 1) {
    throw new Error(`Expected one verified work with id "${workId}"`)
  }
  return matches[0]
}

function success(work, commit, cleanupError = NO_CLEANUP_ERROR) {
  const outcome = { ok: true, work, commit }
  if (cleanupError !== NO_CLEANUP_ERROR) outcome.cleanupError = cleanupError
  return Object.freeze(outcome)
}

function mapSessionResult({ sessionResult, cleanupError }, selectWork) {
  if (!sessionResult.ok) return sessionResult
  const commit = sessionResult.value
  return success(selectWork(commit.database), commit, cleanupError)
}

function phoneAppCount() {
  return Object.keys(PHONE_APP_DEFS).filter(
    type => !PHONE_READER_OWNED_CONTROL_TYPES.includes(type),
  ).length
}

export async function createHomeWork(data, dependencies = {}) {
  assertRecord(data, "data")
  const resolved = resolveDependencies(dependencies)
  const workId = createPreparedId(resolved.createId, "work")
  const operationId = createPreparedId(resolved.createId, "operation")
  const firstChapterId = createPreparedId(resolved.createId, "chapter")
  const firstNodeId = createPreparedId(resolved.createId, "node")
  const firstSceneId = createPreparedId(resolved.createId, "scene")
  const colorSeedId = createPreparedId(resolved.createId, "color")
  const phoneAppIds = data.type === WORK_TYPE.PHONE
    ? Array.from(
      { length: phoneAppCount() },
      () => createPreparedId(resolved.createId, "phone-app"),
    )
    : []
  const timestamp = readTimestamp(resolved.now)
  const preparedWork = createWorkRecord(data, {
    workId,
    firstChapterId,
    firstNodeId,
    firstSceneId,
    colorSeedId,
    phoneAppIds,
    now: timestamp,
  })
  const persistedWork = structuredClone(preparedWork)
  if (persistedWork.phoneModules === undefined) delete persistedWork.phoneModules
  if (persistedWork.phoneData === undefined) delete persistedWork.phoneData

  const sessionRun = await runHomeMutationSession(
    workId,
    resolved,
    session => commitLocalDatabaseMutation(
      commitArgs(
        session,
        operationId,
        workId,
        createJsonToken(null),
        database => ({ ...database, works: [...database.works, persistedWork] }),
      ),
      commitDependencies(session, resolved),
    ),
  )
  return mapSessionResult(sessionRun, database => uniqueWork(database, workId))
}

function selectHomeInfoPatch(patch) {
  assertRecord(patch, "patch")
  const selected = {}
  for (const field of HOME_INFO_FIELDS) {
    if (!Object.hasOwn(patch, field)) continue
    selected[field] = field === "watermark" ? normalizeWorkWatermark(patch[field]) : patch[field]
  }
  return selected
}

export async function updateHomeWorkInfo(args, dependencies = {}) {
  assertRecord(args, "args")
  assertIdentifier(args.workId, "workId")
  assertIdentifier(args.expectedWorkToken, "expectedWorkToken")
  const patch = selectHomeInfoPatch(args.patch)
  const resolved = resolveDependencies(dependencies)
  const operationId = createPreparedId(resolved.createId, "operation")
  const timestamp = readTimestamp(resolved.now)

  const sessionRun = await runHomeMutationSession(
    args.workId,
    resolved,
    session => commitLocalDatabaseMutation(
      commitArgs(
        session,
        operationId,
        args.workId,
        args.expectedWorkToken,
        database => ({
          ...database,
          works: database.works.map(work => work.id === args.workId
            ? { ...work, ...patch, updatedAt: timestamp }
            : work),
        }),
      ),
      commitDependencies(session, resolved),
    ),
  )
  return mapSessionResult(sessionRun, database => uniqueWork(database, args.workId))
}

function readUniqueWorkToken(workId, storage) {
  const matches = readLocalDatabase(storage).works.filter(work => work.id === workId)
  if (matches.length === 0) return null
  if (matches.length > 1) {
    const error = new Error(`More than one work uses id "${workId}"`)
    error.code = "home-work-id-ambiguous"
    throw error
  }
  return createJsonToken(matches[0])
}

function destinationCollisionError(workId) {
  const error = new Error(`A work with id "${workId}" already exists`)
  error.name = "HomeWorkMutationError"
  error.code = "home-work-id-collision"
  return error
}

export async function duplicateHomeWork(args, dependencies = {}) {
  assertRecord(args, "args")
  assertIdentifier(args.workId, "workId")
  const resolved = resolveDependencies(dependencies)
  const destinationId = createPreparedId(resolved.createId, "work")
  const operationId = createPreparedId(resolved.createId, "operation")
  const timestamp = readTimestamp(resolved.now)

  const sessionRun = await runHomeMutationSession(
    args.workId,
    resolved,
    async session => {
      const expectedWorkToken = readUniqueWorkToken(args.workId, resolved.storage)
      if (expectedWorkToken === null) {
        return Object.freeze({ missing: true })
      }
      return commitLocalDatabaseMutation(
        commitArgs(
          session,
          operationId,
          args.workId,
          expectedWorkToken,
          database => {
            if (database.works.some(work => work.id === destinationId)) {
              throw destinationCollisionError(destinationId)
            }
            const source = uniqueWork(database, args.workId)
            const duplicate = JSON.parse(JSON.stringify(source))
            duplicate.id = destinationId
            duplicate.title = `${source.title} (副本)`
            duplicate.createdAt = timestamp
            duplicate.updatedAt = timestamp
            return { ...database, works: [...database.works, duplicate] }
          },
        ),
        commitDependencies(session, resolved),
      )
    },
  )
  const { sessionResult, cleanupError } = sessionRun
  if (!sessionResult.ok) return sessionResult
  if (sessionResult.value?.missing === true) {
    return Object.freeze({
      ok: false,
      code: "work-missing",
      error: null,
      availability: null,
    })
  }
  const commit = sessionResult.value
  return success(uniqueWork(commit.database, destinationId), commit, cleanupError)
}

export async function deleteHomeWork(args, dependencies = {}) {
  assertRecord(args, "args")
  assertIdentifier(args.workId, "workId")
  assertIdentifier(args.expectedWorkToken, "expectedWorkToken")
  const resolved = resolveDependencies(dependencies)
  const operationId = createPreparedId(resolved.createId, "operation")

  const sessionRun = await runHomeMutationSession(
    args.workId,
    resolved,
    session => commitLocalDatabaseMutation(
      commitArgs(
        session,
        operationId,
        args.workId,
        args.expectedWorkToken,
        database => ({
          ...database,
          works: database.works.filter(work => work.id !== args.workId),
        }),
      ),
      commitDependencies(session, resolved),
    ),
  )
  const { sessionResult, cleanupError } = sessionRun
  if (!sessionResult.ok) return sessionResult
  return success(null, sessionResult.value, cleanupError)
}
