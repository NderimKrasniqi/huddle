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

Use the smallest verification set that gives confidence. Validation is not a
quota: do not create a new test or run every available command just because a
file changed. Preserve unrelated dirty-worktree changes and distinguish failures
introduced by the current change from failures that were already present.

1. When an existing focused test covers the changed behavior, run it first. For
   example:

   ```bash
   pnpm exec vitest run <affected-test-file>
   ```

2. Otherwise choose the single most relevant specialized validation, typecheck,
   build, inspection, or smoke test for the changed area. Examples include:

   - workflow changes: `pnpm validate:workflow`
   - architecture or boundary changes: `pnpm validate:architecture`, and when
     applicable `pnpm validate:routes`, `pnpm validate:native-identity`,
     `pnpm validate:boundaries`, or `pnpm validate:ui-stack`
   - game content or contracts: `pnpm validate:packs` or
     `pnpm validate:game-contracts`
   - rate limits or guest identity: `pnpm validate:rate-limits` or
     `pnpm validate:guest-profile`
   - client/server bundle boundaries: `pnpm verify:bundle-seam`

   For typed code, use `pnpm typecheck` when it is the highest-signal check.
   Use `pnpm lint`, `pnpm test:unit`, or `pnpm test:integration` only when the
   changed area or failure mode makes that command relevant.

3. Add or update regression coverage only for a reproducible bug, meaningful
   logic or contract change, security-sensitive behavior, or important state
   transition. Copy, styling, documentation, configuration, simple wiring, and
   behavior-preserving refactors normally do not justify new tests.

4. Broaden to multiple checks or full `pnpm test` only for cross-cutting,
   high-risk, release-level work, or when the narrower check does not cover the
   affected paths. Use
   `pnpm verify:dependency-security` or `pnpm audit:prod` when dependency or
   production-security changes warrant them.

Record the commands run and whether a failure is introduced, pre-existing, or
blocked by the environment. Do not “fix” an unrelated failure by rewriting
unrelated code.

## GitHub publishing from Codex

The managed sandbox restricts `.git` writes and outbound GitHub access. Run
`git add`, `git commit`, `git push`, and networked `gh` commands with elevated
access. A sandboxed `gh auth status` failure is not credential proof; repeat it
with elevated network access. After push, prefer the connected GitHub app for
pull-request changes.
