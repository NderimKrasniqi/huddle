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

## Git workflow

- After a task's tests and typecheck pass, branch, commit, and open a PR
  without asking each time. Never commit straight to `main`; always work on a
  branch.
- Stop before merging to `main`: leave the PR for the user to review and merge.
  Do not fast-forward, squash, or merge into `main` unless the user says so in
  the moment.
- Never force-push, hard-reset shared history, or delete branches without
  explicit confirmation, regardless of permission settings.

## Huddle project references

Beyond the project-truth files above, this repo keeps two Huddle-specific
sources of truth in `docs/`:

- `docs/CONTEXT.md` — domain vocabulary. All names in code use these terms;
  update it when new terms appear.
- `docs/design/design-handoff.md` — the Boardwalk design system, the visual
  source of truth.
