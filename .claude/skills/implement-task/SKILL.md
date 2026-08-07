---
name: implement-task
disable-model-invocation: true
description: Use when docs/implementation-plan.md has a ready or in-progress numbered task. Implement, verify, review, update progress, and leave the repository resumable. Do not use to invent scope, choose initial architecture, or implement materially undefined work.
compatibility: Portable to Agent Skills-compatible coding agents. Repository editing and command execution are required; a fresh read-only reviewer improves independent review.
---

# Implement Task

Implement one numbered task completely before moving on by default.

## Start from project truth

Read only what is needed: session state, selected task/phase, relevant scope/stack rules, repository instructions, Git state, code, tests, configuration, and migrations.

Resume unfinished work first; otherwise use the requested task or next ready unchecked task. If a material product or architecture decision is missing, stop and use `project-plan`; do not replan ordinary implementation choices.

Use the project's actual stack, versions, conventions, ownership, and dependency direction. Verify version-sensitive behavior when uncertain.

## Task cycle

1. Understand the task, dependencies, expected behavior, and verification.
2. Before editing, inspect existing patterns and reason through affected boundaries, likely edge cases, tests, and the smallest coherent change.
3. Implement that solution.
4. Add/update meaningful tests at the behavior boundary.
5. Run focused checks and relevant regressions.
6. Re-read the task, then inspect the full diff as if you did not write it. Use this pass to catch missed requirements, accidental changes, unnecessary complexity, architecture problems, or weak tests; fix them before review.
7. Run independent `code-review` when a fresh reviewer is available; resolve blocking findings and rerun affected checks.
8. Run `security-review` when requested or when the task materially changes a meaningful trust boundary such as authentication, authorization, ownership, sensitive data, credentials, public attack surface, privileged operations, or payments.
9. Mark complete only when behavior works, required checks pass, and no blocking finding remains.
10. Update plan/session state and leave the next exact action.
11. Stop after one task unless the user explicitly asks to continue.

## Engineering discipline

Preserve unrelated work. Prefer simple readable code. Follow project public contracts and boundary validation. Add no dependency, service, migration, or public API unless needed. Never weaken tests or acceptance behavior to make work pass. Document only durable decisions or non-obvious behavior.

## When the plan changes

Update unchecked future tasks when implementation proves them wrong, redundant, or incomplete within approved scope. Use `project-plan` for scope, major architecture, important product behavior, or multi-phase changes.

## Session state

Keep handoff short: current task; what changed; checks/result; review status; blocker; next exact action. Git history, tests, task checkbox, and this handoff are sufficient; do not create a completion dossier.
