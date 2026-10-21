#!/usr/bin/env bash
# Air cloud environment startup for Skill Atlas.
# warmup (snapshot-baking) run: install everything, start the web view and block on healthcheck.
# task run: refresh dependencies, start the web view in the background and return promptly.
set -euo pipefail

if [ "${AIR_STARTUP_MODE:-}" = warmup ]; then WARMUP=1; else WARMUP=; fi

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_DIR"

PLAYWRIGHT_IMAGE="mcr.microsoft.com/playwright:v1.64.1-noble"
SERVE_PORT=4317    # ./skill-atlas serve, bound to 127.0.0.1 only
PUBLIC_PORT=3000   # exposed by the environment; forwarded to SERVE_PORT
LOG_DIR=/tmp/skill-atlas
mkdir -p "$LOG_DIR"

log() { echo "[startup] $*"; }

# Node's fetch honours HTTPS_PROXY only with NODE_USE_ENV_PROXY=1 (also set in the EnvConfig).
export NODE_USE_ENV_PROXY=1
ENV_FILE="$HOME/.skill-atlas-env.sh"
echo 'export NODE_USE_ENV_PROXY=1' > "$ENV_FILE"
MARKER='# skill-atlas-env'
PROFILE=
for f in "$HOME/.bash_profile" "$HOME/.bash_login" "$HOME/.profile"; do
  if [ -f "$f" ]; then PROFILE="$f"; break; fi
done
[ -n "$PROFILE" ] || PROFILE="$HOME/.profile"
for f in "$PROFILE" "$HOME/.bashrc"; do
  grep -qF "$MARKER" "$f" 2>/dev/null || echo "[ -f \"$ENV_FILE\" ] && . \"$ENV_FILE\" $MARKER" >> "$f"
done

log "node $(node -v), npm $(npm -v)"
log "npm ci ..."
npm ci --prefer-offline --no-audit --no-fund
log "npm ci done"

# The UI tests (npm run test:ui:docker) run in this image; pull it into the snapshot.
pull_image() {
  if docker image inspect "$PLAYWRIGHT_IMAGE" >/dev/null 2>&1; then
    log "docker image $PLAYWRIGHT_IMAGE already present"
  else
    log "pulling $PLAYWRIGHT_IMAGE ..."
    docker pull --platform linux/amd64 "$PLAYWRIGHT_IMAGE"
    log "pull done"
  fi
}
if [ -n "$WARMUP" ]; then
  pull_image
else
  pull_image > "$LOG_DIR/docker-pull.log" 2>&1 &
fi

# The web view: ./skill-atlas serve on 127.0.0.1, plus a TCP forwarder on 0.0.0.0 for the exposed port.
if ! pgrep -f "src/cli.ts serve" >/dev/null; then
  log "starting ./skill-atlas serve on 127.0.0.1:$SERVE_PORT (log: $LOG_DIR/serve.log)"
  nohup ./skill-atlas serve --port "$SERVE_PORT" > "$LOG_DIR/serve.log" 2>&1 < /dev/null &
fi
if ! pgrep -f "skill-atlas-forward" >/dev/null; then
  log "forwarding 0.0.0.0:$PUBLIC_PORT -> 127.0.0.1:$SERVE_PORT (log: $LOG_DIR/forward.log)"
  nohup node -e '
    // skill-atlas-forward
    const net = require("net");
    const [publicPort, target] = process.argv.slice(1).map(Number);
    net.createServer((client) => {
      const upstream = net.connect(target, "127.0.0.1");
      client.pipe(upstream).pipe(client);
      client.on("error", () => upstream.destroy());
      upstream.on("error", () => client.destroy());
    }).listen(publicPort, "0.0.0.0");
  ' skill-atlas-forward "$PUBLIC_PORT" "$SERVE_PORT" > "$LOG_DIR/forward.log" 2>&1 < /dev/null &
fi

healthcheck() {
  log "healthcheck: typecheck"
  npm run typecheck
  log "healthcheck: CLI smoke on ./fixture"
  ./skill-atlas help > /dev/null
  ./skill-atlas scan ./fixture
  log "healthcheck: Playwright image runs"
  docker run --rm --platform linux/amd64 "$PLAYWRIGHT_IMAGE" node -v
  log "healthcheck: waiting for the web view on :$PUBLIC_PORT"
  local n=0
  until curl -fsS --noproxy '*' -H "Host: skill-atlas.example" "http://127.0.0.1:$PUBLIC_PORT/" -o "$LOG_DIR/index.html" 2>/dev/null; do
    n=$((n + 1))
    if [ $((n % 10)) -eq 0 ]; then log "still waiting for the web view ($n s); serve.log:"; tail -5 "$LOG_DIR/serve.log" || true; fi
    sleep 1
  done
  if ! grep -q "<title>Skill Atlas</title>" "$LOG_DIR/index.html"; then
    log "healthcheck FAILED: the web view did not return the Skill Atlas page"
    head -c 500 "$LOG_DIR/index.html"
    return 1
  fi
  log "healthcheck passed: web view serves on :$PUBLIC_PORT"
}

if [ -n "$WARMUP" ]; then healthcheck; fi
log "done"
