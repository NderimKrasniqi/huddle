# Huddle architecture

## Workspace boundaries

```text
apps/phone ─┐
apps/tv ────┼─> @huddle/game-registry ─> games/{trivia,voting}
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
- `@huddle/design-tokens` owns the exact Heartbeat palette, semantic colors,
  Nunito typography, spacing, radii, shadows, and reduced-motion durations.
- `@huddle/ui/native` owns shared native primitives: screen shell, text,
  buttons, code tiles, portraits, rows, chips, badges, game cards, loading,
  status, and artwork resolution. It does not own Convex state or game rules.
- `@huddle/game-registry` owns the ordered client catalog and the separate
  server-logic entry. The registry order is Trivia, Voting, Doodle Dash, Quick
  Poll, Hot Take; the last three are presentation-only entries.
- `games/trivia` and `games/voting` own metadata, settings, prompts/content,
  state, deadlines, events, redacted projections, and their Phone/TV screens.
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
Phone: restore → room code/scan → identity → lobby → picker → setup → ready
TV:    boot/restore → invitation → carousel → setup → ready
Both:  start → module-owned runtime → pause/recovery/finish → Back to lobby
```

`startGame` is the hard handoff. Before it, Huddle owns catalog browsing,
module-declared setup, Host management, roster/presence, readiness, and action
busy/failure state. After it, the selected module owns the loop and supplies
two projections:

- a private Phone controller projection addressed to one player seat;
- a shared TV presentation projection that contains only room-safe information.

The generic platform never branches on Trivia or Voting rules. Adding another
installed game means adding a module and registry entry, not adding game logic
to Phone or TV coordinators.

## Authority and privacy

Convex mutations derive seat identity from SecureStore session credentials.
`guestId` is non-secret continuity metadata. `joinAvailability` only reports
capacity and claimed avatar IDs; `joinRoom` is the authoritative membership
mutation. Host transfer/removal, setup locking, Ready, Start, pause, end, and
Back to lobby remain server-authorized and guarded per action on the Phone.

The redaction contract is part of each module's logic, not a renderer
convention:

| Surface | Allowed | Withheld |
| --- | --- | --- |
| TV stage | shared prompt, timer, participation, aggregate tally, reveal, recap, standings | raw player-to-choice mapping, private controls, hidden/future content |
| Player Phone | that player's choices, lock state, busy/error feedback, eyes-up guidance | other players' choices/timing, hidden answer key, pre-reveal correctness, future prompts |

Trivia's TV reveal receives normalized verdicts and standings. Voting's TV
reveal receives aggregate counts and optionally grouped labels after reveal;
Voting never creates a winner or score. Client projections clear internal
history fields so a renderer cannot accidentally reconstruct private data.

## Native presentation boundaries

All visible copy, controls, room codes, QR output, status marks, accessibility
roles, and focus behavior are native. Raster artwork is decorative and text-free.

- Phone room-code entry uses the shared Heartbeat shell and join environment;
  identity is a separate `Pick your vibe` screen with the remembered profile,
  claimed-avatar handling, and authoritative join.
- Phone scan is the only `CameraView` surface. It accepts QR only and falls
  back to manual entry for malformed, denied, unavailable, or missing rooms.
- TV Room Invitation is the only QR renderer. It displays the authoritative
  code, native Huddle mark, join link, and live roster.
- TV boot, room invitation, carousel, setup, ready, runtime, paused,
  unavailable, and finished surfaces are display-only. They do not render
  buttons, pressables, inputs, positive focus targets, or D-pad actions.
- Phone lifecycle, Host management, setup, and game controls use native
  touch-targeted controls. No TV control is mirrored as a hidden focus target.
- NativeWind, Tailwind, CSS interop, Reanimated, Expo Image, Lucide, and
  NetInfo presentation imports remain absent. `react-native-worklets@0.10.1`
  exists only as the native compatibility pin required by the Expo toolchain.

## Assets and motion

The retained visual references are the Huddle direction board and approved
screen set under `docs/design/heartbeat/reference/`. They are design references
only and are never imported by an app. The React Native surfaces have completed
their fidelity pass against that set. Current runtime images under
`packages/ui/assets/heartbeat`, optimized avatars under
`packages/ui/assets/avatars`, and launcher derivatives under
`packages/ui/assets/app-icons` remain implementation assets, not source masters.
The architecture validator checks the runtime bundle
directly for its exact file set, dimensions, alpha channels, and digests; it
does not require a design manifest or source-master tree.

Nunito Regular, Bold, and ExtraBold load in both Expo layouts before the native
splash hides. Heartbeat loading marks, room reveal, selection, success, and
module transitions use tokenized durations. When reduced motion is requested,
the state change is immediate and the mark/art remains static; essential copy
never depends on animation.

TV layouts use a 1920×1080 stage, a 5% overscan-safe frame, and scale down to
1280×720. Phone layouts use Safe Area insets and a scrollable single column.

## Compatibility and verification

Convex schema, room lifecycle, session tokens, stable avatars, and the
client/server `GameModule` seam remain unchanged. Trivia and Voting state
decoders still read legacy persisted `entered` records safely; they do not
reinterpret old data as a new playable state.

High-signal repository checks are:

```sh
pnpm validate:architecture
pnpm validate:game-contracts
pnpm verify:bundle-seam -- <fresh-export-directory>
pnpm test:render
pnpm typecheck
pnpm lint
```

The remaining release evidence is outside static validation: real camera
permission and QR join, mixed-phone reconnect/seat-loss traversal, and the final
physical Phone + Android TV living-room party check.
