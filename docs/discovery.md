# AI Bug Hunter — Discovery Engine

## Purpose

The Discovery Engine produces a **deterministic, structured representation** of a target web application by walking it with a real headless Chromium. The output is a JSON-serializable `ApplicationModel` that future phases (LLM-driven test synthesis, bug intelligence) can reason over without touching Playwright objects or raw DOM.

## Where it lives

`packages/test-engine/src/discovery/`

| File                  | Responsibility                                                    |
| --------------------- | ----------------------------------------------------------------- |
| `discoveryTypes.ts`   | All types + `DEFAULT_DISCOVERY_OPTIONS`                          |
| `urlNormalizer.ts`    | URL parsing, normalization, protocol allow-list, scope checks     |
| `pageInspector.ts`    | Single-page inspection: elements, links, forms, headings, a11y   |
| `discoveryEngine.ts`  | BFS crawler with visited set, depth/page caps, warnings          |

## Data model

```
ApplicationModel
├─ id                    — server-generated UUID
├─ baseUrl
├─ discoveredAt          — ISO
└─ pages: PageModel[]
     ├─ url              — normalized
     ├─ path
     ├─ title
     ├─ headings         — { level, text }[]
     ├─ links            — { text, href, normalizedUrl, inScope, selectors[] }[]
     ├─ elements         — DiscoveredElement[]
     ├─ forms            — { method, action?, fields[], submitSelectors[], selectors[] }[]
     └─ accessibility    — { root: AccessibilityNode | null, nodeCount, truncated }
```

`DiscoveredElement` fields: `category` (button/link/input/textarea/select/option/checkbox/radio/heading/form/navigation/image/generic), `tagName`, `role`, `accessibleName`, `text`, `testId`, `id`, `name`, `type`, `placeholder`, `ariaLabel`, `href`, `required`, `disabled`, `checked`, `visible`, `enabled`, `selectors`.

`DiscoveryResult = { application, stats, warnings }` where `stats` includes `pagesVisited`, `pagesDiscovered`, `linksFound`, `interactiveElements`, `forms`, `crawlDurationMs`, and `warnings` uses a controlled union: `blocked_external | blocked_protocol | navigation_timeout | redirect_out_of_scope | duplicate_url | selector_validation_failed | max_pages_reached | max_depth_reached | inspect_failed`.

## Selector generation

Every discovered element carries a **ranked list of `SelectorCandidate`s**. Priority order (highest confidence first):

| Strategy | Value example                                | Confidence | Uniqueness validated |
| -------- | -------------------------------------------- | :--------: | :------------------: |
| testId   | `[data-testid="login-submit"]`               | 0.98       | yes (querySelectorAll count) |
| role     | `role=button[name="Sign In"]`                | 0.95       | no (best-effort)     |
| label    | `label=Email`                                | 0.90       | no                   |
| name     | `[name="email"]`                             | 0.85       | yes                  |
| id       | `#email`                                     | 0.85       | yes                  |
| css      | `body > form > button:nth-of-type(2)`        | 0.60       | yes                  |

Candidates are sorted by `(unique DESC, confidence DESC)` so consumers can take `element.selectors[0]` as the recommended selector. `data-testid`, `data-test-id`, and `data-test` are all treated as test IDs.

Discovery is **read-only** — it never clicks, fills, or submits. Selector validation uses in-browser `querySelectorAll` counts.

## URL normalization

`normalizeUrl(URL)`:

- lower-cases protocol and hostname
- drops fragment
- drops default ports (`:80` for http, `:443` for https)
- drops trailing slash on non-root paths
- sorts query params alphabetically (preserves values)

Ignored raw href protocols (never queued): `javascript:`, `mailto:`, `tel:`, `data:`, `blob:`, `file:`. Only `http:` and `https:` are ever crawled.

## Scope and security

`ScopeConfig = { baseUrl, sameOriginOnly, allowedHosts }`:

- With `sameOriginOnly: true` (default), only URLs whose `origin` matches `baseUrl.origin` are queued.
- `allowedHosts: ['api.example.com']` extends scope by hostname.
- Server-side redirects that land outside scope are **not followed**; the page is dropped and a `redirect_out_of_scope` warning is emitted.
- Only `http:` / `https:` URLs are queued or reported as `link.href`.

**SSRF caveats.** The engine will connect to any address the URL resolves to (private ranges, `127.0.0.1`, cloud metadata IPs). This is acceptable for local developer use; hardened SSRF filtering is deferred to a hosted-service phase.

## Crawl strategy

Breadth-first with:

- **visited set** keyed by `normalizeUrl` — prevents cycles.
- **`maxPages`** hard cap (default 25) — emits `max_pages_reached` warning when hit.
- **`maxDepth`** hop count from the start URL (default 3) — emits `max_depth_reached` warning.
- **`pageSettleMs`** small `waitForTimeout` after `domcontentloaded` (default 200 ms).

Elements per page are bounded (`maxElementsPerPage`, default 300) and the accessibility tree is capped (`accessibilityMaxNodes`, default 500) so results stay compact for downstream LLM consumption.

## SPA support (current)

Discovery follows normal `<a href>` links only. It does not intercept client-side router `pushState` calls, does not trigger button-driven navigation, and does not attempt to detect virtual routes. Phase 5 is intentionally limited to link-driven discovery — richer SPA walking is a future enhancement.

## Privacy

The model **never captures user-entered values**:

- No `input.value`, `textarea.value`, `select.value`, no `defaultValue`, no cookie/header/token data.
- Form fields carry only metadata: `name`, `type`, `label`, `placeholder`, `required`, `selectors`.
- `text` (visible textContent) is captured for buttons, links, headings — these are structural, not sensitive.

Verified by test: `packages/test-engine/src/discovery/discovery.test.ts > does NOT capture form field values`.

## Future LLM contract

The `ApplicationModel` is designed for direct LLM consumption:

- fully JSON-serializable
- no Playwright objects, no `Buffer`, no filesystem paths
- bounded (page / element / a11y-node caps)
- deterministic — same fixture → same structural output
- normalized URLs and structured selectors so the LLM can produce runnable `TestDefinition`s without inventing selectors

The LLM itself is NOT implemented in Phase 5.
