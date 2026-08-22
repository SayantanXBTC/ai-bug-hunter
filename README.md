# AI Bug Hunter

AI Bug Hunter is an AI-powered autonomous web application testing and bug intelligence platform.

> **Status: Phase 3 — Evidence collection.** Phase 1 (foundation), Phase 2 (Playwright execution engine + `POST /api/test-runs`), and Phase 3 (evidence collection) are complete. Failed test runs now return a structured evidence package — screenshot (base64 PNG), truncated DOM snapshot, console messages, uncaught page errors, and network metadata (including HTTP ≥ 400 and aborted requests). Request/response bodies, headers, and cookies are never captured. **AI investigation is not implemented yet** — evidence is in-memory only and will feed a future AI root-cause engine.

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
- **Phase 3 (done):** Evidence collection engine — screenshot, DOM snapshot, console logs, page errors, network metadata, failure classification, browser metadata, in-memory `EvidenceStore` seam for future persistence.
- **Phase 4+:** Autonomous crawler, AI-powered test generation and root-cause analysis (Claude), bug detection/clustering/flaky-test intelligence, visual regression, evidence persistence (filesystem/S3), reporting, Jira integration.

Deferred features are not implemented today, and the dashboard does not display fabricated data for them.
