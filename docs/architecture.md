# Huddle architecture

## Workspace boundaries

```text
apps/phone ─┐
apps/tv ────┼─> @huddle/game-registry ─> games/{trivia,bomb-squad,sumo-bumpers}
            ├─> @huddle/ui ─> @huddle/design-tokens
            └─> @huddle/domain ─> @huddle/contracts

convex ─> @huddle/game-registry/logic ─> server game logic
       └─> @huddle/domain ─> @huddle/contracts
```

- `@huddle/contracts` owns wire-safe types, validators, module interfaces,
  stable avatar IDs, and rejection unions. It has no domain or renderer
  dependency.
- `@huddle/domain` owns pure room, presence, joining, settings, lifecycle,
  readiness, and credential rules. It depends only on contracts.
- `@huddle/design-tokens` owns the Playroom palette, avatar circle colours,
  Nunito typography, the TV stage and Phone type scales, spacing, radii,
  shadows, and motion timings. It also keeps the older semantic colours that
  the neutral game kit uses. Game modules do not consume these tokens.
- `@huddle/ui/native` owns the Playroom platform pieces: TV stage, text and
  headings, burst dashes, wordmark, avatars, buttons, pills, setting icons,
  status illustrations, props, and artwork resolution. It does not own Convex
  state or game rules. `@huddle/ui/game-kit` is the only entry a game module
  may import: neutral text, buttons, screen shell, icons, and the avatar
  portrait, without Reanimated.
- `@huddle/game-registry` owns the ordered client catalog and the separate
  server-logic entry. The registry order is Trivia, Bomb Squad, Sumo Bumpers.
- `@huddle/physics` owns a small deterministic disc simulation. Sumo Bumpers
  runs it in its rules to decide a round, and its TV screen runs the same
  simulation on the same inputs to replay the round.
- `games/trivia`, `games/bomb-squad` and `games/sumo-bumpers` own metadata, settings, prompts/content,
  state, deadlines, events, redacted projections, and their Phone/TV screens.
  Their running-TV and private Phone presentation is intentionally game-local:
  Trivia owns its Cosmic Quiz look (night-sky TV, cream answer pad, alien
  mascot) in `games/trivia/src/cosmic.tsx`, while Bomb Squad owns its
  night-and-hazard theme in `games/bomb-squad/src/theme.ts` and draws its TV
  art with Skia (`skia-art.tsx`; the phone aliases Skia to a stub). Each game
  keeps its colours and its art in its own package (`assets/`). These are not
  platform tokens, and the game screens do not use the Playroom pieces. Game
  motion uses React Native's `Animated`, never Reanimated, and honours the
  device's reduced-motion setting.
- Games are not told who the Host is. When a game needs a Host-only action,
  the hub stamps `GameEvent.fromHost` itself (as it stamps `playerId`), and the
  phone screen receives `isHost` purely to show the control. Trivia uses this
  to let the Host end the 30-second break after a reveal early.
- `apps/phone` owns Expo Router adapters, the root session provider, scan/join
  routes, subscriptions, presence, and Phone controller composition.
- `apps/tv` owns room opening/restoration, subscriptions, and passive TV stage
  composition. It never owns Host authority or Phone input.
- `convex` remains authoritative for rooms, seats, Host state, presence, setup,
  readiness, game start/pause/finish, and return-to-lobby transitions.

The dependency graph is checked by `tools/validate-architecture.py`. Pure
entrypoints cannot hide renderer imports; the Phone session index is an
intentional native platform seam because it exports the React provider used by
every restored-session and join handoff.

## Platform and module lifecycle

The platform coordinator owns:

```text
Phone: restore → room code/scan → identity → lobby → picker → setup → ready → countdown
TV:    boot/restore → invitation → picker → art reveal → setup → ready → countdown
Both:  start → module-owned runtime → pause/recovery/finish → Back to lobby
```

The Host's Start begins a five-second countdown held by the server:
`startCountdown` sets the setup stage to `countdown` with an absolute
`countdownEndsAt` and schedules `launchCountdown`, which re-checks every start
condition before starting the game. Anything that breaks readiness cancels the
countdown and returns the room to the ready check. The TV and Phones only
display the seconds left against that deadline.

Starting the game is the hard handoff. Before it, Huddle owns catalog browsing,
module-declared setup, Host management, roster/presence, readiness, and action
busy/failure state. After it, the selected module owns the loop and supplies
two projections:

- a private Phone controller projection addressed to one player seat;
- a shared TV presentation projection that contains only room-safe information.

