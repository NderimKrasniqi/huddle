# Implementation Plan

## Execution State

**Current feature:** —  
**Current phase:** —  
**Current task:** —  
**Last completed task:** —  
**Blockers:** None

Status markers:

- `[ ]` pending
- `[~]` in progress
- `[x]` complete
- `[!]` blocked

## Plan Overview

[Short explanation of implementation order and the critical dependency/risk logic behind it.]

### Feature Order

| Order | Feature | Why here | Depends on |
|---:|---|---|---|
| 1 | F-001 ... | ... | ... |

---

# Feature 1 — F-001 [Feature Name]

**Goal:** [What product behavior this feature delivers.]  
**Journeys:** [J-...]  
**Capabilities:** [C-...]  
**Business rules:** [BR-...]  
**Architecture areas:** [components/modules]  
**Dependencies:** [feature/phase IDs or None]

## Phase 1.1 — [Meaningful implementation increment]

**Outcome:** [Observable/verifiable behavior available after this phase.]  
**Covers:** [C-..., BR-..., J-...]

- [ ] **1.1.1 — [Task title]**
  - **Outcome:** [What this task accomplishes]
  - **Work:** [Concrete implementation work]
  - **Touches:** [architecture component(s)]
  - **Requirements:** [C-..., BR-...]
  - **Verify:** [tests/checks/observable behavior]
  - **Depends on:** [task IDs or None]
  - **Done when:** [objective completion condition]

- [ ] **1.1.2 — [Task title]**
  - ...

### Phase 1.1 Completion

- [Observable acceptance condition]
- [Relevant journey/capability works at this increment]

## Phase 1.2 — [Next increment]

...

### Feature 1 Completion

- [All required capabilities for F-001 are covered]
- [Relevant journey behavior is verified]

---

# Feature 2 — F-002 [Feature Name]

...


---

## Final MVP Validation

This is a completion checklist, not another implementation hierarchy level. Put executable work inside the owning feature phases above.

- [ ] Every core MVP journey passes end-to-end verification.
- [ ] Required cross-feature security/reliability behavior is verified.
- [ ] Required migrations/compatibility checks pass.
- [ ] Production/local build and release requirements from discovery are satisfied.

## Completion Gate

The MVP implementation is complete when:

- every MVP feature is complete
- every material MVP capability has implementation coverage
- core journeys pass end-to-end verification
- required cross-cutting/security/reliability behavior is implemented
- required migrations/compatibility checks pass
- no blocked task remains
