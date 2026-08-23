<div align="center">

# AI Bug Hunter

**Autonomous QA intelligence for modern web applications.**

Discovers your app. Generates its own tests. Runs them under real Chromium.
Investigates every failure with an LLM anchored to real evidence. Clusters
recurring bugs across time. Scores reliability. Runs risk-based regression
campaigns. Gates your CI with a deterministic quality verdict.

</div>

---

## The idea

Test suites rot silently. Bug trackers duplicate noise. Coverage tools measure
the wrong thing. AI Bug Hunter takes the opposite bet:

> **The LLM proposes. Deterministic code verifies. Evidence proves.**

Playwright owns execution. PostgreSQL owns truth. Claude proposes tests,
hypothesizes root causes, and compares ambiguous failure pairs — always behind
a strict provider interface, always with Zod + business-rule post-validation.
The model never touches Playwright, never decides pass/fail, never fabricates
evidence, never sees a secret.

If you unplug the model, the platform still works. It just becomes less
opinionated.

## What it actually does

```
   You add an application URL
             │
             ▼
   ┌────────────────────────────────────────────────────────┐
   │  DISCOVERY  (deterministic Chromium crawl)             │
   │  Pages · Forms · Elements · Ranked selectors           │
   └─────────────────────┬──────────────────────────────────┘
                         ▼
   ┌────────────────────────────────────────────────────────┐
   │  AI TEST GENERATION  (Claude behind LLMProvider)       │
   │  Structured JSON → Zod → business rules → executable   │
   └─────────────────────┬──────────────────────────────────┘
                         ▼
   ┌────────────────────────────────────────────────────────┐
   │  EXECUTION  (Playwright)                               │
   │  Per-step results, screenshots, DOM, network, console  │
   └─────────────────────┬──────────────────────────────────┘
                         ▼
   ┌────────────────────────────────────────────────────────┐
   │  EVIDENCE  (content-addressed on disk, SHA-256)        │
   └─────────────────────┬──────────────────────────────────┘
              failed?    │
                         ▼
   ┌────────────────────────────────────────────────────────┐
   │  AI INVESTIGATION  (Claude · anchored to ObservedFacts)│
   │  Fabricated evidence references stripped before return │
   └─────────────────────┬──────────────────────────────────┘
                         ▼
   ┌────────────────────────────────────────────────────────┐
   │  BUG INTELLIGENCE                                      │
   │  Fingerprints + weighted similarity + union-find       │
   │  LLM only for ambiguous pairs, bounded per campaign    │
   └─────────────────────┬──────────────────────────────────┘
                         ▼
   ┌────────────────────────────────────────────────────────┐
   │  RELIABILITY                                           │
   │  stable · suspected_flaky · flaky · unstable ·         │
   │  insufficient_data — with anti-false-positive signal   │
   └─────────────────────┬──────────────────────────────────┘
                         ▼
   ┌────────────────────────────────────────────────────────┐
   │  REGRESSION CAMPAIGNS  (risk_based · smoke · all)      │
   │  Human review boundary → Run → deterministic quality   │
   │  gate (healthy · degraded · failed · inconclusive)     │
   └─────────────────────┬──────────────────────────────────┘
                         ▼
   ┌────────────────────────────────────────────────────────┐
   │  CI QUALITY GATE                                       │
   │  Token-authenticated POST + polling CLI + exit codes   │
   └────────────────────────────────────────────────────────┘
```

## Design principles

**Deterministic-first.** Every product-visible verdict (pass/fail, cluster
membership, regression status, quality gate) is computed by code you can read.
LLMs only propose or summarise.

**Evidence-based AI.** No claim without a persisted artifact ID that resolves
to a real file. The investigation validator strips any evidence pointer the
model invents.

**Provider abstraction.** `LLMProvider` is one interface. `AnthropicProvider`
isolates the SDK. `FakeLLMProvider` is the safe default. Missing API key ≠
broken product.

**Bounded cost.** Every AI-consuming operation has a hard cap: max tests per
generation, max comparisons per bug analysis, max investigations per campaign,
max tokens per call, per-user + per-token rate limits.

**Multi-tenant isolation.** Applications, tests, runs, clusters, campaigns,
evidence — all scoped by `owner_id`. Admin bypass is explicit. Cross-tenant
access returns 404 to avoid existence enumeration.

**Human-review boundary.** Regression campaigns cannot execute until a human
clicks Run. Creating a campaign only stages the selection.

**No secrets to the browser.** The Anthropic key lives in one server-side
file. Never in a response, never in a log, never in the frontend bundle.

## Architecture

Monorepo (npm workspaces + TypeScript project references):

