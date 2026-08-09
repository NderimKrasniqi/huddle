# Scope Audit

Use this only after a draft project specification exists. This is a validator, not a questionnaire. Do not ask about an item merely because it appears here; decide whether it applies and whether the existing artifacts already answer it.

The goal is to find product decisions a competent planner or implementer would otherwise have to invent.

## Product and scope

Check that the project explains:
- the problem and intended outcome
- primary users/actors
- goals and non-goals
- primary value
- meaningful success criteria
- MVP, Later, and Out of Scope boundaries
- constraints and non-negotiables

Challenge the MVP in both directions:
- Is anything included that is speculative rather than necessary for core value?
- Is necessary foundational behavior missing because it is not user-facing?

## Journeys

For every core journey verify:
- actor and goal are clear
- starting condition is clear
- major steps form a complete end-to-end path
- successful outcome is explicit
- important branches, interruptions, and failures are covered where relevant
- every step is supported by a defined feature/capability

Look especially for gaps **between** features: handoffs, waiting states, transition behavior, and what the user sees while the system changes state.

## Confirmed-decision preservation

Before evaluating completeness, compare the artifacts against the material decisions established during discovery and relevant accepted repository facts available in the current session.

Check that:
- every material confirmed decision has one canonical home in the artifacts
- no confirmed decision exists only in chat history
- no later summary accidentally dropped a qualifier, exception, limit, or user-selected option
- no plausible default was promoted to a requirement without confirmation or an explicit assumption
- duplicate statements do not conflict

If a confirmed decision is missing or materially altered, the audit fails even if the document otherwise looks complete.

## Features and capabilities

For each feature:
- Does it have every capability required by the journeys that reference it?
- Are implied lifecycle/support capabilities missing?
- Is the feature defined once rather than duplicated across journeys?

For each material MVP capability, inspect only applicable concerns:
- trigger and preconditions
- entry requirements versus continuation requirements where they may differ
- observable behavior
- alternative behavior
- rules/invariants
- states and legal transitions
- distinct semantics for similar lifecycle events such as leave, disconnect, removal, expiry, cancellation, and timeout where applicable
- ownership and authoritative state
- permissions/visibility
- validation/limits
- duplicate/retry behavior
- concurrency/conflict behavior
- interruption/partial failure
- recovery
- observable acceptance criteria
- for MVP proof/demo features: a complete basic loop and completion behavior rather than only an architectural purpose

## Six high-value questions

For every lifecycle-heavy or stateful area, ask internally:

1. What must always remain true?
2. Who owns each important piece of state, and what is authoritative when states disagree?
3. What lifecycle/state transitions are missing or illegal?
4. What happens if an operation occurs twice?
5. What happens when relevant actions occur concurrently?
6. What happens when a process fails halfway through?

Only turn these into user questions when the answer is material and not already specified.

## Domain consistency

Check:
- important concepts are defined consistently
- terminology is not overloaded or contradictory
- relationships and ownership are clear where they affect behavior
- important lifecycles are complete
- invariants/business rules are explicit
- a rule has one canonical home

Look for the same concept being called different things, or different concepts sharing one name.

## Lifecycle-event distinctions

For every stateful actor or concept, check whether superficially similar events have accidentally been collapsed into one behavior.

Examples include:
- deliberate leave vs network disconnect
- host removal vs voluntary exit
- temporary disconnect vs recovery-window expiry
- cancellation vs failure
- game completion vs forced termination

For each applicable event verify:
- resulting state
- whether identity/membership is preserved
- whether recovery/rejoin is allowed
- whether authority changes
- whether the event pauses, terminates, or permits continuation

## Combined-state and interruption analysis

Do not audit recovery states only one at a time. Where two abnormal states can realistically overlap, verify the combined behavior is defined or explicitly ruled out.

Examples:
- TV recovery while a player is disconnected
- host disconnect while the game is already paused
- multiple players disconnecting together
- room closure during an in-progress recovery
- reconnect arriving after the host has already chosen to continue

Check which rule has precedence, what the user sees, whether timers remain paused/running, and what recovery path remains legal.

## Cross-feature behavior

Where relevant, inspect:
- identity/authentication
- roles/authorization
- shared state and synchronization
- concurrent actions and conflict resolution
- background/asynchronous behavior
- external dependencies
- reconnect/offline behavior
- interactions between overlapping recovery/interruption states
- deletion/expiry/retention semantics
- privacy/security boundaries
- abuse/misuse and limits
- monetization
- accessibility
- performance/reliability
- observability
- platform differences

Do not require irrelevant categories.

## Data semantics

Do not design database schemas. Verify only product-level semantics when relevant:
- what information exists
- who owns it
- who may see/change it
- what must be unique or valid
- what must persist or expire
- what source is authoritative when copies disagree

## Existing-project audit

For an existing project, verify:
- current behavior and target behavior are not conflated
- existing user/data compatibility requirements are known
- existing technology constraints are captured
- intended changes do not silently break established behavior without an explicit decision

## Assumptions, risks, and open decisions

Check that:
- unconfirmed choices are labeled as assumptions rather than facts
- risks describe uncertainty or potential impact, not unresolved required behavior
- a material product decision is not hidden under "risk" just to finish discovery
- material open decisions are resolved before completion

## Contradictions

Compare:
- journey vs feature
- feature vs capability
- capability vs business rule
- role vs permission
- state vs lifecycle
- MVP vs Later/Out of Scope
- assumption vs confirmed decision
- current behavior vs target behavior for existing projects

Resolve material contradictions before completion.

## MVP completeness check

For every MVP feature, including a feature whose purpose is mainly to prove modularity or exercise a platform contract, ask:
- Can another engineer implement the user-visible/basic loop without inventing core behavior?
- Are start conditions, progression, completion, and relevant tie/empty/abstention behavior defined where applicable?
- Are minimum/maximum requirements clear both for entry and continuation if those differ?

A proof feature is not exempt from behavioral completeness.

## Final adversarial pass

Ask internally:

- What would a competent engineer still have to guess?
- Could two competent engineers implement materially different product behavior from these artifacts?
- What capability is implied by another requirement but missing?
- What happens before, during, after, and when each critical flow fails?
- Which happy-path requirement lacks recovery behavior?
- Which stateful concept has an incomplete lifecycle?
- Which actor's ownership or permissions remain unclear?
- Which assumption would cause major rework if wrong?
- Which confirmed decision from the interview could have disappeared from these artifacts?
- Which similar lifecycle events have not been differentiated?
- Which two recovery/failure states can overlap, and is their interaction defined?
- Where do entry requirements differ from continuation requirements?
- Which MVP proof/demo feature still requires an engineer to invent its basic loop?
- If discovery were run again from scratch, what new material question could still appear?

If a material product question appears, the audit fails. Continue the interview, update the canonical artifacts, and run this audit again.
