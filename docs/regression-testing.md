# AI Bug Hunter — Regression Testing & Flaky Detection (Phase 9)

## Purpose

Two tightly coupled capabilities:

- **Reliability / flaky detection** — turn historical `test_runs` into deterministic per-test reliability snapshots (stable / suspected_flaky / flaky / unstable / insufficient_data).
- **Regression campaigns** — deterministic, explainable selection of tests + a two-step (create → human-review → run) execution flow that reuses the Phase 2 `TestExecutor`, Phase 3 evidence, Phase 4 persistence, Phase 7 investigation, and Phase 8 bug intelligence.

**No autonomous browsing, no code changes, no self-healing.** The system may select and execute already-approved `TestDefinition`s; it never invents new tests or actions.

## Flaky classification

Deterministic rules (in `flakyScorer.ts`):

| status | rule |
| --- | --- |
| `insufficient_data` | `totalRuns < MIN_FLAKY_RUNS` (default 10) |
| `stable` | no failures |
| `unstable` | all failures share one signature (stable defect) OR `failureRate ≥ 30%` with low alternation |
| `flaky` | `alternationRate ≥ 40%` AND `failureCount ≥ 3` AND `distinctSignatures ≥ 2` |
| `suspected_flaky` | `alternationRate ≥ 20%` AND `distinctSignatures ≥ 2` |

Signals with weights combine into `flakyScore ∈ [0,1]`:
- `alternation_rate` up to +0.40
- `multiple_failure_signatures (≥ 3)` +0.20
- `duration_variability (coefficient of variation > 0.5)` +0.15
- `environment_correlation` (failure rate delta ≥ 30% across browsers) +0.10
- `single_bug_cluster_domination` **–0.30** (prevents stable-defect misclassification)

`reliabilityScore = clamp(1 - failureRate·0.6 - flakyScore·0.4, 0, 1)`.

Every classification carries a plain-English `explanation` and the full `signals[]` array — auditable, no ML black box.

### Regression vs flaky vs stable-broken

- `PASS PASS PASS PASS FAIL FAIL` → NOT flaky (low alternation, unified signature) → `unstable` or `stable` depending on failure rate. Handled by Phase 8 as a `regressed` bug cluster.
- `PASS FAIL PASS FAIL PASS FAIL` with different signatures → `flaky` (alternation + multi-signature).
- `FAIL FAIL FAIL FAIL FAIL` all same signature → `unstable` (single-cluster domination protects against false flaky).

## Test case persistence

`test_cases` gains: `priority (critical|high|medium|low)`, `enabled`, `tags[]`, `source (manual|generated|imported)`, `external_test_id`. CRUD via `POST/GET/PATCH /api/test-cases`. Delete deliberately omitted.

## Risk scoring

Per test, weighted signals:

| signal | contribution |
| --- | --- |
| `failure_rate` | up to 0.25 |
| `regression_risk` (associated with a regressed `bug_cluster`) | +0.25 |
| `open_bug_clusters` | up to +0.20 (0.05 per cluster) |
| `priority` | critical +0.20 · high +0.15 · medium +0.10 · low +0.05 |
| `recency_stale` (>24h since last run) | +0.05 |
| `never_run` | +0.05 |
| `flaky_penalty` (currently flaky) | **–0.05** |

Every score carries the ordered `selectionReason[]` — clearly explainable.

## Selection strategies

- `all_enabled` — every enabled test, ordered by priority ASC (critical first). Ignores disabled tests.
- `smoke` — only tests tagged `smoke`, tagged `authentication`, or priority=`critical`.
- `risk_based` — order by risk score DESC, cap at `maxTests`.
- `changed_area`, `bug_targeted` — fall back to `risk_based` (deliberate: no branch-diff integration yet).

## Campaign lifecycle

