# Platform visual-parity evidence — 2026-08-12

This directory contains release-build simulator captures used by the
[current simulator audit](../../2026-08-12-current-audit.md).
It is visual evidence, not an end-to-end flow test.

## Capture environment

| Item | Value |
| --- | --- |
| Repository revision | `97190ef999127e7fcfbc37c953c037d0b5d1e572` |
| Xcode | 26.5 (`17F42`) |
| Phone | iPhone 17, iOS 26.5, 402×874 pt / 1206×2622 px |
| TV | Apple TV 4K (3rd generation, 1080p), tvOS 26.5, 1920×1080 px |
| Controller build | `Huddle.xcworkspace`, `Huddle`, Release, iPhone Simulator — succeeded |
| TV build | `Huddle.xcworkspace`, `Huddle`, Release, Apple TV Simulator, `EXPO_TV=1` — succeeded |

Both final captures came from ad-hoc-signed Release simulator builds. The first
unsigned TV launch could not read its SecureStore identity; that launch was
discarded and is not represented here. Xcode emitted upstream Expo/React
deprecation and run-script warnings but no build errors.

## Evidence handling

- Reference and current images are always fit inside separate panels with their
  aspect ratio intact. Phone references include mock-device or crop framing;
  current captures are the real device viewport. The composite therefore does
  not pretend that their outer rectangles share a coordinate system.
- Measurements described as points come from the 402×874 current phone
  viewport or from source styles. Measurements from a reference export are
  labelled approximate after normalizing to its visible inner viewport.
- The temporary room used stable synthetic participants: Ada, Gracey, and
  Linus. The room was allowed to expire. No participant tokens, credentials, or
  active room identifiers are stored in this directory.
- Trivia question, answer, and score screens were used only to reach platform
  recovery and finished states. Those module-owned screens are excluded from
  the evidence set.

## Approved-reference comparisons

### Phone

- [Join](./comparisons/phone-01-join.png)
- [Host room](./comparisons/phone-02-host-room.png)
- [Manage away player](./comparisons/phone-03-manage-player.png)
- [Game picker](./comparisons/phone-04-game-picker.png)
- [Player waiting](./comparisons/phone-05-player-waiting.png)
- [Standard settings](./comparisons/phone-06-settings-standard.png)
- [Quick settings](./comparisons/phone-07-settings-quick.png)
- [Custom settings](./comparisons/phone-08-settings-custom.png)
- [Finished player](./comparisons/phone-09-finished-player.png)
- [Finished host](./comparisons/phone-10-finished-host.png)

### TV

- [Pairing room](./comparisons/tv-01-room.png)
- [Game carousel](./comparisons/tv-02-game-carousel.png)
- [Game setup](./comparisons/tv-03-game-setup.png)

## Current-state captures without approved references

### Phone

- [Native launch frame](./raw/phone/00-launch.png)
- [App loading treatment](./raw/phone/01-join-empty.png)
- [Leave confirmation](./raw/phone/10-leave-confirmation.png)
- [Category picker](./raw/phone/15-category-picker.png)
- [Host recovery](./raw/phone/16-host-recovery.png)
- [Player recovery](./raw/phone/20-player-recovery.png)
- [TV reconnecting](./raw/phone/21-tv-recovery.png)

### TV

- [Startup frame](./raw/tv/00-startup.png)
- [Host-disconnected recovery](./raw/tv/09-host-recovery.png)
- [Player-disconnected recovery](./raw/tv/10-player-recovery.png)

## Alternate approved-screen states

- [Empty join form](./raw/phone/02-join-settled.png)
- [Code-ready join form](./raw/phone/03-join-code-ready.png)
- [Manage player, online](./raw/phone/09-manage-online.png)
- [TV room, empty](./raw/tv/02-room-signed.png)
- [TV custom setup](./raw/tv/08-game-setup-custom.png)

The deterministic composite generator is retained as
[`make-comparisons.swift`](./make-comparisons.swift). Run it from the repository
root; on a sandboxed macOS host, point `SWIFT_MODULECACHE_PATH` and
`CLANG_MODULE_CACHE_PATH` at writable temporary directories.
