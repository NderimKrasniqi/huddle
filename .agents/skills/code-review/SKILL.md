---
name: code-review
description: "Review one completed implementation task in an existing software project. Use after implementation to inspect the actual repository and task requirements, identify concrete issues, and suggest practical improvements for correctness, readability, maintainability, performance, testing, architecture, and stack-specific best practices. Review only; do not modify code or task state."
---

# Code Review

Review one completed implementation task and then stop.

Act with the judgment expected of a senior/staff software engineer with 20+ years of software-engineering experience. Be expert in the project's approved technology stack, including the versions actually used by the repository, its idioms, constraints, ecosystem conventions, and current best practices.

The goal is to help improve the code: identify real issues, explain why they matter, and suggest practical improvements. Do not manufacture findings to make the review appear thorough.

This skill reviews. It does **not** implement fixes or perform a comprehensive security audit.

## Required context

Normally use:

- `implementation-plan.md`
- `architecture.md`
- `tech-stack.md`
- `project-scope.md`
- the real repository being reviewed
- relevant files under `project/` when present

Use discovery/specification artifacts to understand required behavior, `architecture.md` to understand intended boundaries and dependency rules, `tech-stack.md` plus repository manifests/lockfiles to understand the approved and actual stack, and the repository to understand implementation reality.

If a required artifact is missing, use the remaining repository evidence when the review can still be performed safely. Do not invent requirements, architecture, or stack constraints that are not present.

## Core review contract

One invocation = one review target.

By default, review the task recorded as `Last completed task` in `implementation-plan.md`.

If the user explicitly names a completed task, review that task instead.

If the user explicitly provides a different concrete review target such as specific files or a Git ref range, review that target and use project artifacts as supporting context when available.

Do not:

- modify source code, tests, configuration, generated files, or documentation
- fix your own findings
- update `implementation-plan.md` or any task state
- implement missing requirements
- review future tasks as though they belong to the selected task
- redesign the architecture merely because another design is possible
- substitute technologies or recommend migrations without a concrete task-relevant reason
- report formatting or style issues already handled mechanically by repository tooling unless they reveal a meaningful underlying problem
- turn the review into a comprehensive security audit
- create persistent review-planning files

## 1. Establish the review target

Read the selected task and its acceptance criteria, requirement references, dependencies, and owning feature/phase.

Determine what behavior the implementation is responsible for before judging the code.

For the default workflow, `Last completed task` is the review target. Do not use `Current task`: `/implement-task` may already have advanced that pointer to the next pending task.

If the task is not complete, say so and stop unless the user explicitly asks to review incomplete work.

## 2. Load only relevant context

Start from the selected task and load only the context needed to review it confidently:

- referenced requirements/capabilities/business rules
- relevant architecture sections
- relevant stack/version information
- implementation files
- tests for the changed behavior
- direct callers/callees and adjacent invariants when they affect correctness

Do not load every project artifact or inspect the entire repository by default.

## 3. Inspect repository reality

Before producing findings, inspect the actual repository enough to understand:

- Git status and relevant diff/history when available
- repository-native package manager and scripts
- actual dependency/framework versions
- existing abstractions and conventions near the reviewed code
- generated files and their canonical sources
- relevant tests and validation commands
- surrounding call sites or data flow needed to verify behavior

Treat Git changes as **evidence**, not as the sole definition of scope. A working tree may contain unrelated developer work that `/implement-task` intentionally preserved.

Review canonical sources rather than generated, vendored, or lockfile output unless the task changes the generation/dependency contract or the generated output itself is inconsistent.

Do not attribute unrelated dirty work to the selected task. Label something pre-existing only when repository history or other evidence supports that conclusion.

## 4. Review with senior engineering judgment

Evaluate what is relevant to the implementation, including:

- correctness and behavioral completeness
- readability and clarity of intent
- maintainability and change safety
- architecture and dependency discipline
- performance and resource use where material
- behavioral/regression test quality
- stack- and version-appropriate implementation patterns
- important software-engineering principles and best practices

Use KISS, YAGNI, careful DRY, SOLID, cohesion/coupling, separation of concerns, encapsulation, composition, single-source-of-truth, invalid-state prevention, explicit error handling, data integrity, atomicity, concurrency safety, idempotency, resource lifecycle management, dependency minimalism, and related principles as **judgment tools**, not mechanical rules.

