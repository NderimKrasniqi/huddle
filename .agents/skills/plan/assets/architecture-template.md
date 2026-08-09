# Architecture

**Planning status:** [Final | Provisional — repository reconciliation required]

## 1. Architecture Summary

[Concise description of the target system structure and why it fits this project.]

## 2. Existing-System Reconciliation

Include this section for existing projects. Omit it for greenfield projects.

### Current Architecture

[Relevant current structure based on repository inspection.]

### Preserve / Change / Remove

| Area | Current state | Target treatment | Reason / source |
|---|---|---|---|
| [...] | [...] | Preserve / Change / Remove | [...] |

### Migration / Compatibility Constraints

- [...]

### Repository Evidence Gaps

- [Anything still not verified. Final status is not allowed while a material gap remains.]

## 3. Architectural Drivers

Requirements that materially shape architecture.

| Driver | Source | Architectural implication |
|---|---|---|
| [Requirement/constraint] | [C-..., BR-..., constraint] | [Implication] |

## 4. System Context

### Actors / External Systems

- [Actor/system] — [relationship to the system]

### Major Runtime Boundaries

- [Boundary/runtime] — [responsibility]

Use a simple text/Mermaid diagram when it improves understanding.

## 5. Components / Modules

### [Component]

**Responsibility:**  
[What it owns.]

**Depends on:**  
[Important dependencies.]

**Used by:**  
[Important consumers.]

**Discovery coverage:**  
[F-..., C-...]

Repeat only for meaningful architectural units.

## 6. Dependency Rules

- [Rule]
- [Rule]

Call out prohibited dependencies where they prevent coupling/cycles.

## 7. Domain and Business Logic Placement

- [Where shared domain rules live]
- [How feature-specific logic is separated]
- [How UI/transport/infrastructure interact with domain behavior]

## 8. Data and State Ownership

| State / Data | Owner / Source of truth | Writers | Readers | Persistence / lifecycle |
|---|---|---|---|---|
| [...] | [...] | [...] | [...] | [...] |

Do not reproduce a full database schema here.

## 9. Key Flows

### [Flow]

1. ...
2. ...
3. ...

Reference relevant journeys/capabilities.

## 10. Contracts and Integration Boundaries

### [Boundary]

**Purpose:** ...  
**Contract responsibility:** ...  
**Failure behavior:** ...

Document contract shape only to the level needed for architecture and planning; detailed APIs may be designed during implementation unless they are expensive-to-reverse public contracts.

## 11. Security and Trust Boundaries

Include only applicable items:

- authentication boundary
- authorization responsibility
- untrusted input boundaries
- secrets/sensitive data boundaries
- privacy/data exposure rules

## 12. Reliability / Consistency / Recovery

Include only what the project requires:

- concurrency/consistency model
- retries/idempotency
- disconnect/recovery
- timeout/cancellation
- partial failure behavior

## 13. Deployment / Runtime Topology

[Only when relevant. Describe deployable/runtime units and important environment constraints.]

## 14. Testing and Verification Strategy

Architecture-level testing approach only:

- domain/unit boundaries
- integration boundaries
- end-to-end journey coverage
- contract testing where justified

Detailed test tasks belong in `implementation-plan.md`.

## 15. Architecture Decisions and Trade-offs

### AD-001 — [Decision]

**Decision:** ...  
**Why:** ...  
**Alternatives considered:** ...  
**Trade-off / consequence:** ...  
**Source requirements:** [C-..., BR-..., constraint]

Record only decisions future engineers are likely to question or that are costly to reverse.

## 16. Known Architecture Risks

- [Risk and current mitigation/handling]
