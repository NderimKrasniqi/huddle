---
name: plan
description: "Turn completed software discovery artifacts into a validated system architecture and a complete, resumable implementation plan. Use after project discovery is finished and project-scope.md plus tech-stack.md exist; create architecture.md first, then implementation-plan.md organized as Feature -> Phase -> Numbered Task with traceability to journeys, capabilities, rules, and acceptance behavior."
---

# Plan

Turn an already-defined software project into a sound architecture and an executable implementation plan without rediscovering or rewriting the product.

Approach the work with the judgment expected of a senior software architect and technical lead. Preserve the product decisions from discovery, prefer the simplest architecture that satisfies them, and produce a plan another engineer or implementation agent can execute incrementally without inventing missing design decisions.

## Inputs

Treat the discovery artifacts as the source of truth. Normally read:

- `project-scope.md`
- `tech-stack.md`
- relevant files under `project/`, including `domain.md`, `cross-cutting.md`, `journeys/`, and `features/` when present

For a small project, discovery may have kept all detail in `project-scope.md`; do not require files that do not exist.

For an existing codebase, repository inspection is a hard prerequisite for a final architecture and executable implementation plan. Inspect the relevant repository before locking architecture. Distinguish current architecture from target architecture, identify already-implemented behavior, and preserve compatibility constraints that discovery identified.

If the repository is unavailable or cannot be inspected, do not present `architecture.md` or `implementation-plan.md` as final/executable. State the exact reconciliation blocker and stop before the completion gate. A clearly labeled provisional architecture sketch may be produced only when useful, but it must not masquerade as repository-validated architecture.

## Outputs

Create, in this order:

1. `architecture.md`
2. `implementation-plan.md`

Do not create code.

Do not modify product requirements merely to make planning easier.

## Planning model

Discovery describes the product as:

`Journey -> Feature -> Capability`

Planning organizes implementation as:

`Feature -> Phase -> Numbered Task`

Do **not** add "Vertical Slice" as a hierarchy level.

Use end-to-end capability delivery as an internal planning principle: phases should advance real product behavior across the necessary technical layers rather than organizing the plan as database first, backend second, frontend third.

## Boundaries

Plan owns:

- system architecture derived from approved scope and stack
- architectural boundaries, responsibilities, dependencies, and contracts
- data ownership and major data flows
- trust/security boundaries
- relevant consistency, concurrency, failure, recovery, and operational design
- implementation sequencing
- feature phases and numbered tasks
- dependency ordering
- test and verification work attached to the behavior it verifies
- traceability from implementation work back to discovery artifacts
- resumable execution state in `implementation-plan.md`

Plan does **not** own:

- discovering new product features
- changing MVP scope without user approval
- replacing the approved stack without a material reason and user approval
- writing implementation code
- code review or security review of completed code

If planning exposes a genuine product ambiguity that would lead to materially different observable behavior or acceptance, stop only that affected design decision, identify the exact missing requirement, and ask a targeted question. Do not reopen general discovery.

Distinguish product gaps from routine technical choices:

- If different choices would change user-visible behavior, lifecycle semantics, permissions, recovery behavior, acceptance criteria, or other approved product outcomes, treat it as a product gap and seek targeted clarification.
- If the difference is internal and does not change approved behavior, choose the simplest justified technical option and record it as an architecture decision when consequential.
- Never silently promote an implementation convenience into product behavior.

## 1. Load the project selectively

Start with `project-scope.md` and `tech-stack.md`.

Use their indexes/references to load only the detailed journey, feature, domain, and cross-cutting files needed for architecture and planning. For a large project, do not load every detail file at once unless the architecture genuinely requires global comparison.

Build an internal inventory of:

- MVP journeys
- MVP features
- capabilities under each feature
- business rules and invariants
- cross-cutting constraints
- accepted assumptions
- relevant risks
- approved technologies and hard technical constraints

Maintain discovery IDs exactly as written. Do not renumber `J-*`, `F-*`, `C-*`, or `BR-*` identifiers.

## 2. Verify planning readiness

Before architecture design, verify that planning has sufficient evidence.

For an existing project:

