#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
seed="$1"
flow="$2"
code_file="$(mktemp)"
trap 'rm -f "$code_file"; kill "$seed_pid" 2>/dev/null || true' EXIT
(cd "$root/convex" && node "$seed" "$code_file") &
seed_pid=$!
for _ in $(seq 1 30); do
  [ -s "$code_file" ] && break
  sleep 1
done
CODE="$(cat "$code_file")" "$root/tools/e2e-flow.sh" -e CODE="$(cat "$code_file")" "$root/$flow"
