# Huddle Architecture

> Reconciled 2026-08-11 for **F-010 Architecture, Structure, and Naming
> Refactor**.
> Phases 1–5 remain the frozen product baseline. This document records the
> repository's current boundaries through Feature 7 without changing Expo,
> Convex, pnpm workspaces, the game registry, shared UI primitives, or the
> approved Soft Minimal palette and TV assets.

## Product and runtime boundaries

The Android TV owns one durable session credential and one live room. Phones
join that room with per-player session tokens. Convex is the authoritative
store and scheduler for room lifecycle, player presence, game state, and game
deadlines. The TV and controllers subscribe to projections; no client treats a
local timer or local process memory as authority.

The reliability journey is **J-006 Recover a TV-held session**. It requires:

- **C-006.1** durable TV identity before any room mutation;
- **C-006.2** exact pause/resume using the server-stored remaining deadline;
- **C-006.3** a versioned, decoded, redacted game runtime that fails closed;
- **C-006.4** feature-first app and private Convex module boundaries; and
- **C-006.5** a resumable, repository-local engineering workflow.

The governing rules are **BR-006** (one live room per TV token), **BR-007**
(invalid runtimes expose no state), **BR-008** (gameplay cannot advance while
the TV is away), and **BR-009** (legacy development rooms are discarded by an
approved cleanup rather than interpreted or migrated).

## Current repository shape

The current implementation is a pnpm workspace with Expo Router apps under
`apps/controller` and `apps/tv`, Convex functions under `convex/convex`,
platform contracts under `packages/game-core` and `packages/game-registry`,
game modules under `packages/games/*`, and shared tokens/primitives under
`packages/ui`. Expo route adapters are thin. The Controller root screen owns
only deep-link/session composition, while the TV root screen owns room opening,
live subscriptions, and pure surface selection. Both apps keep rendering,
styles, feature hooks, and platform lifecycle code behind explicit entrypoints.

## Current app boundaries

```text
apps/controller/src/
  screens/                     # route surfaces and seated controller
  models/                      # pure app projections and shared types
  features/{join,room,game-picker,game-session}/
  platform/{convex,session,presence,storage}/
  ui/                          # controller-only primitives

apps/tv/src/
  screens/                     # room opening, subscriptions, surface selection
  models/                      # pure TV projections and shared types
  features/{boot,room,carousel,game-setup,game-session}/
  platform/{convex,room-session}/
  ui/                          # TV-only primitives
```

Expo Router files in `apps/*/app` are thin adapters that mount a root
coordinator. The dependency direction is strict:

```text
routes → screens → features/platform/models/UI
features → platform/models/UI
platform → models and other platform owners through entrypoints
models → workspace/external contracts only
UI → shared UI packages only
```

Features never depend on other features, platform code never reaches upward
into a feature, and owners are accessed through their public entrypoints rather
than deep imports. Cycles, empty entrypoints, renderer-bearing model entrypoints,
and authored non-kebab filenames (outside the documented Expo/generated and
`index`/`native`/`styles` exceptions) are rejected by workflow validation.
Features with no pure API may expose only `native.ts`; `index.ts` is reserved
for pure/type seams and `native.ts` for renderer seams. Features own screens,
styles, pure models/helpers, and adjacent tests. Platform folders own Convex
bindings, credentials, secure storage, and presence.
Only genuinely cross-app tokens and primitives live in `@huddle/ui`. The
React-Native implementation has two intentional entrypoints: `@huddle/ui/native`
contains the Node-safe core primitives used by game modules, while
`@huddle/ui/kit` contains the attached Huddle UI kit, its Lucide-backed icon
wrapper, and the phone/TV helper components used by the platform screens. The
kit entrypoint stays separate so its renderer dependency does not enter the
plain-Node game registry tests. Redux, Zustand, Nx, Turborepo, a second API
server, and a new shared package are explicitly out of scope.

## Startup and loading boundary

Native process startup is branded before React mounts: both Expo configs use
the supplied orange Huddle symbol on `#FFF7F2`. Once JavaScript is
available, `@huddle/ui/native` supplies the shared Animated entry transition,
brand pulse, and activity indicator. The apps own the words and lifecycle state
shown around those primitives.

The TV `boot` feature is the only renderer used before a safe Room Code exists.
It distinguishes font startup, room creation, automatic reconnection, and a
configuration failure that cannot make progress. It retains the existing
full-viewport TV background and never renders empty code tiles or a blank QR.
The Controller similarly renders explicit font-startup and session-restoring
surfaces; pending mutations remain on their owning screen with an activity
indicator and an accessibility `busy` state. Platform screen transitions may
fade/scale the whole surface, while gameplay animation remains module-owned.

## Implemented pre-game and finish flow

The pre-game TV experience has three distinct product states:

1. **Room** — players join with the code or QR while the TV shows the roster.
2. **Browse Games** — the Host scrolls on the phone and the TV follows the
   highlighted game card.
3. **Game Setup** — the Host explicitly selects a game, the TV leaves the
   carousel, and the phone's draft settings are mirrored on the TV.

Browsing and setup are different states. Moving the highlight while scrolling
must not start setup; the explicit game-selection action does. The setup
projection contains only shared game metadata and draft settings, so it is safe
for the TV and other players to read.

