---
name: discover
description: Define a software project before architecture, planning, or coding. Run a rigorous adaptive interview that uncovers user journeys, features, capabilities, domain rules, edge cases, constraints, and a justified technology stack; then create and audit the project definition artifacts. Use when the user explicitly starts project discovery for a new or existing software project.
---

# Discover

Define the project completely enough that a later planning skill can design the architecture and implementation plan without inventing product behavior or material technology decisions.

Approach the work with the judgment expected of a senior software engineer and product architect. Ask clarifying questions. Actively help the user find gaps, missing requirements, contradictions, edge cases, and things they have not thought through. Do not merely document the initial idea; challenge and refine it until material ambiguity is removed.

## Boundaries

Discover owns:
- product definition and scope
- users and actors
- core journeys
- features required by those journeys
- capabilities required by each feature
- product/domain rules, states, ownership, permissions, failures, and acceptance behavior
- relevant domain and cross-cutting rules
- MVP / Later / Out of Scope boundaries
- constraints, assumptions, risks, and unresolved decisions
- the simplest justified technology stack

Discover does **not** create:
- application architecture
- folder/module architecture
- database schemas
- API designs
- implementation phases or tasks
- `architecture.md`
- `implementation-plan.md`
- code

Record architectural requirements or hard constraints when the product demands them, but leave architecture design to the later planning workflow.

## Discovery model

Use this model throughout:

`Product -> Users/Actors -> Journeys -> Features -> Capabilities -> Rules/States/Permissions/Failures -> Cross-journey audit`

A **journey** is an end-to-end user goal. A journey references features.

A **feature** is a coherent area of product functionality. Define each feature once even when several journeys use it.

A **capability** is a concrete behavior the feature must provide. Keep capabilities inside the owning feature rather than creating one file per capability.

## Interview behavior

- Ask 1-4 related questions per batch. Keep batches small enough for thoughtful answers; use fewer questions when a single decision needs focus.
- Prioritize high-leverage ambiguities where a wrong assumption could cause major product or implementation rework.
- After each batch, reflect the important decisions in 1-2 sentences, then continue.
- Never ask for information already established or easily discoverable from an existing repository.
- Do not run a fixed questionnaire. Skip concerns that do not apply.
- When an answer is vague and future implementation would require interpretation, push for concrete behavior.
- When the user is uncertain, give 2-3 realistic options when useful, recommend the simplest sensible default, explain the meaningful trade-off, and record an accepted default as an assumption.
- If a new answer conflicts with a previous decision, surface the conflict and resolve it instead of silently replacing the earlier decision.
- Distinguish confirmed facts from assumptions, risks, and open decisions.
- Never silently turn a plausible default into a confirmed requirement. Material behavior must be explicitly confirmed or recorded as an assumption until confirmed.
- After each answer batch, preserve every material confirmed decision by updating its canonical artifact once enough structure exists. Do not rely on conversation history as the only copy of an important decision.
- Once project artifacts exist, persist material unresolved decisions in the `Open Decisions` section of `project-scope.md` so discovery can resume after interruption without a separate state file.
- Prefer explicit product behavior over implementation detail.

## 1. Establish project context

Determine whether this is:
- a new project
- an existing partially built project
- an existing mature project being changed

For an existing project, inspect the relevant repository and project documentation before asking questions that the codebase can answer. Capture current behavior and current technical constraints separately from the intended target behavior. Do not overwrite existing decisions silently.

Establish:
- problem
- product proposition
- primary value
- goals
- non-goals
- target users and actors
- meaningful constraints and non-negotiables

Capture technical preferences or constraints whenever the user mentions them, but defer stack selection until product scope passes review.

## 2. Discover core journeys

Start from what users need to accomplish end-to-end.

For each core journey identify:
- actor
- goal
- starting condition
- major steps
- successful outcome
- important alternative, interruption, and failure paths

Use journeys to reveal missing product functionality rather than treating them as duplicated feature specifications.

## 3. Discover features from journeys

For each journey ask:

> What product functionality must exist for this journey to work completely?

Build a deduplicated feature inventory. A feature may support multiple journeys.

Do not assume the user's initial feature list is complete. Look for supporting functionality implied by the journey, including lifecycle, recovery, ownership, administrative, or boundary behavior that users may not mention directly.

## 4. Decompose features into capabilities

For each feature ask:

> What must this feature be able to do for every relevant journey to work correctly?

Create a capability inventory under the feature.

After the inventory is clear, classify features/capabilities as:
- **MVP** - required to deliver or validate the core value
- **Later** - known and intentionally deferred
- **Out of Scope** - explicitly excluded

Do not deeply specify deferred capabilities unless their future existence imposes a real compatibility constraint on the MVP.

## 5. Specify MVP capabilities

For each material MVP capability, determine only what is relevant from:
- purpose and actor
- trigger and preconditions
- entry requirements versus continuation requirements when they can differ
- observable behavior
- alternative flows
- business rules and invariants
- states and legal transitions
- distinctions between similar lifecycle events when their semantics differ (for example leave vs disconnect vs removal vs expiry)
- ownership and source of truth
- permissions and visibility
- validation and limits
- repeated-action behavior when operations may be retried or duplicated
- concurrent behavior when actors/processes may act simultaneously
- interruption and partial-failure behavior
- recovery behavior
- behavioral acceptance criteria

Do not mechanically ask every category for every capability.

A useful acceptance criterion describes observable product behavior, not test implementation.

An MVP feature that exists primarily as a proof, demo, or conformance example is still an MVP feature. Specify its basic loop, completion behavior, and material edge cases well enough that another engineer can implement it without inventing the product.

