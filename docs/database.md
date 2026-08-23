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
