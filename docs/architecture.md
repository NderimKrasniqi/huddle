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
  server-logic entry. The registry order is Trivia, Voting, Doodle Dash, Quick
  Poll, Hot Take; the last three are presentation-only entries.
- `games/trivia` and `games/voting` own metadata, settings, prompts/content,
  state, deadlines, events, redacted projections, and their Phone/TV screens.
  Their running-TV and private Phone presentation is intentionally game-local:
  Trivia owns its Cosmic Quiz look (night-sky TV, cream answer pad, alien
  mascot) in `games/trivia/src/cosmic.tsx`, while Voting owns its
  poster/sticker room-mood theme in `games/voting/src/tv-theme.ts`. Each game
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

The generic platform never branches on Trivia or Voting rules. Adding another
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

Trivia's TV reveal receives normalized verdicts and standings. Voting's TV
reveal receives aggregate counts and optionally grouped labels after reveal;
Voting never creates a winner or score. Client projections clear internal
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
  `@huddle/ui/native`; the Trivia and Voting game worlds do not use it.
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
countdown fields on setup. Trivia and Voting state
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
