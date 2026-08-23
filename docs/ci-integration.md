# CI integration

AI Bug Hunter exposes a token-scoped CI surface that triggers a regression
campaign, waits for it to complete, and returns a machine-readable summary
with a deterministic exit code.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/ci/regression` | Create + start a regression campaign |
| `GET`  | `/api/ci/regression/:id/result` | Poll for completion |

Both endpoints require a `Bearer` token via `Authorization` header. Tokens are
minted at `POST /api/ci/tokens` (admin only) and shown exactly once.

### Request body — `POST /api/ci/regression`

```json
{
  "applicationId": "<uuid>",
  "strategy": "risk_based",
  "maxTests": 25,
  "waitForCompletion": false
}
```

`strategy` is one of `all_enabled`, `risk_based`, `changed_area`,
`bug_targeted`, `smoke`.

### Result payload

```json
{
  "campaignId": "…",
  "status": "passed | failed | error | cancelled | running",
  "quality": "healthy | degraded | failed | inconclusive | null",
  "passed": 12,
  "failed": 0,
  "errors": 0,
  "regressions": 0,
  "flakyTests": 0,
  "totalTests": 12,
  "exitCode": 0
}
```

## Exit code table

| Exit code | Meaning |
| --- | --- |
| `0` | `quality = healthy` |
| `CI_DEGRADED_EXIT_CODE` (default `0`) | `quality = degraded` (set to `1` to block PRs) |
| `1` | `quality = failed` |
| `2` | `quality = inconclusive`, timeout, network error |

## CLI

Install the bundled CLI at `packages/ci-cli` and invoke:

```bash
export AI_BUG_HUNTER_URL="https://bughunter.example.com"
export AI_BUG_HUNTER_CI_TOKEN="$CI_TOKEN"

# Start + wait
ai-bug-hunter-ci regression \
  --application 11111111-1111-1111-1111-111111111111 \
  --strategy risk_based \
  --wait

# Or poll an existing campaign
ai-bug-hunter-ci regression <campaignId>
```

The CLI redacts the token from every error message and never prints it to
stdout.

## GitHub Actions

```yaml
name: Regression gate
on: [pull_request]
jobs:
  bughunter:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger AI Bug Hunter regression
        env:
          AI_BUG_HUNTER_URL: ${{ secrets.AI_BUG_HUNTER_URL }}
          AI_BUG_HUNTER_CI_TOKEN: ${{ secrets.AI_BUG_HUNTER_CI_TOKEN }}
        run: |
          set -euo pipefail
          RESP=$(curl -sSf -X POST "$AI_BUG_HUNTER_URL/api/ci/regression" \
            -H "Authorization: Bearer $AI_BUG_HUNTER_CI_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"strategy":"risk_based","waitForCompletion":true}')
          echo "$RESP" | jq .
          EXIT=$(echo "$RESP" | jq -r '.exitCode')
          exit "$EXIT"
```

## GitLab CI

```yaml
bughunter:
  stage: test
  image: curlimages/curl:latest
  script:
    - |
      RESP=$(curl -sSf -X POST "$AI_BUG_HUNTER_URL/api/ci/regression" \
        -H "Authorization: Bearer $AI_BUG_HUNTER_CI_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"strategy":"risk_based","waitForCompletion":true}')
      echo "$RESP"
      EXIT=$(echo "$RESP" | sed -n 's/.*"exitCode":\([0-9]*\).*/\1/p')
      exit "$EXIT"
```

## Jenkins (declarative)

```groovy
pipeline {
  agent any
  environment {
    AI_BUG_HUNTER_URL = credentials('bughunter-url')
    AI_BUG_HUNTER_CI_TOKEN = credentials('bughunter-token')
  }
  stages {
    stage('Regression') {
      steps {
        sh '''
          set -e
          RESP=$(curl -sSf -X POST "$AI_BUG_HUNTER_URL/api/ci/regression" \
            -H "Authorization: Bearer $AI_BUG_HUNTER_CI_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"strategy":"risk_based","waitForCompletion":true}')
          echo "$RESP"
          EXIT=$(echo "$RESP" | python3 -c "import sys, json; print(json.load(sys.stdin)['exitCode'])")
          exit $EXIT
        '''
      }
    }
  }
}
```

## Security notes

- Store the token as a CI secret. Never echo it or write it to logs.
- Rotate tokens periodically. Revoke with `DELETE /api/ci/tokens/:id`.
- Bind tokens to a specific application ID when possible; the API rejects
  cross-application use.
- Prefer short polling intervals (5–10s) and a bounded overall timeout in your
  pipeline configuration.
