#!/usr/bin/env bash
# Run Huddle for development: the TV Metro on 8081 and the phone Metro on 8082.
#
# The TV app hosts the room itself (ADR-01), so there is no backend to start.
# The iPhone simulator and the Apple TV simulator share this Mac's network; the
# Android TV emulator reaches Metro through `adb reverse`, and phones reach a
# room on the emulator through `adb forward tcp:7777 tcp:7777`.
# Ctrl-C stops both Metro servers.
#
# Set EXPO_PUBLIC_HUDDLE_RELAY_URL (for example ws://127.0.0.1:8787) to host
# and join through the relay too; the Android TV emulator then also needs
# `adb reverse tcp:8787 tcp:8787`.
#
# Pass --clear after changing environment variables: Metro inlines them at
# bundle time, and a cached bundle would keep the old values.
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
