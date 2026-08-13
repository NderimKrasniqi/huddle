# Huddle

Start with [`docs/README.md`](docs/README.md). It defines documentation
classification and precedence. Product behavior belongs in `project-scope.md`,
runtime boundaries in `architecture.md`, technology/commands in
`tech-stack.md`, current tasks in `implementation-plan.md`, evidence mapping in
`acceptance-matrix.md`, and visuals in `design/soft-minimal-handoff.md`.

Keep Expo, Convex, pnpm workspaces, one Android TV codebase, the game-registry
client/server seam, shared primitives, existing assets, and the Soft Minimal
palette intact unless an active task explicitly changes them. Current package
roots are `apps/phone`, `apps/tv`, `games/*`, `packages/contracts`,
`packages/domain`, `packages/design-tokens`, `packages/ui`, and
`packages/game-registry`.

Do not hand-edit `convex/convex/_generated/ai/guidelines.md`. Never run the
development reset against production or leave its environment gate enabled.

## GitHub publishing from Codex

The managed sandbox restricts `.git` writes and outbound GitHub access. Run
`git add`, `git commit`, `git push`, and networked `gh` commands with elevated
access. A sandboxed `gh auth status` failure is not credential proof; repeat it
with elevated network access. After push, prefer the connected GitHub app for
pull-request changes.