Start is a phone action, not a fourth screen. It validates the selected game's
requirements, locks the draft settings, and creates the running-game record.
The TV and controllers then mount the selected `GameModule` screens. The
platform owns the room, browse/setup projection, and lifecycle transition; the
module owns gameplay visuals, rules, scoring, and its finished beat.

The current surface selectors implement Room, Carousel, Game Setup, Game, and
recovery as separate platform states. Game Setup is driven by the shared
`rooms.setup` projection, not inferred from the Host phone's local component
state. The Host-only select/configure/cancel/start mutations validate the game
and settings at the Convex boundary; Start stores immutable settings with the
running game and clears the draft atomically.

When a module reaches its finished beat, the phone mounts the platform-owned
`FinishedScreen` over the module's summary. Replay is Host-authorized, requires
a server-confirmed finished runtime, and creates fresh state with the locked
settings and current roster. Choose-another and manage-player actions end only
the game, preserving the room and roster.

## Current Convex boundaries

Public modules keep their generated paths and function names stable. The
obsolete `rooms.createRoom` mutation is retired; `rooms.openRoom` is the sole
room-opening API. Private helpers are plain functions and never register Convex
functions:

```text
convex/convex/lib/
  authorization.ts # member/host/session-token gates
  room-lifecycle.ts # room-owned-row and deadline deletion
  presence.ts      # roster and player presence reads
  game-clock.ts    # deadline scheduling, pause, resume, cancellation
  game-runtime.ts  # decode, version, projection, unavailable reporting
```

`tvSessions` carries high-churn TV heartbeat data (`roomId`, `sessionToken`,
`lastSeenAt`, `away`, and the silence-check generation) indexed by token and
room. `rooms.tvAway` is the stable room lifecycle flag. Heartbeats update only
`tvSessions`; one self-rearming silence-check chain observes them, and duplicate
legacy callbacks fold into that generation. Pause/resume touches the room/game
atomically. A room is deleted with players and its TV-session row after ten
minutes of TV silence. The old unjoined-room timer is removed.

## Versioned game runtime

`GameModule` is the client-safe metadata/settings/screens contract;
`GameLogic` is its separate server-only rules contract with `stateVersion`,
strict `decodeState`, strict `decodeEvent`, and required `redactStateFor`.
Trivia and Voting keep their Zod 4 schemas behind server-only `/logic` entry
points. Static boundary tests reject value imports from the client registry or
Trivia client sources into server logic/questions. The Convex layer validates
initial state, overwritten events, reducer output, and deadlines before storage
or scheduling. Any missing module, wrong version, invalid value, projection
failure, or thrown runtime produces an unavailable projection and never exposes
raw state.

The running projection is one of:

```ts
null
| { kind: "running"; gameId: string; state: unknown; clockRemainingMs?: number }
| { kind: "paused"; gameId: string; reason: "tvDisconnected" | "playerDisconnected" }
| { kind: "unavailable"; gameId: string }
```

Paused and unavailable values contain no game state. TV and player loss share
one exact `pausedRemainingMs`; overlapping pauses never replace that remainder
with zero. `playerPaused` records the durable Host-decision boundary. The game
auto-resumes when every seat reconnects, or the current Host may call
`continueAfterDisconnect` at any connected player count. TV loss takes display
precedence and must recover before the clock can run. A valid running game
reports the authoritative remainder for TV countdown display. Hosts retain a
Back to lobby control, but game controls never mount for paused/unavailable
projections.

## TV session lifecycle

The TV reads or creates `huddle.tv-session-token.v1` using `expo-secure-store`.
The credential is generated with `expo-crypto` `Crypto.randomUUID()` and is
persisted before `rooms.openRoom` is called. A storage error renders a retrying
trouble state and opens no room. Invalid stored credentials are replaced and
persisted before use; there is no in-memory fallback.

`rooms.openRoom({ tvSessionToken })` is transactional and idempotent. A valid
session restores the same room/code; a stale row whose room is gone is cleaned
up before a replacement is created. Only brand-new tokens consume the global
rate-limit bucket (10 new rooms/minute, capacity 20). The TV sends a 3-second
heartbeat. At 13 seconds of silence Convex marks the session and room away,
cancels the active deadline, and stores `max(0, deadlineAt - now)`. While away,
game events and carousel movement are inert and starting a game returns
`tvUnavailable`; roster, leave, host transfer, and ending the game remain
available. A returning heartbeat restores the room and exact beat, unless the
runtime is invalid, in which case the unavailable projection lets the Host
return to the lobby.

The TV credential owns room lifetime independently of the roster. When the last
player deliberately leaves, the game clock is cancelled and the same room/code
returns to an empty lobby. Only TV-session expiry deletes a production room;
this keeps an open TV ready for the next party while still collecting a room
after the TV app has remained closed through the recovery window.

## Delivery and migration constraints

Features 6 and 7 are delivered in the ordered tasks in
`docs/implementation-plan.md`.
The repository intentionally retains optional compatibility fields. No cleanup
mutation or schema-tightening deployment has been run as part of Features 6 or
7. Before any deployment that removes compatibility, first run the read-only
orphan/legacy audit. If it finds rows, cleanup is a separately approved
migration; only after the audit is clean may fields become required and cleanup
code be removed. BR-009 means those development rows are discarded, never
decoded as or transformed into current runtime state.

Retiring `rooms.createRoom` does not itself authorize a Convex deployment. A
read-only orphan-room audit must precede deployment; if it finds cleanup work,
that cleanup is a separately approved migration and never part of this
behavior-preserving refactor.
