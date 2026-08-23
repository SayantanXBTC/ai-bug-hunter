# AI Bug Hunter

**Status:** Phases 1–10 complete.

## 1. What is AI Bug Hunter

AI Bug Hunter is an AI-powered autonomous web application testing and bug
intelligence platform. It discovers a target application, generates candidate
tests, executes them under Playwright, collects rich evidence, clusters
failures across runs, investigates root causes with an LLM, tracks reliability,
runs risk-based regression campaigns, and gates CI with a deterministic quality
verdict.

## 2. Why it exists

Traditional test suites rot silently and traditional bug trackers duplicate
noise. AI Bug Hunter puts a deterministic backbone under an AI layer:
Playwright and PostgreSQL own execution and truth; Claude proposes tests,
hypotheses, and semantic comparisons — always behind a strict provider
interface with post-validation. The LLM never touches Playwright, never
decides pass/fail, and never fabricates evidence.

## 3. Architecture

TypeScript npm monorepo with clear seams:

- `apps/web` — React + Vite + Tailwind dashboard (Login, Overview, Settings,
  CI Tokens, Discovery, Runs, Bug Intelligence, Reliability, Campaigns).
- `apps/api` — Express + TypeScript API with cookie sessions, role guards,
  rate limits, SSRF policy, request IDs, structured errors, admin settings,
  AI metrics.
- `packages/test-engine` — Playwright-based discovery + execution engine.
  Nothing else may import Playwright directly.
- `packages/shared` — Cross-cutting TypeScript types.
- `packages/ci-cli` — `ai-bug-hunter-ci` binary for CI pipelines.
- `tests/demo-app` — Standalone Express+HTML target with switchable
  deterministic bugs (`normal | buggy | flaky`).
- `docs/` — Full documentation.

See [`docs/architecture.md`](docs/architecture.md) for the Phase-10 diagram.

## 4. Features

- Deterministic Chromium crawler → `ApplicationModel` (pages, forms,
  elements, ranked selectors, accessibility).
- AI test generation, provider-abstracted, output-validated by Zod + business
  rules.
- Test execution with per-step results, screenshots, DOM snapshots, console,
  network metadata; artifacts content-addressed on disk.
- Persistence: applications, test cases, runs, steps, evidence,
  investigations, bug clusters, reliability snapshots, regression campaigns,
  users, sessions, CI tokens.
- AI failure investigation anchored to deterministic `ObservedFacts`.
- Cross-run bug intelligence: fingerprints + explainable similarity + bounded
  LLM comparator + union-find clustering + deterministic regression /
  resolution status.
- Reliability layer: `stable | suspected_flaky | flaky | unstable |
  insufficient_data` with an explicit anti-false-positive signal for
  stable-broken tests.
- Risk-based regression campaigns with an explicit human-review boundary and
  a deterministic quality gate (`healthy | degraded | failed | inconclusive`).
- Cookie authentication, role guards, CI tokens, SSRF policy, rate limits,
  structured request IDs, admin settings, opt-in retention.
- CI quality gate + CLI + GitHub Actions / GitLab / Jenkins recipes.

## 5. Technology stack

| Layer          | Tech                                                    |
| -------------- | ------------------------------------------------------- |
| Frontend       | React 18, TypeScript, Vite, Tailwind CSS                |
| Backend        | Node.js 20+, Express 4, TypeScript                      |
| Auth           | Cookie sessions + scrypt password hashing               |
| CI surface     | Bearer tokens (SHA-256 hashed), CLI + `curl` examples   |
| Database       | PostgreSQL 18.6                                         |
| DB client      | `pg` (node-postgres) pooled                             |
| Validation     | Zod (env + LLM outputs)                                 |
| Browser engine | Playwright (Chromium)                                   |
| AI             | `@anthropic-ai/sdk` (isolated) + `FakeLLMProvider`      |
| Testing        | Vitest, Supertest, Testing Library                      |
| Code quality   | ESLint (flat config), Prettier                          |
| Tooling        | npm workspaces, TypeScript project references           |

## 6. Quick start

