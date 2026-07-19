# Acceptance Sample Works Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce two deterministic, offline acceptance works that exercise Tuuru's article and pure-phone import/runtime contracts.

**Architecture:** Keep fixture builders separate from generated JSON/PNG artifacts. Generate every raster asset locally as an embedded PNG data URL, then encode the same exported JSON into a steganographic PNG. Validate both formats through the production import schema and structural acceptance assertions.

**Tech Stack:** Native ES modules, Node built-ins, `node:test`, existing Tuuru schema/steganography modules.

---

### Task 1: Deterministic fixture and image builders

**Files:**
- Create: `scripts/acceptance-work-assets.mjs`
- Create: `scripts/acceptance-work-fixtures.mjs`

- [x] Add a dependency-free PNG encoder and embedded raster asset factory.
- [x] Build an article work with complete metadata/watermark, three chapters, multiple branching nodes, inline images, and all seven phone-module types.
- [x] Build a pure-phone work with all seven exported Apps, non-default desktop ordering, complex phone settings, populated collections, choice/follow-up interactions, and cross-App connection gates.

### Task 2: Generate importable artifacts

**Files:**
- Create: `scripts/generate-acceptance-works.mjs`
- Create: `samples/acceptance/README.md`
- Create: `samples/acceptance/tuuru-article-acceptance.json`
- Create: `samples/acceptance/tuuru-article-acceptance.png`
- Create: `samples/acceptance/tuuru-phone-acceptance.json`
- Create: `samples/acceptance/tuuru-phone-acceptance.png`

- [x] Add one reproducible generation command: `node scripts/generate-acceptance-works.mjs`.
- [x] Write byte-equivalent JSON and steganographic PNG versions of both works.
- [x] Document the shortest manual acceptance route, including the article password and branch/App coverage.

### Task 3: Acceptance validation

**Files:**
- Create: `tests/acceptance-sample-works.test.mjs`

- [x] Validate all generated JSON and decoded PNG payloads with `validateWorkForImport`.
- [x] Assert article chapter/node/choice targets, phone-module references, image coverage, and full watermark fields.
- [x] Assert pure-phone App coverage/order, settings, content collections, App gates, and interactive choices.
- [x] Run the focused test, full suite, production build, and a port 8765 smoke check.

**Execution note:** This plan is executed inline in the current task, without delegation or commits, because the working tree already contains user-owned changes.
