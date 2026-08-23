# AI Bug Hunter — Database

## Overview

PostgreSQL 18.6 running natively on the developer machine is the system of record for applications, test cases, test runs, test-run steps, and evidence metadata. Binary artifacts (screenshots, DOM snapshots) live outside the database on the local filesystem, referenced by artifact rows.

Database name: `ai_bug_hunter` (existing). Connection settings come from `.env`. Migrations run automatically at API startup and are also runnable via `npm run migrate --workspace @ai-bug-hunter/api`.

## Migration strategy

Migrations are plain `.sql` files under [`apps/api/src/db/migrations/`](../apps/api/src/db/migrations/), numbered `NNN_name.sql`. The runner (`apps/api/src/db/migrator.ts`) executes any missing migrations inside a transaction and records them in `schema_migrations`. Migrations must be idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) so re-running is safe.

`schema_migrations`:

| column      | type          | notes                    |
| ----------- | ------------- | ------------------------ |
| version     | TEXT PRIMARY  | matches filename prefix  |
| name        | TEXT NOT NULL |                          |
| applied_at  | TIMESTAMPTZ   | default `NOW()`          |

## Tables

### `applications`
System-under-test identifiers.

| column       | type         | notes                                  |
| ------------ | ------------ | -------------------------------------- |
| id           | UUID         | PK, `gen_random_uuid()`                |
| name         | TEXT         | NOT NULL                               |
| base_url     | TEXT         | NOT NULL, validated http/https at API  |
| description  | TEXT         | nullable                               |
| created_at   | TIMESTAMPTZ  | default `NOW()`                        |
| updated_at   | TIMESTAMPTZ  | default `NOW()`                        |

Index: `ix_applications_created_at (created_at DESC)`.

### `test_cases`
Reusable structured test definitions.

| column         | type   | notes                                                  |
| -------------- | ------ | ------------------------------------------------------ |
| id             | UUID   | PK                                                     |
| application_id | UUID   | FK → applications(id), ON DELETE CASCADE               |
| name           | TEXT   | NOT NULL                                               |
| description    | TEXT   |                                                        |
| target_url     | TEXT   | NOT NULL                                               |
| definition     | JSONB  | NOT NULL — serialized `TestDefinition` (source of truth for validation is the TS schema) |
| created_at, updated_at | TIMESTAMPTZ | default `NOW()`                            |

Index: `ix_test_cases_application_id`.

### `test_runs`
One execution of a test.

| column             | type         | notes                                                |
| ------------------ | ------------ | ---------------------------------------------------- |
| id                 | UUID         | PK                                                   |
| test_case_id       | UUID         | FK → test_cases(id), ON DELETE SET NULL              |
| external_test_id   | TEXT         | value from the request `TestDefinition.id`           |
| test_name          | TEXT         |                                                      |
| status             | TEXT         | CHECK IN (`passed`, `failed`, `error`)               |
| started_at         | TIMESTAMPTZ  |                                                      |
| finished_at        | TIMESTAMPTZ  |                                                      |
| duration_ms        | INTEGER      |                                                      |
| error_name         | TEXT         | nullable                                             |
| error_message      | TEXT         | nullable                                             |
| error_step_index   | INTEGER      | nullable                                             |
| created_at         | TIMESTAMPTZ  | default `NOW()`                                      |

Indexes: `ix_test_runs_test_case_id`, `ix_test_runs_created_at (DESC)`, `ix_test_runs_status`.

### `test_run_steps`

| column          | type         | notes                                                |
| --------------- | ------------ | ---------------------------------------------------- |
| id              | UUID         | PK                                                   |
| test_run_id     | UUID         | FK → test_runs(id), ON DELETE CASCADE                |
| step_index      | INTEGER      | unique per run                                       |
| action          | TEXT         | e.g. `navigate`, `click`, `fill`                     |
| status          | TEXT         | CHECK IN (`passed`, `failed`, `skipped`)             |
| duration_ms     | INTEGER      |                                                      |
| error_name      | TEXT         | nullable                                             |
| error_message   | TEXT         | nullable                                             |
| created_at      | TIMESTAMPTZ  | default `NOW()`                                      |

Constraints: `UNIQUE (test_run_id, step_index)`. Index: `ix_test_run_steps_test_run_id`.