## 6. Discover shared domain and cross-cutting behavior

Identify shared domain knowledge when it improves consistency across features:
- ubiquitous language
- important concepts and relationships
- ownership
- lifecycles
- invariants
- business rules

Identify rules that affect several features, such as:
- identity
- roles and authorization
- global ownership
- shared state and synchronization
- deletion/retention semantics
- privacy/security boundaries
- common limits
- connectivity/reconnection semantics

Keep each fact or rule in one canonical location. Reference it elsewhere rather than duplicating it.

When multiple recovery, interruption, or lifecycle states can overlap, clarify their interaction instead of specifying each state only in isolation.

## 7. Consider relevant system qualities

Only when materially relevant, clarify requirements around:
- security and privacy
- abuse and misuse
- accessibility
- performance
- reliability
- offline/connectivity
- scalability
- observability
- compliance
- external integrations and their failure behavior
- platform-specific behavior
- cost or usage limits

Capture requirements, not implementation mechanisms.

## 8. Preserve decisions and maintain project artifacts during discovery

Maintain an internal inventory of material confirmed decisions from the conversation and, for existing projects, relevant repository facts that the user has accepted or that constrain target behavior.

Before considering scope complete, verify every confirmed decision has exactly one canonical home in the project artifacts. A decision may be summarized or referenced elsewhere, but must not disappear, conflict with another artifact, or exist only in chat history.

If a newly discovered decision changes an existing artifact, update the canonical artifact rather than appending a competing rule.

Once enough structure exists, create or update the artifacts so a long interview can be resumed without relying only on conversation history.

Read `assets/project-scope-template.md` when creating `project-scope.md`.

For non-trivial projects, use `assets/detail-spec-templates.md` to split independently useful detail into `project/` files. Split for retrieval value, not to maximize document count.

Default output for a substantial project:

```text
project-scope.md
project/
  domain.md                 # only when shared domain detail justifies it
  cross-cutting.md          # only when shared rules justify it
  journeys/
    J-001-....md
  features/
    F-001-....md
```

For a small project, keep the specification in `project-scope.md` if separate files would add navigation overhead without meaningful context savings.

Rules:
- `project-scope.md` is the concise project map and scope summary.
- Journey files contain end-to-end flow detail and reference features.
- Feature files are the primary detailed retrieval units and contain their capabilities.
- Never create one file per capability by default.
- `domain.md` contains shared concepts/rules reused across features.
- `cross-cutting.md` contains rules that would otherwise be duplicated across features.
- One fact or rule has one canonical home.

Use stable IDs for traceability where the project is non-trivial:
- journeys: `J-001`
- features: `F-001`
- capabilities: `C-001.1`
- business rules/invariants: `BR-001`
- assumptions: `A-001`
- risks: `R-001`
- material open decisions during discovery: `OD-001`

## 9. Audit scope before choosing the stack

The first complete-looking draft is not completion.

Read `references/scope-audit.md` only when the scope appears ready.

Audit the full specification. Include a confirmed-decision coverage check against the interview/repository evidence available in the current session. If any confirmed decision is missing, contradictory, or only present in conversation history, the audit fails.

If the audit reveals material gaps, ask only the new questions needed to resolve them, update the artifacts, and audit again.

Do not proceed to final stack selection while an open product decision would force the planner or implementer to guess materially different behavior.

## 10. Choose the technology stack

After the scope audit passes, derive the technical needs from the completed project definition.

First gather or confirm only consequential preferences and constraints, including existing stack decisions for an existing project.

Then recommend the simplest appropriate stack. Prefer defaults over menus. Do not ask the user to choose routine libraries when there is a clear low-risk default.

For every technology selected, be able to answer:

> What requirement or constraint justifies this technology?

Rules:
- Explicit user constraints win unless they materially conflict with the project; surface such conflicts instead of silently replacing choices.
- Prefer built-in platform capabilities before adding dependencies.
- Avoid speculative infrastructure and architecture for hypothetical future scale.
- Keep `tech-stack.md` about technology choices and constraints, not architecture or implementation order.
- When exact framework/library versions matter, verify current compatible versions from authoritative documentation. If current verification is unavailable, mark the version as unverified rather than guessing.

Read `assets/tech-stack-template.md` when creating `tech-stack.md`.

Before finalizing, review the stack:
- every technology is justified
- no required technical concern is missing
- no technology is present only because it is fashionable or potentially useful later
- existing/user constraints are respected
- important compatibility/version claims are verified

## 11. Completion gate

Finish discovery only when:
- the product problem, goals, non-goals, and primary value are clear
- actors are understood
- core journeys are understood end-to-end
- journeys map to a sufficiently complete feature inventory
- each feature has the capabilities required by its relevant journeys
- MVP / Later / Out of Scope is explicit
- material MVP capability behavior is precise enough to implement and verify
- important rules, ownership, permissions, states, failure, and recovery behavior are explicit
- relevant domain and cross-feature rules are consistent
- assumptions and risks are visible
- every material confirmed decision has one canonical home in the artifacts
- no material behavior was invented without confirmation or an explicit assumption
- similar lifecycle events have distinct semantics where needed
- overlapping recovery/interruption states have defined interaction where relevant
- entry and continuation requirements are distinguished where they can differ
- every MVP feature, including proof/demo features, is implementable without inventing its basic loop
- no known contradictions remain
- no material open product decision remains
- the scope audit produces no new material question
- the technology stack is minimal, justified, constraint-aware, and version-checked where needed

At completion, the project is ready for a separate planning skill to create architecture and `implementation-plan.md`.
