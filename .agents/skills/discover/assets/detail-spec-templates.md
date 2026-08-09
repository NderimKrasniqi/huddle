# Detail Specification Templates

Use only the templates needed for this project. Omit irrelevant subsections rather than filling them with generic text.

---

# Journey Template

# J-001 — [Journey Name]

## Goal
[End-to-end outcome the actor wants.]

## Actor
[Primary actor.]

## Starting Condition
[What is true before the journey begins.]

## Features Used
- F-001 — [Feature]
- F-002 — [Feature]

## Journey
1. [Step]
2. [Step]
3. [Step]

## Important Alternatives / Interruptions
### [Situation]
[Expected behavior.]

## Failure / Recovery
### [Failure]
[Expected user/system behavior and recovery.]

## Completion
[Observable successful outcome.]

---

# Feature Template

# F-001 — [Feature Name]

## Purpose
[Coherent product functionality this feature provides.]

## Used By Journeys
- J-001 — [Journey]

## Capabilities

### C-001.1 — [Capability Name]

**Purpose:** [Concrete behavior this capability provides.]

**Actors:** [Relevant actors.]

**Preconditions / entry requirements:**
- [Only when relevant]

**Continuation requirements:**
- [Only when continuation can differ from entry/start requirements]

**Behavior:**
1. [Observable behavior]
2. [Observable behavior]

**Business rules / invariants:**
- BR-001 — [Rule that must hold]

**States / transitions:**
[Only when lifecycle/state matters. Distinguish semantically different events such as leave, disconnect, removal, expiry, or cancellation when applicable.]

**Ownership / source of truth:**
[Only when ambiguity matters.]

**Permissions / visibility:**
[Only when relevant.]

**Validation / limits:**
- [Only when relevant]

**Repeated / concurrent behavior:**
[Only when retries, duplicate actions, or concurrency matter.]

**Edge cases:**
- [Case -> expected behavior]

**Failure / recovery:**
- [Failure -> expected behavior/recovery]

**Overlapping interruption/recovery behavior:**
[Only when this capability can interact with another recovery/failure state.]

**Acceptance criteria:**
- [Observable criterion]
- [Observable criterion]

Repeat capability sections as needed.

---

# Domain Template

# Domain

## Ubiquitous Language

| Term | Meaning |
|---|---|
| [Term] | [Project-specific meaning] |

## Core Concepts

### [Concept]
**Meaning:** [Definition.]

**Relationships:** [Only relevant relationships.]

**Ownership:** [Only when behavior depends on it.]

**Lifecycle:** [Only when lifecycle matters.]

## Business Rules / Invariants

- BR-001 — [Rule that must remain true]

---

# Cross-Cutting Template

# Cross-Cutting Rules

Only include rules that genuinely affect multiple features. Keep feature-specific behavior in the owning feature file.

## [Concern: Identity / Authorization / Shared State / Retention / etc.]

- BR-001 — [Canonical rule]
- [Additional behavior]

## Ownership / Authority
[Global ownership/source-of-truth semantics when applicable.]

## Failure / Recovery Semantics
[Global behavior only when shared across features.]
