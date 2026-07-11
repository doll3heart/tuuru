# Local Data Integrity and Recovery v2 Design

## Context

Tuuru is intentionally frontend-only and local-only. The editor stores the entire creative library under one `localStorage` key, exports individual works as JSON or stegano PNG, and exports the complete library as a versioned JSON backup. There is no server, upload, remote database, telemetry, or account recovery service.

The current safety boundary is useful but incomplete:

- startup rejects invalid JSON and invalid top-level database containers;
- ordinary writes refuse to overwrite a database already known to be corrupt;
- complete backups can be exported and inspected;
- reader imports are schema-checked and sanitized before rendering.

However, the database and work checks are shallow. Malformed work entries or nested collections can pass storage inspection and fail later in page code. A valid full-library backup can be inspected but cannot be restored. The UI also describes the reading-password gate as encryption even though exported content and the password remain plaintext.

## Goals

- Make the reading-password promise technically accurate without changing password behavior.
- Establish one pure structural validation contract for local storage, backups, JSON imports, and PNG imports.
- Preserve legacy data and unknown fields while rejecting structures the current runtime cannot safely consume.
- Ensure invalid data is rejected before it reaches active reader state, cache, rendering, or `localStorage.setItem()`.
- Add a safe, explicit, whole-library restore path for valid Tuuru backups.
- Permit a valid backup to replace a currently corrupt database without weakening the existing ordinary-write guard.
- Preserve the exact previous value on serialization, conflict, or `setItem()` failure.
- Keep every change frontend-only, dependency-light, incremental, test-first, and reversible by one atomic commit.

## Non-goals

- No cloud sync, account recovery, upload, community, telemetry, remote database, or server component.
- No IndexedDB migration, service worker, PWA cache, CRDT, Web Lock, or framework rewrite.
- No automatic repair that deletes, rewrites, or silently drops malformed user data.
- No merge-import behavior. Restore means replacing the complete library with the selected complete-library backup.
- No remote-media policy change in this phase; network-silent media loading requires a separate compatibility design.
- No editor autosave redesign in this phase; save coalescing and quota-recovery UX follow in a separate specification.

## Considered approaches

### 1. Strict structural validation plus atomic whole-library restore — selected

Known article and phone works must have render-safe collection shapes. Missing legacy optional collections receive in-memory defaults; fields that are present with the wrong type fail validation. Unknown fields remain untouched. Restore uses one validated candidate string and one `localStorage.setItem()`.

This extends the repository's existing fail-closed behavior, does not invent destructive repair semantics, and keeps rollback as simple as reverting a small set of commits.

### 2. Quarantine individual invalid works while editing healthy works — deferred

This is friendlier when only one work is damaged, but every editor mutation currently reads and rewrites the whole database. A quarantine implementation therefore needs a durable, lossless snapshot/reinsertion contract across reads, writes, backups, deletes, and future callers. Filtering invalid works before a normal write could permanently delete the only damaged original.

Until that persistence contract is separately designed and proven, Tuuru will reject the entire database, preserve the exact raw value, block normal writes, and offer raw download plus backup restore.

### 3. Migrate storage or merge backup records — rejected

IndexedDB does not by itself define validation or recovery semantics and adds migration risk. Merging a complete backup cannot safely resolve work, contact, group, or nested-reference ID conflicts, cannot reproduce deletion state, and is impossible when the current database is corrupt. A future content-import feature would require its own ID-remapping design.

## Design

### Truthful password boundary

The password feature remains a client-side reading gate. Existing work fields (`password` and `locked`) and reader comparisons remain unchanged.

User-facing copy must use “阅读密码” or “需阅读密码,” never “已加密” or “此作品已加密.” The work-information form must state that a reading password limits entry through the interface but does not encrypt exported JSON/PNG content. A static contract test scans the relevant editor and reader UI sources so the encryption claim cannot silently return.

### Shared work structure contract

`js/work-schema.js` remains the single source of work-version and work-type semantics. It will expose a pure structural validator used by the current `validateWorkForImport()` wrapper and by storage validation.

```js
validateAndNormalizeWork(input, {
  context: "reader-import" | "local-database" | "backup",
  path: "$",
})
```

The structural result is a discriminated object:

```js
// success
{
  ok: true,
  work,
  sourceVersion,
  migrated,
  warnings: [{ code, path, message }],
}

// failure
{
  ok: false,
  code,
  message,
  issues: [{ code, path, message }],
}
```

Validation rules:

