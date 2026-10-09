#!/usr/bin/env bash
# Run Huddle against a local Convex backend. Functions run on this Mac, so
# development and bot tests do not count against the cloud plan.
#
# The iPhone simulator reaches the backend at 127.0.0.1, and the Android TV
# emulator reaches it through `adb reverse`. Real devices cannot reach it: they
# keep the cloud dev deployment in apps/*/.env, which this script leaves alone.
# Ctrl-C stops the backend and both Metro servers.
#
# Pass --clear after switching between this and the cloud backend: the backend
# URL is built into the bundle, and a cached bundle would keep the old one.
set -euo pipefail

clear_flag=""
if [ "${1:-}" = "--clear" ]; then clear_flag="--clear"; fi

root="$(cd "$(dirname "$0")/.." && pwd)"
config="$root/convex/.convex/local/default/config.json"
if [ ! -f "$config" ]; then
  (cd "$root/convex" && pnpm exec convex deployment create local)
fi
name="$(node -p "require('$config').deploymentName")"
port="$(node -p "require('$config').ports.cloud")"
url="http://127.0.0.1:$port"

# `convex dev` rewrites convex/.env.local to the deployment it runs. Put the
# cloud selection back on the way out, so later deploys still go to the cloud.
env_file="$root/convex/.env.local"
backup="$(mktemp)"
cp "$env_file" "$backup"
pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  cp "$backup" "$env_file"
  rm -f "$backup"
}
trap cleanup EXIT INT TERM

(cd "$root/convex" && CONVEX_DEPLOYMENT="local:$name" pnpm exec convex dev) &
pids+=($!)
until curl -sf "$url/version" >/dev/null; do sleep 1; done

adb="$(command -v adb || echo "${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb")"
if [ -x "$adb" ]; then "$adb" reverse "tcp:$port" "tcp:$port" >/dev/null 2>&1 || true; fi

(cd "$root/apps/tv" && EXPO_PUBLIC_CONVEX_URL="$url" npx expo start --port 8081 --dev-client $clear_flag) &
pids+=($!)
(cd "$root/apps/phone" && EXPO_PUBLIC_CONVEX_URL="$url" npx expo start --port 8082 --dev-client $clear_flag) &
pids+=($!)

echo "Huddle is using the local backend at $url. Press Ctrl-C to stop."
wait