```powershell
git clone <repo> ai-bug-hunter
cd ai-bug-hunter
npm install
npx playwright install chromium
Copy-Item .env.example .env
# Edit .env: set DATABASE_PASSWORD, optionally ANTHROPIC_API_KEY

npm run dev            # api + web
npm run demo           # demo target on http://localhost:4000
```

## 7. Environment variables

| Name | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development | test | production` |
| `API_PORT` | `5000` | |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin |
| `DATABASE_HOST` | `127.0.0.1` | |
| `DATABASE_PORT` | `5432` | |
| `DATABASE_NAME` | `ai_bug_hunter` | |
| `DATABASE_USER` | `postgres` | |
| `DATABASE_PASSWORD` | *(empty)* | Set locally in `.env` |
| `ARTIFACT_STORAGE_PATH` | `./artifacts` | Git-ignored |
| `LLM_PROVIDER` | `anthropic` | `anthropic | fake` |
| `LLM_MODEL` | `claude-sonnet-4-6` | |
| `LLM_ENABLED` | `true` | |
| `LLM_MAX_TOKENS` | `4096` | |
| `LLM_TEMPERATURE` | `0.2` | |
| `LLM_TIMEOUT_MS` | `60000` | |
| `ANTHROPIC_API_KEY` | *(empty placeholder)* | Never commit |
| `ALLOW_PRIVATE_TARGETS` | `false` | Enable only for local demo/fixture use |
| `AI_MAX_TESTS` | `20` | |
| `AI_PROMPT_MAX_CHARS` | `30000` | |
| `BUG_INTEL_MAX_RUNS` | `500` | |
| `BUG_INTEL_MAX_CANDIDATE_PAIRS` | `2000` | |
| `BUG_INTEL_MAX_AI_COMPARISONS` | `100` | |
| `BUG_INTEL_MIN_RESOLUTION_STREAK` | `3` | |
| `MIN_FLAKY_RUNS` | `10` | |
| `REGRESSION_MAX_CONCURRENCY` | `1` | |
| `MAX_AUTO_INVESTIGATIONS_PER_CAMPAIGN` | `20` | |
| `MAX_AI_SUMMARIES_PER_CAMPAIGN` | `10` | |
| `AUTH_ALLOW_REGISTRATION` | `true` | |
| `AUTH_DEFAULT_ROLE` | `viewer` | `admin | qa_engineer | viewer` |
| `SESSION_TTL_DAYS` | `7` | |
| `CI_DEGRADED_EXIT_CODE` | `0` | Set to `1` to block PRs on degraded |
| `RETENTION_ENABLED` | `false` | Opt-in |
| `DEMO_PORT` | `4000` | For `tests/demo-app` |
| `DEMO_MODE` | `normal` | `normal | buggy | flaky` |
| `DEMO_ALLOW_RUNTIME_MODE_SWITCH` | `false` | |

## 8. PostgreSQL setup

Requires a running local PostgreSQL 18.6 with an `ai_bug_hunter` database.
Migrations run automatically at API startup and can be re-run with:

```powershell
npm run migrate --workspace @ai-bug-hunter/api
```

Schema and migration order are documented in [`docs/database.md`](docs/database.md).

## 9. Anthropic setup

The real Anthropic provider is optional. Without a key, the system falls back
to `FakeLLMProvider` and all deterministic pipelines still function.

```powershell
# .env
ANTHROPIC_API_KEY=<your-anthropic-key>   # never commit
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-6
```

If the key is missing at runtime, AI endpoints return a controlled
`provider_error` and the rest of the system continues. See
[`docs/ai-architecture.md`](docs/ai-architecture.md).

## 10. Demo application

`tests/demo-app` is an Express+HTML target with deterministic bugs, useful
for end-to-end demos:

```powershell
npm run demo                             # normal mode
$env:DEMO_MODE = "buggy";   npm run demo # inject bugs
$env:DEMO_MODE = "flaky";   npm run demo # deterministic flake
```

See [`tests/demo-app/README.md`](tests/demo-app/README.md).

## 11. Running tests

```powershell
npm run test           # node + web
npm run test:node      # vitest (api + packages + tests/**)
npm run test:web       # vitest (jsdom, apps/web)
```

## 12. CI integration

Regression is exposed via a token-scoped surface:

- `POST /api/ci/regression`
- `GET  /api/ci/regression/:id/result`
- CLI: `ai-bug-hunter-ci regression …`

Full guide, exit-code table, GitHub Actions / GitLab / Jenkins snippets:
[`docs/ci-integration.md`](docs/ci-integration.md).

## 13. Security

Authentication, authorization, SSRF policy, secret handling, prompt-injection
defense, artifact security, CI tokens, rate limiting, logging, retention, and
the STRIDE-style threat model are documented in
[`docs/security.md`](docs/security.md).

## 14. Screenshots

See [`docs/architecture.md`](docs/architecture.md) for diagrams.

## 15. Project limitations

- Single-node deployment assumed. Rate limits and session store are
  in-process.
- No CSP header from the app itself; add via reverse proxy.
- DNS rebinding not fully solved.
- Regression campaigns hold no distributed lock — do not run multiple API
  nodes against one database without adding one.
- Artifact storage is local filesystem only in this release.

## 16. Roadmap

- **Phases 1–10 complete.** See "Phase history" below.
- **Deferred:** cloud artifact storage (S3/GCS), Jira integration, Slack
  notifications, Firefox/WebKit engines, HAR + video capture, distributed
  execution.

## 17. Resume-ready project description

AI Bug Hunter is a full-stack TypeScript platform that autonomously
discovers, tests, and reasons about web applications. Playwright drives
deterministic crawling and execution; PostgreSQL persists runs, evidence,
and bug clusters; a strict `LLMProvider` abstraction lets Claude propose
tests, root-cause hypotheses, and semantic pair comparisons without ever
controlling execution, storage, or pass/fail. Cross-run bug intelligence,
reliability scoring, risk-based regression campaigns, cookie-based auth with
role guards, SSRF protection, a token-scoped CI quality gate, a bundled CLI,
and a demo application with switchable deterministic bugs make the system
end-to-end usable from a fresh clone.

---

## Phase history

- **Phase 10:** Auth (cookies + scrypt), role guards, CI quality gate + CLI,
  executive dashboard, SSRF policy, request IDs, structured errors, AI
  metrics, admin settings, opt-in retention, demo app, `docs/security.md`,
  `docs/ci-integration.md`, `docs/ai-architecture.md`.
- **Phase 9:** Flaky detection & regression campaigns — deterministic
  reliability snapshots, explainable risk scoring, three selection
  strategies, human-review boundary, deterministic quality gate.
- **Phase 8:** Bug intelligence — hybrid deterministic fingerprints +
  weighted similarity + union-find, bounded LLM comparator for ambiguous
  pairs, explainable membership reasons, deterministic regression/resolution
  logic, `bug_clusters` + `bug_cluster_members`.
- **Phase 7:** AI failure investigation — deterministic `ObservedFacts`,
  bounded `InvestigationContext`, multimodal-capable provider, validator
  strips fabricated references, `investigations` table.
- **Phase 6:** AI test generation — `LLMProvider` abstraction,
  `AnthropicProvider` (SDK isolated), `FakeLLMProvider`, Zod + business-rule
  validation, prompt-injection defense.
- **Phase 5:** Application discovery engine — deterministic Chromium crawler,
  `ApplicationModel`, `POST /api/discovery`.
- **Phase 4:** Test run & evidence persistence — schema, migrator,
  `LocalArtifactStore` with SHA-256 checksums, `TestRunPersistenceService`,
  list/detail/download endpoints.
- **Phase 3:** Evidence collection — screenshots, DOM snapshots, console,
  page errors, network metadata, failure classification.
- **Phase 2:** Browser execution engine — `@ai-bug-hunter/test-engine`,
  structured test definitions, `POST /api/test-runs`.
- **Phase 1:** Foundation — monorepo, backend, frontend shell, PostgreSQL
  connectivity, tests, CI.
