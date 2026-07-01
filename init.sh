#!/usr/bin/env bash
#
# Standard startup + baseline verification path for Concord.
# Installs both packages, generates the Prisma client, and runs a behavioral
# smoke check (there is no unit test suite yet — see AGENTS.md).
#
# Usage:
#   ./init.sh                    # install, generate, smoke check
#   RUN_START_COMMAND=1 ./init.sh  # also launch both dev servers afterwards

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

FRONTEND_URL="http://localhost:3000"
AUTH_URL="http://localhost:3001/auth/"

echo "==> Working directory: $PWD"

# ---------------------------------------------------------------------------
# 1. Install dependencies (two packages: root + server)
# ---------------------------------------------------------------------------
echo "==> Installing root dependencies"
npm install

echo "==> Installing server dependencies"
npm install --prefix server

# ---------------------------------------------------------------------------
# 2. Generate the Prisma client (output -> app/generated/prisma)
# ---------------------------------------------------------------------------
echo "==> Generating Prisma client"
npx prisma generate

# Best-effort Postgres reachability check (non-fatal: the smoke endpoints below
# do not touch the DB, but a broken DB will block auth-002+).
if npx prisma db execute --stdin <<<"SELECT 1;" >/dev/null 2>&1; then
  echo "    Postgres reachable."
else
  echo "    WARNING: could not confirm Postgres is reachable (DATABASE_URL in .env)."
fi

# ---------------------------------------------------------------------------
# 3. Baseline smoke check: boot both servers, assert endpoints, tear down
# ---------------------------------------------------------------------------
SERVER_PID=""
FRONTEND_PID=""

# Kill a process group leader and all its children. `npm run ...` spawns child
# processes (tsx / next-server) that hold the ports, so killing the npm wrapper
# alone is not enough — we start each server via `setsid` (own process group)
# and kill the whole group with a negative PID.
kill_tree() {
  local pid="$1"
  [ -n "$pid" ] || return 0
  kill -TERM -- "-$pid" >/dev/null 2>&1 || kill -TERM "$pid" >/dev/null 2>&1 || true
}

cleanup() {
  kill_tree "$FRONTEND_PID"
  kill_tree "$SERVER_PID"
}
trap cleanup EXIT

wait_for() {
  # wait_for <url> <max_seconds>
  local url="$1" max="$2" i=0
  until curl -s -o /dev/null "$url"; do
    i=$((i + 1))
    if [ "$i" -ge "$max" ]; then
      return 1
    fi
    sleep 1
  done
}

echo "==> Running baseline smoke check"

echo "    Starting Express server (port 3001)"
setsid bash -c 'cd server && npm start' >/tmp/concord-server.log 2>&1 &
SERVER_PID=$!

echo "    Starting Next dev server (port 3000)"
setsid npm run dev >/tmp/concord-frontend.log 2>&1 &
FRONTEND_PID=$!

# Check 1: /auth/ returns 302 -> Notion authorize
if ! wait_for "$AUTH_URL" 30; then
  echo "    FAIL: server did not come up on 3001 (see /tmp/concord-server.log)"
  exit 1
fi
AUTH_RESP=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$AUTH_URL")
echo "    /auth/ -> $AUTH_RESP"
case "$AUTH_RESP" in
  302*api.notion.com/v1/oauth/authorize*)
    echo "    PASS: /auth/ redirects to Notion authorize" ;;
  *)
    echo "    FAIL: expected 302 to api.notion.com/v1/oauth/authorize"
    exit 1 ;;
esac

# Check 2: frontend / returns 200
if ! wait_for "$FRONTEND_URL" 60; then
  echo "    FAIL: frontend did not come up on 3000 (see /tmp/concord-frontend.log)"
  exit 1
fi
FRONT_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$FRONTEND_URL")
echo "    / -> $FRONT_CODE"
if [ "$FRONT_CODE" = "200" ]; then
  echo "    PASS: login page renders (200)"
else
  echo "    FAIL: expected 200 from $FRONTEND_URL"
  exit 1
fi

echo "==> Baseline smoke check PASSED"

# Smoke check done; drop the servers to leave a clean state.
cleanup
trap - EXIT
SERVER_PID=""
FRONTEND_PID=""

# ---------------------------------------------------------------------------
# 4. Startup commands (for actually working on the app)
# ---------------------------------------------------------------------------
echo "==> To run the app:"
echo "    Frontend:  npm run dev            # http://localhost:3000"
echo "    Backend:   npm start --prefix server  # http://localhost:3001"

if [ "${RUN_START_COMMAND:-0}" = "1" ]; then
  echo "==> Launching both dev servers (Ctrl-C to stop)"
  npm start --prefix server &
  exec npm run dev
fi