```
apps/web           React + Vite + Tailwind — full theme system, orbital scene
apps/api           Express + TypeScript — cookie sessions, RBAC, SSRF, rate
                   limits, request IDs, structured errors, admin settings
packages/
  test-engine     Playwright discovery + execution. Only this package imports
                  Playwright. Discovery is deterministic; execution normalises
                  every failure into structured evidence.
  shared          Cross-cutting TS types
  ci-cli          `ai-bug-hunter-ci` binary — polls quality gate, honest exit
                  codes (0 healthy, configurable degraded, 1 failed, 2
                  inconclusive)
tests/
  demo-app        Standalone Express+HTML target with switchable deterministic
                  bugs (normal | buggy | flaky) — no external services
  demo-app/acceptance.test.ts   Behavioural BUG-1..5 coverage
docs/             architecture · security · ai-architecture · ci-integration
                  · database · development · regression-testing
scripts/e2e/      minimalLiveE2E.ts — gated live pipeline proof
```

Full diagram: [`docs/architecture.md`](docs/architecture.md).

## Capabilities at a glance

| Layer            | What ships                                                                 |
| ---------------- | -------------------------------------------------------------------------- |
| Discovery        | Chromium crawler → `ApplicationModel` (pages, forms, ranked selectors, a11y) |
| Test generation  | Claude behind `LLMProvider`, output validated via Zod + business rules     |
| Execution        | Playwright, per-step + evidence, deterministic action model                |
| Evidence         | Screenshot, DOM, console, network, browser metadata; content-addressed     |
| Persistence      | Applications, cases, runs, steps, evidence, investigations, clusters, snapshots, campaigns, users, sessions, CI tokens |
| Investigation    | Real evidence pointers only; hypotheses + confidence + recommendations     |
| Bug intelligence | Deterministic fingerprints + weighted similarity + union-find; bounded LLM comparator |
| Reliability      | 5-class classifier with `single_bug_cluster_domination` signal to prevent flaky-vs-broken confusion |
| Regression       | risk_based / smoke / all_enabled selection; human-review boundary; quality gate |
| Auth             | Cookie sessions, scrypt passwords, role guards (admin / qa_engineer / viewer) |
| Multi-tenancy    | `owner_id` scoping on every read + evidence ownership chain                |
| SSRF             | Blocklist for loopback / RFC1918 / link-local / metadata / IPv6 ULA + explicit dev override |
| Rate limits      | Per user, per token, per endpoint category; 429 with `Retry-After`         |
| CI               | `POST /api/ci/regression` + polling CLI + exit-code contract               |
| Retention        | Opt-in preview + apply, admin only, `confirm: true` guard                  |
| Observability    | Request IDs, structured logs with `REDACT_KEYS`, AI usage metrics          |

## What it looks like

The frontend is a full dark/light theme system built on CSS variables.
Every authenticated page switches themes cleanly; Login stays intentionally
cinematic dark.

- **Login** — cinematic scene: near-black gradient, hex-grid floor,
  computational pods drifting across the viewport paired with system labels,
  orbital paths.
- **Dashboard** — QA command centre: dominant quality score with SVG ring,
  6-metric grid, trend chart, recent failures, bug intelligence, AI activity,
  quick actions.
- **Applications** — application observatory: metric strip, per-app tree-node
  visual, orbital empty state.
- **Tests** — AI test laboratory: filterable list, detail with steps +
  reliability + recent runs, generation modal with pipeline diagram.
- **Test Runs** — execution telemetry: 5-metric strip, execution trace with
  per-step glyphs, evidence grid with lazy-loaded screenshots.
- **Bugs** — AI investigation command centre: metric panels, AI engine card,
  cluster cards with mini-timeline, detail modal with confidence bars.
- **Reliability** — stability matrix: last-N runs as coloured cells per test,
  classification pills, insufficient-data warnings.
- **Regression** — mission control: SELECT → REVIEW → EXECUTE → ANALYZE
  pipeline, campaign cards with risk gauges.
- **Settings** — system control console: Appearance / AI Engine / Account /
  CI Integration / Retention. Never displays the API key.

Notifications dropdown pulls recent failed runs + bug clusters + campaigns
from the real APIs.

## Quickstart

Requirements: Node.js 20+, PostgreSQL 18.6, Chromium (installed via
Playwright).

```powershell
git clone <repo> ai-bug-hunter
cd ai-bug-hunter
npm install
npx playwright install chromium
Copy-Item .env.example .env
# Edit .env: set DATABASE_PASSWORD; optionally ANTHROPIC_API_KEY

npm run dev            # api :5000 + web :5173
npm run demo           # demo target on :4000
```

Register first user in the browser, then in a separate psql session:

```powershell
psql -U postgres -d ai_bug_hunter -c "UPDATE users SET role='admin' WHERE email='you@example.com';"
```

Log out, log back in. You're admin.

Without an Anthropic key the platform still runs — it just falls back to
`FakeLLMProvider` for AI-consuming endpoints. Every deterministic pipeline
continues to work.

