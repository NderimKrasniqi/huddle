---
name: implement-task
description: "Implement exactly one eligible numbered task from implementation-plan.md in an existing software project. Use after discovery and planning are complete, when architecture.md and implementation-plan.md exist. Inspect the real repository, create a concise repository-informed execution plan for the selected task, load only relevant context, apply current best practices for the approved tech stack, implement and verify the task, update persistent task state, and stop."
---

# Implement Task

Implement exactly one eligible task from `implementation-plan.md` and then stop.

Operate with the judgment expected of a senior/staff software engineer with 20+ years of experience. Be expert in the project's approved technology stack, its current idioms and constraints, and the software-engineering principles that matter to the task.

Do not merely make code compile. Produce the smallest correct implementation that satisfies the specification, fits the existing repository, respects the architecture, and is maintainable by another experienced engineer.

This skill implements. It does **not** perform code review or security review. A separate review skill owns independent review after implementation.

## Required inputs

Normally require:

- `implementation-plan.md`
- `architecture.md`
- `tech-stack.md`
- `project-scope.md`
- the real repository being modified
- relevant files under `project/` when present

If `implementation-plan.md`, `architecture.md`, or the repository is unavailable, do not invent them. Report the blocker and stop.

Treat these sources differently:

- discovery/specification artifacts define **required behavior**
- `architecture.md` defines **intended structure and dependency rules**
- `implementation-plan.md` defines **the current unit of work and order**
- the repository defines **current implementation reality**
- `tech-stack.md` defines **approved technologies and constraints**

If they conflict materially, do not silently choose one. Follow the conflict rules below.

## Core execution contract

One invocation = one numbered task.

Do not:

- implement the next task after completing the current one
- implement an entire phase or feature unless the selected task itself requires it
- redesign the product
- rewrite the implementation plan
- create persistent per-task planning files
- change architecture merely for convenience
- substitute approved technologies without explicit justification and approval
- perform unrelated cleanup or broad refactoring
- turn one task into a hidden multi-task project
- run a code-review pass on your own work
- mark a task complete without verification

## Engineering quality bar

Apply these as implementation constraints rather than slogans:

- correctness before cleverness
- readability and explicit intent
- KISS and YAGNI
- DRY for duplicated knowledge/business rules, not cosmetic similarity
- high cohesion and low coupling
- separation of concerns
- encapsulation and information hiding
- SOLID where it genuinely improves the design
- composition over inheritance by default
- dependency direction from `architecture.md`
- make invalid states hard to represent
- single source of truth for important state and rules
- validate at trust boundaries
- secure defaults and least privilege
- explicit error handling
- data integrity and atomicity where required
- concurrency/race awareness where state is shared
- idempotency where operations may repeat or retry
- deterministic behavior where practical
- preserve existing behavior unless the task intentionally changes it
- test observable behavior rather than implementation trivia
- regression protection for bugs/changed behavior
- dependency minimalism
- measure before optimizing, while avoiding obviously pathological work
- proper lifecycle/cleanup for timers, subscriptions, sockets, listeners, files, and async work
- follow established repository conventions when they are sound

For a complex task or when principles conflict, read `references/engineering-quality.md`.

## 1. Determine the task

Use `scripts/task-state.py` when available to inspect execution state and determine the next eligible task. Examples use `python3`; substitute another Python 3.10+ launcher when required by the environment:

```bash
python3 <skill-root>/scripts/task-state.py status <project-root>
```

Task selection rules:

1. If exactly one task is `[~]` in progress, resume that task.
2. If a task is `[!]` blocked, automatic progression stops at the blocker. Do not silently jump to later work.
3. Otherwise use `Current task` when it is pending and all dependencies are satisfied.
4. Otherwise select the first pending task whose task dependencies are complete.
5. Never skip an incomplete dependency.
6. Never start a second task while another task is `[~]`.
7. If the plan is inconsistent, stop and report the exact plan-state problem rather than guessing.

If the user explicitly names a task, use it only if it exists and its dependencies are satisfied. An explicitly selected later task may proceed despite a different blocked task only when it is genuinely independent under the declared dependencies. If it is not eligible, explain why and stop.

## 2. Load only relevant context

Start with the selected task block in `implementation-plan.md` and the architecture areas and requirement IDs it references.

Load the minimum additional context needed to implement safely:

- `tech-stack.md`
- relevant section(s) of `architecture.md`
- owning feature specification
- relevant capability/business-rule definitions
- relevant journey when end-to-end behavior matters
- `domain.md` for domain concepts/invariants when relevant
- `cross-cutting.md` for shared rules when relevant

Do not automatically read every journey and feature file.

Trace requirement IDs back to their canonical files rather than relying on repeated summaries in the plan.

## 3. Inspect the repository before designing the change

Inspect the actual code that owns or interacts with the task.

