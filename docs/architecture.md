# AI Bug Hunter — Architecture

## Overview

AI Bug Hunter is an AI-powered autonomous web application testing and bug intelligence platform. This document describes the Phase 1 foundation and outlines where later capabilities will attach.

The system is organized as a TypeScript npm monorepo:

```
ai-bug-hunter/
├── apps/
│   ├── web/          # React + Vite dashboard (frontend)
│   └── api/          # Node.js + Express API (backend)
├── packages/
│   └── shared/       # Cross-cutting TypeScript types and helpers
├── docs/             # Architecture and development documentation
├── tests/            # Cross-workspace integration tests (empty in Phase 1)
└── .github/workflows # CI pipelines
```

## Frontend (`apps/web`)

React 18 + TypeScript, built with Vite, styled with Tailwind CSS. Responsibilities:

- Present the primary AI Bug Hunter dashboard.
- Show branding, product description, live system status, and navigation.
- Display Applications, Test Runs, Test Cases, Bugs, and Reports sections. In Phase 1 these render honest empty states; no fabricated statistics.
- Poll `/api/health` and reflect API/DB availability in the status badge.

## Backend (`apps/api`)

Node.js + Express + TypeScript. Responsibilities:

- HTTP surface for the frontend and any future integrations.
- Health endpoints (`GET /api/health`, `GET /api/health/detailed`).
- Centralized environment validation (Zod) at process start.
- Centralized error handling; production responses never leak stack traces.
- PostgreSQL connectivity via a pooled `pg` client.

Layout inside `apps/api/src`:

- `config/`  — environment loading and validation.
- `db/`      — PostgreSQL pool and connectivity helpers.
- `routes/`  — Express route modules.
- `middleware/` — error handling, 404 handling.
- `app.ts`   — pure Express app factory (for tests).
- `index.ts` — server bootstrap and graceful shutdown.

## Shared package (`packages/shared`)

Framework-agnostic TypeScript types and small helpers used by both frontend and backend. Phase 1 exports the canonical `HealthResponse` / `DetailedHealthResponse` contract and a type guard. Consuming both apps import via `@ai-bug-hunter/shared` — the workspace resolves it and TypeScript project references keep builds consistent.

## PostgreSQL

Phase 1 connects to an existing `ai_bug_hunter` database on a native Windows PostgreSQL 18.6 install. The API does not create, drop, or migrate the database. It only verifies connectivity (`SELECT 1`) and exposes reachability via the detailed health endpoint. No application tables are created in Phase 1.

## Test engine (`packages/test-engine`) — Phase 2

Isolated package that owns all browser automation. The Express API depends on it through a narrow TypeScript surface; Playwright types never leak into HTTP layers or the frontend.

```
packages/test-engine/src/
├── types/execution.ts         # TestDefinition, TestAction (discriminated union),
│                              # ExecutionResult, StepResult, ExecutionOptions
├── actions/
│   ├── actionTypes.ts         # Zod schemas + assertSafeUrl (http/https only)
│   └── actionExecutor.ts      # Translates one TestAction to a Playwright call
├── browser/browserManager.ts  # BrowserManager + BrowserSession lifecycle
├── executor/testExecutor.ts   # Orchestrates a full TestDefinition run
├── logger.ts                  # Structured JSON logger (secrets never logged)
└── index.ts                   # Public API surface
```

**BrowserManager** — launches Chromium (headless by default), creates isolated `BrowserSession` per run, and guarantees teardown of page/context/browser. The `Page` object is passed only to `ActionExecutor` inside the package; consumers never see it. Firefox/WebKit are reserved by the `BrowserName` union but not implemented in Phase 2.

**ActionExecutor** — a pure `executeAction(page, action, opts)` function that maps each variant of `TestAction` to a Playwright call. All timeouts flow in from `ExecutionOptions` — no hardcoded waits.

**TestExecutor** — public entry point. Given a `TestDefinition`, it launches (or reuses) a `BrowserManager`, runs each step sequentially, records per-step status/duration/errors, stops on the first failure, marks remaining steps `skipped`, and always closes the session in a `finally` block. Errors are normalized into `{ name, message, stepIndex }` — raw Playwright errors never escape.

**Supported actions (Phase 2):** `navigate`, `click`, `fill`, `selectOption`, `press`, `waitForSelector`, `wait`. The discriminated-union model keeps the schema extensible without breaking existing consumers.

**Public API:** `TestExecutor`, `BrowserManager`, `TestDefinitionSchema`, `TestActionSchema`, `assertSafeUrl`, plus all execution/result types.

## Evidence collection (`packages/test-engine/src/evidence/`) — Phase 3

`EvidenceCollector` is a separate concern that lives alongside `TestExecutor` and never mixes with `ActionExecutor`. `TestExecutor` owns lifecycle:

