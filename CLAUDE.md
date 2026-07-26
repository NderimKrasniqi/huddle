# Huddle

Planning docs live in `docs/`: `project-scope.md` (what and why),
`tech-stack.md` (tools and testing strategy), `implementation-plan.md`
(phased tasks with acceptance criteria), `CONTEXT.md` (domain vocabulary),
and `design/design-handoff.md` (the Boardwalk design system — the visual
source of truth).

- Plan tasks are implemented by running `/build`, never ad hoc — the
  implement → review → fix loop and commit discipline always apply.
- Sessions follow `docs/implementation-plan.md` in phase order.
- All names in code use the vocabulary in `docs/CONTEXT.md`; update it when
  new terms appear.
- When a decision changes, update the affected doc in `docs/` in the same
  session.

Tracker: local