- Input must be a plain object.
- A missing `schemaVersion` is legacy version 0. A non-integer, negative, or newer version is rejected.
- Reader import accepts only known `article` and `phone` types.
- Local database and backup validation may preserve an unknown legacy type only when the entry itself is a plain object and has no newer schema version. It is not treated as an editable known work.
- An article requires a `nodes` array. Known optional collections (`chapters`, `scenes`, `placeholders`, and `phoneModules`) default only when absent and otherwise must be arrays of plain objects. Node `choices`, when present, must be an array of plain objects.
- A phone requires a plain-object `phoneData`. Its known runtime collections default only when absent and otherwise must be arrays of plain objects. Nested collections that renderers iterate as records must follow the same rule.
- Missing legacy collections may receive in-memory defaults. A present `null`, string, number, or object in place of an array is corruption and must not become `[]` silently.
- Normalization returns fresh containers and never mutates the source.
- Unknown top-level and nested fields are copied unchanged.
- Structural validation does not replace `sanitizeImportedWork()`. Reader flow remains validate/normalize, then sanitize, then activate/cache/render.

Validation is deliberately structural rather than exhaustive. It prevents runtime collection and dereference failures without rejecting harmless legacy metadata, colors, copy, URLs, or unknown future fields.

### Database validation

Storage validation will separate raw parsing from storage access:

```js
inspectLocalDatabaseRaw(raw)
inspectLocalDatabase(storage = localStorage)
```

`inspectLocalDatabaseRaw()` accepts `null` for a missing database, parses JSON, validates the root and all database collections, applies the shared known-work structural contract, and returns either normalized in-memory data or a stable error with the original raw value.

The database must fail closed when:

- JSON is invalid;
- the root is not a plain object;
- `works` is not an array;
- an explicitly present top-level `contacts` or `groups` field is not an array of plain objects;
- any known work has an invalid or unsafe nested structure;
- any known work uses a schema newer than the runtime.

Missing legacy `contacts` and `groups` collections receive in-memory empty arrays. Existing valid and unknown fields remain unchanged. Inspection never writes normalized data back automatically.

`writeLocalDatabase()` validates the outgoing candidate with the same contract before serializing or calling `setItem()`. It continues to inspect and reject a corrupt current value, so ordinary editor operations cannot erase recovery material.

Backup parsing uses the same database contract. A backup that cannot be safely loaded is inspectable only as an error and cannot produce a restore plan.

### Export-to-reader compatibility fixtures

Golden fixtures cover both current work types and carry representative legacy defaults, unknown fields, placeholders, phone collections, and inline phone modules.

The JSON path must prove:

```text
editor work
  -> exportWorkAsJSON
  -> validateWorkForImport
  -> sanitizeImportedWork
  -> render-safe work preserving allowed and unknown data
```

The PNG path uses the same exported JSON bytes through the existing stegano payload writer/reader, then runs the identical validation and sanitation path. Canvas presentation remains covered by the existing PNG tests; the new fixture proves that JSON and PNG transport do not diverge semantically.

Invalid fixture variants prove that active reader state, cache, recent list, and rendered work do not change after validation failure.

### Two-phase restore API

UI code must never call `localStorage.setItem()` directly. Restore is split into preparation and commit:

```js
prepareLocalDatabaseRestore(parsedBackup, storage = localStorage, now = new Date())
  -> RestorePlan

restoreLocalDatabaseBackup(plan, storage = localStorage)
  -> RestoreResult
```

`RestorePlan` is immutable and contains:

```js
{
  candidateRaw,
  expectedCurrentRaw,
  summary,
  previousState: "missing" | "valid" | "corrupt",
  recoveryArtifact: null | {
    kind,
    filename,
    mimeType,
    contents,
  },
}
```

Preparation performs no write. It revalidates the backup database instead of trusting a mutable UI object, serializes and revalidates the candidate before any destructive action, reads the exact current raw value, and creates a recovery artifact:

- valid current library: a versioned full-library backup;
- corrupt current library: the exact raw value as a local recovery text file;
- missing current library: no artifact.

Commit performs the following synchronous sequence:

1. Read the current raw value again.
2. Require exact equality with `expectedCurrentRaw`; otherwise throw `restore-conflict` without writing.
3. Call `storage.setItem(DATABASE_KEY, candidateRaw)` exactly once and never call `removeItem()` first.
4. Read the stored raw value once.
5. Require byte-for-byte equality with `candidateRaw` and successful `inspectLocalDatabaseRaw()` validation.
6. Return success only after both checks pass.

If candidate serialization, conflict detection, or `setItem()` fails, the previous raw value remains unchanged. If readback throws or differs, the final state is unknown: Tuuru must not report success, automatically retry, or perform a second write as rollback because that could overwrite another tab's newer value. The UI instead keeps the recovery artifact available and requires a reload and fresh inspection.

Stable restore error codes are:

- `restore-serialize-failed`;
- `restore-conflict`;
- `restore-write-failed`;
- `restore-readback-failed`;
- `restore-verification-failed`.

