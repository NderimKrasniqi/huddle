# Repository Workflow

Use AI Project Workflow Core.

```text
/project-plan
/implement-task [<task-id>]
/workflow-code-review
/workflow-security-review
```

## Rules

- `docs/project-scope.md`, `docs/tech-stack.md`, and `docs/implementation-plan.md` are project truth.
- Plan the full MVP as capability-oriented phases with stable numbered tasks.
- Implement one task at a time by default and keep `.ai-workflow/session-state.md` resumable.
- Update future unchecked tasks when implementation evidence proves the roadmap should change.
- Preserve unrelated work and avoid speculative architecture.
- Code review and security review are independent and read-only — see "Reviews".

## Reviews

- Code review and security review MUST run as their own subagents, in a fresh
  context — spawn the `workflow-code-reviewer` and `workflow-security-reviewer`
  agents (via the Agent tool). Do NOT invoke the `workflow-code-review` /
  `workflow-security-review` skills inline: a skill loads into the current
  session, so the author reviews their own work in the context that wrote it,
  which is not an independent review.
- Give each reviewer agent only the boundary to review (the task, its diff or
  files, and the checks already run). Relay its findings and resolve blocking
  ones before marking a task complete.
- Run security review when the task materially affects a trust boundary
  (auth, ownership, credentials, private/participant data, public attack
  surface, privileged operations).

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

Beyond the project-truth files above, this repo keeps one Huddle-specific
source of truth in `docs/`:

- `docs/design/design-handoff.md` — the Boardwalk design system, the visual
  source of truth.
