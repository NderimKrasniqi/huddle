#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
code_file="$(mktemp)"
trap 'rm -f "$code_file"; kill "$seed" 2>/dev/null || true' EXIT
(cd "$root/convex" && node e2e/seed-bomb-room.mjs "$code_file") &
seed=$!
for _ in $(seq 1 30); do
  [ -s "$code_file" ] && break
  sleep 1
done
code="$(cat "$code_file")"
device="${DEVICE:-$(xcrun simctl list devices booted | grep -m1 -oE '\(([0-9A-F-]{36})\)' | tr -d '()')}"
maestro --device "$device" test -e CODE="$code" "$root/e2e/bomb-squad-start.yaml"
