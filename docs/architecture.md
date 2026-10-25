# Huddle architecture

The TV app hosts the room (ADR-01). Phones connect to it over Wi-Fi and speak
the versioned Room Protocol; there is no backend. Technology versions live in
[`tech-stack.md`](tech-stack.md); product behavior lives in
[`project-scope.md`](project-scope.md).

## System architecture

```text
Phone app ── Room Protocol over WebSocket ──┐
  LAN room client, lan-discovery module      │
                                             ▼
                     ┌──────────────────────── TV app ────────────────────────┐
                     │ Shell: LAN server module (Kotlin / Network.framework),  │
                     │   advertising, snapshot file, background/foreground     │
                     │ @huddle/room-host: seats, Host, presence, setup,        │
                     │   countdown, game runtime, rate limits, redaction       │
                     │   → @huddle/game-registry/logic → each game's rules     │
                     │ TV screens: read the host's shared views in-process     │
                     └─────────────────────────────────────────────────────────┘
Optional: relay/ (Rust) forwards frames between phones and a TV they cannot
reach directly, or a TV that cannot listen, such as a web TV (ADR-03, ADR-04).
```

### Workspace and dependency direction

```text
apps/phone ─┬─> @huddle/game-registry ─> games/{trivia,bomb-squad,sumo-bumpers}
apps/tv ────┤                              └─> @huddle/physics (Sumo Bumpers)
            ├─> @huddle/ui ─> @huddle/design-tokens
            ├─> @huddle/domain ─> @huddle/contracts
            └─> @huddle/room-host (TV only) ─> @huddle/game-registry/logic, @huddle/domain
tools/headless-tv ─> @huddle/room-host (the TV's room host under Node)
```

- `@huddle/contracts` owns wire-safe types, module interfaces, stable avatar
  IDs, rejection unions, and the Room Protocol (`@huddle/contracts/protocol`,
  zod). The main entry has no dependencies.
- `@huddle/domain` owns pure room, presence, joining, settings, lifecycle,
  readiness, room-code, join-link and session-token rules.
- `@huddle/room-host` is the room's authority (see below). It may import only
  contracts, domain, the registry's `./logic` entry and zod, and no Node-only
  global; `tools/validate-architecture.py` enforces both.
- `@huddle/game-registry` owns the ordered catalog (Trivia, Bomb Squad, Sumo
  Bumpers) and the separate rules-only `./logic` entry, which never imports a
  screen.
- Each game owns its metadata, settings, content, state, deadlines, events,
  redaction and its Phone and TV screens, with its own palette, art and
  `Animated` motion (never Reanimated). Trivia keeps its Cosmic Quiz look in
  `games/trivia/src/cosmic.tsx`; Bomb Squad and Sumo Bumpers draw TV art with
  Skia, which the phone build aliases to a stub. `@huddle/physics` is the
  deterministic disc simulation Sumo Bumpers runs in its rules and replays on
  the TV.
- `@huddle/design-tokens` and `@huddle/ui/native` own the Playroom platform
  look. `@huddle/ui/game-kit` is the only UI entry a game may import.
- `apps/phone` owns routes, the session provider, scan and join, presence, the
  room client and the controller screens. `apps/tv` owns the shell, room
  opening and restoration, and the passive TV stage. The TV screen never owns
  controls or focus.

### Room host

`@huddle/room-host` holds seats, the Host pointer, presence and away, join
previews, setup, readiness, the five-second countdown, the game runtime and
deadlines, rate limits and per-viewer redaction. Its caller passes the clock,
timers, a cryptographic random source and a `save` function, so the same code
runs in the TV app and under Node (`pnpm headless-tv`, the e2e seeds).

- Precise timers drive the countdown and game deadlines. A one-second sweep
  marks silent phones away, drops join previews older than 20 seconds, and
  ends a room whose TV has been away for ten minutes; any frame from a seated
  phone counts as its beat.
- After every change the host pushes each phone only the views that changed
  and saves a JSON snapshot. A restarted TV app restores a snapshot younger
  than ten minutes; a running beat keeps the time it had left.
- Games are not told who the Host is: the host stamps `fromHost` and the
  acting `playerId` on events itself.

### Room Protocol and transport

A connection opens with `hello`/`welcome` (protocol version, TV instance id,
room code); a different version gets `incompatible` and the phone shows
"Update Huddle". The connection is anonymous until `joinRoom` or
`resumeSession` binds it to one seat, so later commands carry no Session
Token. Results carry the room's rejection unions; views are pushed
(`session`, `roster`, `setup`, `browsing`, `running`, `connection`, and
`arrivals` for the TV alone). Clocks travel as milliseconds remaining. Frames
are capped at 256 KB. Bump `PROTOCOL_VERSION` for any change an older peer
would misread.