### `artifacts`
Binary artifact metadata. The artifact bytes themselves live under `ARTIFACT_STORAGE_PATH` on disk.

| column        | type         | notes                                             |
| ------------- | ------------ | ------------------------------------------------- |
| id            | UUID         | PK                                                |
| storage_key   | TEXT         | UNIQUE — server-generated `<sha256[0..2]>/<uuid>.<ext>` |
| content_type  | TEXT         | e.g. `image/png`, `text/html`                     |
| byte_size     | BIGINT       |                                                   |
| sha256        | TEXT         | 64-char hex; enables future deduplication         |
| created_at    | TIMESTAMPTZ  | default `NOW()`                                   |

Index: `ix_artifacts_sha256`.

### Phase 9 additions

**`test_cases` extended columns** — `priority` (`critical|high|medium|low`), `enabled` (BOOL default true), `tags` (TEXT[]), `source` (`generated|manual|imported`), `external_test_id` (TEXT) linking test cases to persisted `test_runs.external_test_id`.

**`test_reliability_snapshots`** — one row per `external_test_id` (UNIQUE). Fields: `total_runs`, `pass_count`, `failure_count`, `error_count`, `flaky_score` (0..1), `reliability_score` (0..1), `status` CHECK (`stable`|`suspected_flaky`|`flaky`|`unstable`|`insufficient_data`), `signals` JSONB (signal breakdown + explanation + failureSignatures), `duration_stats` JSONB, `environment_signals` JSONB, timing columns.

**`regression_campaigns`** — `id`, `application_id` FK, `name`, `status` CHECK (`queued`|`running`|`passed`|`failed`|`cancelled`|`error`), `trigger` CHECK (`manual`|`api`|`ci`), `selection_strategy` CHECK (`all_enabled`|`risk_based`|`changed_area`|`bug_targeted`|`smoke`), counters, `quality` CHECK (`healthy`|`degraded`|`failed`|`inconclusive`), `cancel_requested` boolean.

**`regression_campaign_tests`** — composite PK `(campaign_id, test_case_id)`, `selection_score` NUMERIC(4,3), `selection_reason` JSONB (explainable), `execution_run_id` FK → test_runs, `status`, `ordinal`.

### `bug_clusters` (Phase 8)
One row per unique failure fingerprint. Identity via `fingerprint_key` (deterministic hash of primary signature).

| column                    | type         | notes                                                                        |
| ------------------------- | ------------ | ---------------------------------------------------------------------------- |
| id                        | UUID PK      |                                                                              |
| fingerprint_key           | TEXT UNIQUE  | idempotency key                                                              |
| title                     | TEXT         | deterministic, e.g. `HTTP 500 on /api/orders`                                |
| description               | TEXT         | primary failure signature                                                    |
| status                    | TEXT CHECK   | `open` | `recurring` | `regressed` | `resolved` | `inconclusive`             |
| severity                  | TEXT CHECK   | `critical` | `high` | `medium` | `low` | `none` | `unknown`                 |
| confidence                | NUMERIC(3,2) | 0..1                                                                         |
| first_seen_at             | TIMESTAMPTZ  | min of member `started_at`                                                   |
| last_seen_at              | TIMESTAMPTZ  | max of member `started_at`                                                   |
| occurrence_count          | INTEGER      |                                                                              |
| affected_test_count       | INTEGER      |                                                                              |
| affected_page_count       | INTEGER      |                                                                              |
| affected_endpoint_count   | INTEGER      |                                                                              |
| regression_status         | TEXT CHECK   | `first_seen` | `recurring` | `regressed` | `resolved` | `inconclusive`      |
| primary_run_id            | UUID FK      | → test_runs(id) ON DELETE SET NULL                                           |
| primary_investigation_id  | UUID         | reference to the primary investigation (if any)                              |
| primary_failure_signature | TEXT         |                                                                              |
| root_cause_summary        | TEXT         | copied from primary investigation summary if present                         |
| created_at, updated_at    | TIMESTAMPTZ  |                                                                              |

Indexes: `ix_bug_clusters_status`, `ix_bug_clusters_last_seen (DESC)`, `ix_bug_clusters_regression_status`.

