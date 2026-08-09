# Architecture Audit

Use this only after a draft `architecture.md` exists.

This is a validator, not an architecture pattern catalog. Compare the architecture against the discovery artifacts and approved tech stack. Do not add abstractions merely because they appear in this checklist.

## 1. Requirements fit

Verify that every architectural choice is justified by at least one of:

- an MVP capability or business rule
- a cross-cutting requirement
- an approved quality requirement
- a platform/integration constraint
- an existing-code compatibility requirement

Flag architectural elements with no concrete driver.

## 2. Product preservation

Ask:

- Did architecture change or narrow product behavior without approval?
- Did it silently reinterpret a capability or business rule?
- Does any architectural limitation contradict the approved scope?
- Are assumptions clearly distinguished from confirmed requirements?

If product behavior would change, discovery/user confirmation is required.

## 3. Responsibility and cohesion

Check that major components/modules:

- have a clear reason to exist
- own cohesive responsibilities
- do not mix unrelated business areas
- keep domain/business rules out of presentation/transport code where reuse or independent testing matters
- do not create "god" services or shared utility buckets that become hidden coupling points

## 4. Dependencies and boundaries

Check:

- dependency direction is explicit where important
- circular dependencies are avoided
- high-level/domain behavior is not unnecessarily coupled to infrastructure details
- independent features/modules communicate through clear contracts when appropriate
- shared modules exist because behavior is genuinely shared, not merely similar today

## 5. Data and state ownership

For important state verify:

- owner/source of truth is explicit
- write authority is clear
- consistency expectations match product behavior
- concurrent updates have defined handling where relevant
- lifecycle/retention/expiry requirements are respected
- duplicated state has a clear synchronization strategy or is removed

## 6. Failure, recovery, and concurrency

Where relevant, verify architecture supports discovery requirements for:

- retries and idempotency
- reconnect/recovery
- partial failures
- simultaneous actions
- cancellation/timeouts
- overlapping abnormal states
- graceful degradation

Do not invent mechanisms beyond what is needed to satisfy behavior.

## 7. Security and privacy boundaries

Where relevant, verify:

- trust boundaries are explicit
- authentication/authorization responsibilities are placed clearly
- least-privilege access is feasible
- secrets/sensitive data do not cross unnecessary boundaries
- untrusted inputs cross a validation boundary
- externally visible contracts do not expose unnecessary internals

This is architecture-level security design, not a substitute for later security review.

## 8. Modularity and change

Check that the architecture accommodates **known** likely change without speculative systems.

Ask:

- What parts are expected to change independently?
- Are those changes localized?
- Are extension contracts justified by an actual requirement?
- Did we create a plugin/microservice/event abstraction before the product needs it?

Prefer reversible/simple decisions when future direction is uncertain.

## 9. Technology fit

Compare with `tech-stack.md`:

- approved technologies are used consistently
- no technology was silently replaced
- new dependencies/services have concrete justification
- architecture does not require a technology omitted from the stack without documenting and approving the change
- version/platform constraints are compatible with the architecture

## 10. Operational fit

Only when required by scope, verify:

- deployability
- local development constraints
- observability
- performance
- scalability
- migration/backward compatibility
- external dependency failure handling

## 11. Simplicity challenge

For each major abstraction ask:

> What breaks if this abstraction is removed?

If the answer is "nothing in the approved MVP," remove or defer it.

Look specifically for unnecessary:

- microservices
- queues/event buses
- caches
- repositories/service layers with no boundary value
- generic plugin systems
- premature sharding/distribution
- duplicated domain abstractions

## 12. Final adversarial questions

Before passing the audit ask:

1. What architecture decision would be most expensive to reverse?
2. Is it justified by current requirements?
3. Where could coupling make one feature change break unrelated features?
4. What important state lacks a clear owner?
5. Which boundary is most security-sensitive?
6. Which failure/recovery requirement is hardest for this architecture to satisfy?
7. Could the same requirements be met with fewer components or dependencies?
8. Does any component exist only because a named architecture pattern suggested it?
9. Can an implementation planner understand where each MVP feature belongs without inventing structure?
10. Did this architecture preserve the product rather than redesign it?

The architecture passes only when no material defect remains.

## 13. Existing-project evidence gate

For an existing project, architecture cannot be final until relevant repository evidence has been inspected.

Verify:

- current boundaries and target boundaries are distinguished
- current data/state ownership is understood where changes touch it
- working behavior that discovery says to preserve has a migration/preservation strategy
- repository constraints are evidence-based rather than guessed from documentation
- `Planning status` is `Provisional` whenever material repository evidence is missing

Do not let a clean target architecture hide an unexamined migration from the current system.

## 14. Product-gap versus technical-choice check

For each unresolved decision ask:

> Would two reasonable choices change observable product behavior or acceptance?

If yes, it is a product gap and needs targeted clarification.

If no, make the simplest justified technical choice and record it as an architecture decision only when consequential.
