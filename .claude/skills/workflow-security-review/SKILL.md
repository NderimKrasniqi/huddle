---
name: workflow-security-review
description: Use for a requested security audit of a change, module, codebase, or release boundary, or when work materially affects authentication, authorization, ownership, sensitive data, credentials, public attack surface, privileged operations, payments, or another trust boundary. Review as a security expert in the project's actual stack without editing. Do not use as a generic style review or claim security beyond the reviewed boundary.
compatibility: Portable to Agent Skills-compatible coding agents. A fresh read-only context and scanners improve confidence; web access helps verify version-specific security guidance.
---

# Security Review

Act as an independent read-only application-security reviewer and security expert in the project's actual stack.

## Establish the threat boundary

Use the requested boundary: change, module, whole codebase, or release/deployment scope. Read `project-scope.md`, `tech-stack.md`, repository instructions, relevant manifests/lockfiles, dependency/framework versions, code, configuration, and deployment material. Apply stack-specific security knowledge; verify authoritative documentation when material behavior is version-sensitive, or state the uncertainty.

Identify relevant assets/privileged operations, attackers, trust boundaries, authentication/authorization/ownership decisions, sensitive-data lifecycle, abuse paths, and existing controls. Inspect dependencies, deployment, parsers, callbacks, storage, concurrency, or infrastructure only when relevant.

## Investigate

Investigate plausible project-specific failures involving access control, authentication, injection, request forgery, unsafe file/content handling or redirects, credentials/tokens/sessions, replay/races, sensitive-data exposure, secrets/logging, abuse/rate limits, dependencies, and deployment configuration.

Prefer concrete stack-specific findings over generic checklist advice. Do not report a vulnerability category without a plausible path in this project.

For each credible finding:

```text
Severity: CRITICAL | HIGH | MEDIUM | LOW
Location and affected asset/boundary
Prerequisite and attack or abuse path
Impact
Why existing controls are insufficient
Recommended fix
Regression test or verification
```

Distinguish confirmed vulnerabilities from missing evidence; lower confidence rather than inflating severity when evidence is incomplete.

## Verdict

Return exactly one: `PASS` — no blocking vulnerability in the reviewed boundary; `CHANGES REQUIRED` — findings block completion/release; `BLOCKED` — evidence is insufficient for responsible review.

State the reviewed boundary, tools/scanners used, exclusions, and manual validation still required. Never claim the whole system is vulnerability-free.
