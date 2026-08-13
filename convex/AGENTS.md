# Convex backend

Before editing, read `convex/convex/_generated/ai/guidelines.md`; it is generated and
must not be hand-edited. Backend truth lives in the repository
[`docs/architecture.md`](../docs/architecture.md) and
[`docs/project-scope.md`](../docs/project-scope.md).

Convex owns rooms, seats, presence, setup/readiness, rate limits, running proof
state, and lifecycle cleanup. Keep public paths stable, shared helpers under
`convex/convex/lib/`, and the server registry import on `@huddle/game-registry/logic`
so React Native screens cannot enter the backend bundle. Credentials authorize;
`guestId` never does.

Never commit deployment credentials. `development-reset.ts` is development
cutover tooling: audit first, require both environment gates and the exact
confirmation literal, verify zero rows, disable the gate, and never enable or
invoke it in production.
