# Physical party check — 2026-08-13

This is the dated manual record for `PLAT-001`, `PLAT-002`, and `REL-003`.
All live-backend observations used the Convex development deployment only:

- Deployment: `colorful-viper-224` (`dev/nderim-krasniqi`)
- Runtime URL: `https://colorful-viper-224.convex.cloud`
- Production targeting: none; no production deployment, reset, or production
  data was used.
- TV test room: code `VNSU` (freshly opened during this check)

## Runtime repair before the physical check

The first Phone build exited immediately on both simulator and physical iPhone
with a dyld error: `ExpoImage` referenced
`ExpoModulesCore.BaseModule.willDestroy`, which the bundled Expo Modules Core
did not export. This was an Expo SDK 57 patch-version mismatch, not a macOS or
iPhone compatibility failure.

Expo's compatibility check prescribed the SDK 57 patch alignment. Phone and TV
now use `expo`/`expo-router` `~57.0.12`, `expo-modules-core` resolves to
`57.0.10`, and their other prescribed Expo patch updates. A clean signed
physical arm64 build was installed as `tv.huddle.phone`; the launch console
then stayed alive without the dyld error. The only remaining console messages
were iOS background-mode warnings. After the same alignment, the Android TV
release artifact also completed with `BUILD SUCCESSFUL`.

## Device and deployment setup

| Surface | Device / identity | Result |
| --- | --- | --- |
| Phone | wired, paired iPhone XS Max, iOS 18.7.9, UDID `00008020-001B79810128002E`, `tv.huddle.phone` | installed, signed Team `SMEM2NZ9Y8`, process remained alive |
| TV | Android TV AVD `huddle_tv`, `emulator-5554`, package `tv.huddle.hub` | lobby rendered; QR and room code visible |
| Android Phone | no physical Android phone or phone-form-factor emulator connected | unavailable |
| TV remote | Android TV emulator DPAD only | emulator observation; physical remote still required |

## Manual gates

| Gate | Observation | Status |
| --- | --- | --- |
| Remove old Phone app / install new identity | `tv.huddle.phone` installed alongside the existing `tv.huddle.controller`; no app data was erased | passed |
| Physical QR scan | iPhone camera read the TV QR for room `VNSU`; the development audit changed from zero memberships to one | passed |
| Phone join | TV roster showed `Nderim` and `HOST`; development audit reported `rooms: 1`, `memberships: 1`, `tvSessions: 1`, `games: 0` | passed for one physical Phone |
| Mixed iOS + Android phones | second physical Android Phone is not connected | blocked |
| Ready every seat / Start and End both modules | requires the second phone and live interaction on both seats | blocked |
| Reconnect / away recovery | requires a second phone and a controlled disconnect during a live game | blocked |
| Android TV focus with a physical remote | DPAD hierarchy on the AVD had no accidental focusable Huddle controls; no physical remote was available | partial; emulator-only |

Local ignored captures from this run include the TV lobby before joining, the
fresh `VNSU` QR, and the joined roster. They remain outside Git because they
are generated device captures; this Markdown record is the durable evidence.

## Gate decision

The real-camera QR and one-seat physical join pass on the development
deployment. `REL-003` is not complete: mixed-phone lifecycle, reconnect, and
physical Android TV remote focus remain blocked until a second Android phone
and a physical TV remote are available.
