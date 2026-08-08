# Session State

## Current task

None in progress. **5.6 is complete**, which closes the last required MVP task.
The work is committed on a branch with a PR open for review.

## Where the plan stands

Every required task is checked. What remains is optional or follow-up:

- **5.8** — (optional) remember last-used name/avatar locally. Not started.
- **5.9** — (follow-up, raised by 5.6's security review) keep `@huddle/packs`
  out of the Controller bundle. The wire no longer carries unplayed questions or
  their answers, but the pack is still reachable from the client entry point and
  `questionsFor` is deterministic, so a *modified* client can reproduce the deal.
  Structural fix: the client-side `GameModule` would stop carrying
  `createInitialState`. Not started.

## What 5.6 changed

Two blocking findings, both fixed, then two rounds of independent review:

- **B1** — `games.running` broadcast the game state whole, so every phone and the
  TV saw each player's answer before the reveal. Fixed with an optional
  module-owned `redactStateFor(state, viewer)` on `GameLogic`; the viewer is
  resolved from the Session Token server-side (`viewerIn`), never claimed by a
  client. It is a read-only view — `reduce` still runs on the stored row.
- **B2** — no host "end the room" control. Added `rooms.endRoom` behind the
  shared gate in the new `convex/convex/host-control.ts`, with a confirm sheet.
  Lobby-only by design; recorded as a scope note on 5.6.
- **The dealt questions leaked too** (security review): `correctIndex` for every
  question plus all future text. The first fix covered only the question phase,
  so the five-second reveal still handed over the rest of the game — caught on
  re-review, then closed on every beat.
- **The phones never returned to the Join Screen** (code review): `players.session`
  was a one-shot read. The seated screen now subscribes to its seat, which also
  covers `removePlayer` and expiry.

## Checks

`pnpm typecheck` clean (9 workspaces); `pnpm lint` clean; `pnpm test` green —
**771 passed, 64 files** (746 before this work).

Independent code review and security review both **PASS** on the final tree.

**Not verified on hardware:** both phones reaching the Join Screen after a Host
ends the room, and the TV opening a fresh room afterwards. Worth doing on device
before release, along with watching a live reveal payload on the wire.

## Next action

The user's call. Options: 5.8, 5.9, the hardware verification above, or the
smaller residuals 5.6 recorded (`expireRoom` does not cancel a game deadline
unlike `endRoom`; a removed player gets no explanation on the join form; the
confirm-sheet shell is duplicated between the manage sheet and the end-room
sheet).
