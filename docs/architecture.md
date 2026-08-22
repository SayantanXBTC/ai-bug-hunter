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

## Future functionality (NOT implemented in Phase 1)

The following capabilities are intentionally deferred. They are listed so the architecture reserves clean seams for them:

- **Playwright integration** — will live under a future `apps/api/src/browser/` module (or a dedicated `packages/runner` package) and drive real browsers for automation.
- **Autonomous crawler** — a discovery layer that walks a target application to produce a page/action graph fed into test generation.
- **AI analysis engine** — Claude API integration for reasoning about pages, generating test cases, and analyzing failures. Will attach behind a provider-agnostic interface in the API layer.
- **Bug detection engine** — evaluates test results, screenshots, DOM/network artifacts to identify defects.
- **Bug intelligence layer** — clustering, deduplication, flaky-test detection, visual regression, and AI root-cause analysis. Backed by dedicated PostgreSQL tables introduced in later phases.
- **Reporting and integrations** — historical reports, Jira integration, and advanced dashboards.

Phase 1 deliberately does **not** ship any of the above.