```
POST /api/regression-campaigns          → status="queued", selected tests persisted
        ↓ (human review — required)
POST /api/regression-campaigns/:id/run  → status="running" → executes sequentially
        ↓
per test:
  TestExecutor → TestRunPersistenceService → (optional) FailureInvestigator
        ↓
after all done:
  BugIntelligenceService.analyze({testRunIds})   ← incremental
  compute campaign quality
        ↓
status = passed | failed | error | cancelled
```

**Human review is mandatory.** Creating a campaign never triggers execution.

## Campaign quality

Deterministic rules:

- `healthy` — no critical test failure, no regressed bug cluster among created runs.
- `failed` — any critical test failed OR any regressed cluster appears among created runs.
- `degraded` — non-critical failures/errors present, no regression.
- `inconclusive` — total runs = 0.

The LLM does **not** decide quality.

## Cancellation

`POST /api/regression-campaigns/:id/cancel` flips `cancel_requested = true`. The runner checks the flag between each test; currently-running test finishes cleanly (browser teardown via `TestExecutor.finally`); remaining tests are marked `skipped`; final status becomes `cancelled`. No process is forcibly killed.

## Concurrency

Sequential execution (`REGRESSION_MAX_CONCURRENCY=1` default). One `TestExecutor` per iteration → one Chromium instance at a time. The `executorFactory` seam allows a future worker-pool implementation without touching the service.

## Failure investigation & bug intelligence integration

- Per failed/error test: if `investigateFailed` is wired and a provider is configured, the Phase 7 `FailureInvestigator` runs and persists an `InvestigationReport` (capped by `MAX_AUTO_INVESTIGATIONS_PER_CAMPAIGN`).
- After all tests: `BugIntelligenceService.analyze({ testRunIds: createdRunIds })` performs incremental clustering for only the new runs — never a full rebuild.

Passing runs are never investigated.

## Cost controls

| variable | default |
| --- | --- |
| `MIN_FLAKY_RUNS` | 10 |
| `REGRESSION_MAX_CONCURRENCY` | 1 |
| `MAX_AUTO_INVESTIGATIONS_PER_CAMPAIGN` | 20 |
| `MAX_AI_SUMMARIES_PER_CAMPAIGN` | 10 |

Without a real `ANTHROPIC_API_KEY`, campaigns still run — deterministic reliability + risk scoring + clustering all operate LLM-free. Only investigation and AI summaries are gated on the key.

## API endpoints

- `POST /api/test-cases`, `GET /api/test-cases`, `GET /api/test-cases/:id`, `PATCH /api/test-cases/:id`.
- `GET /api/ai/test-reliability?status=&flakyOnly=&minRuns=`.
- `GET /api/ai/test-reliability/:externalTestId`.
- `POST /api/ai/test-reliability/recalculate`.
- `POST /api/regression-campaigns` (create, returns preview).
- `POST /api/regression-campaigns/:id/run` (explicit execute — human-triggered only).
- `POST /api/regression-campaigns/:id/cancel`.
- `GET /api/regression-campaigns` (paginated + filtered by status/application).
- `GET /api/regression-campaigns/:id` (campaign + members + selection reasons).

## Security & privacy

- No secrets in prompts or logs.
- Test definitions revalidated by `TestDefinitionSchema` on every mutation (URL safety, action enum).
- Applications-under-test remain scoped by URL validation from `@ai-bug-hunter/test-engine`.
- Failure investigation prompt-injection defenses inherited from Phase 7.
- Cancellation is cooperative — no process kill; browsers cleaned via `TestExecutor.finally`.

## Not implemented

- CI webhook integration (schema keeps `trigger: 'ci'` slot for later).
- Cross-run selector healing / test modification.
- GitHub/Jira/Slack notifications.
- Distributed workers, queues, Redis.
- Parallel campaign execution (`REGRESSION_MAX_CONCURRENCY=1` for now).
- `changed_area` and `bug_targeted` strategies (fall back to `risk_based`).
- AI-authored campaign summaries (metric plumbing exists; not wired to a summariser).
