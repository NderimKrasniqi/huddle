# Huddle

Planning and repository truth live in `docs/`:

- `docs/project-scope.md` — product scope, journeys, rules, and acceptance behavior;
- `docs/tech-stack.md` — approved tools and verification strategy;
- `docs/architecture.md` — current and target module boundaries;
- `docs/implementation-plan.md` — resumable phased tasks and evidence;
- `docs/design/soft-minimal-handoff.md` — current visual source of truth.

The active design system is Soft Minimal. The historical Boardwalk handoff is
kept only under `docs/design/legacy/`.

Keep Expo, Convex, pnpm workspaces, the game registry, shared UI primitives,
and the existing TV/assets/palette intact unless an active task explicitly
changes them.

## GitHub publishing from Codex

The managed sandbox restricts both `.git` writes and outbound GitHub access.
For commit, push, and pull-request workflows:

- run `git add` and `git commit` with elevated access so Git can write its
  index and object metadata;
- run `git push` and networked `gh` commands with elevated access;
- do not treat a sandboxed `gh auth status` “invalid token” result as proof
  that the user's credentials are bad—repeat the check with elevated network
  access before asking the user to authenticate again;
- after the branch is pushed, prefer the connected GitHub app for creating
  and updating pull requests.
