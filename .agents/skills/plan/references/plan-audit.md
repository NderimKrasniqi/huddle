# Implementation Plan Audit

Use this after a complete draft of `implementation-plan.md` exists.

The goal is to ensure the plan can be executed from start to finish without losing discovery coverage, introducing hidden architecture decisions, or turning into horizontal layer work.

## 1. Coverage

Verify:

- every MVP feature `F-*` appears in the plan
- every material MVP capability `C-*` is covered by at least one phase/task
- important business rules `BR-*` are implemented or verified where they apply
- every core MVP journey has enough feature coverage to work end-to-end
- acceptance behavior has corresponding verification work

No requirement should disappear between discovery and planning.

## 2. Hierarchy

The visible hierarchy must be:

`Feature -> Phase -> Numbered Task`

Do not add "Vertical Slice" as another level.

Feature identifiers should preserve discovery IDs.

Phases/tasks should use stable hierarchical numbers such as:

- `1.1`
- `1.1.1`

## 3. End-to-end progression

Check each phase:

- does it advance a real feature/capability?
- can its result be meaningfully verified?
- are required layers changed together when needed?

Flag plans dominated by horizontal phases such as:

- build all database tables
- build all APIs
- build all screens
- write all tests

A small shared foundation is allowed when genuinely prerequisite, but should be minimal and just-in-time.

## 4. Dependency order

Verify:

- prerequisites appear before dependents
- shared contracts/foundations are created before first use, not months earlier
- risky integrations/unknowns are validated early enough to avoid late rewrites
- migrations/backward compatibility are ordered safely where relevant
- no task requires artifacts created only by a later task

## 5. Task size and executability

A task should be completable in one focused implementation session.

Flag tasks that:

- contain several independent capabilities
- say "implement feature" without decomposition
- require unresolved architecture choices
- combine large refactors with new behavior unnecessarily
- hide multiple systems behind vague wording such as "wire everything up"

Also flag over-fragmentation where dozens of trivial tasks create navigation overhead without improving resumability.

## 6. Traceability without duplication

Each phase/task should reference canonical IDs when useful rather than restating entire requirements.

Check that references are valid and do not contradict discovery.

Do not duplicate detailed requirements into the plan merely to make the plan self-contained.

## 7. Testing and verification

Verify that:

- behavior is tested/verified near the work that introduces it
- integration points have integration verification where needed
- failure/recovery/concurrency behavior has appropriate verification when material
- acceptance criteria are not left for a generic final testing phase
- final end-to-end validation exists for core journeys

Testing should be proportionate; do not manufacture tests with no meaningful value.

## 8. Security and quality integration

Where discovery/architecture requires them, confirm the plan includes work for:

- authorization/security controls
- validation at trust boundaries
- privacy/data handling
- observability
- accessibility
- performance/reliability
- migrations/compatibility

These should usually live with the feature they protect or enable.

## 9. Resumability

Verify:

- every task has a status marker
- task numbers are unique and stable
- the top execution state identifies current/last-completed work
- a new session can resume by reading the plan and relevant canonical files
- unfinished tasks do not rely on hidden conversation state

## 10. Architecture consistency

Check that tasks implement the approved architecture rather than inventing a second architecture.

Flag tasks that introduce:

- new system boundaries
- new infrastructure/services
- new storage models
- new major contracts

without a corresponding architecture decision.

## 11. Simplicity and YAGNI

Remove or defer tasks whose only justification is hypothetical future use.

Challenge:

- large generic setup phases
- pre-emptive abstractions
- speculative scaling work
- framework-building before the first real feature
- duplicate infrastructure for future modules

## 12. Completion definition

The implementation plan is complete only when an implementation agent can start at the first pending task and proceed in order without needing to invent:

- product behavior
- architecture boundaries
- major technology decisions
- dependency order
- acceptance conditions

The implementation agent may still make routine local coding decisions.

## 13. Existing-project reconciliation

For an existing project, verify before calling the plan executable:

- the relevant repository was actually inspected
- current architecture and target architecture are distinguished
- already-working behavior is preserved unless discovery requires change
- migration/compatibility work is explicit where required
- tasks do not contain vague placeholders such as "reconcile existing code" where repository inspection could have made the work concrete
- no material repository fact remains unknown that could change task order or architecture

If the repository was unavailable, the plan must remain provisional/blocked rather than pretending to be final.

## 14. Requirement sufficiency

Look for tasks that would force the implementation agent to invent observable behavior.

Examples include unresolved:

- disconnect/presence detection semantics
- timeout behavior
- concurrency/conflict winners
- retry/idempotency behavior
- partial-failure outcomes
- lifecycle transitions
- deletion/retention semantics

If different choices change product-visible behavior or acceptance, return the exact gap for targeted clarification. If the choice is purely technical, keep it in architecture rather than reopening discovery.

## 15. Dependency integrity

Verify every task dependency:

- references a real task ID or an explicitly named external prerequisite
- points to work that is already complete or appears earlier in execution order
- does not create cycles
- is actually necessary rather than decorative

A plan with broken or forward task dependencies is not executable.
