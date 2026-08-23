# AI Bug Hunter — Development Guide

## Prerequisites (Windows 10/11)

- **Node.js** 20 LTS or newer (Node 24 verified).
- **npm** 10 or newer (comes with Node).
- **PostgreSQL** 18.6 installed natively on Windows and running on `127.0.0.1:5432`.
- **Git**.

Do **not** use Docker for local development.

## PostgreSQL setup

An empty database named `ai_bug_hunter` must already exist and be owned by (or accessible to) the `postgres` user. The application connects to it but never creates or drops it.

Quick sanity check from PowerShell (if `psql` is on PATH):

```powershell
psql -h 127.0.0.1 -U postgres -d ai_bug_hunter -c "SELECT 1;"
```

If `psql` is not on PATH, the API will still verify connectivity at startup via the pooled `pg` client.

## Environment setup

1. Copy the example env file:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Edit `.env` and set `DATABASE_PASSWORD` to your local PostgreSQL password. **Never commit `.env`.**

Required variables (validated at API startup):

| Variable            | Default                  |
| ------------------- | ------------------------ |
| `NODE_ENV`          | `development`            |
| `API_PORT`          | `5000`                   |
| `FRONTEND_URL`      | `http://localhost:5173`  |
| `DATABASE_HOST`     | `127.0.0.1`              |
| `DATABASE_PORT`     | `5432`                   |
| `DATABASE_NAME`     | `ai_bug_hunter`          |
| `DATABASE_USER`     | `postgres`               |
| `DATABASE_PASSWORD` | *(empty — set locally)*  |

## Install

From the repository root:

```powershell
npm install
```

This installs dependencies for the root, both apps, and the shared package via npm workspaces.

## Development commands

| Command             | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Runs API (:5000) and Web (:5173) in parallel.      |
| `npm run dev:api`   | Runs only the API with `tsx watch`.                |
| `npm run dev:web`   | Runs only the Web dev server (Vite).               |
| `npm run build`     | Builds shared, api, and web workspaces.            |
| `npm run test`      | Runs Node-side tests, then Web (jsdom) tests.      |
| `npm run lint`      | Runs ESLint over the whole repo.                   |
| `npm run typecheck` | Runs `tsc --noEmit` in every workspace.            |
| `npm run format`    | Formats the repo with Prettier.                    |

## Playwright / browser setup (Phase 2)

The `@ai-bug-hunter/test-engine` package depends on `playwright`. Browser binaries are downloaded outside `node_modules` (into `%LOCALAPPDATA%\ms-playwright`). Install Chromium after `npm install`:

```powershell
npx playwright install chromium
```

Only Chromium is required in Phase 2. Re-run this command after every Playwright upgrade.

## Running a sample test

Start the API:

```powershell
npm run dev:api
```

Then trigger a test run via `POST /api/test-runs`:

```powershell
curl -s -X POST http://localhost:5000/api/test-runs `
  -H "Content-Type: application/json" `
  -d '{
    "id": "sample-1",
    "name": "sample",
    "targetUrl": "https://example.com",
    "steps": [
      { "action": "navigate", "url": "https://example.com" },
      { "action": "waitForSelector", "selector": "h1", "timeoutMs": 5000 }
    ]
  }'
```

Response is an `ExecutionResult` with `status`, per-step timings, and a normalized `error` on failure.

To silence engine logs during tests, set `TEST_ENGINE_QUIET=1`.

## Evidence collection (Phase 3)

When a step fails, the engine automatically attaches an `evidence` package to the returned `ExecutionResult`:

- **screenshot** — base64-encoded PNG (`{mimeType, encoding, data, byteLength, capturedAt}`)
- **dom** — outer HTML of the failing page, truncated to 512 KB by default
- **consoleLogs** — messages captured from `page.on('console')` since the start of the test
- **pageErrors** — uncaught page exceptions (kept separate from console errors)
- **networkRequests** / **failedRequests** — URL, method, resource type, status, timestamp, failure type (`http | network | aborted`). Request/response bodies are **never** captured.
- **browser** — `{ name, version, userAgent, viewport, url, title }`
- **metadata** — truncation flags and counts

Successful runs skip evidence by default. Pass `evidence: { includeEvidenceOnSuccess: true }` to `new TestExecutor(...)` or the API layer to override. Individual sub-options (`screenshotOnFailure`, `captureConsole`, `captureNetwork`, `capturePageErrors`, `captureDomOnFailure`, size caps) are documented on the `EvidenceOptions` type.

## Database & persistence (Phase 4)

Migrations run automatically at API startup. To apply them manually (e.g. during CI):

```powershell
npm run migrate --workspace @ai-bug-hunter/api
```

Output is a JSON summary like `{"applied":["001"],"skipped":[]}`. Migrations are idempotent.

### Environment

Add to your `.env` (already documented in `.env.example`):

```
ARTIFACT_STORAGE_PATH=./artifacts
TEST_RUNS_LIST_MAX_LIMIT=100
```

The `./artifacts` directory is git-ignored and created on demand. Move it out of the repo (e.g. `D:/aibh-artifacts`) for real environments.

### Test database

Repository/persistence integration tests are guarded behind `RUN_DB_TESTS=1`. They connect to your existing `ai_bug_hunter` database using the credentials in `.env`, create a fresh temporary schema per test suite (`tdb_<random>`), run migrations inside it, and drop the schema at the end. They never touch `public` and never destroy developer data.

Run only the DB tests:

```powershell
$env:RUN_DB_TESTS = "1"; npx vitest run apps/api/src/db apps/api/src/services
```

Or run the full suite with DB tests enabled:

```powershell
$env:RUN_DB_TESTS = "1"; npm run test
```

Without `RUN_DB_TESTS=1`, DB integration tests are skipped so the suite stays fully deterministic offline.

### Testing evidence locally

The deterministic fixture (`tests/fixtures/simple-app/index.html`) exposes buttons that trigger:

- `#trigger-console-error` → `console.error('deliberate-console-error')`
- `#trigger-page-error` → uncaught `throw new Error('deliberate-page-error')`
- `#trigger-500` → `fetch('/api/error')` returning HTTP 500
- `#trigger-abort` → `fetch('/api/abort')` where the server destroys the socket

These are served by `startFixtureServer()` over `127.0.0.1:<random port>` so tests remain offline and deterministic.

## Manual verification

1. `npm run dev`.
2. Open `http://localhost:5000/api/health` — expect `{"status":"ok","service":"ai-bug-hunter-api"}`.
3. Open `http://localhost:5173` — expect the AI Bug Hunter dashboard with a green "System online" badge.
