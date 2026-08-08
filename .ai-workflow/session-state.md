# Session State

## Current task

**5.9 — keep the Question Pack out of the Controller bundle** is **implemented and
verified** on branch `fix/5.9-pack-out-of-client-bundle`. Tests, typecheck, and
lint are green. Independent security review **still to run** (trust-boundary
change — this is anti-cheat). PR: opened, left for the user to review/merge.

## Where the plan stands

Every required MVP task is checked, plus optional 5.8 and now 5.9. 5.6's three
smaller residuals shipped earlier on `fix/5.6-residuals` (PR #22). Nothing
substantive remains in the plan.

## What this change did (5.9)

The leak: `@huddle/packs` (`CURATED_PACK` — every question and its answer) was
reachable from the Controller because the trivia module carried the rules and
the deal, and `questionsFor` is deterministic. The real graph was worse than the
plan's one-liner — the client *screens* pulled `./logic` (and the pack) through
pure helpers, and the barrel re-exported the logic value.

1. **`GameModule` no longer `extends GameLogic`** (`packages/game-core/src/game-module.ts`).
   The client type is now metadata + settingsSchema + screens, no rules. The
   type is the seam; `registry.test.ts` asserts the module carries no
   `createInitialState`/`reduce`.
2. **Pack-free selectors moved to `trivia/src/state.ts`** — `revealBeat`,
   `answersIn`, `playersCounted`, `beatOf`, `QUESTION_SECONDS`, `REVEAL_SECONDS`.
   `logic.ts` imports them back and re-exports them (server/tests unchanged); the
   screens (`controller-screen.tsx`, `watching.ts`) now import them from
   `./state`, so no client file value-imports `./logic`.
3. **Client-safe category names** — new `@huddle/packs/categories`
   (`curated-categories.ts`, `CURATED_CATEGORIES`), drift-guarded by
   `curated-categories.test.ts`. `trivia/src/settings.ts` imports names from
   there instead of `./questions`.
4. **Barrel carries no rules** — `trivia/src/index.ts` re-exports the module and
   types only, using `export type { … }` (the `export { type … }` value-block
   form keeps a runtime edge and re-leaks the pack).
5. **Modules assembled field-by-field, not `...spread`** — `trivia.ts`,
   `voting.ts`. Voting got the same shape (its prompts are opinion, not answers,
   so not a security case, but the pattern is uniform).

## Guards added

- eslint `no-restricted-imports` bans `@huddle/packs` in `apps/**` and
  `packages/games/*/src/**` except the server-only `questions.ts` and tests.
- `trivia/src/client-seam.test.ts` — source tripwire: the client entry/module
  must reach `./logic`/`./questions` through type-only imports.

## Checks

`tsc -b` clean; `eslint` clean; `vitest` green — **797 passed, 68 files**.
**Bundle-verified**: bundling the client registry entry with esbuild shows
`huddle-classics.json`, `curated-pack.ts`, `questions.ts`, `logic.ts` absent from
the client module graph and no question text in the output; the server's
`games.test.ts` still deals a game unchanged.

## Next action

Run the independent **security review** (workflow-security-reviewer) on the
branch diff — the mandated gate for a trust-boundary change. Resolve any blocking
finding, then the PR is ready for the user to merge.
