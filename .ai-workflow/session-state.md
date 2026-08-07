# Session State

## Current task

**5.4 — multiplayer acceptance matrix across both games — MATRIX DELIVERED,
BLOCKED on two product decisions (F1/F2).** Not markable complete until F1/F2 are
resolved. After that: **5.6 — final scope/architecture review** (should adopt the
matrix + findings). Optional: **5.8** (remember last-used name/avatar).

## What changed (5.4)

- New `docs/acceptance-matrix.md`: every approved MVP workflow (`project-scope.md`)
  mapped to a passing automated or documented-manual check, with **Trivia and
  Voting** columns and a legend (✅ automated · 🔁 game-agnostic · 🧪 manual ·
  ⛔ gap). Includes a Findings section and a per-release manual checklist.
- New `convex/convex/voting-lifecycle.test.ts` (19 tests): drives the
  game-agnostic Convex hub with `gameId: 'voting'` — the automated "second game
  included" backbone. Covers start/range/settings, event dispatch, anonymous-
  tally privacy at the wire boundary, away-in-game, both server-clocked beats,
  end/replay, mid-game late-join, and Trivia↔Voting switching (no state leak).
- `implementation-plan.md` 5.4 note updated (cap wording 10; delivered vs
  blocked); this file.

## Checks

- `pnpm typecheck` clean; `pnpm lint` clean; `pnpm test` green — **721 passed**
  (was 702; +19), **62 files** (was 61). Voting suite alone: 19/19.
- Independent code-review: **could not complete** — the workflow-code-reviewer
  subagent was cut off by the account monthly spend limit after one finding
  (a file-count typo in the matrix, since fixed to 62). Self-review done inline:
  each new test fails if the hub is broken (away-test needs real presence-feed to
  reveal; switch-test proves no leak both directions; privacy-test guards the
  wire key-set). Re-running the independent review is a recommended follow-up
  once the limit resets.

## Blockers / decisions to raise

- **F1 — manual host transfer is not implemented.** Scope lists it; only
  automatic presence-driven `handOverRoom` exists (no mutation to hand the room
  to a chosen player while connected). No check can pass. Decide: implement a
  `transferHost` mutation, or amend the scope to automatic-only.
- **F2 — host-initiated player removal is not implemented.** Scope lists "remove
  players"; there is no `removePlayer` mutation. Decide: implement, or amend the
  scope.
- **F3 — TV recovery is modeled via player presence + room expiry, not a TV
  heartbeat/pause phase.** Outcome holds; wording mismatch. Reconcile in 5.6.
- The plan's 3.2/3.3 notes claim manual transfer + removal are "Done" — that is
  inaccurate given F1/F2 and should be corrected when F1/F2 are decided.

## Next action

Get the F1/F2 decision (implement vs. amend scope). If implement: plan a small
capability task for `transferHost` + `removePlayer` (host-authorized mutations,
old-participant invalidation on removal, tests, and the controller host-control
UI). If amend: update `project-scope.md` Host + Phone-Disconnection sections and
the 3.2/3.3 plan notes, then 5.4's ⛔ rows become documented decisions and 5.4
can close. Then proceed to 5.6.

## Open PRs (unmerged; stacked)

- PR #14 `chore/5.7-controller-rn-tvos-fork` — 5.7 RN-fork alignment + scope→10.
- 5.4 work is stacked on that branch (shared plan/session-state files would
  otherwise conflict). See its PR.
