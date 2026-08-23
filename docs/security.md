# Security

This document describes the security posture introduced through Phase 10.

## Authentication

Session-cookie authentication backed by scrypt-hashed passwords.

- `POST /api/auth/register` (gated by `AUTH_ALLOW_REGISTRATION`).
- `POST /api/auth/login` — validates credentials, mints a session, sets an
  `HttpOnly; SameSite=Lax; Secure` cookie.
- `POST /api/auth/logout` — invalidates the session.
- `GET /api/auth/me` — returns the current user.
- Passwords are hashed with Node `scrypt` (per-user salt, constant-time
  comparison via `timingSafeEqual`).
- Sessions live for `SESSION_TTL_DAYS` (default 7). Session identifiers are
  random opaque tokens stored hashed in `sessions`.

## Authorization roles

Three roles enforced by route middleware:

| Role | Read | Run tests | Manage tokens / users | Admin settings |
| --- | --- | --- | --- | --- |
| `admin` | yes | yes | yes | yes |
| `qa_engineer` | yes | yes | no | no |
| `viewer` | yes | no | no | no |

Default role for new registrations: `AUTH_DEFAULT_ROLE` (default `viewer`).

## SSRF protection

All outbound URLs from discovery, generation, execution and regression are
routed through `targetUrlPolicy`:

- Protocol allow-list: `http`, `https` only.
- Blocklist of private / link-local / loopback IP ranges, `.local`, metadata
  endpoints (`169.254.169.254`, `metadata.google.internal`).
- Optional per-request `allowedHosts` extension.
- `ALLOW_PRIVATE_TARGETS=true` disables the blocklist — intended only for the
  demo app and for the fixture server. Never enable in production.

Applied surfaces: `POST /api/discovery`, `POST /api/test-runs`,
`POST /api/ai/generate-tests`, regression campaign execution, CI regression
trigger.

Known limitation: DNS rebinding is not fully mitigated. A pinned resolver is a
follow-up.

## Secret handling

- The Anthropic API key is only ever read from `ANTHROPIC_API_KEY` env or a
  bootstrapped `.env` file loaded by `apps/api/src/config/env.ts`.
- `GET /api/admin/settings` returns provider settings with the key masked
  (`sk-…****` shape or empty string when unset). The raw key is never returned.
- Structured logger has a `REDACT_KEYS` list (`password`, `token`, `apiKey`,
  `api_key`, `authorization`, `cookie`). Request bodies, prompts, and full
  responses are never logged.

## Prompt-injection defense

- System prompt instructs the model to treat all page/model content as
  untrusted data.
- User prompts fence application-derived content inside code blocks.
- Every LLM response is JSON-parsed and validated against a Zod schema before
  it can flow anywhere else.
- Business rules reject outputs that reference selectors not in the discovered
  model, URLs that are out of scope, or actions outside the supported set.
- One retry per operation on malformed output; a second failure returns a
  controlled provider error to the caller.

## Artifact security

- `LocalArtifactStore` writes under `ARTIFACT_STORAGE_PATH` using
  content-addressed keys (`<sha256[0..2]>/<uuid>.<ext>`).
- Storage keys are server-generated; callers cannot supply paths.
- `read` / `delete` reject absolute paths, `..` segments, and null bytes.
- Evidence downloads (`GET /api/evidence/:id`) require an authenticated
  session; UUIDs are validated before any filesystem I/O.

## CI tokens

- Issued via `POST /api/ci/tokens` (admin only).
- Stored as SHA-256 hashes; the raw token value is shown to the user exactly
  once at creation time and never returned again.
- Optional application binding — a token bound to app `X` cannot trigger a
  campaign against app `Y`.
- Revocation via `DELETE /api/ci/tokens/:id`.

## Rate limiting

In-memory token buckets keyed per endpoint. Limits (per client / token) are:

| Endpoint | Window | Max |
| --- | --- | --- |
| `POST /api/auth/login` | 15 min | 10 |
| `POST /api/auth/register` | 15 min | 5 |
| `POST /api/discovery` | 15 min | 30 |
| `POST /api/test-runs` | 15 min | 60 |
| `POST /api/ai/generate-tests` | 15 min | 30 |
| `POST /api/ci/regression` | 60 min | 30 |

Login failures also update `login_attempts` — repeated failures trigger a
lockout window.

Known limitation: rate limits are in-process only and reset on restart. They
are not suitable for a multi-node deployment as-is; a shared store (Redis) is a
follow-up.

## Logging

- Structured JSON logger; every request carries an `X-Request-Id`.
- `REDACT_KEYS` list ensures secrets never appear in logs.
- Bodies, headers, prompts, and LLM responses are never logged.
- The Anthropic API key is never logged even at debug level.

## Data retention

Opt-in via `RETENTION_ENABLED=true`. When enabled:

- `POST /api/admin/retention/preview` reports what would be deleted.
- `POST /api/admin/retention/purge` deletes test runs and artifacts older than
  the configured horizon and any evidence they own.
- Never runs automatically without an explicit admin invocation.

## Threat model (STRIDE summary)

| Threat | Surface | Mitigation |
| --- | --- | --- |
| Spoofing | login | scrypt + session cookie + login attempt tracking |
| Tampering | artifact URLs | UUID params + server-generated content-addressed keys |
| Repudiation | admin actions | Structured logs with `X-Request-Id` |
| Information disclosure | LLM outputs, logs | REDACT list, masked admin/settings, no prompt logging |
| DoS | LLM + campaign endpoints | Per-endpoint rate limits, campaign concurrency cap |
| Elevation | protected APIs | Role guards on every mutating route |
| SSRF | discovery/generation | `targetUrlPolicy` blocklist |
| Prompt injection | LLM prompts | Fenced input + Zod + business-rule validation |

## Known limitations

- Single-node deployment assumed; rate limits and session store are in-process.
- No CSP header emitted by the Express app; add via reverse proxy when
  deploying.
- DNS rebinding is not fully solved.
- No CSRF token — mutating APIs rely on `SameSite=Lax` cookies + JSON
  content-type checks. Add CSRF tokens if you plan to expose from other
  origins.
- Regression campaigns hold no distributed lock; do not run more than one API
  node against the same database without adding one.
