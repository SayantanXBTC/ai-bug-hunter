# AI Bug Hunter

AI Bug Hunter is an AI-powered autonomous web application testing and bug intelligence platform.

> **Status: Phase 9 — Flaky detection & regression campaigns.** Phases 1–8 complete. Phase 9 adds two layers: (a) deterministic per-test reliability snapshots (stable / suspected_flaky / flaky / unstable / insufficient_data) that avoid classifying stable-broken tests as flaky by weighting a `single_bug_cluster_domination` signal; (b) regression campaigns with explainable risk scoring (failure_rate, regression_risk from Phase 8 clusters, priority, recency, flaky_penalty), three selection strategies (`all_enabled`, `smoke`, `risk_based`), and a mandatory human-review boundary (create → preview → explicit Run). Execution reuses Phase 2 `TestExecutor` sequentially, persists via Phase 4, auto-investigates failed runs via Phase 7 (bounded), and triggers incremental Phase 8 bug intelligence on new runs. Campaign quality is deterministic (healthy / degraded / failed / inconclusive) — the LLM never decides pass/fail. Cancellation is cooperative — no process is force-killed, no Chromium leaks. New tables: `test_reliability_snapshots`, `regression_campaigns`, `regression_campaign_tests`; `test_cases` extended (migration `004`). History below.
>
> **Status: Phase 8 — Bug intelligence & failure clustering.** Phases 1–7 complete. Phase 8 adds cross-run failure clustering via a hybrid pipeline: deterministic `FailureFingerprint`s + weighted explainable similarity + union-find first, LLM only for ambiguous pairs (bounded). Every cluster carries deterministic metrics (occurrence count, affected tests/pages/endpoints, first/last seen), a `status` and `regression_status` derived from real historical passes/failures, and JSONB membership reasons so every merge is auditable. New endpoints: `POST /api/ai/bug-intelligence/analyze`, `GET /api/ai/bug-intelligence/clusters`, `GET /api/ai/bug-intelligence/clusters/:id`. New tables: `bug_clusters`, `bug_cluster_members` (migration `003`). Frontend Bug Intelligence panel shows status counts + clickable clusters + timeline. History below.
>
> **Status: Phase 7 — AI failure investigation & root-cause analysis.** Phases 1–6 complete. Phase 7 introduces the investigation engine: `POST /api/ai/investigate/:testRunId` takes a persisted failed run + its evidence + recent history and produces an evidence-backed `InvestigationReport` (classification, severity, confidence, likely root cause, observed facts, hypotheses with per-hypothesis confidence, supporting evidence references, reproduction steps derived from the actual test definition, recommended next steps). **The LLM only proposes.** Deterministic code strips any invented evidence IDs, fabricated step indices, or invented facts before the report is returned or persisted. Reports live in a new `investigations` table (unique per test run). The frontend renders investigations under each failed test run — "Likely root cause" + confidence percentage, never absolute claims. History below.
>
> **Status: Phase 6 — AI test generation.** Phases 1–5 complete. Phase 6 introduces the first LLM into the system behind a strict provider abstraction (`LLMProvider` interface, `AnthropicProvider` isolates `@anthropic-ai/sdk`, `FakeLLMProvider` for tests). `POST /api/ai/generate-tests` accepts a discovered `ApplicationModel`, sends a bounded compacted context to the model, and returns strictly validated `TestDefinition`s. **The LLM does not control Playwright** — outputs go through JSON parse → Zod → business rules (selector must exist in model, URL must be safe + in-scope, action must be supported, duplicates flagged) before an execution API call is even possible, and the frontend requires an explicit user click to run any generated test. History below.
>
> **Status: Phase 5 — Application discovery engine.** Phases 1–4 complete. Phase 5 adds a deterministic Chromium-based crawler that produces a compact, JSON-serializable `ApplicationModel` (pages, links, forms, interactive elements, ranked selector candidates, bounded accessibility snapshot) via `POST /api/discovery`. The output is designed for a future LLM to consume directly — no Playwright objects leak, no field values are captured, and scope/protocol filters prevent following external or unsafe URLs. **The LLM layer is intentionally not implemented yet.** History below.
>
> **Status: Phase 4 — Test run & evidence persistence.** Phases 1–3 (foundation, Playwright execution engine, evidence collection) are complete. Phase 4 makes execution history durable: PostgreSQL now stores applications, test cases, test runs, per-step results, and evidence metadata; binary artifacts (screenshots, DOM snapshots) live on the filesystem under a git-ignored `ARTIFACT_STORAGE_PATH`, referenced by content-addressed keys with SHA-256 checksums. New endpoints: `GET /api/test-runs`, `GET /api/test-runs/:id`, `GET /api/evidence/:id`, `POST/GET /api/applications`. **AI investigation is still not implemented** — the persistence layer is the substrate a future AI engine will consume.

