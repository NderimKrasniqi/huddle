# Engineering Quality Reference

Read this for complex tasks, architectural boundary work, concurrency/state work, security-sensitive behavior, or when implementation principles conflict.

This is a decision aid, not a review checklist.

## Decision priority

When principles appear to conflict, prefer in this order:

1. Correct specified behavior and invariants
2. Security/data integrity
3. Approved architecture and compatibility constraints
4. Simplicity and clarity
5. Maintainability/evolvability
6. Performance proven necessary by requirements or measurement

Never sacrifice correctness for elegance.


## Repository safety and native tooling

Preserve pre-existing developer work. Inspect the working tree when Git is available and never reset, clean, checkout over, or otherwise discard unrelated changes to make implementation easier. Relevant uncommitted edits are part of repository reality and must be understood before modification.

Use the repository's own package manager, workspace commands, generators, migration tools, test runner, formatter, and build scripts where they are sound. Change canonical sources rather than generated artifacts; regenerate outputs through the owning tool unless the repository explicitly documents generated files as editable.

When a focused baseline is cheap enough to provide useful attribution, run it before editing and distinguish pre-existing failures from regressions introduced by the task. A red baseline is evidence to account for, not an excuse to claim verification succeeded.

If the task is already fully implemented, verification is the work: prove the acceptance criteria, update task state, and avoid meaningless code churn.

## Task-level planning

Plan the selected task only after inspecting the real repository. The purpose is to translate a pre-written task into the smallest safe sequence of code changes that fits current reality.

Keep the plan concise and ephemeral. A strong task plan identifies the actual ownership boundary, orders tightly coupled changes, and names the verification that will prove completion. It should not create a second hierarchy of phases/subtasks or persistent planning documents.

A task that reveals multiple independent outcomes should be sent back for decomposition rather than implemented as a hidden mini-project. Difficulty or multi-file scope alone does not make a task oversized; independence of outcomes does.

## Simplicity

Choose the least complicated implementation that completely satisfies the task.

Do not build abstractions for hypothetical callers, future platforms, or imagined scale. A small direct implementation is preferable until repeated domain knowledge or a real boundary justifies abstraction.

## DRY

Deduplicate knowledge, invariants, policies, and business rules.

Do not deduplicate merely because two code blocks currently look similar. Similar syntax with different reasons to change should remain separate.

## Cohesion and coupling

Place behavior with the state/rules it owns. Keep modules focused on coherent responsibilities. Minimize knowledge of other modules' internals and prevent dependency cycles.

Prefer explicit small contracts at genuine boundaries. Do not introduce interfaces solely to wrap every concrete class/function.

## SOLID and composition

Use SRP, interface segregation, dependency inversion, and open/closed thinking when they reduce coupling or protect stable domain behavior. Do not apply them mechanically.

Prefer composition to inheritance unless the domain truly has a substitutable is-a relationship and inheritance simplifies rather than obscures behavior.

## Invalid states and invariants

Use types, constructors/factories, state transitions, validation, database constraints, or transactional operations to make illegal states difficult to create.

Enforce important invariants at authoritative boundaries, not only in UI code.

## Trust boundaries and security

Treat users, clients, network messages, external services, uploaded data, and untrusted persisted values as untrusted.

Authorization must be checked by the authoritative side. Client-side checks may improve UX but cannot be the security boundary.

Apply least privilege and avoid exposing/logging secrets or unnecessary private data.

## Errors and failures

Differentiate expected domain/user failures from programmer/invariant failures.

Handle expected failures explicitly and preserve valid state. Surface programmer/configuration errors close to their source rather than swallowing them.

Never use empty catch blocks unless ignoring the exact error is specified behavior.

## Concurrency and idempotency

For shared or distributed state, consider simultaneous actions, stale reads, duplicate requests, retries, reconnects, and out-of-order delivery.

Use atomic/transactional operations when intermediate state would violate invariants.

Make repeated operations idempotent when retries or duplicate delivery are plausible and duplicate side effects would be harmful.

## Resource lifecycle

Every owned timer, subscription, listener, socket, lock, file, stream, background operation, or cancellation token needs an intentional cleanup/lifetime policy.

Avoid work that outlives the state/component/request that owns it unless explicitly designed as background work.

## Tests

Test observable contracts and important invariants.

Prefer the lowest-cost test level that reliably catches the behavior:

- pure/domain unit tests for deterministic rules
- integration tests for persistence, transactions, boundaries, and framework integration
- component/UI tests for user-facing interaction logic
- end-to-end tests for critical cross-system journeys

A bug fix should normally add a regression test when reproducible.

Do not over-mock until tests only verify mocks interacting with mocks.

## Refactoring

Refactor only what is necessary to make the selected task correct, understandable, or safely testable.

Preserve behavior outside the task. Avoid opportunistic repository-wide cleanup.

## Dependencies

Prefer platform/framework capabilities and existing approved dependencies before adding another package.

A new dependency should solve a real task need, be compatible with the approved stack, and provide enough value to justify its maintenance/security cost.

## Performance

Avoid obvious N+1 work, accidental unbounded loops/queries, unnecessary repeated rendering/computation, and wasteful data transfer.

Do not add caches, denormalization, queues, concurrency machinery, or algorithmic complexity without a requirement or measurement that justifies them.

## Stack idioms

Use the project's actual pinned versions and established stack conventions. Prefer framework-native lifecycle, data, state, and error patterns over generic patterns imported from another ecosystem.

When repository conventions conflict with current authoritative stack guidance, preserve compatibility unless changing the convention is part of the task or required for correctness/security.
