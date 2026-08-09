# Security Review Quality Reference

Load this reference when the reviewed surface crosses security-sensitive boundaries or when a candidate finding requires deeper security judgment.

Use these as reasoning lenses, not a checklist that must produce a finding in every category.

## Evidence standard

A strong security finding connects four elements:

1. **Entry** — attacker/untrusted input or capability.
2. **Path** — how it reaches the security-sensitive decision/sink.
3. **Failure** — the missing, bypassed, or incorrect control.
4. **Impact** — what confidentiality, integrity, authorization, availability, or trust property is violated.

If one of these is missing, investigate further before reporting.

Distinguish:

- **confirmed**: the path/control failure is established from code or safe reproduction
- **conditional**: exploitability depends on a deployment/configuration fact not available
- **speculative**: merely conceivable; normally discard

Do not inflate severity to compensate for uncertainty.

## Access control and tenant isolation

Authorization must be enforced at a trusted boundary for every protected operation.

Look for:

- object lookup by attacker-controlled ID without actor/tenant scope
- write/delete operations that authenticate but do not authorize
- client/UI-only permission checks
- role checks without resource ownership where ownership also matters
- tenant ID taken from request input rather than authenticated context
- admin/internal endpoints reachable through ordinary routing/middleware
- batch endpoints where one item bypasses per-object authorization
- indirect references that become direct object access
- stale authorization after membership/role revocation

Prefer authorization tied to the authoritative operation/query rather than scattered caller-side checks.

## Authentication and sessions

Inspect the actual auth model before judging it.

Relevant issues can include:

- accepting unsigned/unverified tokens
- wrong issuer/audience/algorithm/key validation
- session fixation or reuse where rotation is expected
- insecure token storage or leakage
- reset/invite/magic-link tokens that are predictable, reusable, excessively long-lived, or not bound to intended state
- authentication state trusted from client-controlled fields
- privileged state changes without re-authentication when the project requires it
- fail-open behavior when auth/session lookup errors occur

Do not prescribe a different authentication product merely because one exists.

## Input, encoding, and injection

Follow the value to the interpreter/sink.

Common dangerous boundaries:

- SQL/NoSQL query construction
- shell/OS commands
- HTML/DOM/template rendering
- filesystem paths
- URLs/HTTP clients
- LDAP/XPath or other query languages
- dynamic imports/eval/code generation
- serialized data formats interpreted as executable/configuration state

Prefer structural APIs (parameterized queries, argument arrays, typed builders, safe framework rendering) over escaping when the stack supports them.

Validation is only a security control if it constrains the value before the relevant sink and cannot be bypassed through alternate encodings/paths.

## Web/browser boundaries

Evaluate according to the actual auth and rendering model.

Potential issues include:

- unsafe HTML insertion from untrusted content
- unsafe URL schemes or open redirects that enable a meaningful attack
- CSRF on cookie-authenticated state-changing requests lacking appropriate origin/token/SameSite protection
- permissive CORS combined with credential/sensitive-response exposure
- sensitive data embedded in client bundles or browser-readable storage without justification
- postMessage without origin/source validation

Do not report missing CSP or headers mechanically; connect configuration to the reviewed threat surface.

## SSRF and outbound requests

When users influence destinations or URLs, inspect:

- allowed schemes
- hostname/IP validation and redirects
- access to loopback/link-local/private/cloud-metadata ranges
- DNS rebinding assumptions where relevant
- credential forwarding to attacker-controlled hosts
- proxy behavior
- response-size/time limits where abuse matters

Prefer allowlisting intended destinations when the product model permits it.

## File and path handling

Review uploads/downloads/extraction/generation for:

- path traversal and canonicalization mistakes
- user-controlled absolute paths
- archive extraction outside intended root
- unsafe temporary-file permissions/names
- executing or serving uploaded active content
- trusting extension instead of content when content type matters
- unbounded upload/decompression/resource use
- file disclosure through predictable/unscopeable identifiers

Follow framework/runtime path semantics for the pinned version and operating environment.

## Cryptography, randomness, and secrets

Cryptography findings require precision.

Look for:

- hardcoded or default production secrets
- weak/predictable tokens from non-cryptographic randomness
- password hashing with inappropriate primitives/parameters
- encryption without authentication where tampering matters
- fixed/reused nonces/IVs where the chosen mode forbids it
- disabled TLS verification
- secret material logged, returned, committed, embedded in client artifacts, or stored in inappropriate plaintext locations
- home-grown cryptographic protocols where a standard stack facility exists

Do not recommend custom cryptography. Prefer stack/platform primitives and established libraries already approved by the project.

## Sensitive data and logging