```
launch browser
  → create session
  → EvidenceCollector.start(page)      # install console/pageerror/network listeners
  → for each step:
       execute action
       on failure → EvidenceCollector.collectFailureEvidence(stepIndex)  # screenshot + DOM
  → EvidenceCollector.finalize()       # capture browser metadata + detach listeners
  → session.close()                     # only AFTER finalize
  → manager.close() (if owned)
```

**Types (`evidenceTypes.ts`):** `EvidencePackage`, `ScreenshotEvidence`, `DOMEvidence`, `ConsoleEvidence`, `PageErrorEvidence`, `NetworkEvidence`, `NetworkFailureEvidence` (union `http | network | aborted`), `BrowserMetadata`, `EvidenceOptions`. All fields JSON-serializable; no Playwright objects leak.

**Screenshot:** PNG buffer captured via `page.screenshot()`, base64-encoded (`ScreenshotEvidence.data`) with `byteLength`. Default: capture on failure only. Configurable via `screenshotOnFailure` / `screenshotOnSuccess`.

**DOM:** `document.documentElement.outerHTML` captured via `page.evaluate`. Truncated to `maxDomBytes` (default 512 KB) with a `truncated` flag. Skipped if page already closed.

**Console:** `page.on('console')` listener attached in `start()` — before actions run. Type mapped to `log | info | warning | error | debug | other`. Bounded by `maxConsoleMessages` (default 200).

**Page errors:** `page.on('pageerror')` — recorded separately from `console.error` messages so uncaught page exceptions never collapse into console signal.

**Network:** `request` / `response` / `requestfailed` listeners. Captured fields: URL, method, resource type, timestamp, response status. **Request/response bodies, headers, and cookies are never captured** (sensitivity risk). Failure classification: `type: 'http'` for status ≥ 400, `type: 'aborted'` when the failure message mentions abort, else `type: 'network'`. Bounded by `maxNetworkEntries` (default 500).

**Browser metadata:** `{ name, version, userAgent, viewport, url, title }` collected in `finalize()` before listeners detach.

**Persistence:** `EvidenceStore` interface with `InMemoryEvidenceStore` implementation. No filesystem or database storage in Phase 3 — the interface is a seam for a future artifact store (filesystem, S3, PostgreSQL metadata) without touching `TestExecutor`.

**ExecutionResult integration:** `evidence?: EvidencePackage` optional field. Attached automatically when `status !== 'passed'`. On success, evidence is only attached when `includeEvidenceOnSuccess: true`.

**Security / privacy:** By design, the collector never records passwords, tokens, cookies, request bodies, headers, or environment variables. DOM snapshots and screenshots may still contain sensitive rendered content — treated as sensitive artifacts by future storage layers. The engine logs only counts and IDs, never DOM/screenshot payloads.

## API integration — `POST /api/test-runs`

`apps/api/src/routes/testRuns.ts` validates the request body against `TestDefinitionSchema`, hands it to `new TestExecutor().run(def)`, and returns the resulting `ExecutionResult` JSON. Malformed bodies and unsupported URL schemes yield `400`. No persistence — results (including any attached `evidence` package with base64 screenshot + truncated DOM) are in-memory only. A dedicated evidence endpoint and artifact store arrive in a later phase.

## Local test fixture

`tests/fixtures/simple-app/index.html` is a static page with heading, text/password inputs, a select, a submit button, and a delayed element. `packages/test-engine/src/test/fixtureServer.ts` serves it on `127.0.0.1:<ephemeral port>` so browser tests are fully offline and deterministic.

## Future functionality (NOT implemented yet)

Capabilities intentionally deferred to later phases:

- **Autonomous crawler** — discovery layer that walks a target application to produce a page/action graph fed into test generation.
- **AI analysis engine** — Claude API integration for reasoning about pages, generating test cases, and analyzing failures. Will attach behind a provider-agnostic interface in front of the test engine.
- **Bug detection engine** — evaluates test results, screenshots, DOM/network artifacts to identify defects.
- **Bug intelligence layer** — clustering, deduplication, flaky-test detection, visual regression, and AI root-cause analysis. Backed by dedicated PostgreSQL tables introduced in later phases.
- **Evidence persistence** — Phase 3 keeps evidence in memory only. Filesystem/object-storage/PostgreSQL-metadata storage attaches to the existing `EvidenceStore` interface in a later phase.
- **Videos and HAR** — richer artifact types beyond the current screenshot + DOM + console + network metadata.
- **Reporting and integrations** — historical reports, Jira integration, advanced dashboards.
- **Additional browsers** — Firefox and WebKit through the existing `BrowserName` union.
- **Distributed / cloud execution, queues, self-healing selectors.**

Phase 2 ships the deterministic execution engine and API endpoint only.