### `bug_cluster_members` (Phase 8)
Membership per run — composite PK enforces one row per (cluster, run).

| column            | type         | notes                                            |
| ----------------- | ------------ | ------------------------------------------------ |
| cluster_id        | UUID FK      | → bug_clusters(id) ON DELETE CASCADE             |
| test_run_id       | UUID FK      | → test_runs(id) ON DELETE CASCADE                |
| similarity_score  | NUMERIC(4,3) | 0..1                                             |
| membership_reason | JSONB        | array of `{name, contribution, explanation}`     |
| created_at        | TIMESTAMPTZ  |                                                  |

Primary key: `(cluster_id, test_run_id)`. Index: `ix_bug_cluster_members_test_run`.

### `investigations` (Phase 7)
One AI failure investigation per test run.

| column           | type         | notes                                                 |
| ---------------- | ------------ | ----------------------------------------------------- |
| id               | UUID         | PK                                                    |
| test_run_id      | UUID UNIQUE  | FK → test_runs(id) ON DELETE CASCADE                  |
| classification   | TEXT         | CHECK IN (`application_defect`, `test_defect`, `environment_failure`, `dependency_failure`, `data_failure`, `inconclusive`) |
| severity         | TEXT         | CHECK IN (`critical`, `high`, `medium`, `low`, `none`) |
| confidence       | NUMERIC(3,2) | CHECK 0..1                                            |
| summary          | TEXT         |                                                       |
| likely_root_cause| TEXT         | nullable                                              |
| provider, model  | TEXT         | LLM metadata                                          |
| report_json      | JSONB        | full InvestigationReport                              |
| created_at       | TIMESTAMPTZ  | default NOW()                                         |

Indexes: `ix_investigations_test_run_id`, `ix_investigations_classification`. Upsert-per-test-run via DELETE+INSERT; `force=true` regenerates.

### `evidence`
Evidence facets attached to a test run (and optionally a specific step).

| column           | type         | notes                                                                 |
| ---------------- | ------------ | --------------------------------------------------------------------- |
| id               | UUID         | PK                                                                    |
| test_run_id      | UUID         | FK → test_runs(id), ON DELETE CASCADE                                 |
| test_run_step_id | UUID         | FK → test_run_steps(id), ON DELETE SET NULL                           |
| evidence_type    | TEXT         | CHECK IN (`screenshot`, `dom`, `console`, `page_error`, `network`, `browser_metadata`) |
| artifact_id      | UUID         | FK → artifacts(id), NULL for text-only evidence types                 |
| metadata         | JSONB        | default `{}` — captured console logs, network entries, browser info, etc. |
| created_at       | TIMESTAMPTZ  | default `NOW()`                                                       |

Indexes: `ix_evidence_test_run_id`, `ix_evidence_type`.

## JSONB usage

- `test_cases.definition` — full `TestDefinition` (id/name/targetUrl/steps).
- `evidence.metadata` — normalized evidence content that isn't a binary artifact: console log arrays, page-error arrays, network request arrays, browser metadata, plus truncation/count summaries.

Runtime validation of these payloads lives in the TypeScript layer (`@ai-bug-hunter/test-engine` and `apps/api/src/routes/*`). The database enforces only structural constraints (JSONB, not-null, check constraints on enum-like columns).

## Artifact references

Artifacts are content-addressed by SHA-256 and stored under `ARTIFACT_STORAGE_PATH` (default `./artifacts`, git-ignored). The database only sees the storage key, content type, byte size, and checksum — never the bytes. A single artifact row may back multiple evidence rows in the future (dedup is intentionally not implemented yet).

## Transaction boundaries

`TestRunPersistenceService.persist()`:

1. Writes artifact bytes to the local artifact store first (filesystem is non-transactional).
2. Opens a Postgres transaction.
3. Inserts `test_runs` + `test_run_steps` + `artifacts` + `evidence` rows.
4. `COMMIT` on success, `ROLLBACK` on failure.
5. On rollback: attempts best-effort deletion of already-written artifact files.

Because filesystem and database cannot participate in the same atomic transaction, a hard crash between step 1 and step 4 may leave orphaned artifact files on disk. Future retention/cleanup jobs will sweep unreferenced files.