The TV's LAN server is a local Expo module (`apps/tv/modules/lan-server`):
Java-WebSocket on Android TV, `NWListener` with `NWProtocolWebSocket` on Apple
TV. `start` falls back to a free port when 7777 is taken. The shell marks the
TV away and stops the server when the app leaves the foreground (Apple TV
suspends it within seconds), and restarts and re-advertises it on return.

### Relay transport

`hostThroughRelay` in `@huddle/room-host` hosts the room through the relay
over one outgoing WebSocket; the shell passes the socket factory, so the same
code runs in the TV app, the headless TV and a future web shell. The TV
registers its code with a secret it keeps (the same secret reclaims the code
after a restart), and each phone the relay opens is a room-host connection
like a LAN one. Codes are minted on the TV, so the relay may have one taken:
an empty room then takes a fresh code; a room with players stays LAN-only.
The TV app turns the relay on with `EXPO_PUBLIC_HUDDLE_RELAY_URL` and stops it
with the LAN server in the background.

### Discovery and the phone client

The TV advertises `Huddle-<code>` as `_huddle._tcp` with TXT entries `code`,
`port` and `hosts` (IPv4, home-network ranges first). Its QR code carries the
same, plus the relay URL while the relay holds the code:
`huddle://join/CODE?hosts=…&port=…&tv=…&relay=…`, built and parsed by
`roomJoinLink` and `parseRoomJoinLink` in `@huddle/domain`. A typed code is
resolved by `apps/phone/modules/lan-discovery` (Bonjour on iOS, `NsdManager`
on Android) from the TXT addresses; a resolved Bonjour endpoint is not used,
because it is often IPv6 link-local. A code Bonjour does not find, or any code
when Local Network access is off, is looked up on the relay
(`EXPO_PUBLIC_HUDDLE_RELAY_URL`); the relay's 4404 means no such room.

The phone's room client tries the TV's addresses in order, then the relay, keeps one link
per TV, and files a seated link under the TV instance id so a new TV at the
same address gets a fresh link. A seated link reconnects with backoff and
resumes by token; the TV's address is saved with the Session Token, so a
relaunched phone finds its TV, and a saved seat whose TV is gone fails
quietly. Leaving always succeeds for the player. Problems reaching the TV
surface as the Local Network, "Can't reach the TV" and "Update Huddle" states.

## Platform and module lifecycle

```text
Phone: restore → room code/scan → identity → lobby → picker → setup → ready → countdown
TV:    boot/restore → invitation → picker → art reveal → setup → ready → countdown
Both:  start → module-owned runtime → pause/recovery/finish → Back to lobby
```

The Host's Start begins the countdown; the host re-checks every start
condition when it ends, and anything that breaks readiness returns the room
to the ready check. Starting the game is the hard handoff: before it Huddle
owns browsing, setup, Host management, roster, presence and readiness; after
it the module owns the loop and supplies a private Phone projection per seat
and a shared TV projection. The platform never branches on a game's rules;
another game is a module and a registry entry.

## Authority and privacy

- The TV's room host is authoritative for seats, the Host, readiness, time and
  game state. There is one clock, the TV's.
- The host mints room codes and Session Tokens from a cryptographic source. A
  token proves exactly one seat; `guestId` is non-secret continuity metadata.
  `joinAvailability` reports only capacity and claimed avatars.
- Redaction is each game's `redactStateFor`, run by the host before a view is
  sent. The TV process holds every secret; its screen shows only room-safe
  information:

| Surface | Allowed | Withheld |
| --- | --- | --- |
| TV stage | shared prompt, timer, participation, aggregate tally, reveal, recap, standings | raw player-to-choice mapping, private controls, hidden or future content |
| Player Phone | that player's choices, lock state, own result once revealed, shared standings, feedback | other players' choices and timing, the answer key, pre-reveal correctness, future prompts |

- LAN frames are plain `ws://`: tokens protect seats against mistakes, not a
  hostile network. Relay traffic will use `wss://`.
- Join previews show an arriving seat on the TV only. They are never a seat or
  a reservation, and never outnumber the free seats.

## Portability rules for web TVs

Samsung (Tizen) and LG (webOS) run TV apps as web apps that cannot accept
incoming connections, so they need the relay and a web build of the TV app.
The web build exists as a smoke test (TASK-23): `.web.ts` files in
`apps/tv/src/platform` swap the LAN server, file snapshot and Keychain for
relay-only hosting and `localStorage`, and Skia is stubbed on the web until a
shell loads CanvasKit. Every change keeps these rules; the validator enforces
the first three:

