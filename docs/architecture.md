# Huddle architecture

## Workspace boundaries

```text
apps/phone ─┐
apps/tv ────┼─> @huddle/game-registry ─> games/{trivia,voting}
            ├─> @huddle/ui ─> @huddle/design-tokens
            └─> @huddle/domain ─> @huddle/contracts

convex ─> @huddle/game-registry/logic ─> game logic exports
       └─> @huddle/domain ─> @huddle/contracts
```

- `@huddle/contracts` owns wire-safe types, validators, module interfaces, and
  rejection unions. It has no domain or client dependency.
- `@huddle/domain` owns pure room, presence, settings, lifecycle, readiness,
  joining, and credential rules. It depends only on contracts.
- `@huddle/design-tokens` exposes exactly two presentation values: white
  background and black text.
- `@huddle/ui/native` exposes the neutral `PurposeScreen` plus the pure
  `huddleAvatarSource` asset resolver. It does not own screen state or render
  app-specific layouts. The illustrated Join Room, Phone scanner, TV
  boot/restoration, Room Invitation, and TV game-flow renderers remain
  app-owned under their respective apps.
- `games/*` retain independent metadata, settings, logic, and Phone/TV module
  contracts. Their current screens resolve to the shared purpose renderer.
- `@huddle/game-registry` remains the ordered client module list and the
  separate server-logic entry. Convex must never import native screens.
- `apps/phone` and `apps/tv` remain Expo Router adapters and state
  coordinators. Route files, subscriptions, credentials, presence, heartbeat,
  expiry, and session recovery remain in their existing seams.
- `convex` remains authoritative for room, seat, presence, rate limits, setup,
  readiness, and running-game state.

The dependency graph is acyclic and validated by
`tools/validate-architecture.py`.

Phone and TV explicitly pin `react-native-worklets@0.10.1` as a native build
compatibility peer for Expo Router's transitive Reanimated 4.5.1 dependency.
Neither package is an approved Huddle presentation API: source imports remain
forbidden, and the architecture validator restricts the Worklets pin to the two
native clients at that exact version.

## Presentation boundary

The clean-slate baseline still requires state coordinators to resolve runtime
state first, then pass one short purpose to `PurposeScreen`. The shared renderer
always produces a white full-screen `View` and one centered, accessible black
system-font `Text` label. Phone text is 24pt; TV text is 48pt. It accepts no
controls, inputs, images, progress indicators, overlays, dialogs, animation,
focus targets, or feature-specific styling. The app-owned TV boot, restoration,
Room Invitation, and game-flow presentations below are narrow exceptions to
this shared baseline.

There are a small number of narrow app-owned exceptions:

- `apps/phone/src/features/join/join-room-screen.tsx` may use ordinary React
  Native image, input, scrolling, keyboard, loading, picker, and pressable
  primitives with the supplied Phone PNGs and shared avatar runtime assets.
  `JoinForm` remains its route-facing adapter, seeds `linkedCode`, owns the
  Convex/profile/session handoff, and owns `/scan` navigation. The renderer owns
  only local draft and picker state.
- `apps/phone/src/features/scan/scan-screen.tsx` may use the existing Expo
  Camera capability and ordinary React Native modal/presentation primitives.
  It requests permission on entry, filters to QR payloads, delegates protocol
  validation to `decodeJoinQr`, and replaces itself with `/join/[code]`. It owns
  no membership, identity, or session authority and unmounts the camera when
  unfocused.
- `apps/tv/src/features/room/room-invitation-screen.tsx` may use ordinary React
  Native image primitives and the TV app's QR/SVG dependencies with the exact
  TV PNGs. It is a pure display renderer accepting `roomCode`, `joinUrl`, and an
  optional ordered player projection. `RoomStage` caps and maps the live
  `RosterSeat[]` and generates `roomJoinLink(code)`; `TvSessionController`
  retains the roster query and selects this renderer only for the resolved
  room surface. The renderer has no controls, focus targets, subscriptions, or
  room authority.
- `apps/tv/src/features/boot/tv-creating-room-screen.tsx` owns the animated
  living-room presentation for `startup`, `opening`, and `reconnecting`. It
  reuses the exact existing TV background, may use built-in React Native
  `Animated`/image primitives and `react-native-svg` for decorative motion, and
  adds no packages, custom fonts, or new runtime artwork. It is a pure,
  display-only renderer with no QR-code package, controls, focus targets,
  subscriptions, or room authority; the TV session coordinator still owns
  room creation and recovery.
- `apps/tv/src/features/boot/tv-restoring-room-screen.tsx` owns the short,
  display-only handoff shown when an existing TV room is restored. It may use
  built-in React Native `Animated` and ordinary text/image primitives, plus the
  existing `react-native-svg` runtime for ambient sparkles; its
  `tv-restore-indicator.tsx` helper is part of the same allowlisted seam and
  resolves the brand spinner into a green check. It does not query or claim a
  roster, expose controls or focus targets, or decide whether the restored room
  is a lobby or active game.
- `apps/tv/src/features/game-flow/` owns the display-only carousel, selected
  game-art reveal, schema-driven setup, and ready renderers. The carousel reads
  the ordered `CAROUSEL_REGISTRY` and authoritative browsing index; the setup
  renderer receives the installed module’s settings schema and the roster
  projection; the ready renderer is mounted only after the coordinator mirrors
  the server start gate. These renderers may use built-in `Animated`, image,
  and system-font primitives, but never controls, pressables, inputs, QR,
  subscriptions, phone presence authority, or game rules. The coordinator’s
  only local state is the one-shot 0.9-second reveal timer, which is cleaned up
  on phase changes and unmount.

The state-to-label mapping is platform-owned:

- Phone boot/scan: `Starting Huddle`, `Restoring your room`, or `Scan a room
  code`; the join route uses the illustrated exception above.
- Phone room/game states: `Room lobby`, `Waiting for the Host`, `Choose a
  game`, `Game setup`, `Game paused`, `Game unavailable`, `Game finished`,
  `Trivia game`, or `Voting game`.
- TV boot/room states: `Starting Huddle`, `Creating a room`, `Reconnecting to
  room`, `TV setup required`, or `TV unavailable`. `startup`, `opening`, and
  `reconnecting` use the illustrated animated TV boot exception above;
  `misconfigured` and `deviceFailure` may remain centered purpose labels. A
  restored room may briefly use the TV restoration exception above before
  handing off to the resolved surface; any game-owned state is handed off
  directly to its game renderer rather than showing the lobby.
- TV selection/game states use the illustrated four-card carousel, the short
  selected-game art reveal, schema-only setup, and ready renderers. Word Battle
  and More Games remain display-only `Coming soon` cards. The shared runtime
  labels and the two module labels remain the fail-closed fallback for game
  surfaces not yet implemented.

This is a presentation reset, not a lifecycle reset. Convex queries and
mutations, persisted identities, session tokens, roster/presence projections,
room expiry, heartbeat handling, route selection, `GameModule`, and the
game-registry client/server seam remain intact. The scan route now mounts the
existing Expo Camera capability only while it is focused; it never creates a
seat or writes a session.

## State and authority

Convex owns one room record, optional setup, optional running game, seats, and
TV credential. Clients subscribe to public projections; they never decide room
phase. Setup still flows `configuring → ready → absent while running`. Ending
clears the running game and setup while keeping the room code, roster, Host,
and browsing index so the TV can return to its carousel.

`players.joinAvailability` is a deliberately narrow public projection keyed by
the normalized room code. It returns only capacity and claimed avatar IDs, and
is advisory UI state; `players.joinRoom` remains the sole membership authority.

`rooms.openRoom` is the sole TV opening authority and returns the room identity
plus `restored` and `hasRunningGame` flags. A newly minted room (including a
replacement for a stale session) reports `restored: false`; an existing room
recovered through its durable TV credential reports `restored: true`. The TV
route uses those flags for handoff: fresh rooms continue to the invitation,
restored rooms without game state may show the short restoration renderer, and
any `hasRunningGame: true` state takes the TV directly to its game/paused/
unavailable surface. The controller also suppresses a lobby flash while that
running query is pending. The restoration presentation makes no roster,
player-count, or seat-presence claims; roster subscriptions remain owned by the
resolved session controller.

Once the lobby is browsed, `games.browsing` and `games.setup` are the only
projections passed to the TV game-flow seam. A game selection creates one local
art-reveal handoff; cancelling setup unmounts it, and selecting the same game
again mounts a fresh reveal. Ordinary setup updates do not replay the reveal.
The selected module’s metadata player range, settings schema, mode, roster, and
server `readyPlayerIds` remain authoritative. The TV derives no alternate
settings or player readiness state.

`GameModule` is the client-safe module contract. `GameLogic` provides runtime
decode, initial state, reducer, deadline, and public/private projection. Proof
modules decode versioned `entered` state, reject all events, and schedule no
deadline. The registry `/logic` export keeps React Native screens and Trivia
future content outside the Convex bundle; bundle-seam checks keep future
content out of clients.

## Security boundaries

- Phone SecureStore session credentials authenticate seats and Host actions.
- TV SecureStore credentials restore and authorize the TV-owned room.
- `guestId` is UUID-shaped non-secret metadata only and cannot query a session.
- Public mutations derive player identity from credentials; callers cannot
  supply authoritative player IDs.
- Token buckets reject with `{kind, operation, retryAfterMs}`. Heartbeats and
  internal callbacks are exempt so a limit cannot manufacture absence.

## Native and feature assets

Shared checked-in bitmap assets remain limited to the neutral launcher, splash,
adaptive-icon, monochrome, and Android TV banner resources under
`packages/ui/assets/app-icons`. App configuration references only those neutral
assets. Runtime product artwork is app-owned or shared by an explicit
resolver: the supplied Phone PNGs under `apps/phone/assets/join-room`, the
generated high-quality avatar masters under
`docs/design/assets/avatars/masters`, the optimized 512px avatar runtime PNGs
under `packages/ui/assets/avatars`, the clean TV background and phone icon under
`apps/tv/assets/room-invitation`, and the optimized TV game-flow bundle under
`apps/tv/assets/game-flow` (1080p playroom/game art, source-size four carousel
cards, Huddle mark, and Questions/Rounds PNG icons). The TV boot, Room
Invitation, and game-flow renderers reuse the approved background assets. The
third Room file, `tv-lobby-empty.png`, is the supplied baked visual reference
and must never be imported into runtime code. 4K/2K duplicates, Word Battle art,
unused setup icons, SVG duplicates, fonts, and sample code remain excluded.
Custom fonts and the former redesign importer remain absent, while Phone retains
Expo Camera configuration for the platform capability. The architecture
validator pins the avatar and game-flow asset names, dimensions, and SHA-256
digests.

## Migration constraints

`@huddle/phone` uses native identity `huddle-phone` / `tv.huddle.phone`.
Existing installs under a different native identity and their local storage do
not migrate in place; remove earlier Huddle builds before validating
`huddle://` routing. Development data is intentionally reset only through the
guarded lifecycle path: audit the development deployment, enable the
development-only reset gates briefly, invoke the confirmation-literal reset,
verify zero active rows, disable the gate, then deploy the strict runtime.
Never enable or invoke the reset in production.
