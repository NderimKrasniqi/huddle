#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
device="${DEVICE:-$(xcrun simctl list devices booted | grep -m1 -oE '\(([0-9A-F-]{36})\)' | tr -d '()')}"
maestro --device "$device" test "$@"
