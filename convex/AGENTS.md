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

Room views answer only `roomViewer` from `convex/convex/lib/authorization.ts`:
a seated phone's `sessionToken` or the room's `tvSessionToken`. Anyone else
gets an empty roster, no setup or card, and `unavailable` for a game.
`rooms.stillOpen` and `rooms.connection` carry no room content and stay open
by room ID.

`npx convex ai-files update` refreshes the generated guidelines. Keep only
its changes to `convex/convex/_generated/ai/`. Drop the Convex block it adds
to this file and the CLAUDE.md it creates beside it: this repository keeps one
instruction file per directory, and `pnpm validate:workflow` rejects a
tracked `CLAUDE.md`.

Never commit deployment credentials. `developmentReset.ts` is development
cutover tooling: audit first, require both environment gates and the exact
confirmation literal, verify zero rows, disable the gate, and never enable or
invoke it in production.
