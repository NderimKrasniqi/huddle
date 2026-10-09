#!/usr/bin/env bash
# Start the Android TV emulator and open Huddle on it.
#
# Quick boot resumes from the saved snapshot (seconds, not minutes). If the
# emulator then sits at "offline", the snapshot is bad: run with --cold once,
# which boots from scratch and saves a fresh snapshot on exit.
#
# Software rendering: this Mac shows a black emulator window with host GPU.
set -euo pipefail

sdk="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
adb="$sdk/platform-tools/adb"
avd="${HUDDLE_TV_AVD:-huddle_tv}"
serial="emulator-5554"

if ! "$adb" -s "$serial" get-state >/dev/null 2>&1; then
  boot=()
  if [ "${1:-}" = "--cold" ]; then boot=(-no-snapshot-load); fi
  nohup "$sdk/emulator/emulator" -avd "$avd" -gpu swiftshader_indirect ${boot[@]+"${boot[@]}"} >/tmp/huddle-tv-emulator.log 2>&1 &
fi

"$adb" -s "$serial" wait-for-device
until [ "$("$adb" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done

# Metro (8081) and a local Convex backend (3210), when one is running.
for port in 8081 3210; do "$adb" -s "$serial" reverse "tcp:$port" "tcp:$port" >/dev/null; done
"$adb" -s "$serial" shell am start -n tv.huddle.hub/.MainActivity >/dev/null
echo "Huddle is open on the TV emulator."
