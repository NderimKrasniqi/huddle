# Review Quality Reference

Use this reference when a candidate finding requires deeper engineering judgment. It is a review lens, not a checklist that must produce findings in every category.

## Correctness and invariants

Prioritize observable behavior and domain invariants over code aesthetics.

Look for:

- branches that violate acceptance criteria or business rules
- invalid or partially updated states
- incorrect handling of retries, duplicates, ordering, time, absence, cancellation, or failure
- stale state and lost updates
- incorrect default/fallback behavior
- errors swallowed, transformed incorrectly, or exposed at the wrong boundary
- non-atomic multi-step mutations when partial success is unsafe
- operations that are not idempotent despite realistic retries/replays

Do not call something a bug merely because an alternative behavior might be preferable. Tie behavior claims to a requirement, established repository contract, or clear invariant.

## Readability

Readability findings should improve a maintainer's ability to understand important behavior.

Useful concerns include:

- names that conceal domain meaning or imply the wrong contract
- control flow that makes success/failure/state transitions difficult to follow
- hidden mutation or side effects that a caller cannot reasonably predict
- deeply interleaved responsibilities that obscure the primary operation
- comments that contradict the implementation or compensate for unclear code

Do not report ordinary style preferences already covered by formatter/linter rules.

## Maintainability and design

Favor change safety over abstract purity.

### KISS and YAGNI

Flag complexity when the implementation carries machinery that the current requirements and repository do not need and that materially increases cognitive or change cost.

Do not recommend removing structure merely because the code could be shorter.

### DRY

Duplicated syntax is not automatically a problem. Report duplication when the same business knowledge, invariant, mapping, policy, or calculation exists in multiple places that can drift independently.

### SOLID and separation of concerns

Use these principles to diagnose concrete design pressure:

- responsibilities that change for unrelated reasons
- dependencies pointing across an architecture boundary
- callers depending on details they should not know
- extension requiring repeated edits across unrelated modules
- state exposed broadly enough to bypass invariants

Do not demand interfaces, factories, repositories, services, or dependency injection simply because a principle can be named.

### Cohesion and coupling

Prefer code whose related behavior lives together and whose dependencies are narrow and intentional.

A coupling finding should identify the actual maintenance cost: duplicated coordination, impossible isolated testing, circular ownership, cross-feature state mutation, or widespread change amplification.

## Existing abstractions and single source of truth

Prefer existing repository abstractions when they correctly own the behavior.

Flag bypasses when they create:

- duplicate business rules
- inconsistent validation
- incompatible persistence/access patterns
- multiple authoritative representations of state
- generated/canonical source divergence

Do not insist on reuse when the existing abstraction is the wrong boundary or would make the implementation more complicated.

## Performance

Review performance proportionally to the path and expected scale.

Strong findings include:

- N+1 network/database requests on a collection path
- repeated full scans where an existing index/map/query is already available
- unbounded work tied to user-controlled input
- unnecessary serialization/deserialization or large copies on hot paths
- blocking work on latency-sensitive/event-loop paths
- repeated expensive computation that is clearly avoidable
- leaking subscriptions/timers/listeners/connections

Avoid speculative micro-optimization. If impact depends on scale that the project does not establish, lower confidence or omit the finding.

Measure or reproduce when practical before claiming a subtle performance defect.

## Concurrency, async work, and lifecycle

When the reviewed code shares mutable state or owns resources, check relevant failure modes:

- check-then-act races
- stale closures/state
- work continuing after cancellation/unmount/disconnect
- missing cleanup
- duplicate subscriptions/listeners
- out-of-order async completion overwriting newer state
- transactions that do not cover all integrity-critical mutations
- locks/transactions held across unnecessary external work

Use stack-native lifecycle patterns for the pinned framework version.

## Testing and regression protection

Tests should establish behavior, not merely execute lines.

Look for:

- acceptance criteria with no meaningful assertion
- tests that mock away the behavior they claim to verify
- assertions against implementation details that make safe refactoring difficult
- missing regression coverage for a concrete bug-prone branch introduced by the task
- test setup that accidentally makes the relevant branch impossible to fail
- flaky time/concurrency assumptions

Do not report generic "add more tests" advice. Name the behavior that is currently unprotected and why it matters.

## Stack and version accuracy

Treat `tech-stack.md` as intended stack and manifests/lockfiles/source as actual repository reality.

Before making a stack-specific claim:

1. identify the version actually in use
2. inspect existing repository patterns and types/source when useful
3. verify uncertain API/version behavior with authoritative documentation when available

Do not recommend a newer library/framework pattern that is unavailable or inappropriate for the pinned version.

Prefer native capabilities already provided by the stack over new dependencies when they solve the problem cleanly.

## Security-sensitive correctness

This skill is not the comprehensive security audit, but do not ignore obvious security-relevant defects encountered in task code, especially when they are also correctness or boundary issues:

- missing authorization on a changed access path
- tenant/user scope accidentally removed
- sensitive information newly exposed or logged
- trust-boundary input used without required validation
- unsafe default permission introduced by the task

Report the concrete defect here. Leave broad threat modeling, vulnerability scanning, secret hunting, dependency advisories, and systematic security posture review to `/security-review`.

## Finding quality test

Before reporting, ask:

- Is this demonstrably true?
- Is it relevant to this review target?
- Does it have a meaningful engineering consequence?
- Can I point to the evidence?
- Is the suggested direction proportionate and repository-native?

If not, discard or refine the candidate.
