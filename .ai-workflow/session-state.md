# Session State

## Current task

**3.7 — Host management controls (transferHost + removePlayer) — BACKEND +
CLIENT PLUMBING DONE, host-roster screen UI remains.** Added by 5.4 to close
findings F1/F2. Then **5.4** can close (its ⛔ rows are now backend-covered), and
**5.6** (final scope/architecture review) remains. Optional: **5.8**.

## What changed (3.7)

- `packages/game-core/src/host-control-rejection.ts`: new `HostControlRejection`
  type (notInRoom · notHost · targetNotInRoom · targetIsSelf · targetAway),
  exported from index.
- `convex/convex/players.ts`: `transferHost` and `removePlayer` mutations +
  shared `hostSeatAndRoom` / `targetSeatIn` helpers. Transfer hands the room to a
  chosen connected seat (away target refused); removal deletes the seat,
  invalidating its token. Both host-gated by Session Token.
- `apps/controller/src/host-control-rejection.ts` (+ test): maps each refusal to
  a host-readable line, mirroring `game-rejection.ts`.
- `packages/game-core/src/room-phase.ts`: corrected the stale "no way to remove a
  player" comment. Plan 3.2/3.3 notes corrected to point at 3.7.

## Checks / reviews

- `pnpm typecheck` clean; `pnpm lint` clean; `pnpm test` green — **739 passed**
  (was 721; +13 convex host-control tests, +5 controller mapper tests),
  **63 files**.
- **Independent security review: PASS** (workflow-security-reviewer). Token-first
  authorization complete; cross-room and self-target guards hold; credential
  invalidation via row deletion total; no mid-game beat deadlock (server clock);
  no info disclosure/DoS beyond existing public-mutation envelope.
- (The independent *code*-review subagent for 5.4 earlier could not finish —
  account monthly spend limit; 5.4 self-review was inline. 3.7's security review
  did complete.)

## Remaining for 3.7

Wire the two controls into the Host's roster screen
(`apps/controller/app/index.tsx`). This is design-informed —
`docs/design/design-handoff.md` §5 defines the roster and does not yet specify
transfer/remove affordances — and RN screen code is not unit-tested per the
stack. A spawn_task chip was raised for it. Until it lands, the capability is
tested and authorized but not reachable from the UI.

## Next action

Decide the host-roster UI approach (design §5 addition) and wire
`transferHost`/`removePlayer` with confirm affordances + the mapper's failure
lines. Then close 3.7 and 5.4, and start 5.6.

## Open PRs (unmerged; stacked, merge in order)

- PR #14 `chore/5.7-controller-rn-tvos-fork` — 5.7 RN-fork alignment + scope→10.
- PR #15 `chore/5.4-acceptance-matrix` (base #14) — 5.4 matrix + Voting hub suite.
- 3.7 stacked on the 5.4 branch (shared plan/matrix/session-state files would
  otherwise conflict). See its PR.
