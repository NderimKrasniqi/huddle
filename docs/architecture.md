# Huddle architecture

## Workspace boundaries

```text
apps/phone ─┐
apps/tv ────┼─> @huddle/game-registry ─> games/{trivia,voting}
            ├─> @huddle/ui ─> @huddle/design-tokens
            └─> @huddle/domain ─> @huddle/contracts

convex ─> @huddle/game-registry/logic ─> game logic exports
       └> @huddle/domain ─> @huddle/contracts
```

- `@huddle/contracts`: wire-safe types, validators, module interfaces, and
  rejection unions. It has no domain or client dependency.
- `@huddle/domain`: pure room, presence, settings, lifecycle, readiness, join,
  and credential rules. It depends only on contracts.
- `@huddle/design-tokens`: canonical Soft Minimal values and Tailwind preset.
- `@huddle/ui`: focused shared native primitives and asset renderers.
- `games/*`: independent module metadata/settings/logic and module-owned Phone
  and TV screens. Production exports never include `future/`.
- `@huddle/game-registry`: ordered client module list and separate server logic
  entry. The Convex seam must never import native screens.
- `apps/phone` and `apps/tv`: thin Expo Router adapters plus platform-specific
  orchestration. `app/scan.tsx` delegates to `src/features/scan`.
- `convex`: authority for room, seat, presence, setup, readiness, rate limits,
  and running proof state.

The dependency graph is acyclic and validated by `tools/validate-architecture.py`.

## State and authority

Convex owns one room record, optional setup, optional running game, seats, and
TV credential. Clients subscribe to public projections; they never decide room
phase. Setup flows `configuring → ready → absent while running`. Ending clears
game, setup, selection, browsing, and readiness while keeping the room code,
roster, and Host.

`GameModule` is the client-safe screen contract. `GameLogic` provides runtime
decode, initial state, reducer, deadline, and public/private projection. Proof
modules decode versioned `entered` state, reject all events, and schedule no
deadline. The registry’s `/logic` export keeps React Native and Trivia future
content outside the Convex bundle; bundle-seam checks keep future content out
of clients.

## Security boundaries

- Phone SecureStore session credentials authenticate seats and Host actions.
- TV SecureStore credentials restore/authorize the TV-owned room.
- `guestId` is UUID-shaped non-secret metadata only and cannot query a session.
- Public mutations derive player identity from credentials; callers cannot
  supply authoritative player IDs.
- Token buckets reject with `{kind, operation, retryAfterMs}`. Heartbeats and
  internal callbacks are exempt so a limit cannot manufacture absence.

## Migration constraints

`@huddle/phone` uses native identity `huddle-phone` / `tv.huddle.phone`.
Existing installs under a different native identity and their local storage do
not migrate in place; remove earlier Huddle builds before validating
`huddle://` routing. Development data is intentionally reset: run
`developmentReset:audit`, briefly enable both
development-only environment gates, invoke the confirmation-literal reset,
verify zero active rows, disable the gate, then deploy the strict runtime.
Never enable or invoke the reset in production.
