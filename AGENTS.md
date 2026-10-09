# Huddle

Start with the remaining current documentation under `docs/`. Product behavior
belongs in `project-scope.md`, runtime boundaries in `architecture.md`,
technology/commands in `tech-stack.md`, and current tasks in
`implementation-plan.md`.

Keep Expo, Convex, pnpm workspaces, one Android TV codebase, the game-registry
client/server seam, shared primitives, existing assets, and the warm living-room
palette intact unless an active task explicitly changes them. Current package
roots are `apps/phone`, `apps/tv`, `games/*`, `packages/contracts`,
`packages/domain`, `packages/design-tokens`, `packages/ui`, and
`packages/game-registry`.

Do not hand-edit `convex/convex/_generated/ai/guidelines.md`. Never run the
development reset against production or leave its environment gate enabled.

## Documentation and dependency research

The project-scoped `.codex/config.toml` provides Context7 for current
third-party documentation. Prefer the installed dependency version and use
Context7 when its current API or configuration is relevant. If Context7 does
not cover the needed detail, use the dependency's official documentation or
source as the fallback; do not guess about version-sensitive behavior.

## Verification

There are no unit, render or integration tests; the project keeps end-to-end
tests only, as Maestro flows in `e2e/`. Do not add other kinds of tests. Use the smallest
check that gives confidence, and preserve unrelated dirty-worktree changes.

- Typed code: `pnpm typecheck` and `pnpm lint`.
- Architecture or boundary changes: `pnpm validate:architecture`.
- Docs and scripts: `pnpm validate:workflow`.
- Trivia question content: `pnpm validate:packs`.
- Client/server bundle boundaries: `pnpm verify:bundle-seam` on a fresh export.
- Dependency or production-security changes: `pnpm verify:dependency-security`
  or `pnpm audit:prod`.
- Behaviour: play it on the simulators against `pnpm dev:local`.
- End-to-end: `pnpm e2e:bomb-squad` with `pnpm dev:local` running and the
  phone app open on a booted iPhone simulator. It seeds a room with a fake TV
  and three bots, then drives the phone from join to the first bomb.

Record the commands run and whether a failure is introduced, pre-existing, or
blocked by the environment.

## Working notes

- Dev builds: the TV Metro runs on port 8081 and the phone Metro on 8082. Run
  them without `CI=1`, which turns off file watching. The Android TV emulator
  needs `adb reverse tcp:8081 tcp:8081`. If a phone keeps showing old game
  code after an edit under `games/`, reload the app; Fast Refresh does not
  always reach game packages.
- Room views (roster, setup, browsed card, running game) answer only the
  room's TV, which passes `tvSessionToken`, or a seated phone, which passes
  `sessionToken`. A new room query must use `roomViewer` from
  `convex/convex/lib/authorization.ts`. Changing these arguments breaks clients
  in both directions, so follow the release order in
  [`docs/implementation-plan.md`](docs/implementation-plan.md).
- Game packages animate with React Native `Animated`, never Reanimated, and keep
  their own palettes: the Cosmic Quiz colours belong to `games/trivia` only.
  `pnpm validate:architecture` enforces both.
- Runtime artwork is pinned by file name, size, alpha and SHA-256 in
  `tools/validate-architecture.py`. Replacing an image means updating its
  spec. PNG and JPEG are both read; use JPEG for opaque, photo-like backdrops.
- Use the shared text components (`PlayroomText`, `HuddleText`, Trivia's
  `CosmicText`) rather than a bare `Text`. They cap how far type follows the
  system text size (`fontScaleCap`), so display headings do not split
  mid-word at the largest accessibility sizes.
- Trivia keeps `playerRange.min: 1` so a single device can test the whole flow;
  Bomb Squad needs 3 players (use the bot scripts or more simulators).
- Check visual changes on the iPhone simulator and the Android TV emulator. Cover a guest phone, ten players, long names,
  reduced motion and the largest text size when the change touches them.

## GitHub publishing from Codex

The managed sandbox restricts `.git` writes and outbound GitHub access. Run
`git add`, `git commit`, `git push`, and networked `gh` commands with elevated
access. A sandboxed `gh auth status` failure is not credential proof; repeat it
with elevated network access. After push, prefer the connected GitHub app for
pull-request changes.
