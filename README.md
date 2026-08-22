# AI Bug Hunter

AI Bug Hunter is an AI-powered autonomous web application testing and bug intelligence platform.

> **Status: Phase 1 — Foundation.** Only the engineering foundation (monorepo, frontend shell, backend API skeleton, PostgreSQL connectivity, tests, CI) is implemented. Browser automation, crawling, AI analysis, and bug intelligence are intentionally not part of this phase.

## Architecture

A TypeScript npm monorepo:

- `apps/web` — React + Vite + Tailwind CSS dashboard.
- `apps/api` — Node.js + Express + TypeScript API.
- `packages/shared` — Shared TypeScript types (e.g. the API health contract).
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
| Testing        | Vitest, Supertest, Testing Library           |
| Code quality   | ESLint (flat config), Prettier               |
| Tooling        | npm workspaces, TypeScript project references |

## Installation

Requires Node.js 20+ and a running local PostgreSQL 18.6 with an existing `ai_bug_hunter` database.

```powershell
git clone <repo> ai-bug-hunter
cd ai-bug-hunter
npm install
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

Phase 1 (this repository) delivers the foundation. Subsequent phases will add:

- Playwright browser automation.
- Autonomous crawler.
- Claude-powered AI test generation and analysis.
- Bug detection, clustering, and flaky-test intelligence.
- Visual regression and AI root-cause analysis.
- Reporting and Jira integration.

None of these features are implemented today, and the dashboard does not display fabricated data for them.