- The room host and shared TV code (everything in `apps/tv/src` outside
  `platform`, and each game's TV screen) import no native-only module.
- Shared TV code reaches storage and networking only through the platform
  layer.
- Skia appears only inside game packages, behind an alias.
- The TV stays display-only; no flow depends on a remote.
- Shells talk to the room host only through messages the relay could carry
  (a review rule).

## Presentation, assets and motion

All copy, controls, codes, QR output and accessibility roles are native;
raster art is decorative and text-free. The phone scan route is the only
`CameraView`, and TV Room Invitation is the only QR renderer. TV surfaces
render no buttons, pressables, inputs or focus targets. Platform motion uses
Reanimated in both apps and `@huddle/ui`: presses 100 ms, transitions 180 ms,
entrances 240 ms with at most 12 units of travel; reduced motion drops scale
and travel. Nunito loads before the splash hides. TV layouts use a 1920×1080
stage with a 5% overscan-safe frame; phone layouts use Safe Area insets and a
scrollable single column. The visual reference is
[`design/playroom/README.md`](design/playroom/README.md); runtime artwork is
pinned by file name, size, alpha and SHA-256 in
`tools/validate-architecture.py`.

## Verification gates

```sh
pnpm typecheck
pnpm lint
pnpm validate:architecture
pnpm validate:workflow
pnpm verify:bundle-seam -- <fresh-phone-export>
pnpm verify:dependency-security
pnpm relay:check
```

The project keeps end-to-end tests only: the Maestro flows in `e2e/` run
against the headless TV with `pnpm dev:local` (see `AGENTS.md`). The bundle
check proves a phone export carries no Trivia pack. Still open: physical
devices (QR scan, Local Network prompt, Wi-Fi that blocks devices, a real
Apple TV), the relay transport and its load check, and the web TV smoke test.

## Architecture Decisions

### ADR-01 — The TV hosts the room; Convex is retired

- **Decision (accepted, done):** The TV app runs the authoritative room host
  and phones connect to it. Convex was removed in TASK-18 once every game
  played end to end on the TV host.
- **Why:** Lower latency and no backend vendor between phones and TV;
  `GameLogic` and `@huddle/domain` were already pure TypeScript.
- **Consequences:** Phones and TV share a network until the relay ships. The
  room ends with the TV app unless a snapshot restores it. The TV device holds
  all room secrets. The rules/screens seam is now a host/renderer seam.
- **Rejected alternatives:** Keep Convex (a cloud round trip and a vendor per
  input). Peer-to-peer WebRTC (still needs signalling, no single authority).
  Cloud streaming (the heaviest server dependency).

### ADR-02 — LAN WebSocket server in local Expo modules

- **Decision (accepted, done):** One module API: Java-WebSocket 1.6.0 on
  Android TV, `NWListener` with `NWProtocolWebSocket` on Apple TV.
- **Why:** React Native's WebSocket is client-only, and no maintained React
  Native server module covers Android TV and tvOS.
- **Consequences:** Two small native implementations behind one TypeScript
  interface. iPhones need Huddle's own Local Network text; the phone's
  `plugins/with-lan-cleartext.js` lets Android release builds use `ws://`.
- **Rejected alternatives:** A Rust core embedded in the TV apps
  (`aarch64-apple-tvos` is a tier 3 target needing nightly `-Zbuild-std`).

### ADR-03 — Rust for the relay only

- **Decision (accepted):** The relay is a stable-Rust service (tokio, axum,
  tracing), built before any web TV ships.
- **Why:** A small, long-running server holding many idle connections, with
  no rules to share with TypeScript.
- **Consequences:** A Cargo workspace with `cargo fmt --check`, `cargo clippy`
  and `cargo deny`, end-to-end flows through the relay, a load binary, one
  container image (`relay/Dockerfile`), and no unit tests. One 1-CPU, 512 MB
  instance held 1,000 rooms of ten phones (TASK-22).
- **Rejected alternatives:** Rust in the room host or for physics, or a hosted
  realtime service (a vendor again).

### ADR-04 — Ship native TVs first, keep web TVs possible

- **Decision (accepted):** Android TV and Apple TV ship; Samsung and LG are not
  built, but the portability rules apply to every change.
- **Why:** Tizen and webOS apps cannot host a server.
- **Consequences:** Native-only code stays in shells; a web shell will reuse
  the room host, protocol and TV screens.
- **Rejected alternatives:** Build all four now, or ignore web TVs and port
  later.