1. inspect the repository structure and relevant implementation
2. identify current runtime/module boundaries and data ownership
3. map discovery features/capabilities to existing code where possible
4. identify working behavior that must be preserved
5. identify migrations, compatibility constraints, and technical debt that affect the target design
6. record unresolved repository facts that block architecture decisions

Do not use discovery documents as a substitute for repository inspection when planning changes to an existing implementation.

Run a focused ambiguity scan before locking architecture. Look for requirements whose missing semantics would force implementation to invent observable behavior, especially:

- timeout/detection thresholds that change user experience
- conflict/concurrency winners
- retry/idempotency semantics
- start-versus-continue eligibility rules
- partial-failure outcomes
- lifecycle transition meaning
- data retention/deletion semantics

If one is material, ask only the targeted question required. If it is purely technical, decide it in architecture instead.

## 3. Identify architectural drivers

Before drawing architecture, extract only the requirements that materially constrain system structure, such as:

- platform/runtime boundaries
- real-time or offline behavior
- data ownership and consistency requirements
- concurrency and lifecycle rules
- security/trust boundaries
- external integrations
- modularity/extensibility requirements
- performance/reliability targets
- deployment or local-development constraints
- backward-compatibility or migration requirements

Separate **architectural drivers** from ordinary feature behavior. Do not turn every requirement into an architectural abstraction.

## 4. Design the simplest sufficient architecture

Read `assets/architecture-template.md` when creating `architecture.md`.

Design from the domain and capabilities outward, not from fashionable patterns inward.

Use these rules:

- Prefer the simplest architecture that satisfies the approved requirements.
- Keep responsibilities cohesive and boundaries explicit.
- Minimize coupling between independently changing areas.
- Make dependency direction intentional and avoid cycles.
- Put business/domain rules where they can be reused and tested independently of UI or transport concerns.
- Make ownership and source of truth explicit for important state.
- Define contracts at boundaries where independent components must coordinate.
- Prefer composition and small stable interfaces over speculative abstraction hierarchies.
- Introduce shared infrastructure only when several features genuinely need it.
- Design for known likely change without building hypothetical future systems.
- Respect the approved stack; do not add technologies unless a requirement justifies them.
- Treat security, privacy, failure, consistency, and recovery requirements as architecture inputs when relevant.
- Record important trade-offs, especially expensive-to-reverse decisions.

Architecture may describe modules/components, dependencies, data flows, trust boundaries, deployment topology, contracts, and state ownership. It should not become an implementation task list.

## 5. Validate architecture

The first architecture draft is not final.

Read `references/architecture-audit.md` only after the draft exists.

Audit `architecture.md` against the discovery artifacts and `tech-stack.md`.

If the audit finds an architecture defect, revise and audit again.

If it finds a true product gap, ask only the targeted product question required to unblock architecture, then update the plan inputs only if the user confirms the requirement change.

Do not create `implementation-plan.md` until the architecture audit passes.

## 6. Build the feature implementation order

Order implementation by real dependencies and learning value, not by technical layer.

Default sequencing priorities:

1. core journey-enabling features and risky assumptions early enough to validate them
2. prerequisite features before dependents
3. remaining MVP features
4. cross-feature integration/hardening required for MVP completion

Avoid a separate generic "setup" feature or phase. Attach foundational work to the earliest real feature that requires it, and create only what that feature needs.

Avoid separate project-wide phases such as "Database", "Backend", "Frontend", or "Testing" when those concerns can be implemented inside the feature phase that needs them.

Cross-cutting infrastructure should normally be introduced just in time when the first dependent feature requires it, then reused by later features.

## 7. Plan each feature

Use each discovery feature `F-*` as a primary planning unit.

For each MVP feature:

1. identify the capabilities and journeys it must satisfy
2. identify architecture components/contracts it touches
3. identify prerequisite features or shared foundations
4. divide the feature into a small number of coherent phases
5. divide each phase into numbered executable tasks

A phase should represent a meaningful implementation increment of the feature, ideally producing behavior that can be verified end-to-end.

A task should be small enough that an implementation agent can complete it in one focused work session without needing to redesign the project.

Tasks may cross UI, backend, persistence, tests, and integration layers when that is what delivering the capability requires.

Do not create artificial layer-oriented phases just to keep technologies separated.

## 8. Number and make the plan resumable

