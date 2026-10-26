#!/usr/bin/env bash
set -euo pipefail

clear_flag=""
if [ "${1:-}" = "--clear" ]; then clear_flag="--clear"; fi

root="$(cd "$(dirname "$0")/.." && pwd)"
pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

adb="$(command -v adb || echo "${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb")"
if [ -x "$adb" ]; then "$adb" reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true; fi

(cd "$root/apps/tv" && npx expo start --port 8081 --dev-client $clear_flag) &
pids+=($!)
(cd "$root/apps/phone" && npx expo start --port 8082 --dev-client $clear_flag) &
pids+=($!)

echo "Huddle Metro servers are running (TV 8081, phone 8082). Press Ctrl-C to stop."
wait