Errors expose `details.phase` (`prepare`, `replace`, or `verify`) and `details.commitState` (`unchanged`, `committed`, or `unknown`) so the UI never guesses whether data changed.

### Restore UI

The homepage evolves “检查备份” into “检查 / 恢复备份” while preserving the current file-size cap and read-only preview. A valid file shows its timestamp, version, counts, current-versus-backup comparison, and the explicit warning: restoring replaces the complete current creative library.

The final restore action remains disabled until the user has initiated download of the recovery artifact when one exists and entered the exact confirmation phrase `RESTORE`. Copy says “已发起下载,” not “已安全保存,” because browsers cannot confirm that a file reached durable disk.

During commit, file selection, modal closing, and repeat submission are disabled. Outcomes are explicit:

- success: show success briefly, then reload so startup validation rebuilds application state;
- conflict: no write occurred; require a new preview;
- write failure: no restore occurred and the previous raw value remains unchanged;
- verification failure: do not claim success or submit again; require reload and inspection.

The corrupt-storage startup screen also gains the same valid-backup restore path between raw recovery download and destructive reset. `storage-unavailable` continues to disable both restore and reset because no reliable snapshot or commit can be established.

## Error and data-loss policy

- Never normalize a present wrong-typed collection into an empty collection.
- Never write during read, inspection, normalization, preview, or preparation.
- Never remove the database key before restore.
- Never auto-repair, auto-delete, or silently filter corrupt entries.
- Never render untrusted quarantine/recovery raw data as HTML.
- Never describe an initiated download as guaranteed durable storage.
- Never lower a future work schema version during export or restore.
- Preserve all unknown fields through validation, backup parsing, restoration, and later normal writes.

## Testing strategy

### Work and database contracts

- Every new structural rule begins with a failing test.
- Missing legacy collections normalize in memory without modifying or writing the source.
- Present wrong-typed collections fail with stable codes and JSON paths.
- Null and primitive entries in works, nodes, choices, phone collections, and selected nested collections fail without throwing incidental runtime errors.
- Legacy and unknown fields survive normalization and backup round trips.
- Future-version works never reach sanitize, active reader state, cache, rendering, export downgrade, or storage writes.
- Outgoing invalid candidates never call `setItem()`.
- JSON and stegano PNG fixtures converge on equivalent sanitized works.

### Restore storage contract

- Preparation produces no `setItem()` or `removeItem()` call.
- Missing, valid, corrupt, and unavailable current states produce the correct plan or error.
- Restore from a corrupt current database is allowed only through a valid prepared plan.
- Success performs exactly one `setItem()`, no `removeItem()`, and exact readback verification.
- A stale plan performs no write and reports `restore-conflict`.
- Quota/security failure preserves the exact old raw value and reports `commitState: "unchanged"`.
- Readback failure or mismatch never reports success and performs no automatic rollback.
- Private fields, editor settings, unknown fields, and complete library collections survive replacement.

### UI contract

- Invalid or oversized files cannot enter confirmation.
- Recovery download and exact typed confirmation gate the destructive button.
- Double activation commits once.
- Error copy distinguishes unchanged from unknown state.
- Success reloads; failure does not.
- The corrupt startup screen restores a valid backup without first deleting raw data.
- A storage event invalidates an open plan and requires a new preview.

Every atomic implementation commit must pass its focused tests followed by `npm run verify`. Verification must leave the Git-visible worktree unchanged.

## Commit sequence and rollback

1. Documentation: this design.
2. Documentation: the TDD implementation plan.
3. Copy: truthful reading-password language and static contract tests.
4. Schema: shared pure structural validation and deep work tests.
5. Storage: database-wide validation using the shared work contract.
6. Compatibility: editor-to-JSON/PNG-to-reader golden fixtures.
7. Restore core: immutable preparation plan, conflict check, single replacement, and readback verification.
8. Restore UI: homepage preview/confirmation/recovery download.
9. Corrupt startup integration: valid backup restore before destructive reset.

If any implementation is harmful, revert only its atomic commit. Do not rewrite history or manually undo the entire phase.

## Success criteria

- All existing behavior remains available except inaccurate encryption wording.
- The editor and reader reject malformed known work structures before runtime dereferences.
- Valid legacy works remain usable and unknown fields remain preserved.
- JSON and PNG imports obey the same work contract.
- A valid full-library backup can safely replace a missing, valid, or corrupt current database.
- Serialization, conflict, and write failures preserve the previous raw value exactly.
- Verification uncertainty is never presented as success.
- No server, upload, remote database, telemetry, or new network behavior is introduced.
- `npm run verify` passes and leaves the worktree clean after every commit.