Read `assets/implementation-plan-template.md` when creating `implementation-plan.md`.

Use the feature's discovery number as the first planning number when practical:

- Feature `F-001` -> Feature 1
- Phase `1.1`, `1.2`, ...
- Task `1.1.1`, `1.1.2`, ...

If discovery IDs do not map cleanly to integers, preserve `F-*` as the feature identifier and still use stable phase/task numbering.

Every task must have a persistent status marker:

- `[ ]` pending
- `[~]` in progress
- `[x]` complete
- `[!]` blocked

At the top of `implementation-plan.md`, maintain a compact execution state containing:

- current feature
- current phase
- current task
- last completed task
- blockers, if any

This lets a later implementation skill resume without reconstructing progress from conversation history.

## 9. Make tasks implementation-ready

Each task should state enough to execute safely without becoming a mini design document.

Include when relevant:

- intended outcome
- architecture/component area affected
- discovery requirements implemented (`J-*`, `F-*`, `C-*`, `BR-*`)
- concrete implementation work
- tests/verification required
- dependencies or prerequisites
- completion condition

Do not repeat the full product specification inside the plan. Reference canonical discovery IDs/files instead.

Do not prescribe exact file names, classes, functions, or APIs unless architecture already requires them or the existing repository makes them obvious. Leave routine implementation details to the implementation skill.

## 10. Integrate quality into the work

Do not postpone quality to a final cleanup phase.

Attach relevant work to the feature/phase that needs it:

- behavior tests
- integration tests
- migration/compatibility checks
- security controls required by the feature
- error/failure handling
- observability required for that capability
- accessibility/performance checks when specified

Use TDD where it provides value, but do not require a rigid test-first ritual for every trivial task.

Keep cross-system hardening minimal. Prefer placing it in the feature whose completion requires it; use a final non-task completion checklist only for truly global verification.

## 11. Preserve traceability and coverage

Every MVP feature must appear in the implementation plan.

Every material MVP capability must be covered by at least one phase or task.

Important business rules and acceptance behavior must be implemented or verified somewhere relevant.

Use discovery IDs rather than copying requirements verbatim.

No task should exist only because a technology is available. Every task must support:

- an approved capability/rule
- an architectural prerequisite
- a quality requirement
- or necessary project delivery work

## 12. Validate the implementation plan

Read `references/plan-audit.md` after the first complete plan exists.

Audit for:

- coverage
- dependency order
- end-to-end feature progression
- task size and clarity
- traceability
- verification/testing
- resumability
- unnecessary setup or speculative infrastructure
- architecture/plan consistency

Run the bundled validator from this skill's `scripts/validate-plan.py`, passing the project root, for example:

```bash
python3 <skill-root>/scripts/validate-plan.py <project-root>
```

The validator checks deterministic structure such as IDs, duplicate numbers, broken discovery references, task dependency integrity/order, and MVP feature/capability/journey/business-rule coverage where those IDs are available.

Fix failures and re-run validation until it passes.

Do not weaken the plan merely to satisfy the validator; if the script exposes an intentional exception, document the exception and keep the architecture/product truth intact.

## 13. Completion gate

Finish only when:

- for an existing project, the relevant repository was inspected and current-to-target reconciliation is documented
- `architecture.md` exists and passes the architecture audit
- architecture is derived from discovery rather than invented product behavior
- approved technology constraints are respected
- major responsibilities, boundaries, dependencies, ownership, and important flows are clear
- important architectural trade-offs are recorded
- `implementation-plan.md` covers every MVP feature
- every material MVP capability is mapped to implementation work
- every core MVP journey and material business rule is represented in implementation/verification coverage
- the visible hierarchy is `Feature -> Phase -> Numbered Task`
- no "Vertical Slice" hierarchy level was introduced
- phases progress real product behavior rather than horizontal technical layers
- tasks are small, ordered, executable, and resumable
- tests/verification are attached to the work they validate
- cross-cutting setup is minimal and introduced when needed
- discovery IDs are preserved for traceability
- all task dependencies resolve to real earlier tasks or documented external prerequisites
- deterministic validation passes or documented intentional exceptions are justified
- no material planning decision remains that an implementation agent would have to invent

At completion, the project is ready for a separate implementation skill to execute one numbered task at a time.
