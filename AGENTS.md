# Huddle

Start with the remaining current documentation under `docs/`. Product behavior
belongs in `project-scope.md`, runtime boundaries in `architecture.md`,
technology/commands in `tech-stack.md`, and current tasks in
`implementation-plan.md`.

Keep Expo, pnpm workspaces, one TV codebase (Android TV and Apple TV), the
TV-hosted room (ADR-01), the game-registry rules/screens seam, shared
primitives, existing assets, and the warm living-room palette intact unless an
active task explicitly changes them. Current package roots are `apps/phone`,
`apps/tv`, `games/*`, `packages/contracts`, `packages/domain`,
`packages/design-tokens`, `packages/ui`, `packages/game-registry`,
`packages/physics`, and `packages/room-host`.

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
- End-to-end: run `pnpm dev:local` and
  open the phone app on a booted iPhone simulator. Each flow seeds a headless
  TV (`tools/headless-tv`) with bots on port 7777, which advertises itself over
  Bonjour so the phone finds the typed code. `pnpm e2e:bomb-squad` drives the
  phone from join to the first bomb. `pnpm e2e:phone-starts` checks the phone
  gets past its start-up screen. `pnpm e2e:crowded-room` seats nine long-named
  bots that go quiet and checks the phone names them in a short list.
  `pnpm e2e:host-handoff` uses the same seed and checks the host-change toast.
  `pnpm e2e:trivia` joins a Trivia room and answers the first question.
  `pnpm e2e:sumo` plays a Sumo Bumpers round. Port 7777 must be free (an Apple
  TV simulator running the TV app also listens there). The flows target the
  booted iPhone simulator, or `DEVICE`.

Record the commands run and whether a failure is introduced, pre-existing, or
blocked by the environment.

## Working notes

- Dev builds: the TV Metro runs on port 8081 and the phone Metro on 8082. Run
  them without `CI=1`, which turns off file watching. The Android TV emulator
  needs `adb reverse tcp:8081 tcp:8081`. If a phone keeps showing old game
  code after an edit under `games/`, reload the app; Fast Refresh does not
  always reach game packages.
- The TV's room host (`packages/room-host`) is the room's authority. Phones
  speak the versioned Room Protocol (`@huddle/contracts/protocol`); a
  connection is anonymous until `joinRoom` or `resumeSession` binds it to one
  seat, and room views go only to seated phones and the TV's own screens. Any
  change an older phone or TV would misread bumps `PROTOCOL_VERSION`.
- Game packages animate with React Native `Animated`, never Reanimated, and keep
  their own palettes: the Cosmic Quiz colours belong to `games/trivia` only.
  `pnpm validate:architecture` enforces both.
- Runtime artwork is pinned by file name, size, alpha and SHA-256 in
  `tools/validate-architecture.py`. Replacing an image means updating its
  spec. PNG and JPEG are both read; use JPEG for opaque, photo-like backdrops.
- Use the shared text components (`PlayroomText`, `GameText`, Trivia's
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
