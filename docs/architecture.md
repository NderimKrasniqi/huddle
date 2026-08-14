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
- `@huddle/ui/native` exposes only `PurposeScreen`. It remains the sole shared
  renderer and accepts `platform` plus `purpose`, with no children or style
  override. The illustrated Join Room and Room Invitation renderers are
  app-owned under their respective apps and are not exported from a shared
  package.
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

## Presentation boundary

The clean-slate baseline still requires state coordinators to resolve runtime
state first, then pass one short purpose to `PurposeScreen`. The shared renderer
always produces a white full-screen `View` and one centered, accessible black
system-font `Text` label. Phone text is 24pt; TV text is 48pt. It accepts no
controls, inputs, images, progress indicators, overlays, dialogs, animation,
focus targets, or feature-specific styling.

There are exactly two narrow app-owned exceptions:

- `apps/phone/src/features/join/join-room-screen.tsx` may use ordinary React
  Native image, input, scrolling, keyboard, loading, and pressable primitives
  with the three exact Phone PNGs. `JoinForm` remains its route-facing adapter,
  seeds `linkedCode`, and owns `/scan` navigation. The renderer owns local entry
  state only and never Convex authority, identity, credentials, or membership.
- `apps/tv/src/features/room/room-invitation-screen.tsx` may use ordinary React
  Native image primitives and the TV app's QR/SVG dependencies with the exact
  TV PNGs. It is a pure display renderer accepting `roomCode`, `joinUrl`, and an
  optional ordered player projection. `RoomStage` caps and maps the live
  `RosterSeat[]` and generates `roomJoinLink(code)`; `TvSessionController`
  retains the roster query and selects this renderer only for the resolved
  room surface. The renderer has no controls, focus targets, subscriptions, or
  room authority.

The state-to-label mapping is platform-owned:

- Phone boot/scan: `Starting Huddle`, `Restoring your room`, or `Scan a room
  code`; the join route uses the illustrated exception above.
- Phone room/game states: `Room lobby`, `Waiting for the Host`, `Choose a
  game`, `Game setup`, `Game paused`, `Game unavailable`, `Game finished`,
  `Trivia game`, or `Voting game`.
- TV boot/room states: `Starting Huddle`, `Creating a room`, `Reconnecting to
  room`, `TV setup required`, or `TV unavailable`; the resolved room uses the
  illustrated Room Invitation exception above.
- TV selection/game states use `Choose a game`, `Game setup`, the shared
  runtime labels, and the two module labels.

This is a presentation reset, not a lifecycle reset. Convex queries and
mutations, persisted identities, session tokens, roster/presence projections,
room expiry, heartbeat handling, route selection, `GameModule`, and the
game-registry client/server seam remain intact. The scan route retains its
parser and Expo Camera configuration, but the temporary clean-slate screen
does not mount the camera.

## State and authority

Convex owns one room record, optional setup, optional running game, seats, and
TV credential. Clients subscribe to public projections; they never decide room
phase. Setup still flows `configuring → ready → absent while running`. Ending
still clears game, setup, selection, browsing, and readiness while keeping the
room code, roster, and Host.

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
assets. Runtime product artwork is app-owned: the three supplied Phone PNGs
under `apps/phone/assets/join-room`, plus the clean TV background and phone icon
under `apps/tv/assets/room-invitation`. The third TV file,
`tv-lobby-empty.png`, is the supplied baked visual reference and must never be
imported into runtime code. Custom fonts and the former redesign importer remain
absent, while Phone retains Expo Camera configuration for the platform
capability.

## Migration constraints

`@huddle/phone` uses native identity `huddle-phone` / `tv.huddle.phone`.
Existing installs under a different native identity and their local storage do
not migrate in place; remove earlier Huddle builds before validating
`huddle://` routing. Development data is intentionally reset only through the
guarded lifecycle path: audit the development deployment, enable the
development-only reset gates briefly, invoke the confirmation-literal reset,
verify zero active rows, disable the gate, then deploy the strict runtime.
Never enable or invoke the reset in production.
