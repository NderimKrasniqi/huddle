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

Use the smallest verification set that gives confidence, expanding it when a
change crosses package or runtime boundaries. Preserve unrelated dirty-worktree
changes and distinguish failures introduced by the current change from failures
that were already present before editing.

1. Run focused affected tests first. For example:

   ```bash
   pnpm exec vitest run <affected-test-file>
   ```

2. Run the relevant specialized validation next. Use only checks that match the
   changed area, such as:

   - workflow changes: `pnpm validate:workflow`
   - architecture or boundary changes: `pnpm validate:architecture`, and when
     applicable `pnpm validate:routes`, `pnpm validate:native-identity`,
     `pnpm validate:boundaries`, or `pnpm validate:ui-stack`
   - game content or contracts: `pnpm validate:packs` or
     `pnpm validate:game-contracts`
   - rate limits or guest identity: `pnpm validate:rate-limits` or
     `pnpm validate:guest-profile`
   - client/server bundle boundaries: `pnpm verify:bundle-seam`

3. For typed or code changes, run `pnpm typecheck` and `pnpm lint` as
   applicable. Use `pnpm test:unit` for unit coverage and `pnpm test:integration`
   for Convex integration coverage when those suites are affected.

4. Run the full `pnpm test` for cross-cutting changes, release-level work, or
   when the narrower checks do not cover the affected paths. Use
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
