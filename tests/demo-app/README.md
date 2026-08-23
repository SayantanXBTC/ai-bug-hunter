# Demo Application

Standalone Express + inline-HTML target used by AI Bug Hunter for end-to-end
discovery, generation, execution, investigation, and regression demos.

The app is fully deterministic and holds all state in memory. It performs no
network calls and touches no filesystem or database.

## Run

```powershell
# from repo root
npm run demo               # start (mode from env, default normal)
npm run dev:demo           # watch mode

# or standalone
npm run start --workspace @ai-bug-hunter/demo-app
```

Default URL: <http://localhost:4000>

## Environment variables

| Var | Default | Description |
| --- | --- | --- |
| `DEMO_PORT` | `4000` | HTTP port |
| `DEMO_MODE` | `normal` | One of `normal`, `buggy`, `flaky` |
| `DEMO_ALLOW_RUNTIME_MODE_SWITCH` | `false` | If `true`, `POST /__mode` is allowed |

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/healthz` | `{ ok, mode }` |
| GET | `/__mode` | current mode |
| POST | `/__mode` | switch mode at runtime (403 unless env-enabled) |
| GET | `/` | landing page |
| GET | `/login` | login form |
| POST | `/login` | authenticate |
| GET | `/dashboard` | placeholder |
| GET | `/products` | list catalog |
| POST | `/cart/add` | add product to cart |
| GET | `/cart` | render cart (HTML or JSON) |
| GET | `/checkout` | checkout form |
| POST | `/checkout` | submit order |
| GET | `/profile` | profile form |
| POST | `/profile` | echo profile save |
| GET | `/search?q=` | search endpoint |
| GET | `/slow` | 15s sleep in buggy mode |

Predictable form selectors: `login-email`, `login-password`, `login-submit`,
`search-input`, `search-submit`, `checkout-name`, `checkout-confirm`,
`profile-name`, `profile-email`, `profile-save`, `add-<sku>`.

## Modes and bugs

| ID | Mode | Endpoint | Symptom |
| --- | --- | --- | --- |
| BUG-1 | `buggy` | `POST /login` | Accepts any password for `demo@example.com` |
| BUG-2 | `buggy` | `POST /checkout` | Returns 500 if cart contains `sku-broken` |
| BUG-3 | `buggy` | `GET /cart` | Total is doubled (price × 2 × qty) |
| BUG-4 | `flaky` | `GET /search?q=…` | Every 3rd request per query returns 500 (deterministic counter) |
| BUG-5 | `buggy` | `GET /slow` | Sleeps 15s, exceeding typical 10s test timeouts |

Demo credentials: `demo@example.com` / `demo1234`.

### Flaky counter reset

BUG-4 uses a module-level `Map` keyed by query. The counter is per-process and
resets when the process restarts. This is intentional so a single test run can
reason about the pattern.

## In-repo test

```powershell
npx vitest run tests/demo-app/server.test.ts
```

The test suite intentionally does not invoke `/slow` in buggy mode (would sleep
15s); it only asserts the route is registered.
