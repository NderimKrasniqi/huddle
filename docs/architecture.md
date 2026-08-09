# Huddle Architecture

> Reconciled 2026-08-10 for **F-007 Full-Codebase Behavior-Preserving Refactor**.
> Phases 1–5 remain the frozen product baseline. This document records the
> repository-informed target boundaries for Feature 6 without changing Expo,
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
the TV is away), and **BR-009** (legacy development rooms are discarded rather
than migrated).

## Current repository shape

The current implementation is a pnpm workspace with Expo Router apps under
`apps/controller` and `apps/tv`, Convex functions under `convex/convex`,
platform contracts under `packages/game-core` and `packages/game-registry`,
game modules under `packages/games/*`, and shared tokens/primitives under
`packages/ui`. Expo route adapters are thin. The Controller root screen owns
only deep-link/session composition, while the TV root screen owns room opening,
live subscriptions, and pure surface selection. Both apps keep rendering,
styles, feature hooks, and platform lifecycle code behind explicit entrypoints.

## Target app boundaries

```text
apps/controller/src/
  screens/                     # deep-link/session composition
  features/{join,room,game-picker,game-session}/
  platform/{convex,session,presence,storage}/
  ui/                          # controller-only primitives

apps/tv/src/
  screens/                     # room opening, subscriptions, surface selection
  features/{room,carousel,game-session}/
  platform/{convex,room-session}/
  ui/                          # TV-only primitives
```

Expo Router files in `apps/*/app` become thin adapters that mount a root
coordinator. Features own screens, styles, pure models/helpers, and adjacent
tests. Platform folders own Convex bindings, credentials, secure storage, and
presence. Cross-feature deep imports are prohibited; each feature exposes a
small model entry point plus an explicit native UI entry point where required.
Only genuinely cross-app tokens and primitives live
in `@huddle/ui`. Redux, Zustand, Nx, Turborepo, a second API server, and a new
shared package are explicitly out of scope.

## Target Convex boundaries

Public modules keep their generated paths and function names stable except for
the intentional `rooms.createRoom` → `rooms.openRoom` replacement and the new
TV APIs. Private helpers are plain functions and never register Convex
functions:

```text
convex/convex/lib/
  authorization.ts  # member/host/session-token gates
  room-lifecycle.ts # open, pause, resume, expiry, deletion
  presence.ts       # player and TV presence transitions
  game-clock.ts     # deadline scheduling and cancellation
  game-runtime.ts   # decode, version, projection, unavailable responses
```

`tvSessions` carries high-churn TV heartbeat data (`roomId`, `sessionToken`,
`lastSeenAt`, `away`) indexed by token and room. `rooms.tvAway` is the stable
room lifecycle flag. Heartbeats update only `tvSessions`; pause/resume touches
the room/game atomically. A room is deleted with players and its TV-session row
after ten minutes of TV silence. The old unjoined-room timer is removed.

## Versioned game runtime

`GameLogic` is a server/client contract with `stateVersion`, strict
`decodeState`, strict `decodeEvent`, and required `redactStateFor`. Trivia and
Voting keep their Zod 4 schemas behind server-only `/logic` entry points. The
Convex layer validates initial state, overwritten events, reducer output, and
deadlines before storage or scheduling. Any missing module, wrong version,
invalid value, projection failure, or thrown runtime produces an unavailable
projection and never exposes raw state.

The running projection is one of:

```ts
null
| { kind: "running"; gameId: string; state: unknown; clockRemainingMs?: number }
| { kind: "paused"; gameId: string; reason: "tvDisconnected" }
| { kind: "unavailable"; gameId: string }
```

Paused and unavailable values contain no game state. A paused game resumes with
the exact stored `pausedRemainingMs`, while a valid running game reports the
authoritative remainder for TV countdown display. Hosts retain a Back to lobby
control, but game controls never mount for paused/unavailable projections.

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

## Delivery and migration constraints

Feature 6 is delivered in the ordered tasks in `docs/implementation-plan.md`.
Convex schema rollout is staged: add optional fields and a development-only
internal cleanup mutation, purge ephemeral development rows, verify zero legacy
rooms/players/sessions, then deploy required fields and remove the cleanup
mutation. The purge must never be run against production without separate
approval. Every implementation task receives a code review; runtime,
credential, authorization, migration, rate-limit, and TV-presence tasks also
receive a security review.
