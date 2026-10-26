# Huddle implementation plan

The TV app hosts the room (ADR-01 to ADR-04 in
[`architecture.md`](architecture.md#architecture-decisions)), and Convex is
gone. The installed games are Trivia, Bomb Squad and Sumo Bumpers. The project
keeps end-to-end tests only. Earlier plans and their evidence are in the git
history.

## Open work

In order of value:

1. **Finish the physical party check.** Still to run: switching the iPhone's
   Wi-Fi off and on mid-game, an Android phone (including the release `ws://`
   setting), and a physical Apple TV.
2. **Host the relay** (deferred by the owner on 2026-10-26). Needed only for
   guest Wi-Fi that blocks devices, phones on mobile data, and web TVs. Any
   proxied host needs `HUDDLE_RELAY_MAX_PER_IP` raised, or the relay must read
   `X-Forwarded-For`, and the apps need the production
   `EXPO_PUBLIC_HUDDLE_RELAY_URL` over `wss://`.
3. **Web TVs (Samsung Tizen, LG webOS).** Load CanvasKit so Skia art draws on
   the web, mark the TV away when the page is hidden, and test on real TV
   browsers.

### Release gates

- [x] Every e2e flow passes on the LAN host and through the relay.
- [~] The physical party check runs on a real Android TV with mixed phones,
  including a guest network that blocks traffic between devices. Done on an
  Android TV with an iPhone; open items are listed above.
- [x] Independent review of the room host against the retired Convex rules.

## Local-first plan (complete)

The approved scope changes are in
[`project-scope.md`](project-scope.md#rooms-hosted-by-the-tv). Task
dependencies are in `.workflow/tasks.json`.

| Task | Result |
| --- | --- |
| TASK-01 | ADR-01 to ADR-04 and the scope changes approved |
| TASK-02 to TASK-04 | LAN server and discovery spikes on Android TV and Apple TV (spike code since removed) |
| TASK-05 | Versioned Room Protocol in `@huddle/contracts/protocol` |
| TASK-06 | Room host package, `packages/room-host` |
| TASK-07 | Headless TV and protocol bots, `tools/headless-tv` |
| TASK-08 | Room host and web-TV boundaries enforced by `tools/validate-architecture.py` |
| TASK-09, TASK-10 | Phone and TV behind room-client interfaces |
| TASK-11, TASK-16 | LAN server module on Android TV and Apple TV |
| TASK-12 | Room host running inside the TV app |
| TASK-13, TASK-14 | Phone LAN client and the connection problem states |
| TASK-15, TASK-17 | All three games played to the finish on Android TV and Apple TV |
| TASK-18 | Convex removed |
| TASK-19 | Architecture docs made current |
| TASK-20 to TASK-22 | Rust relay, relay transport and fallback, load check and container image |
| TASK-23 | Web TV build smoke-tested in Chromium |

## Validation ledger

Most recent first.

### Physical party check (Android TV and iPhone)

Release builds on home Wi-Fi with no relay: the TV app (`armeabi-v7a` APK) on
a Philips 75PUS8506 running Android 11, installed over `adb` on Wi-Fi, and the
phone app on an iPhone XS Max. The owner ran the checklist and every step
passed: the TV invitation with no remote focus, the Local Network prompt,
joining by QR code and by typed code, Trivia alone, Bomb Squad and Sumo
Bumpers with bots joined from the Mac, locking the phone mid-game, the TV's
Home button and a force-close and reopen (same room, players and Host), Local
Network turned off, leaving, the largest text size and Reduce Motion.

### Room host review and follow-ups

An independent reviewer compared `packages/room-host` with the Convex rules
as they were before TASK-18. Rate-limit numbers, join checks, Host
succession, readiness, the countdown, the game runtime and redaction matched.
Fixed: a TV restart or return from the background marked every seat away and
moved the Host; a phone could send its own `msRemaining`; a second
`joinRoom` on one connection left an orphan seat; idle unseated connections
could fill the 32-connection cap; every ping flushed every view; refused
commands spent rate-limit tokens; out-of-range arguments closed the socket;
hidden join screens kept asking for availability. Android release phones
now allow `ws://` through `apps/phone/plugins/with-lan-cleartext.js`. Kept on
purpose: the room code in `welcome`, which the TV already announces through
Bonjour. Each fix was checked with a fake-clock script against `RoomHost`
and all six e2e flows.

### Relay (TASK-20 to TASK-22)

`relay/huddle-relay` (tokio, axum, tracing) forwards frames unread and
enforces frame size, rooms, phones per room, connections per IP, rates and
idle timeouts. `hostThroughRelay` in `@huddle/room-host` hosts through it;
the phone tries the TV's addresses, then the relay, and looks up a typed
code on the relay when Bonjour finds nothing. All six e2e flows pass
relay-only. Load check with `relay/huddle-relay-load`, 1,000 rooms of ten
phones, about 10,000 frames a second each way, zero failures:

| Run | Peak memory | phone → TV p95 | TV → phone p95 |
| --- | ---: | ---: | ---: |
| Native release build | 165 MB | 1.97 ms | 1.22 ms |
| Container, 1 CPU and 512 MB | 186 MiB | 5.77 ms | 16.88 ms |

The first run used 1.5 GB because each socket kept axum's 128 KiB read
buffer; the relay now uses 4 KiB.

### Web TV smoke test (TASK-23)

A web export of the TV app (`pnpm --filter @huddle/tv export:web`) ran at
1920×1080 in Chromium, hosted through the relay, played Trivia with the
iPhone simulator, and restored a running game after a reload. Gaps for a
Tizen or webOS shell: Skia needs CanvasKit (stubbed on the web, so Bomb Squad
and Sumo lose their TV art), storage is `localStorage`, networking is
relay-only, and `crypto.randomUUID` needs a secure context.

### TV-hosted rooms on simulators (TASK-11 to TASK-18)

All three games played to the finish with nine bots and a guest iPhone on
the Android TV emulator (Trivia 119 s, Bomb Squad 263 s, Sumo 150 s) and the
Apple TV simulator (110, 261 and 157 s). The Maestro flows were ported to the
headless TV, and Convex was removed with its seeds, env files and
dependencies.

## Non-negotiable constraints

- Do not change session-token authority (a token proves exactly one seat),
  room lifecycle, stable avatar IDs, or the `GameModule` seam.
- The TV screen remains display-only and the Phone remains the controller.
  The TV app hosts the room but never gains controls or focus targets.
- Do not add Invite Friend, a phone web client or fake settings. A web build
  of the TV app exists only as the TASK-23 smoke test.
- Keep private player choices, timing and unrevealed game content off the TV
  screen and out of other players' Phone projections.
- Any change an older phone or TV would misread bumps `PROTOCOL_VERSION`.
