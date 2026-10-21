#!/usr/bin/env bash
# Air cloud environment startup for Skill Atlas (Node CLI + web view, Playwright UI tests in Docker).
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ "${AIR_STARTUP_MODE:-}" = warmup ]; then WARMUP=1; else WARMUP=; fi
PLAYWRIGHT_IMAGE=mcr.microsoft.com/playwright:v1.64.1-noble

log() { echo "[startup] $*"; }

# Node's fetch only honours HTTPS_PROXY with this flag; skill-atlas and its e2e tests call the GitHub API.
export NODE_USE_ENV_PROXY=1
ENV_FILE="$HOME/.skill-atlas-env"
echo 'export NODE_USE_ENV_PROXY=1' > "$ENV_FILE"
SOURCE_LINE="[ -f \"$ENV_FILE\" ] && . \"$ENV_FILE\" # skill-atlas-env"
profile=
for f in "$HOME/.bash_profile" "$HOME/.bash_login" "$HOME/.profile"; do
  if [ -f "$f" ]; then profile=$f; break; fi
done
profile=${profile:-$HOME/.profile}
for f in "$profile" "$HOME/.bashrc"; do
  grep -qF '# skill-atlas-env' "$f" 2>/dev/null || echo "$SOURCE_LINE" >> "$f"
done

log "node $(node -v), npm $(npm -v)"
log "npm ci..."
npm ci --no-audit --no-fund
log "npm ci done"

if command -v docker >/dev/null 2>&1; then
  if docker image inspect "$PLAYWRIGHT_IMAGE" >/dev/null 2>&1; then
    log "Playwright image already present"
  elif [ -n "$WARMUP" ]; then
    log "pulling $PLAYWRIGHT_IMAGE (for npm run test:ui:docker)..."
    docker pull "$PLAYWRIGHT_IMAGE"
    log "pull done"
  else
    log "pulling $PLAYWRIGHT_IMAGE in the background (log: /tmp/playwright-pull.log)"
    nohup docker pull "$PLAYWRIGHT_IMAGE" > /tmp/playwright-pull.log 2>&1 &
  fi
else
  log "WARNING: docker not found; npm run test:ui:docker will not work"
fi

healthcheck() {
  log "healthcheck: typecheck"
  npm run typecheck
  log "healthcheck: offline tests (the e2e ones depend on live GitHub latency and are not gated here)"
  node --test $(ls tests/*.test.ts | grep -v '/e2e.test.ts$')
  log "healthcheck: CLI smoke"
  ./skill-atlas help > /dev/null
  ./skill-atlas scan ./fixture
  log "healthcheck: GitHub API reachable from node"
  until ./skill-atlas scan github.com/JetBrains/koog/tree/22e342e033c716f835312dd6cbe83193e1cbcf76 > /dev/null; do
    log "GitHub scan failed; retrying in 5s"; sleep 5
  done
  log "healthcheck: UI tests in the CI container (npm run test:ui:docker)"
  until docker info > /dev/null 2>&1; do log "waiting for the Docker daemon"; sleep 3; done
  npm run test:ui:docker
  log "healthcheck passed"
}

if [ -n "$WARMUP" ]; then healthcheck; fi
log "startup done"
