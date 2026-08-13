# Huddle documentation

This directory is the repository’s documentation map. When documents disagree,
use this precedence order:

1. [`project-scope.md`](./project-scope.md) owns product behavior, supported platforms, journeys, acceptance rules, exclusions, and roadmap.
2. [`architecture.md`](./architecture.md) owns runtime boundaries, dependency direction, state flow, security boundaries, and migrations.
3. [`tech-stack.md`](./tech-stack.md) owns approved technology, pinned versions, platform caveats, and verification commands.
4. [`design/soft-minimal-handoff.md`](./design/soft-minimal-handoff.md) owns current visual behavior.
5. [`implementation-plan.md`](./implementation-plan.md) owns only unfinished/resumable work and current evidence.
6. [`acceptance-matrix.md`](./acceptance-matrix.md) maps current requirements to evidence.
7. [`dependency-security.md`](./dependency-security.md) owns audit exceptions, patches, and review dates.

## Classification

- **Current product documentation:** this file; the seven owning documents above;
  `design/qa/README.md`; `design/reference/boards/SOURCE-MANIFEST.md`;
  `packages/ui/assets/README.md`; root and Convex `AGENTS.md`.
- **Generic tooling:** `.agents/skills/**/*.md`. These reusable workflows are not Huddle product truth.
- **Generated:** `convex/convex/_generated/ai/guidelines.md`. Regenerate it with Convex; do not hand-edit it.

Historical material is available through Git history, which is the repository’s
only archive. Tracked `docs/archive/` and `docs/design/legacy/` directories are
prohibited; superseded reports, handoffs, and evidence are deleted instead of
being moved inside the repository.

Terms used throughout: **TV** is the shared Android TV display and room owner;
**Phone** is the iOS/Android player app; **seat** is temporary room membership;
**Host** is the seat authorized to configure and control the room; **session
credential** is the SecureStore secret that authorizes a seat; **guest profile**
is non-secret local identity metadata; **Game Module** is client-safe metadata,
settings, and screens; **Game Logic** is the server-safe decoder/reducer seam.

Run `pnpm validate:workflow` after changing Markdown. It validates this
exact classification, stale terms and references, links, anchors, paths,
packages, commands, and requirement traceability.