The generic platform never branches on a game's rules. Adding another
installed game means adding a module and registry entry, not adding game logic
to Phone or TV coordinators.

## Authority and privacy

Convex mutations derive seat identity from SecureStore session credentials.
`guestId` is non-secret continuity metadata. `joinAvailability` only reports
capacity and claimed avatar IDs; `joinRoom` is the authoritative membership
mutation. Host transfer/removal, setup locking, Ready, Start, pause, end, and
Back to lobby remain server-authorized and guarded per action on the Phone.
Room views (roster, setup draft, browsed card and running game) are shown only
to a caller who proves a seat in the room (its Phone session) or that it is the
room's TV (the TV session credential it opened the room with). Anyone else gets
an empty roster, no setup or card, and `unavailable` for a game, never the TV's
shared view. Only `stillOpen` and `connection`, which carry no room content,
answer by room ID alone.

While someone is on the join form, the phone sends a best-effort seat preview
(`seatPreviews.previewSeat`): their avatar and the name as typed so far. The
room's TV alone reads them (`seatPreviews.arrivals`) and draws arriving seats.
A preview is not a seat or a reservation. `joinRoom` stays the only authority,
there are never more previews than free seats, and a preview its phone stops
refreshing is deleted 20 seconds later.

The redaction contract is part of each module's logic, not a renderer
convention:

| Surface | Allowed | Withheld |
| --- | --- | --- |
| TV stage | shared prompt, timer, participation, aggregate tally, reveal, recap, standings | raw player-to-choice mapping, private controls, hidden/future content |
| Player Phone | that player's choices, lock state, their own result once revealed, shared standings, busy/error feedback, eyes-up guidance | other players' choices and raw timing, hidden answer key, pre-reveal correctness, future prompts |

Trivia's TV reveal receives normalized verdicts and standings. Bomb Squad's TV
sees no clue, role or vote until a round is revealed. Client projections clear internal
history fields so a renderer cannot accidentally reconstruct private data.

## Native presentation boundaries

All visible copy, controls, room codes, QR output, status marks, accessibility
roles, and focus behavior are native. Raster artwork is decorative and text-free.

- Phone room-code entry shows four boxes that match the TV's code tiles;
  identity is a separate `Pick your look` screen with the remembered profile,
  claimed-avatar handling, and authoritative join.
- Phone scan is the only `CameraView` surface. It accepts QR only and falls
  back to manual entry for malformed, denied, unavailable, or missing rooms.
- TV Room Invitation is the only QR renderer. It displays the authoritative
  code as four tiles, the QR code, and the live roster.
- TV boot, room invitation, picker, setup, ready, countdown, runtime, paused,
  unavailable, and finished surfaces are display-only. They do not render
  buttons, pressables, inputs, positive focus targets, or D-pad actions.
- TV platform surfaces are laid out on `PlayroomTvStage` from
  `@huddle/ui/native`; the game worlds do not use it.
- Phone lifecycle, Host management, setup, and game controls use native
  touch-targeted controls. No TV control is mirrored as a hidden focus target.
- Reanimated 4.5.1 drives platform motion in both apps and `@huddle/ui`; it
  stays out of game modules. NativeWind, Tailwind, CSS interop, Expo Image,
  Lucide, and NetInfo presentation imports remain absent.

## Assets and motion

The visual reference is the Playroom design under `docs/design/playroom/`:
its README, the concept boards, and the design-system tokens. They are never
imported by an app. Runtime images under `packages/ui/assets/playroom`, each
game's `assets/`, and launcher derivatives under `packages/ui/assets/app-icons`
remain implementation assets, not source masters. `tools/generate-app-icons.py`
derives the launcher files from the supplied Huddle-Platform app artwork. The
architecture validator checks each runtime bundle directly for its exact file
set, dimensions, alpha channels, and digests; it does not require a design
manifest or source-master tree.

Nunito Regular, Bold, ExtraBold and Black load in both Expo layouts before the
native splash hides. Presses take 100 ms, transitions 180 ms and entrances
240 ms with at most 12 units of travel; props settle once and then hold still.
When reduced motion is requested, scale and travel are dropped and state
changes are immediate or brief fades; essential copy never depends on
animation.

TV layouts use a 1920×1080 stage, a 5% overscan-safe frame, and scale down to
1280×720. Phone layouts use Safe Area insets and a scrollable single column.

## Compatibility and verification