When Git is available, inspect the working tree before editing. Treat pre-existing uncommitted changes as user/developer work that must be preserved. Do not reset, checkout over, clean, stash, or otherwise discard unrelated changes merely to obtain a clean tree. If relevant files already contain changes, understand and work with them; if those changes make the task unsafe or ambiguous, stop with a specific repository blocker.

Determine:

- current behavior
- existing abstractions and module boundaries
- repository conventions
- relevant tests
- data ownership and persistence behavior
- existing error/validation patterns
- whether part or all of the task is already implemented
- the repository's actual package manager, workspace boundaries, scripts, generators, migrations, and verification commands relevant to the task
- which relevant files are generated versus canonical editable sources
- whether the plan made assumptions that no longer match repository reality

Do not recreate structures that already exist.

Do not follow suggested filenames/functions from the plan blindly when the repository has evolved.

Prefer extending sound existing patterns over introducing a parallel style.

Use repository-native tooling. Modify canonical source files and run the repository's generator/codegen/migration command when generated output must change. Do not manually patch generated artifacts unless the repository explicitly treats them as editable source. Do not introduce a second package manager, formatter, test runner, migration path, or code-generation workflow for convenience.

### Already implemented fast path

If repository inspection shows the selected task is already fully implemented, do not change code merely to demonstrate activity. Verify the task's acceptance criteria against the current implementation using the required checks. If verification passes, mark the task in progress if needed, complete it, report that no implementation change was necessary, and stop. If verification exposes missing behavior, continue with normal task execution.

## 4. Check task size and coherence

Before planning the implementation, confirm the selected task is still an appropriate atomic unit given the real repository.

A task is appropriately sized when it has one coherent outcome and can be implemented and verified without becoming a hidden project. It may touch several files or layers when those changes are tightly coupled to one outcome.

Do **not** reject a task merely because it is difficult, spans multiple files, or requires coordinated changes.

Treat the task as oversized when repository inspection reveals multiple independently valuable or independently verifiable outcomes that could be completed safely as separate tasks, or when completing it would require unrelated architectural changes beyond its stated intent.

If the task is oversized:

1. do not silently expand its scope
2. do not create a second implementation plan inside this skill
3. mark it blocked with a concise `task decomposition needed` reason
4. identify the independent outcomes that the planning workflow should split
5. stop

## 5. Resolve implementation uncertainty correctly

Distinguish three kinds of uncertainty.

### Routine implementation choice

If alternatives preserve the same approved behavior and architecture, choose the simplest stack-idiomatic option and proceed.

Examples:

- local function naming
- internal helper placement within an approved module
- equivalent library API variants supported by the project's version

### Material specification gap

If alternatives would change observable behavior, permissions, lifecycle semantics, accepted failure/recovery behavior, or acceptance criteria, do not invent the answer.

Mark the task blocked and report the exact missing product decision.

### Architecture conflict

If the correct implementation would materially violate `architecture.md`, create a dependency cycle, move ownership to the wrong boundary, require an unapproved technology, or contradict an architectural decision, do not quietly work around it.

Mark the task blocked and report the exact architecture conflict.

A repository difference is not automatically an architecture conflict. Adapt routine implementation details to current repository reality while preserving specification and architectural intent.

## 6. Confirm stack-specific facts when needed

Read `tech-stack.md` and inspect installed/pinned versions in the repository.

Use the approved stack as authoritative.

When a task depends on version-specific framework/library behavior and uncertainty could affect correctness, compatibility, security, or architecture:

1. determine the exact installed/pinned version
2. consult authoritative current documentation available to the environment
3. implement using APIs/patterns valid for that version

Do not upgrade dependencies as a side effect of an unrelated task.

Do not add a dependency unless the task genuinely needs it and existing platform/repository capabilities are insufficient.

## 7. Establish verification before changing code

Read the task's `Verify` and `Done when` fields plus the canonical capability/acceptance behavior.

When reasonably cheap and useful for attribution, run the focused existing verification for the affected area before editing. Record any pre-existing failures that could overlap with the task. Do not run an expensive full-suite baseline by default when a narrower check provides the needed signal.

Identify the cheapest reliable verification for the change:

- focused unit test
- domain/state-machine test
- integration test
- component/UI test
- end-to-end test
- typecheck/lint/build
- migration/schema validation
- manual executable check when automation is not practical

For behavior changes, add or update tests before or alongside implementation when practical.

For bug fixes, add regression coverage that fails for the broken behavior when feasible.

Do not create tests that merely mirror internal implementation details.

The baseline is evidence, not a gate requiring a perfectly green repository. A pre-existing unrelated failure does not automatically block the task; preserve the distinction between baseline failures and task-caused regressions throughout verification.

## 8. Create a concise task execution plan

After inspecting the repository, resolving material uncertainty, confirming relevant stack facts, and identifying verification, create a small execution plan for **this task only**.

The plan exists to reconcile the pre-written task with current repository reality before editing code. It is not a new project plan, architecture plan, phase, or persistent artifact.

The amount of detail should match the task's complexity. Include only the steps necessary to implement and verify the task safely. The plan should cover, where relevant:

- the existing code path or module that will be changed
- the smallest implementation steps in dependency order
- any tightly scoped refactor required to make the change safe
- tests or verification that establish the required behavior
- relevant migration/compatibility work only when the task requires it

Prefer steps that describe observable engineering actions, for example:

- extend the existing membership lookup to accept the reconnect credential
- restore the existing membership instead of creating a replacement
- resynchronize authoritative room state after restoration
- add regression coverage for successful and forbidden reconnect paths
- run focused tests and typecheck

Do not write vague steps such as `implement backend`, `update frontend`, or `add tests`.

Do not invent filenames, abstractions, APIs, or technologies that repository inspection did not justify.

Keep this plan in working context. Do **not** create `task-plan.md`, per-task plan files, or add the execution steps to `implementation-plan.md`.

If resuming a `[~]` task, inspect the repository and current changes first, determine what has already been completed, and reconstruct only the remaining execution steps. Do not depend on prior chat context.

Once the concise plan is coherent, proceed without asking for approval unless a material specification/architecture decision is unresolved.

## 9. Mark the task in progress

Before modifying implementation code, persist the task as `[~]` and update the execution-state header.

When available:

```bash
python3 <skill-root>/scripts/task-state.py start <project-root> <task-id>
```

If the task was already `[~]`, resume it without resetting useful state.

## 10. Implement the smallest complete change

Implement only what the selected task requires.

Follow these rules:

- satisfy the referenced capability, business rules, and acceptance behavior
- respect architectural ownership and dependency direction
- keep business rules out of presentation/transport code when architecture assigns them elsewhere
- keep authorization/security decisions on trusted boundaries
- treat client/network/external input as untrusted
- use transactions/atomic operations when partial completion would violate invariants
- consider duplicate/retried/concurrent operations when relevant to the task
- handle expected failure paths deliberately
- clean up owned resources and asynchronous work
- preserve backward compatibility when discovery/architecture requires it
- avoid speculative extension points
- avoid broad formatting, renaming, or refactoring unrelated to the task
- do not leave commented-out code, dead branches, placeholder TODOs, or debug logging unless the task explicitly requires them
- preserve pre-existing unrelated worktree changes; never use destructive Git operations to simplify the task
- edit canonical sources rather than generated outputs, then use repository-native generation/migration tooling when required

Refactor only the smallest surrounding area necessary to make the task correct and maintainable.

## 11. Verify the implementation

Run the verification required by the task and by the affected repository area.

Prefer focused checks first, then broader checks when justified.

Typical order:

1. task-specific tests
2. affected package/module tests
3. typecheck/static checks
4. lint/format validation when configured
5. build or integration checks when the task can affect them

If a check fails because of your implementation, fix the implementation and re-run the relevant checks.

If a pre-existing unrelated failure prevents verification, distinguish it clearly from task-caused failures and do not claim full verification.

Verification is not code review. Do not perform a separate subjective review pass after tests succeed.

## 12. Complete or block the task

Mark the task `[x]` only when:

- required behavior is implemented
- task dependencies remain satisfied
- required tests/checks pass, or an explicitly documented external/pre-existing limitation is acceptable under the task's completion condition
- `Done when` is objectively satisfied
- no known task-caused regression remains

When available:

```bash
python3 <skill-root>/scripts/task-state.py complete <project-root> <task-id>
```

Update execution state so:

- `Last completed task` becomes the completed task
- `Current task` becomes an existing blocker when one remains, otherwise the next eligible pending task, or `—` when none remains
- current feature/phase follow `Current task`
- resolved blocker entries are cleared; reasons for other blocked tasks are preserved

If a material product/architecture/repository/external blocker prevents completion, mark `[!]`, record a concise blocker in execution state, and stop without pretending the task is complete:

```bash
python3 <skill-root>/scripts/task-state.py block <project-root> <task-id> "<reason>"
```

Do not mark `[!]` merely because your first implementation attempt failed tests; fix your work instead.

A blocked task stops automatic progression. Do not silently skip it and start a later task just because that task appears dependency-safe. A later independent task may be started only when the user explicitly selects it and its declared dependencies are complete.

## 13. Handoff and stop

After the task is complete, report only the useful implementation handoff:

- task ID and title
- what changed at a high level
- files/areas changed
- tests/checks run and their results
- any pre-existing verification limitations
- next eligible task ID, if one exists

Do not implement the next task.

Do not perform code review or security review. Those are separate workflow stages.

## Completion gate

Finish the invocation only when exactly one of these is true:

### Completed

- exactly one selected task is now complete
- its required behavior and acceptance criteria are satisfied
- verification evidence is recorded/reported
- implementation-plan state is consistent and resumable
- no next task was implemented

### Blocked

- the selected task cannot safely proceed because of a material product, architecture, repository, dependency, or external blocker
- the blocker is specific and actionable
- task/plan state records the blocker
- no speculative workaround was implemented