## Architecture

A TypeScript npm monorepo:

- `apps/web` — React + Vite + Tailwind CSS dashboard.
- `apps/api` — Node.js + Express + TypeScript API (exposes `/api/health` and `/api/test-runs`).
- `packages/shared` — Shared TypeScript types (e.g. the API health contract).
- `packages/test-engine` — Playwright-based browser execution engine (Phase 2).
- `tests/fixtures/simple-app` — Local HTML fixture used by browser tests (offline, deterministic).
- `docs/` — Architecture and development documentation.
- `.github/workflows/ci.yml` — Lint, typecheck, test, build pipeline.

See [`docs/architecture.md`](docs/architecture.md) for details.

## Technology stack

| Layer          | Tech                                         |
| -------------- | -------------------------------------------- |
| Frontend       | React 18, TypeScript, Vite, Tailwind CSS     |
| Backend        | Node.js 20+, Express 4, TypeScript           |
| Database       | PostgreSQL 18.6 (native Windows install)     |
| DB client      | `pg` (node-postgres) with pooled connections |
| Validation     | Zod (environment configuration)              |
| Browser engine | Playwright (Chromium in Phase 2)             |
| Testing        | Vitest, Supertest, Testing Library           |
| Code quality   | ESLint (flat config), Prettier               |
| Tooling        | npm workspaces, TypeScript project references |

## Installation

Requires Node.js 20+ and a running local PostgreSQL 18.6 with an existing `ai_bug_hunter` database.

```powershell
git clone <repo> ai-bug-hunter
cd ai-bug-hunter
npm install
npx playwright install chromium
Copy-Item .env.example .env
# Edit .env and set DATABASE_PASSWORD
```

## Configuration

Environment variables are documented in [`docs/development.md`](docs/development.md) and validated at API startup. `.env` is git-ignored; never commit credentials.

## Running locally

```powershell
npm run dev
```

- API: <http://localhost:5000/api/health>
- Web dashboard: <http://localhost:5173>

## Testing

```powershell
npm run test
```

Runs backend + shared tests (Vitest, node env) followed by frontend component tests (Vitest, jsdom env).

## Build

```powershell
npm run build
```

Builds `packages/shared`, `apps/api`, and `apps/web`.

## Roadmap

- **Phase 1 (done):** Foundation — monorepo, backend, frontend shell, PostgreSQL connectivity, tests, CI.
- **Phase 2 (done):** Browser execution engine — `@ai-bug-hunter/test-engine` (Chromium via Playwright), structured test definitions, discriminated action model, normalized execution results, `POST /api/test-runs`.
- **Phase 3 (done):** Evidence collection engine — screenshot, DOM snapshot, console logs, page errors, network metadata, failure classification, browser metadata.
- **Phase 4 (done):** Test run & evidence persistence — PostgreSQL schema (applications, test cases, test runs, steps, artifacts, evidence), migration runner, `LocalArtifactStore` with SHA-256 checksums, `TestRunPersistenceService`, list/detail/download API endpoints, frontend surfaces persisted runs.
- **Phase 5 (done):** Application discovery engine — deterministic Chromium crawler, `ApplicationModel` with pages/links/forms/elements/ranked selectors/accessibility, `POST /api/discovery`, frontend Discovery panel.
- **Phase 6 (done):** AI test generation — `LLMProvider` abstraction, `AnthropicProvider` (SDK isolated), `FakeLLMProvider` for tests, deterministic compaction of `ApplicationModel`, Zod + business-rule validation, prompt-injection defense, `POST /api/ai/generate-tests`, frontend preview + explicit "Run Selected Tests" flow.
- **Phase 7 (done):** AI failure investigation — deterministic `FailureSignals` + `ObservedFacts`, bounded `InvestigationContext`, multimodal-capable provider interface, validator that strips fabricated evidence/step references, `POST /api/ai/investigate/:testRunId`, `investigations` table (migration `002`).
- **Phase 8 (done):** Bug intelligence — cross-run `FailureFingerprint`s, deterministic normalization, weighted explainable similarity, blocking-based candidate pairs, union-find clustering, bounded AI comparator for ambiguous pairs, deterministic regression/resolution logic, `bug_clusters` + `bug_cluster_members` tables (migration `003`), frontend Bug Intelligence dashboard.
- **Phase 9+:** Flaky-test intelligence, visual regression, cloud artifact storage, reporting, Jira integration.

Deferred features are not implemented today, and the dashboard does not display fabricated data for them.