Room lifecycle, session tokens, stable avatars, and the client/server
`GameModule` seam remain unchanged. The Convex schema only gained the optional
countdown fields on setup.

High-signal repository checks are:

```sh
pnpm validate:architecture
pnpm verify:bundle-seam -- <fresh-export-directory>
pnpm typecheck
pnpm lint
```

The remaining release evidence is outside static validation: real camera
permission and QR join, mixed-phone reconnect/seat-loss traversal, and the final
physical Phone + Android TV living-room party check.

## Target architecture: local-first TV host (approved)

Status: approved in ADR-01 to ADR-04 below and not built yet. Everything above
this section describes the current, Convex-based system. The phased work is in
[`implementation-plan.md`](implementation-plan.md#local-first-tv-host--plan).

```text
                        ┌──────────────────────── TV app ────────────────────────┐
Phone app ── transport ─┤ Shell (per platform)                                    │
  (one client)          │   Android TV, Apple TV: LAN WebSocket server   [first]  │
                        │   Samsung, LG (web):    relay client           [later]  │
                        │ Room host (pure TypeScript, shared by every shell)      │
                        │   seats, Host, presence, setup, countdown, runtime,     │
                        │   redaction, via @huddle/game-registry/logic            │
                        │ TV screens (shared)                                     │
                        └─────────────────────────────────────────────────────────┘
Relay (Rust, later) ── forwards opaque frames between phones and one TV by room code
```

- **Room host.** `@huddle/room-host` (built, not yet wired into the TV app)
  takes over the rules that `convex/convex` holds today: seats, the Host pointer,
  presence and away, setup, readiness, the countdown, the game runtime,
  deadlines, rate limits and per-viewer redaction. It depends only on
  `@huddle/domain` and `@huddle/game-registry/logic`. It gets its clock, timer,
  random source, storage and `send` function from the shell, so the same code
  runs inside the TV app and under plain Node (the headless TV used by the
  end-to-end flows). Precise timers drive the countdown and game deadlines; a
  one-second sweep marks silent phones away, drops stale join previews and
  ends a room whose TV has been away for ten minutes. Any frame from a seated
  phone counts as its beat. Because the TV owns the room, a room whose phones
  have all gone quiet stays open, as it did on Convex while the TV was
  present.
- **Protocol.** Versioned JSON messages in `@huddle/contracts/protocol`
  (zod, so the main contracts entry stays dependency-free). A connection opens
  with hello/welcome, which carries the protocol version; a mismatch gets
  `incompatible`. The connection is anonymous until `joinRoom` or
  `resumeSession` binds it to one seat, so later commands carry no Session
  Token. Commands are named after today's Convex mutations and views after
  today's queries; the host pushes a view whenever it changes. Presence is the
  transport's ping. Clocks travel as milliseconds remaining, never as absolute
  times, because the phone's and TV's clocks differ. Every transport carries
  exactly these messages.
- **Transport.** One small interface: connection opened, message, send, closed.
  `LanTransport` is a native WebSocket server in a local Expo module: Kotlin on
  Android TV, Swift with Network.framework (`NWListener`) on Apple TV.
  `RelayTransport` is an outgoing WebSocket, so it works on web TVs too.
- **Discovery.** The TV's QR code carries the TV's LAN address, the room code
  and the TV instance ID. A typed room code is resolved on the local network by
  mDNS (Android `NsdManager`, Apple Bonjour). Later, the relay also resolves a
  typed code.
- **Phone.** The phone keeps one room client behind an interface. It uses React
  Native's built-in WebSocket client; only mDNS browsing needs native code.
- **Relay (later).** A small Rust service (tokio and axum) at `relay/` in the
  repository. The TV registers a room code with a random host secret, phones
  join by code, and the relay forwards frames without reading game content. It
  holds no database and no rules, and it ships as one container image that any
  host can run.

### Authority and trust in the target

- The TV's room host is authoritative for seats, the Host, readiness, time and
  game state. There is one clock, the TV's, so deadlines need no scheduler.
- The TV mints room codes and session tokens from a cryptographic random
  source. A token still proves exactly one seat; the phone keeps it per TV
  instance for reconnects.
- Redaction stays in each game's `redactStateFor`. The room host sends each
  phone socket only that seat's view, and the TV screens read the shared view
  in-process. The TV device now holds every secret; this is an accepted trust
  change for a living-room party game.
- LAN traffic is plain `ws://`. Anyone on the same Wi-Fi can see frames, so
  tokens protect seats against mistakes, not against a hostile network. Relay
  traffic uses `wss://`.
- The room host caps connections and applies per-connection token buckets with
  the limits that `convex/convex/lib/rateLimits.ts` uses today.

### Portability rules for web TVs

Samsung (Tizen) and LG (webOS) run TV apps as web apps that cannot accept
incoming connections. Until they ship, every change keeps these rules, and
`tools/validate-architecture.py` enforces them:

- The room host and the shared TV screens import no native module. Native code
  lives in the shell, behind an adapter (transport, storage, network address).
- Shared TV code does not use SecureStore or other native storage directly.
- Skia stays inside game packages behind an alias, as the phone build already
  stubs it, so a web TV can use a lighter renderer.
- The TV stays display-only. No flow depends on a TV remote.
- Shells talk to the room host only through protocol messages that the relay
  could carry. This one is a review rule; the validator cannot see it.

The validator also keeps the room host portable: it may import only
`@huddle/contracts`, `@huddle/contracts/protocol`, `@huddle/domain`,
`@huddle/game-registry/logic` and zod, and may not use Node-only globals such
as `process`, `Buffer` or `structuredClone`.

## Architecture Decisions

### ADR-01 — The TV hosts the room; Convex is retired

- **Decision (accepted):** The TV app runs the authoritative room host. Phones
  connect to the TV. Convex is removed after the TV host plays every game end
  to end.
- **Why:** The owner wants lower latency and no backend vendor between the
  phones and the TV. `GameLogic` and `@huddle/domain` are already pure
  TypeScript, so the rules can move without a rewrite.
- **Consequences:** Phones and TV must share a network until the relay ships.
  The room ends when the TV app ends, unless a snapshot restores it. The TV
  device holds all room secrets. The client/server seam becomes a
  host/renderer seam: the room host and each game's `/logic` entry stay free of
  renderers so they also run under Node.
- **Rejected alternatives:** Keep Convex — adds a cloud round trip and a vendor
  for every input. Peer-to-peer WebRTC — still needs signalling, fails on some
  NATs, and has no single authority. Cloud streaming (the Netflix model) — the
  heaviest server dependency of all.

### ADR-02 — LAN WebSocket server in local Expo modules

- **Decision (accepted):** One module API, implemented in Kotlin for Android TV
  and in Swift with `NWListener` and `NWProtocolWebSocket` for Apple TV. The
  Android WebSocket library is chosen in the transport spike from proven
  candidates (Java-WebSocket, Ktor server).
- **Why:** React Native's WebSocket is client-only, and no maintained React
  Native server module covers Android TV and tvOS. Native platform networking
  needs no extra toolchain.
- **Consequences:** Two small native implementations behind one TypeScript
  interface. iPhones show the Local Network permission prompt. Each app needs a
  cleartext exception for local addresses.
- **Rejected alternatives:** A Rust core embedded in the TV apps through
  uniffi-bindgen-react-native — `aarch64-apple-tvos` is a tier 3 Rust target
  that needs nightly `-Zbuild-std`, and Expo support for the binding generator
  is unconfirmed.

### ADR-03 — Rust for the relay only

- **Decision (accepted):** The relay is a Rust service on stable Rust with
  tokio, axum (WebSocket) and tracing. It is built after the LAN host reaches
  parity and before any web TV ships.
- **Why:** The relay is a small, long-running network server that must hold
  many idle connections cheaply. Rust fits this well, and the relay holds no
  rules, so it shares no TypeScript.
- **Consequences:** A Cargo workspace beside the pnpm workspace, its own static
  checks (`cargo fmt --check`, `cargo clippy`, `cargo deny`), an end-to-end
  check through the relay with the headless TV and bots, and one container
  image. Like the rest of the project, it gets no unit tests.
- **Rejected alternatives:** Rust in the room host — every game would need a
  bridge to TypeScript. Rust physics — the disc simulation is small and, once
  only the TV runs it, needs no cross-machine determinism. A hosted realtime
  service — reintroduces a vendor.

### ADR-04 — Ship native TVs first, keep web TVs possible

- **Decision (accepted):** Android TV ships first, then Apple TV. Samsung and LG
  are not built yet, but the portability rules above apply to every change.
- **Why:** Tizen and webOS apps are web apps that cannot host a server; they
  need the relay and a web build of the TV app.
- **Consequences:** Native-only code stays in shells. A later web shell reuses
  the room host, the protocol and the TV screens.
- **Rejected alternatives:** Build all four now — doubles the work before the
  core design is proven. Ignore web TVs — a later port would mean a rewrite.
