#!/usr/bin/env bash
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

"$adb" -s "$serial" reverse tcp:8081 tcp:8081 >/dev/null
"$adb" -s "$serial" shell am start -n tv.huddle.hub/.MainActivity >/dev/null
echo "Huddle is open on the TV emulator."
