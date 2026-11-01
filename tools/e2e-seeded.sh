#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
seed="$1"
flow="$2"
code_file="$(mktemp)"
trap 'rm -f "$code_file"; kill "$seed_pid" 2>/dev/null || true' EXIT
(cd "$root" && exec node --import tsx "$root/$seed" "$code_file") &
seed_pid=$!
for _ in $(seq 1 30); do
  [ -s "$code_file" ] && break
  sleep 1
done
code="$(sed -n 1p "$code_file")"
code2="$(sed -n 2p "$code_file")"
CODE="$code" "$root/tools/e2e-flow.sh" -e CODE="$code" -e CODE2="$code2" "$root/$flow"