Do not report a principle violation unless it creates a concrete correctness, readability, maintainability, architectural, performance, testing, or regression concern.

For nuanced design, concurrency, lifecycle, testing, or performance judgments, read `references/review-quality.md`.

## 5. Generate candidate findings

Look for concrete issues in the selected implementation and the directly relevant surrounding code.

A useful finding should answer:

- What is wrong or unnecessarily difficult?
- Where is the evidence?
- Why does it matter in this project?
- What practical improvement would address it?

Examples of valid review concerns include:

- an acceptance criterion is not actually satisfied
- an edge case violates a domain invariant
- duplicated business knowledge can drift
- an established repository abstraction is bypassed in a way that worsens consistency or maintainability
- control flow or naming obscures important behavior
- a function/module has responsibilities that materially reduce change safety
- a lifecycle resource is leaked
- an avoidable N+1 or repeated expensive operation exists on a meaningful path
- tests pass without actually proving the changed behavior
- a framework API is used incorrectly for the repository's pinned version

Do not report preferences merely because you would personally write the code differently.

## 6. Verify findings before reporting them

Every finding needs evidence.

Use the strongest practical evidence available:

- trace the relevant control/data flow
- inspect callers/callees
- compare against requirements and architecture
- inspect existing repository patterns
- run focused existing tests or repository-native checks
- reproduce suspected behavior with a non-destructive command when practical
- verify version-specific claims against installed code/types or authoritative documentation when uncertainty remains

Inspect repository scripts before running them. Do not use auto-fix, formatting, migration, generation, snapshot-update, or other mutating commands as review verification unless the user explicitly requested that side effect.

Do not edit production code or add persistent tests just to prove a review finding.

If a candidate does not survive verification, discard it.

Do not infer behavior from names alone.

## 7. Calibrate findings

Use two severity levels:

### Important

A concrete issue that should normally be fixed before accepting the implementation, such as:

- incorrect behavior or unmet requirement
- regression or broken invariant
- data integrity/lifecycle/concurrency defect
- material architecture or dependency violation
- meaningful performance pathology
- a test gap that leaves important changed behavior unprotected when the risk is concrete

### Improvement

A concrete, worthwhile improvement that does not invalidate the implementation, such as:

- materially clearer control flow or naming
- reduced unnecessary complexity
- removing duplicated knowledge that creates maintenance risk
- better use of an existing stack/repository abstraction
- test design that would make future changes safer
- measurable or obvious efficiency improvement that is relevant but not blocking

Do not create a separate category for cosmetic nits. If an issue is too minor to be meaningfully useful, omit it.

When provenance matters, add `Origin: pre-existing` only when you can support that attribution. Pre-existing issues should normally be reported only when they directly affect the selected task or materially change the safety of the implementation.

## 8. Suggest improvements, do not implement them

A suggestion should describe the smallest practical direction that resolves the issue.

Prefer repository-native solutions and existing abstractions where appropriate.

Do not prescribe a large rewrite when a local correction is sufficient. Do not invent new abstractions merely to make a finding sound sophisticated.

## 9. Report the review

Order findings by severity and impact, with the most important first.

Use this shape:

```markdown
# Code Review

Target: Task X.Y.Z — <task title>

Summary: <N> Important, <N> Improvements

## Findings

### [Important] <concise finding title>
Location: `path/to/file.ts:line-range`

Evidence: <specific code/behavior/requirement evidence>

Why it matters: <concrete impact>

Suggested improvement: <smallest practical direction>

### [Improvement] <concise finding title>
...

## Verification
- `<command or inspection>` — <result>
```

If there are no meaningful findings, say so directly:

```markdown
# Code Review

Target: Task X.Y.Z — <task title>

No material code-review findings.

Reviewed the task requirements, relevant implementation and tests, surrounding code needed to validate behavior, and applicable architecture/stack conventions.

## Verification
- `<check>` — <result>
```

Do not add filler findings so the `Findings` section is non-empty.

## 10. Stop

After reporting the review:

- do not fix the findings
- do not update task state
- do not continue into the next task
- do not launch a security-review pass

The user or a separate implementation/fix workflow decides what to change next.
