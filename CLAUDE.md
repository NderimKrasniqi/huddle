# Repository Workflow

Use AI Project Workflow Core.

```text
/project-plan
/implement-task [<task-id>]
/workflow-code-review
/workflow-security-review
```

## Rules

- `project-scope.md`, `tech-stack.md`, and `implementation-plan.md` are project truth.
- Plan the full MVP as capability-oriented phases with stable numbered tasks.
- Implement one task at a time by default and keep `.ai-workflow/session-state.md` resumable.
- Update future unchecked tasks when implementation evidence proves the roadmap should change.
- Preserve unrelated work and avoid speculative architecture.
- Code review is independent and read-only.
- Run security review for explicit audits or meaningful security-boundary changes.

## Huddle project references

Beyond the project-truth files above, this repo keeps two Huddle-specific
sources of truth in `docs/`:

- `docs/CONTEXT.md` — domain vocabulary. All names in code use these terms;
  update it when new terms appear.
- `docs/design/design-handoff.md` — the Boardwalk design system, the visual
  source of truth.