Inspect both normal and exceptional paths.

Examples:

- passwords, session tokens, API keys, reset tokens, private keys, payment data, or sensitive personal data in logs
- full request/response logging around authentication/payment endpoints
- stack traces or debug errors revealing credentials/internal data
- cache keys/responses mixing users or tenants
- sensitive server configuration exposed to client bundles

Redaction must occur before data reaches uncontrolled sinks.

## Integrity and signed external input

For webhooks, callbacks, artifacts, or remotely supplied state:

- verify signatures/MACs before trusting payloads
- bind verification to the raw bytes/representation expected by the signer
- validate timestamp/replay policy when required
- verify issuer/key identity and algorithm expectations
- perform authorization/business validation after cryptographic authenticity
- fail closed on malformed or failed verification

A valid signature does not automatically authorize every business action in the payload.

## Exceptional conditions and secure failure

Security-sensitive failures should fail closed.

Look for:

- authz/authn errors treated as success
- catch blocks that skip verification
- missing-data fallbacks granting privilege
- partial transaction failures leaving privileged/inconsistent state
- timeout/fallback paths that disable checks
- verbose errors exposing secrets or security internals

OWASP Top 10:2025 explicitly includes mishandling exceptional conditions; treat concrete fail-open behavior as a vulnerability, not merely code quality.

## Concurrency and TOCTOU

Security-relevant concurrency issues include:

- checking ownership/permission then acting on a resource that can change identity/state before use
- one-time tokens redeemed concurrently more than once
- quota/payment/entitlement checks separated from mutation without required atomicity
- raceable filename/path checks
- revocation not synchronized with protected action

Use the repository's transaction/atomic primitives rather than inventing locks when the stack already provides them.

## Resource exhaustion and abuse

Do not label every unbounded loop as a vulnerability.

A strong availability finding has:

- attacker-controlled input or repetition
- materially expensive CPU/memory/network/storage/work-queue behavior
- insufficient bounding/backpressure/quota for the exposed operation
- meaningful service impact

Consider pagination limits, regex/pathological parsing, decompression, fan-out, upload size, recursive structures, expensive cryptographic work, and queue flooding where relevant.

## Dependencies and supply chain

Use repository evidence.

Check when relevant:

- manifests/lockfiles pin the vulnerable version
- the vulnerable package/component is actually used on a relevant path when exploitability requires it
- existing audit tooling reports an advisory
- install/build scripts execute untrusted code or fetch unverified artifacts
- integrity/signature/checksum protections are bypassed
- dependency confusion/registry configuration is concretely possible

Do not infer a vulnerability solely because a package is old.

When network access is available and dependency risk is in scope, prefer authoritative advisory sources and the repository's native audit tooling. Do not update dependencies during review.

## Framework/version accuracy

Security behavior is often version-specific.

Before reporting a framework/library vulnerability or mitigation requirement:

1. identify the actual version from lockfiles/manifests/runtime
2. inspect repository configuration and existing protections
3. use installed types/source when useful
4. verify uncertain claims against authoritative vendor/framework documentation or advisories

Avoid recommending APIs/options unavailable in the pinned version.

## Severity calibration

Consider:

- attacker prerequisites and required privileges
- remote vs local reachability
- user interaction required
- data/tenant/account scope
- confidentiality/integrity/availability impact
- repeatability and scale
- existing mitigations

Examples:

- **Critical**: unauthenticated remote code execution; universal auth bypass; broadly exposed signing/private key enabling systemic compromise
- **High**: cross-tenant read/write; account takeover; practical command/SQL injection; privileged action bypass
- **Medium**: constrained sensitive-data exposure; exploit requiring authenticated low-privileged user with limited scope; meaningful CSRF on a non-critical state change
- **Low**: real but limited weakness with strong prerequisites or minor security impact

Do not use severity to express confidence.

## OWASP coverage references

Use current OWASP material as review support:

- OWASP Top 10:2025 for broad application-risk awareness
- OWASP ASVS 5.0.0 for detailed security verification requirements

The Top 10 is not an exhaustive audit checklist. ASVS requirements should be selected according to the actual application type, assurance needs, and reviewed surface.

CWE or OWASP mappings can make a finding easier to communicate, but the vulnerability must stand on its code evidence even without the label.

## Finding quality gate

Before reporting each finding, ask:

- Can I show the vulnerable code/configuration and the broken security invariant?
- Can an untrusted actor plausibly reach it?
- What exact asset or privilege is affected?
- Did I check surrounding middleware/policies/helpers that might already mitigate it?
- Is the severity proportionate to actual exploitability and impact?
- Is the remediation compatible with this repository and stack?

If not, investigate further or discard the candidate.
