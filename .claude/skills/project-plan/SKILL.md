---
name: project-plan
disable-model-invocation: true
description: Plan a project or significant roadmap: discover scope, choose the stack, and produce a reviewed numbered MVP plan. Do not use for a single planned task.
compatibility: Portable to Agent Skills-compatible coding agents; repository/web access improves evidence.
---

# Project Plan

Create/update only `docs/project-scope.md`, `docs/tech-stack.md`, `docs/implementation-plan.md`, and `.ai-workflow/session-state.md`. Do not write production code while planning.

## 1. Discover the project

If a repository exists, inspect instructions, structure, manifests, tests, CI, data/integrations, and Git state before questioning. Treat code as current evidence, not automatically intended behavior.

Interview adaptively. Ask only unresolved questions that could materially change the product or implementation. Never repeat answered questions; recommend sensible defaults for reversible details.

When the project can be described coherently, write `docs/project-scope.md`.

## 2. Challenge the scope until complete

Read `docs/project-scope.md` fresh as if another engineer wrote it:

> Review it and ask me clarifying questions. Help me find gaps or things I haven't thought through.

Look for missing workflows/rules/states, actors, permissions/data boundaries, failures/recovery, constraints, contradictions, accidental scope, or unclear MVP boundaries. Do not turn this into a mechanical questionnaire.

Resolve known gaps from prior decisions; ask only about unresolved material decisions. Update the scope and repeat the fresh review until no material gap remains.

Use domain-driven thinking only where domain complexity justifies it; do not force extra DDD artifacts.

## 3. Choose the stack before writing it

Read the approved scope and repository reality. Derive the technical capabilities and constraints required. Consider suitable options internally and reject unnecessary technologies, services, infrastructure, or abstractions before presenting a recommendation.

Ask for meaningful stack preferences or constraints. Preserve a working stack unless there is a concrete reason to change it; otherwise recommend the simplest suitable stack and explain why. If the user delegates the choice, use the recommendation. Do not make them choose every library or provider.

Only after the direction is agreed, write a small `docs/tech-stack.md`: choices and why, essential architecture/dependency rules, and verification commands. Verify version-sensitive choices when needed.

Re-read it against `docs/project-scope.md` only for contradictions, omissions, or accidental complexity. Correct genuine mistakes; do not use post-write review as the normal place to design the stack.

## 4. Reason through the roadmap, then write it

Before writing the plan, reason through the complete approved MVP using `docs/project-scope.md`, `docs/tech-stack.md`, and repository reality. Determine capability order, dependencies, cross-cutting work at first need, task boundaries, verification, and the simplest path to MVP.

Write `docs/implementation-plan.md` as:

```text
Project
└── Phase = working feature or capability
    └── Numbered task = focused implementation step
```

Use stable numbering (`1.1`, `1.2`, `2.1`). Keep tasks focused enough for one implementation session and independently verifiable without fragmenting trivial work. Avoid layer-first phases; use a foundation phase only when genuinely required.

Then read `docs/implementation-plan.md` fresh with `docs/project-scope.md` and `docs/tech-stack.md`. Find missing MVP work, bad ordering/dependencies, vague or oversized tasks, trivial fragmentation, missing required cross-cutting work, or unnecessary architecture. Fix actual defects; ask only if review exposes a real unresolved product or architecture decision.

Update future unchecked tasks when implementation evidence proves the roadmap wrong; preserve completed history unless incorrect.

## 5. Finish planning

Initialize `.ai-workflow/session-state.md` with the first executable task, blockers, and next action. Stop before implementation.

For later significant changes, inspect affected project truth/code, update only what changed, adjust future tasks/dependencies, and leave unaffected truth alone.
