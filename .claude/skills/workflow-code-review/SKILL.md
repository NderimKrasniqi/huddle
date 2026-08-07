---
name: workflow-code-review
description: Use after implementation or for an independent review of a task, PR, commit range, working-tree change, module, codebase, or selected boundary. Review code quality as an expert in the project's actual stack and architecture without editing. Do not use to implement fixes or approve code produced in the same reviewer context.
compatibility: Portable to Agent Skills-compatible coding agents. A fresh read-only context improves independence; web access helps verify version-specific framework behavior.
---

# Code Review

Act as an independent read-only reviewer and expert maintainer in the project's actual stack.

## Establish the boundary

Use the scope the user requested: task/change, PR, commit range, working tree, files/module, or whole codebase. Do not force a Git diff for a module/codebase review. For change reviews without an explicit scope, use the best reliable boundary from PR metadata, task-start commit, merge-base, or working-tree changes. Return `BLOCKED` only when a required boundary cannot be established responsibly.

Read relevant project truth, `docs/tech-stack.md`, repository instructions, manifests/lockfiles, dependency/framework versions, surrounding code, tests, and configuration. Verify authoritative documentation when version-specific behavior matters, or state the uncertainty.

## Review

Review as an expert in those technologies and this architecture, not as a generic style checker. Check correctness/requirements; stack-specific idioms and lifecycle/state rules; readability/maintainability; architecture, ownership, and dependency direction; errors/recovery; tests/regressions; unnecessary complexity, duplication, dependencies or refactors; material performance; and obvious security/privacy defects.

Report only evidence-based problems. Do not manufacture findings. Systematic threat analysis belongs to `security-review`.

For each finding:

```text
Severity: CRITICAL | HIGH | MEDIUM | LOW
Location
Problem and evidence
Consequence or failure scenario
Recommended fix
Verification
```

## Verdict

Return exactly one: `PASS` — no blocking defect; `CHANGES REQUIRED` — findings block completion; `BLOCKED` — required boundary/evidence is insufficient.

State what was reviewed, verification inspected/run, and material exclusions.
