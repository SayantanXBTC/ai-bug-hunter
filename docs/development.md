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

## Manual verification

1. `npm run dev`.
2. Open `http://localhost:5000/api/health` — expect `{"status":"ok","service":"ai-bug-hunter-api"}`.
3. Open `http://localhost:5173` — expect the AI Bug Hunter dashboard with a green "System online" badge.
