# Huddle implementation plan

> **Current state:** the installed games are Trivia, Bomb Squad and Sumo
> Bumpers. Voting and the Coming soon cards were removed, and the project keeps
> end-to-end tests only. The sections after the local-first plan are the
> historical log and mention them as they were at the time.

## Execution state

**Current phase:** Playroom redesign, Cosmic Quiz Trivia, the visual polish
pass and the live seat preview are merged on `main` and live on the only
Convex deployment. Sumo Bumpers is on the `sumo-bumpers` branch. Open: the
physical party check.

**Next phase:** the local-first TV host below. The owner approved ADR-01 to
ADR-04 in [`architecture.md`](architecture.md#architecture-decisions) and the
scope changes (TASK-01). TASK-02 to TASK-11 are done; results are in the validation
ledger. Next: TASK-12, the room host inside the TV app.

**Runtime milestone:** the platform/game behavior and Phone-controller /
TV-stage handoff are implemented. Every platform screen on Phone and TV now
follows the Playroom design in
[`design/playroom/README.md`](design/playroom/README.md), which replaces the
earlier Heartbeat look. Runtime artwork remains checked-in implementation
artwork rather than source-master design material.

## Local-first TV host — plan

**Status:** Approved. Design: [`architecture.md`](architecture.md#target-architecture-local-first-tv-host-approved).
Task dependencies are in `.workflow/tasks.json`.

### Audit summary

- **Convex surface:** 3,369 lines in `convex/convex`: 40 functions (10 queries,
  23 mutations, 7 scheduled internal mutations, counting the development
  reset pair) over five tables (`rooms`,
  `players`, `presence`, `tvSessions`, `seatPreviews`). The scheduler drives
  away checks, room expiry, seat-preview expiry, the countdown and game
  deadlines. The rate limiter is the one Convex component.
- **Already portable:** `@huddle/domain` holds readiness, presence timings,
  room codes, nicknames, capacity, expiry and the session-token format as pure
  functions. Each game's `GameLogic` (`reduce`, `deadline`, `redactStateFor`)
  is pure. Game screens receive props only and never import Convex, so the
  game seam survives unchanged.
- **Client coupling:** Convex appears in 13 phone files and 7 TV files. The
  phone's hub is `apps/phone/src/screens/use-seated-room.ts` (5 queries, 15
  mutations). The TV's hub is `apps/tv/src/platform/room-session/room-client.ts`
  and `apps/tv/src/screens/tv-session-controller.tsx`.
- **Tooling coupling:** the e2e seeds in `convex/e2e` drive a fake TV and bots
  through the Convex HTTP client. `tools/dev-local.sh` starts a local Convex
  backend. `tools/validate-architecture.py`, `tools/validate-workflow.py` (it
  lists `convex/AGENTS.md`), `tools/verify-client-bundle.cjs` and `AGENTS.md`
  all name Convex.
- **Weak points the move fixes:** session tokens come from Convex's seeded
  `Math.random`; every game event is a transaction on the one room document.

### Scope changes (approved in TASK-01)

These are new user-visible behaviors, now recorded in
[`project-scope.md`](project-scope.md#rooms-hosted-by-the-tv-approved-being-built):

1. Phones join only on the same Wi-Fi as the TV, until the relay ships.
2. On first join, an iPhone asks for Local Network access. If the player
   denies it, the phone explains why and links to Settings.
3. New failure state: "Can't reach the TV" when the network blocks traffic
   between devices, with short guidance.
4. The room lives in the TV app. If the TV app restarts, it restores the room
   from its last snapshot for as long as rooms expire today (ten minutes).
5. New state: "Update Huddle" when the phone and TV protocol versions differ.
6. A typed room code works on the same Wi-Fi through local discovery.
7. The "existing Convex schema remains compatible" non-goal is replaced by
   "room lifecycle, stable avatar IDs and the game seam remain compatible".

### Phase 0 — Decisions and spikes

- [x] TASK-01 Approve ADR-01 to ADR-04 and the scope changes above
  Done when: the owner approved them in chat, `project-scope.md` and
  `tech-stack.md` record them, and the non-negotiable constraints at the end of
  this file match the new design.
- [x] TASK-02 Spike the Android TV LAN server
  Done when: a throwaway local Expo module in Kotlin, built with
  `npx create-expo-module --local`, runs a WebSocket server in the TV app on
  the Android TV emulator; an iPhone simulator and an Android phone connect
  through a QR address (`adb forward` for the emulator); the ledger records the
  library chosen (Java-WebSocket or Ktor), median and p95 round trip, the iOS
  Local Network prompt, the cleartext settings both phones need, and whether
  the server survives the TV screen saver.
- [x] TASK-03 Spike the Apple TV LAN server
  Done when: the same module API in Swift (`NWListener` with
  `NWProtocolWebSocket`) accepts phone connections on the Apple TV simulator
  via `pnpm sim:tvos`, and the ledger records any tvOS limits.
- [x] TASK-04 Spike local discovery
  Done when: the TV advertises a `_huddle._tcp` service with the room code
  (Android `NsdManager`, Apple Bonjour), an iPhone and an Android phone find it
  by code, and the ledger records the Info.plist keys and Android permissions
  this needs.

### Phase 1 — Protocol and room host (pure TypeScript)

- [x] TASK-05 Define the versioned protocol in `@huddle/contracts`
  Done when: zod schemas cover hello/welcome (protocol version, TV instance
  ID), every command named after today's mutations, every view named after
  today's queries, the existing rejection unions and ping; `pnpm typecheck`
  and `pnpm lint` pass.
- [x] TASK-06 Build the room host package (`packages/room-host`)
  Done when: it ports rooms, players, game setup, games, seat previews and the
  `lib` helpers from `convex/convex` with the same rules and rejections; it
  takes clock, timers, random, storage and send from its caller; it imports
  only `@huddle/domain`, `@huddle/contracts` and `@huddle/game-registry/logic`;
  it mints codes and tokens from a cryptographic source; it serialises a
  snapshot after every change.
- [x] TASK-07 Build the headless TV and bots
  Done when: a Node runner (tsx and the `ws` library) hosts the room host on a
  LAN port, the four seed scripts are ported from `convex/e2e` to it, and a bot
  client speaks the protocol.
- [x] TASK-08 Enforce the host boundary
  Done when: `tools/validate-architecture.py` knows the room-host package kind,
  rejects renderer, native and Convex imports in it, and enforces the web-TV
  portability rules in `architecture.md`; `pnpm validate:architecture` passes.

### Phase 2 — Client seam, still on Convex

- [x] TASK-09 Put the phone behind a room-client interface
  Done when: `use-seated-room.ts`, the session provider, join, seat preview and
  heartbeat call an interface with a Convex implementation; behavior is
  unchanged and every `pnpm e2e:*` flow passes against `pnpm dev:local`.
- [x] TASK-10 Put the TV behind a room-client interface
  Done when: room opening, presence, roster, setup, browsing, arrivals and the
  running game go through an interface with a Convex implementation; behavior
  is unchanged on the Android TV emulator.

### Phase 3 — Android TV hosts the room

- [x] TASK-11 Build the Android TV LAN module
  Done when: a local Expo module in `apps/tv` exposes start, stop, send, close
  and connection events, reports the LAN address, and advertises the mDNS
  service, using the library from TASK-02.
- [ ] TASK-12 Run the room host inside the TV app
  Done when: the TV shell starts the room host with the LAN transport, the TV
  screens read the shared view in-process, the QR code carries address, code
  and TV instance ID, and a restarted TV app restores its room from the
  snapshot.
- [ ] TASK-13 Add the phone LAN client
  Done when: the phone implements the room-client interface over React
  Native's WebSocket with reconnect and backoff, stores the session token per
  TV instance, resolves typed codes by mDNS, and plays a full Trivia game
  against the emulator.
- [ ] TASK-14 Add the approved new states
  Done when: the phone shows the Local Network denial, "Can't reach the TV" and
  "Update Huddle" states from TASK-01, with the shared text components and the
  largest text size checked.
- [ ] TASK-15 Run the end-to-end flows on the LAN host
  Done when: every Maestro flow in `e2e` passes against the headless TV, and
  Trivia, Bomb Squad and Sumo Bumpers each play to the finish on the Android TV
  emulator with a guest phone and ten bots.

### Phase 4 — Apple TV

- [ ] TASK-16 Build the Apple TV LAN module
  Done when: the Swift implementation from TASK-03 sits behind the same module
  API with Bonjour advertising, and the TV app builds for tvOS.
- [ ] TASK-17 Play on Apple TV
  Done when: all three games play to the finish on the Apple TV simulator with
  an iPhone simulator and bots, and `tech-stack.md` moves tvOS out of
  experimental if the owner agrees.

### Phase 5 — Retire Convex

- [ ] TASK-18 Remove Convex
  Done when: the Convex room-client implementations, the `convex` package, its
  dependencies and env files, the Convex parts of `tools/dev-local.sh` and both
  validators, `convex/AGENTS.md` and the Convex notes in `AGENTS.md` are gone;
  `pnpm verify:bundle-seam` now proves that phone exports hold no `/logic`
  entry and that the room host is renderer-free; `pnpm typecheck`, `pnpm lint`,
  `pnpm validate:workflow`, `pnpm verify:dependency-security` and every e2e
  flow pass.
- [ ] TASK-19 Make the target architecture current
  Done when: `architecture.md` describes only the TV host (the Convex sections
  removed, under 16 KB), `tech-stack.md` lists the new stack, and the ADRs are
  marked accepted.

### Phase 6 — Rust relay (before any web TV)

- [ ] TASK-20 Build the relay
  Done when: `relay/` holds a Cargo workspace on stable Rust with tokio, axum
  WebSocket and tracing; a TV registers a code with a host secret, phones join
  by code, frames pass through unread, and connection, room, size and rate
  limits plus idle expiry apply; `cargo fmt --check`, `cargo clippy -- -D
  warnings` and `cargo deny check` pass.
- [ ] TASK-21 Add the relay transport and fallback
  Done when: the TV shell can host through the relay with a plain JavaScript
  WebSocket, the QR code also carries the relay URL, the phone falls back to
  the relay when the LAN address fails, and a typed code resolves through the
  relay when mDNS finds nothing.
- [ ] TASK-22 Load-check and package the relay
  Done when: a Rust load binary in the same workspace holds 1,000 simulated
  rooms of ten phones on one small instance with the ledger recording memory
  and p95 forward time, and the relay ships as one container image.

### Phase 7 — Web TV readiness (Samsung and LG not shipped)

- [ ] TASK-23 Smoke-test a web TV build
  Done when: an Expo web export of the TV app runs at 1920×1080 in Chromium
  through the relay, plays Trivia with a phone, and the ledger lists what
  fails (Skia, storage, fonts) for a later Tizen and webOS shell.

### Release gates

- Every e2e flow passes on the LAN host and, after Phase 6, through the relay.
- The physical party check runs on a real Android TV with mixed phones,
  including a guest network that blocks traffic between devices.
- Independent review of the room host port against the Convex rules before
  TASK-18.

## Playroom redesign

- [x] Server-driven five-second countdown after the Host taps Start, with
  cancellation when readiness breaks and one shared readiness rule for the
  server, Phone and TV.
- [x] Games describe their settings (icon and unit) and themselves (tagline);
  the platform never names a game.
- [x] Phone room state and actions live in `useSeatedRoom`; each Phone phase
  has its own screen under `apps/phone/src/screens/seated/`.
- [x] Playroom tokens, Nunito Black, and shared pieces in `@huddle/ui/native`:
  TV stage, headings with burst dashes, pop-out avatars, orange primary
  buttons, pills, setting icons, status illustrations, and props, with
  Reanimated motion that respects reduced motion.
- [x] TV boot, room (code tiles, silhouette seats), picker (three cards),
  art reveal, setup, raise-your-hand ready check, countdown, paused, and
  unavailable screens.
- [x] Phone join, pick your look, lobby, Manage player, picker, setup
  (stepper, segmented, sheet), ready, countdown (haptics and a flash of the
  player's colour), status, scan, loading, and seat-lost screens.
- [x] Trivia and Voting keep their own colours, spacing and world art, and
  borrow only the neutral `@huddle/ui/game-kit`.
- [x] Heartbeat runtime art, components, and design references removed; app
  icons and splash regenerated from the Huddle-Platform app artwork; the
  architecture validator pins the Playroom and game artwork.
- [x] Simulator and emulator pass on iPhone and Android TV, compared against
  the concept boards and the prototype (visual audit, PRs 61–69).
- [x] Fresh Phone and TV exports through `pnpm verify:bundle-seam`.
- [x] Independent review of the redesign (reviewer passes on PRs 61–63).
- [x] Live seat preview while a player picks a look: the TV shows an arriving
  seat with the avatar and the name as typed (owner-approved `seatPreviews`
  table; TV-only `arrivals`; never a reservation).

## Completed implementation

### 1. Foundation — complete

- [x] Palette and semantic tokens in `@huddle/design-tokens`.
- [x] Nunito pinned at `0.4.2` and loaded before the native splash hides on
  Phone and TV.
- [x] Shared native shell, text, buttons, code tiles, portraits, player rows,
  badges, chips, game cards, loading mark, status surfaces, and artwork map.
- [x] Temporary Huddle brand derivatives, ten stable avatar assets, phone
  environments, TV stage, five text-free game cards, and Trivia/Voting game
  worlds are available to the runtime.
- [x] Review the React Native brand, screen composition, and artwork screen by
  screen against the approved reference boards; repair any fidelity gaps found.
- [x] Tokenized motion with static reduced-motion fallbacks and TV
  1920×1080/1280×720 overscan-safe composition.

### 2. Phone platform lifecycle — complete

- [x] Root session provider for credential restoration, active seat, notices,
  remembered profile, join handoff, leave, and seat-loss recovery.
- [x] Root room-code screen with authoritative `joinAvailability` checks and
  inline missing/full-room errors.
- [x] Dedicated `/join/[code]` Pick your look identity route with remembered
  profile, claimed-avatar disabling, authoritative join, persistence, and
  replacement navigation. Same-room deep links are suppressed; different-room
  links require an authoritative leave confirmation before identity can join.
- [x] `/scan` modal camera route with permission, malformed-code, duplicate,
  unavailable-camera, and manual-entry recovery states.
- [x] Host/player lobby, live roster, presence/Ready state, Host transfer and
  remove confirmations, Leave, synchronized picker, setup, locked readiness,
  Start gating, pause, unavailable, finished, recovery, Host Back to room from
  picker/setup, and Back to lobby from a running or finished game.

### 3. TV platform lifecycle — complete

- [x] Orbit loading mark, warm living-room boot, restore handoff, and static
  reduced-motion fallback.
- [x] Room Invitation with native Huddle mark, authoritative code, native QR,
  and live ten-seat avatar roster arranged in two rows of five.
- [x] Five-game registry carousel in the exact order Trivia, Voting, Doodle
  Dash, Quick Poll, Hot Take; the five-game registry is shown through a
  three-card viewport with the selected card centered, larger, and visually
  forward, plus one neighboring card on each side. Only the first two are
  selectable.
- [x] Display-only art reveal, module-declared setup projection, roster
  readiness, paused/unavailable/finished/device-failure status surfaces, and
  1920×1080 overscan-safe scaling.

### 4. Playable modules — complete

- [x] Trivia question → private answer/lock → TV reveal/standings → next
  question → final standings loop, with Flat/Speed scoring and its declared
  Questions, Difficulty, Timer, Category, and Scoring settings.
- [x] Voting prompt → private choice/lock → waiting or live aggregate → TV
  reveal → next round → non-scored room-vibe recap loop, with Rounds, Timer,
  Results, and Voter-label settings.
- [x] Per-action busy guards, authoritative event/deadline handling, stale
  event rejection, pause/recovery, and Host-only Back to lobby.
- [x] Redacted Phone/TV projections: private controls stay on the owner Phone;
  TV receives shared prompts, participation, aggregates, reveals, and recap
  only. Future prompts, raw mappings, timings, and pre-reveal answer keys stay
  server-side.
- [x] Legacy persisted `entered` records remain safely decodable without being
  silently reinterpreted as playable state.

### 5. Cleanup and architecture guardrails — complete

- [x] Removed the obsolete neutral purpose renderer and combined legacy join
  adapter, tests, exports, and duplicate Phone/TV asset trees.
- [x] Validator checks the exact palette, runtime asset sets,
  dimensions/alpha/digests, native identity derivatives, QR/camera scope, TV
  display-only source, bundle boundaries, and absent NativeWind/Tailwind setup
  without requiring a design manifest or source-master tree.
- [x] The approved visual references live under `docs/design/playroom/`;
  generated sources outside that set are not treated as masters.
- [x] Client seam protects both Trivia content and Voting prompts from client
  runtime graphs and exported bundles.

## Remaining release work

### 6. Fresh bundle and static evidence — complete

- [x] Export Phone (iOS/Android) and TV (Android) into fresh directories.
- [x] Run `pnpm verify:bundle-seam -- <export-directory>` for each export and
  retain the output with the release evidence.
- [x] Capture the iPhone room-code/scanner surfaces and Android TV Room
  Invitation at representative simulator/emulator sizes.
- [x] Capture synchronized Phone identity/lobby/picker/setup/readiness and TV
  roster/carousel/setup/readiness surfaces.
- [x] Capture the two-player Trivia and Voting runtime/final surfaces on Phone
  and TV. Recovery and reduced-motion behavior remain covered by focused
  render/motion checks; physical-device observation stays in the party check.

### 7. Simulator/emulator traversal — complete

- [x] Build, install, and launch the iPhone 17 Release app; exercise the
  room-code screen and QR scanner/manual fallback in runtime
  traversal.
- [x] Traverse the iPhone identity, Host lobby, synchronized picker, Trivia
  setup lock, Ready toggle, minimum-player Start gate, and confirmed
  authoritative Back-to-room against Android TV.
- [x] Verify same-room deep links return to the active seat and different-room
  deep links stop on the explicit handoff confirmation without leaving.
- [x] Complete the two-seat iPhone flow for Host transfer/removal, Trivia,
  Voting, and Back to lobby. Live QA exposed a stale picker after Host return;
  the server now clears game/setup/browse state atomically and the Phone clears
  stale local picker state from authoritative projections. Focused server and
  Phone regressions cover the repaired return path.
- [x] Build the Android TV x86_64 Release APK, install it on the dedicated
  `huddle_tv` AVD, launch through Leanback, and exercise Room Invitation in
  runtime traversal.
- [x] Build the Android Phone Release APK. The product owner accepted the
  Android Phone install/traversal checkpoint after the dedicated emulator
  stalled during installation; this item is closed by direction rather than
  recorded as captured device evidence.
- [x] Verify Android TV has no remote focus target or hidden control and that
  room code, QR, roster, prompts, timer, and recap stay inside overscan-safe
  bounds.

### 8. Physical party check and review — pending

- [ ] Test a real camera permission and QR join with a mixed iOS/Android Phone
  group.
- [ ] Exercise ten-seat roster, Host transfer/removal, away/Ready, seat loss,
  reconnect, both game loops, and Host return-to-lobby on physical devices.
- [ ] Complete the mixed physical Phone + Android TV living-room check.
- [x] Complete the first independent review and repair its Trivia privacy,
  picker return, join handoff, navigation-motion, and contact-sheet findings.
- [x] Obtain follow-up independent approval against the repaired implementation.

### 9. Game-night lounge screens — complete except Voting on devices

Native Phone and TV screens follow the fifth-pass lounge prototype in
`output/playroom-review/`. Trivia and Voting gameplay is unchanged.

- [x] Join, player pass, lobby, picker, setup, ready check, countdown, return
  ("Back in the room" / "One more?"), camera scanner and seat-loss screens.
- [x] Confirmed-join welcomes and the finished-game return composition use
  session-local presentation state; transition tests cover restores,
  reconnects and grouped arrivals.
- [x] One-seat traversal on iPhone 17 (dev build) and Android TV (dev build):
  join → lobby → picker → setup → ready → countdown → Trivia → return.
- [x] Independent review; its fallback player range, scanner label and
  duplicate-action, and finished-game confirmation findings are repaired.
- [x] Trivia and Voting accept one player (`playerRange.min: 1`) so a single
  device can test the whole flow; range tests follow the declared minimum.
- [x] Two-seat run covering guest views, 10 seats, long names (PR 58), the
  largest text sizes (PR 67) and reduced motion (PR 68).
- [ ] Voting on devices with guest phones.
- [ ] Android Phone and tvOS checks (not run; tvOS project not generated).

### 10. Cosmic Quiz Trivia — complete

Trivia's TV and Phone screens follow the approved Cosmic Quiz mockups (Huddle
Playroom v10; the reference pack is kept locally and is not in git). Voting and
the platform screens are unchanged.

- [x] Night-sky TV and cream answer pad: intro ("Ready for liftoff?"),
  question, answer locked, reveal with round results, podium finish; shared
  answer colours A–D; alien mascot; Trivia's full-scene picker card.
- [x] The reveal is a 30-second break that advances on its own; only the Host
  can end it early. The hub stamps `GameEvent.fromHost`; phones get `isHost`
  only to show the button. Logic and Convex tests cover guests, spoofing and
  stale beats.
- [x] Motion uses React Native `Animated` (entrances, answer press, staggered
  results, rising podium, bobbing mascot) and honours reduced motion.
- [x] One-seat traversal on iPhone 17 and Android TV dev builds, including the
  Host skipping a break and the final scores; independent review repaired the
  6–10 player reveal, podium and crew-row layouts.
- [x] Two-seat run with guest phones, ten players and long names on devices
  (PRs 58, 63).
- [x] Question categories: each question carries its category chip (PR 59).

### 11. Visual polish and room-view access — complete

- [x] Audit fixes: spacing, contrast and copy across the flow (PR 61).
- [x] Celebration and feedback: round points, the owner's private "You got
  it!" verdict, launch wipe, confetti and winner rings (PR 62); the owner's
  finishing place on the phone (PR 63).
- [x] A returning guest whose remembered avatar is taken gets a free one
  (PR 64).
- [x] Room views — roster, setup, browsed card and running game — answer only
  this room's TV (its TV session credential) or a seated phone (PRs 65, 66).
  Session-token authority is unchanged: a token still proves exactly one seat.
- [x] Text follows the system size up to a cap by type size (PR 67).
- [x] Under reduced motion the Trivia stage waits for its sky (PR 68); the sky
  ships as a 112 KB JPEG (PR 69).

### 12. Release order for the room-view credential change — not needed yet

There is no separate production deployment. Both apps' `.env` point at the
one Convex deployment, `colorful-viper-224` (type dev), which already runs
PRs 65, 66 and 71, and Huddle runs only on the iPhone simulators and the
Android TV emulator, built from `main`. Nothing is left to cut over.

Keep this for the day a production deployment or installed release builds
exist. PRs 65, 66 and 71 change the room-view protocol in both directions:

- An updated server gives a client without credentials an empty roster, no
  setup or card, and an `unavailable` game.
- An older server rejects the new clients' `sessionToken` / `tvSessionToken`
  arguments as extra fields, and a new TV crashes subscribing to
  `seatPreviews.arrivals` on a server that lacks it.

So deploy the server and update every installed app together (cutover), or
first deploy a transitional server that accepts the new optional arguments
without enforcing them, then release the apps, then deploy `main`. Rolling
back means rolling back server and apps together. Any production deploy needs
explicit owner approval.

## Validation ledger

### TASK-11 LAN server module

`apps/tv/modules/lan-server` is now the real module, with the same API on both
TVs: `start(port)` resolves the port in use and falls back to any free port
when the requested one is taken (and rejects instead of hanging when it cannot
listen), `send`, `close`, `stop`, connection events, `addresses()` ordered
home-network ranges first and VPN-style ranges last, and
`advertise(code, port)` / `stopAdvertising()`. Frames are capped at the
protocol's 256 KB and binary frames close the connection. Android uses
Java-WebSocket 1.6.0 (`Draft_6455` with the frame cap) and `NsdManager`;
Apple TV uses Network.framework. The typed seam is
`apps/tv/src/platform/lan-server` (`LAN_PORT`, `LanServer`). The spike screens
stay as a diagnostic until TASK-12 wires the room host.

Both sides compile. On the Apple TV simulator, with the headless TV holding
port 7777, the module fell back to port 65006 and advertised it
(`port=65006`, hosts home-network first); the iPhone found it by code in 31 ms
and connected (back-to-back median 9.3 ms, p95 12.3 ms). Not run on Android
TV: the emulator had shut down. The Kotlin server core ran in TASK-02; the new
fallback, frame cap and advertising run on Android in TASK-12 and TASK-15.
`pnpm typecheck`, `pnpm lint` and `pnpm validate:architecture` pass.

### TASK-04 local discovery spike

The TV spike module gained `advertise(code, port)` and `stopAdvertising()`:
Bonjour through `NWListener.service` on Apple TV and `NsdManager` on Android
TV. The service is `Huddle-<code>` of type `_huddle._tcp`, with TXT entries
`code`, `port` and `hosts` (the TV's IPv4 addresses). A phone module,
`apps/phone/modules/lan-discovery`, answers `find(code, timeoutMs)` with
`NWBrowser` on iOS and `NsdManager` on Android.

- **Apple TV to iPhone (simulators):** the Mac's own `dns-sd -B` saw the TV's
  service, `dns-sd -L` showed `port=7777 code=PFPW hosts=192.168.1.207,100.82.48.124`,
  and the iPhone found the TV by code in 36 ms and connected (back-to-back
  median 6.2 ms, p95 10.5 ms).
- **Use the TXT addresses, not the resolved endpoint.** Resolving the Bonjour
  endpoint first stalled in `preparing` when IPv4 was required, and without
  that requirement it returned an IPv6 link-local address
  (`fe80::…%ap1`) whose interface zone a WebSocket URL cannot carry. The
  TV now publishes its IPv4 addresses; the phone tries them in order. The list
  can include VPN interfaces (here `100.82.48.124`), so the real client
  (TASK-13) must try each with a short timeout.
- **Info.plist (both apps):** `NSBonjourServices` with `_huddle._tcp` (the dev
  launcher adds its own `_expo._tcp`) and Huddle's own
  `NSLocalNetworkUsageDescription`, both set in each `app.json`. Android
  needs no permission beyond `INTERNET` for `NsdManager`.
- **Android:** both Kotlin modules compile. Not run: the Android TV emulator
  shut down before the advertising check, and two Android emulators each sit
  behind their own virtual network, so emulator-to-emulator discovery cannot
  be tested. Android advertising and discovery need real devices on one Wi-Fi.
- **Not covered:** physical devices, the iOS Local Network prompt (the
  simulator shows none), and networks that block multicast.

### TASK-03 Apple TV LAN server spike

The spike module in `apps/tv/modules/lan-server` gained a Swift
implementation on Network.framework (`NWListener` with `NWProtocolWebSocket`,
TCP no-delay) behind the same module API as the Kotlin one. CocoaPods picked
up the local module, and a Debug build ran on the Apple TV 4K (at 1080p)
simulator, tvOS 26.5, with the TV bundle from `pnpm dev:local`.

- **Address:** the tvOS simulator shares the Mac's network, so the module
  reported the Mac's real LAN address (`192.168.1.207`) and the iPhone
  simulator connected to exactly the address a QR code would carry. No port
  forward is needed, unlike the Android emulator.
- **Round trip, phone → TV JavaScript → phone:** back-to-back with a re-render
  per message, median 11.4 ms, p95 15.3 ms, max 142 ms (200 samples); pings
  once a second, median 1.7 ms, p95 2.3 ms (66 samples).
- **Background:** after Home, tvOS suspended the app within about two
  seconds: two pings were answered in 60 seconds, the phone saw the socket
  close (1001), and nothing listened on the port. Coming back showed the room
  screen with the listener gone. The shell must therefore mark the TV away on
  background, restart the listener on foreground, and let phones resume
  (recorded in [`architecture.md`](architecture.md#target-architecture-local-first-tv-host-approved)).
- **Deep links:** tvOS asks "Open in Huddle?" before following a link from
  `simctl openurl`; Return on the Simulator window selects Open.
- **Not covered:** a physical Apple TV, real Wi-Fi, and how long a suspended
  app stays in memory before tvOS ends it.
- **Unrelated, seen on the way:** the phone's join screen showed a red Convex
  error when a `joinAvailability` query hit the local backend's one-second
  limit while this Mac ran two simulators, an emulator and a build. It is a
  load effect on `pnpm dev:local`, gone after a restart, and Convex leaves with
  TASK-18.

### TASK-10 TV room client

The TV reaches its room only through `apps/tv/src/platform/room-client`: a
`TvRoomClient` interface (`openRoom`, `heartbeat`, live views as the room's TV,
`useStillOpen`) with a Convex implementation exported as `tvRoomClient`, plus
`RoomClientProvider` for the root layout. The room opener, presence loop,
expiry watch, session controller and model types use it. The TV session
credential stays in the interface; the room host inside the TV app will ignore
it. Only comments and the missing-backend caption still name Convex.

`pnpm typecheck`, `pnpm lint` and `pnpm validate:architecture` pass. On the
Android TV emulator against `pnpm dev:local`, Convex bots joined the TV's own
room and the TV followed each step, read through `maestro hierarchy`: the room
with three seats, Bomb Squad setup, the ready check, How to play, the first
bomb (the server agreed at each step), and an empty room again once the bots
left. `uiautomator dump` is not usable for this: it fails while the screen
animates and leaves the previous dump in place, and calling it with `execSync`
blocks a bot script's heartbeats long enough for the room to mark the bots
away.

### TASK-09 phone room client

The phone reaches its room only through `apps/phone/src/platform/room-client`:
a `RoomClient` interface (live views, join availability, seat commands, join,
session lookup, seat previews, heartbeat) with a Convex implementation behind
`RoomClientProvider`. Refusals arrive as `RoomRefusal` from
`@huddle/contracts/protocol`, so the rejection messages no longer read
`ConvexError`. Screens keep an absolute `countdownEndsAt` on the phone's clock;
the LAN client will derive it from the protocol's remaining time. Only comments
still name Convex outside the room client.

`pnpm typecheck`, `pnpm lint` and `pnpm validate:architecture` pass. Against
`pnpm dev:local` on the iPhone 17 simulator, every flow passed:
`e2e:phone-starts`, `e2e:trivia`, `e2e:bomb-squad`, `e2e:crowded-room`,
`e2e:host-handoff` and `e2e:sumo`. The first `e2e:trivia` run straight after
`e2e:phone-starts` timed out before the Ready button; the rerun passed every
step, so that was a cold start rather than a change in behavior. The flows
launch `tv.huddle.controller`, an older app ID than the phone's current
`tv.huddle.phone`; both load the current JavaScript from Metro, and the
mismatch predates this change.

### TASK-08 host boundary

`tools/validate-architecture.py` now has a `host` package kind (it may depend
on contracts, domain and the registry) and two new checks. The room host may
import only the modules listed in
[`architecture.md`](architecture.md#portability-rules-for-web-tvs) and may not
use Node-only globals; it and the protocol entry must be renderer-free. Shared
TV code (everything in `apps/tv/src` outside `platform`, and each game's TV
screen) may not reach native-only modules, and Skia may appear only in game
packages. Each rule was proved by planting a violation: React Native,
`node:crypto` and the registry's client entry in the host, `process` and
`structuredClone` in the host, SecureStore and `requireNativeModule` in shared
TV code, AsyncStorage in a game's TV screen, and Skia in `packages/ui`. All
failed with a named file; a string containing "process" and SecureStore in the
TV platform layer passed.

### TASK-07 headless TV and bots

`pnpm headless-tv` runs the room host behind a `ws` server on port 7777
(`HEADLESS_TV_PORT` changes it). `tools/headless-tv/bot.ts` is a protocol
client on Node's built-in WebSocket. The four seeds in `tools/headless-tv`
match the ones in `convex/e2e` and take the same code-file argument. The
`pnpm e2e:*` scripts still use the Convex seeds, because the phone app talks to
Convex until TASK-13; TASK-15 switches them.

Each seed ran against a scratchpad stand-in phone bot playing the human's part:
Trivia started and took an answer, with only the phone's own answer visible;
Bomb Squad left How to play once everyone tapped Got it; the crowded room
locked setup with ten seats and marked the nine quiet bots away; Sumo Bumpers
replayed a round once everyone aimed. `pnpm typecheck` (now including
`tools/headless-tv`), `pnpm lint` and `pnpm validate:architecture` pass. Port
7777 must be free: an `adb forward` left from the LAN spike takes it.

### TASK-06 room host

`@huddle/room-host` ports every rule from `convex/convex` except the ones the
TV now makes unnecessary: TV heartbeats and their silence chain (the TV is the
host; the shell reports background and foreground with `setTvAway`) and
desertion expiry (the TV keeps the room, as Convex did while the TV was
present). The protocol gained two refusals, `gameUnavailable` and `hostError`.

A one-off Node script in the scratchpad (not checked in) drove the host with a
fake clock and three bot phones: joins and every join refusal, seat previews,
setup, readiness, the countdown and its cancellation, a full Trivia game on
deadlines and answers, end game, away and Host handover by silence, return,
removal, a removed token failing to resume, TV-away pause and resume from the
exact remainder, and snapshot restore. During a question the phone and TV both
see Trivia's hidden answer placeholder. Bomb Squad and Sumo Bumpers each ran
through every phase on deadlines alone. No runtime failure was logged.
`pnpm typecheck`, `pnpm lint` and `pnpm validate:architecture` pass.

### TASK-02 Android TV LAN server spike

Run on the `huddle_tv` Android TV emulator and the iPhone 17 simulator, both
debug builds, with the spike screens in `apps/tv/modules/lan-server` and the
`lan-spike` routes. The phone reached the TV at `127.0.0.1:7777` through
`adb forward`, because the emulator reports its private address `10.0.2.15`.

- **Library:** Java-WebSocket 1.6.0 (latest release; only depends on
  `slf4j-api`). Ktor was not needed. In Kotlin, the module's own socket map
  must not be called `connections`: that name clashes with the server's field.
- **Round trip, phone → TV JavaScript → phone:** pings once a second, median
  4.6 ms and p95 9.2 ms (57 samples). Back-to-back pings with a re-render per
  message, warm: median 27.3 ms, p95 49.8 ms, max 100 ms (200 samples). The
  first cold run was median 34.6 ms, p95 145 ms.
- **Sleep and background:** the server answered every ping through 60 seconds
  of `KEYCODE_SLEEP` and 90 seconds behind the Home screen. The one drop came
  from the spike stopping the server when its screen unmounted, so the server
  must belong to the app shell (TASK-12), not to a screen.
- **iOS Local Network:** the simulator shows no prompt. The phone's
  `NSLocalNetworkUsageDescription` is the Expo dev launcher's text, so release
  builds need Huddle's own text (TASK-13). `NSAllowsLocalNetworking` is already
  true.
- **Android cleartext:** debug manifests set `usesCleartextTraffic`; release
  manifests do not, so release builds block `ws://` to the TV until the phone
  and TV configs allow it (TASK-13).
- **Not covered:** a physical TV, real Wi-Fi, a real iPhone prompt, an Android
  phone (the release build was stopped by owner direction after a Gradle
  Metaspace failure), the TV screen saver on real hardware, and Wi-Fi that
  blocks traffic between devices.

Focused implementation checks pass for contracts, Convex integration,
Trivia/Voting logic, Phone/TV render suites, typecheck, lint, client seam,
architecture fixtures, architecture/routes/UI-stack validation, and
`git diff --check`. Fresh Phone iOS/Android and TV Android exports pass the
bundle scanner. The iPhone Release app and Android TV Release APK both build,
install, launch, and pass synchronized join, roster, picker, setup, Ready,
two-player Trivia/Voting, Host transfer/removal, and TV display-only inspection.
The Android Phone Release APK also builds successfully; device traversal was
accepted without new captured evidence by product-owner direction after the
test emulator stalled during installation. The Back-to-lobby repair passes its
focused Convex and Phone regressions. Independent re-review previously approved
the room-handoff availability gate and complete Trivia/Voting TV accessibility
summaries after 18 focused render cases passed. Recovery/reduced-motion physical
observation and the mixed physical party check remain open.

The visual polish pass (PRs 61–69) adds: full `pnpm test`, typecheck, lint and
validators on every PR; fresh bundle-seam exports; device runs on iPhone 17 /
17 Pro simulators and the Android TV emulator with one guest phone and up to
ten bot players; the largest iOS text sizes; and reduced motion on the TV.

## Non-negotiable constraints

- Do not change session-token authority (a token proves exactly one seat),
  room lifecycle, stable avatar IDs, or the `GameModule` seam. Under ADR-01 the
  room authority moves from Convex to the TV's room host; until TASK-18 the
  Convex schema may change only with approval.
- The TV screen remains display-only and the Phone remains the controller. The
  TV app may host the room, but it never gains controls or focus targets.
- Do not add Invite Friend, a web client, fake settings, or playable cards for
  Doodle Dash, Quick Poll, or Hot Take. A web build of the TV app for Samsung
  and LG is allowed only as the Phase 7 smoke test.
- Keep private player choices/timing and unrevealed game content off the TV
  screen and out of other players' Phone projections.
