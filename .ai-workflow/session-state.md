# Session State

## Current task

**2.4 — Build the Voting/Test game — DONE.** Next executable task: **5.7 —
align the Controller to the `react-native-tvos` fork** (small stack
correction), or **5.4 — multiplayer acceptance matrix across both games**.

## What changed (2.4)

- New package `packages/games/voting` ("Hot Takes"): a second `GameModule` built
  only against `@huddle/game-core` — `logic.ts` (state/reducer/timers),
  `settings.ts` (one `rounds` setting), `prompts.ts` (self-contained, no packs),
  screen-logic (`voting-controller.ts`, `voting-tv.ts`), screens
  (`controller-screen.tsx`, `tv-screen.tsx`), `voting.ts` module assembly,
  `index.ts`, and four test files.
- Registered by one entry each in `packages/game-registry/src/registry.ts` and
  `.../logic.ts`; dep added to `game-registry/package.json` and root
  `package.json`. **No `convex/` changes** — the hub was not touched.
- Fixed two stale registry/carousel tests that assumed a single installed game,
  and refreshed one stale `carousel.ts` comment.

## Checks / reviews

- `pnpm typecheck` clean; `pnpm lint` clean; `pnpm test` green — **702 passed**
  (was 666; +36 for voting).
- Independent code-review: **PASS**. Independent security-review: **PASS**
  (individual-vote attribution is never stored; two LOW/informational items are
  pre-existing platform properties shared with Trivia, hub-only, out of scope).

## Blocker / decision to raise

**Discovered discrepancy: `ROOM_PLAYER_CAP` is 10, but `project-scope.md` says
"up to 12 players" (twice).** Both games cap at 10 to respect the code. This is
a scope-vs-implementation conflict the earlier reconciliation missed — it needs
a decision: lift the platform cap to 12 (code change), or amend the scope to 10.
Not changed here; task 2.4 respected the real cap.

## Next action

Start 5.7: switch `apps/controller` from `react-native@0.86.0` to
`npm:react-native-tvos@~0.86.0-2` (the TV already uses the fork; tech-stack
requires all apps to match), reinstall, and confirm typecheck/tests/local build.

## Other remaining work (see implementation-plan.md)

- 5.4 — multiplayer acceptance matrix across both games.
- 5.6 — final scope/architecture review including the Voting game.
- 5.8 — optional: remember last-used name/avatar in AsyncStorage.
