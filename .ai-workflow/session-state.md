# Session State

## Current task

**2.4 — Build the Voting/Test game as the second module**

This is the first executable remaining task after the 2026-08-07 reconciliation.
Huddle is implemented through Phase 5 (typecheck clean; 666 Vitest tests green).
The platform, Trivia, recovery, and hardening are done. The Voting game is the
one MVP feature still missing — the approved scope requires a second game to
prove the platform is genuinely game-independent, and `GAME_REGISTRY` is
currently `[triviaGameModule]` only.

## Blockers

None. The platform is ready: `packages/game-core` defines the `GameModule`
contract, `packages/game-registry` installs games as a list, and the room/
session/lifecycle code stores game state opaquely — a second game should need
no changes to `convex/convex/{rooms,players,games}.ts`.

## Next action

Create `packages/games/voting` as a new `GameModule` built only against the
`@huddle/game-core` contract: a single prompt-and-vote loop whose per-participant
vote stays participant-private until reveal and whose shared prompt/tally is
projected to TV public state. Model it on `packages/games/trivia`. Do **not**
implement it yet under this planning pass — begin when starting `/implement-task`.

## Other remaining work (see implementation-plan.md)

- 5.7 — align the Controller to the `react-native-tvos` fork (stack correction).
- 5.4 — run the multiplayer acceptance matrix across both games (after 2.4).
- 5.6 — final scope/architecture review including the Voting game (last).
- 5.8 — optional: remember last-used name/avatar in AsyncStorage.