## CI integration

CI systems call the API with a Bearer token (SHA-256 hashed at rest, shown
once at creation):

```bash
export AI_BUG_HUNTER_CI_TOKEN="..."
npx ai-bug-hunter-ci regression \
  --application <app-id> \
  --strategy risk_based \
  --wait
```

Exit codes: **0** healthy · **configurable** degraded · **1** failed · **2**
inconclusive. Examples for GitHub Actions, GitLab CI and Jenkins live in
[`docs/ci-integration.md`](docs/ci-integration.md).

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — Full system diagram, module
  responsibilities, data flow.
- [`docs/ai-architecture.md`](docs/ai-architecture.md) — Where Claude is used,
  where it isn't, prompt-injection defence, cost controls.
- [`docs/security.md`](docs/security.md) — Auth, RBAC, tenant isolation, SSRF,
  session security, rate limits, secret handling, threat model, known
  limitations.
- [`docs/ci-integration.md`](docs/ci-integration.md) — Token flow, CLI, exit
  codes, platform recipes.
- [`docs/database.md`](docs/database.md) — Schema, migrations, retention.
- [`docs/regression-testing.md`](docs/regression-testing.md) — Reliability
  algorithm, risk scoring, campaign lifecycle.
- [`docs/development.md`](docs/development.md) — Local development, environment
  variables, running tests.

## Known limitations

- Single-node deployment assumed. Rate limits and session store are in-process.
- No CSP header (Vite dev incompatibility); add via reverse proxy in
  production.
- DNS rebinding not fully solved (documented in `docs/security.md`).
- Regression campaigns hold no distributed lock — do not run multiple API
  nodes against one database without adding one.
- Artifact storage is local filesystem only.
- CI-triggered regression campaigns are system-owned (`owner_id = null`),
  visible only to admins — intentional.

## Roadmap

- Cloud artifact storage (S3 / GCS)
- Jira & Slack integrations
- Firefox / WebKit engines
- HAR + video capture
- Distributed execution + shared rate-limit store

## Resume-ready description

AI Bug Hunter is a full-stack TypeScript platform (React + Vite + Tailwind
frontend, Express + PostgreSQL + Playwright backend) that autonomously
discovers, tests, and reasons about web applications. Claude proposes test
definitions, root-cause hypotheses, and semantic pair comparisons behind a
strict provider abstraction with Zod + business-rule post-validation, while
deterministic code owns execution, evidence, cluster status, reliability
classification and the CI quality gate. Ships with cookie-based auth (scrypt
+ role guards), tenant isolation across 5 entities, SSRF policy, per-endpoint
rate limits, request IDs, opt-in retention, a token-scoped CI quality gate, a
bundled CLI, a demo application with switchable deterministic bugs, and a
gated live end-to-end validation harness that exercises the real Anthropic
pipeline for ~$0.02 per run.

---

<details>
<summary>Phase history</summary>

- **Phase 10:** Auth (cookies + scrypt), role guards, CI quality gate + CLI,
  executive dashboard, SSRF policy, request IDs, structured errors, AI
  metrics, admin settings, opt-in retention, demo app, `docs/security.md`,
  `docs/ci-integration.md`, `docs/ai-architecture.md`. Post-Phase-10 hardening
  added tenant isolation across 5 entities + evidence ownership chain +
  expanded rate limits + premium theme system.
- **Phase 9:** Flaky detection & regression campaigns — deterministic
  reliability snapshots, explainable risk scoring, three selection strategies,
  human-review boundary, deterministic quality gate.
- **Phase 8:** Bug intelligence — hybrid deterministic fingerprints + weighted
  similarity + union-find, bounded LLM comparator for ambiguous pairs,
  explainable membership reasons, deterministic regression/resolution logic.
- **Phase 7:** AI failure investigation — deterministic `ObservedFacts`,
  bounded `InvestigationContext`, multimodal-capable provider, validator
  strips fabricated references.
- **Phase 6:** AI test generation — `LLMProvider` abstraction,
  `AnthropicProvider` (SDK isolated), `FakeLLMProvider`, Zod + business-rule
  validation, prompt-injection defence.
- **Phase 5:** Application discovery engine — deterministic Chromium crawler,
  `ApplicationModel`, `POST /api/discovery`.
- **Phase 4:** Test run & evidence persistence — schema, migrator,
  `LocalArtifactStore` with SHA-256 checksums, `TestRunPersistenceService`.
- **Phase 3:** Evidence collection — screenshots, DOM snapshots, console,
  page errors, network metadata, failure classification.
- **Phase 2:** Browser execution engine — `@ai-bug-hunter/test-engine`,
  structured test definitions, `POST /api/test-runs`.
- **Phase 1:** Foundation — monorepo, backend, frontend shell, PostgreSQL
  connectivity, tests, CI.

</details>
