// Trivia: the first Game Module behind game-core's interface. The Registry
// (`@huddle/game-registry`) is what installs it in the hub.
//
// This is the *client* entry — the module a TV or phone mounts, and the types a
// screen is written against. It re-exports no value from `./logic` on purpose:
// `triviaGameLogic` reaches from there to `./questions` and the Question Pack,
// so a value re-export here would pull every answer into any bundle that
// imported this barrel (docs/implementation-plan.md 5.9). The rules have their
// own entry point, `@huddle/game-trivia/logic`, which the Convex server uses —
// see `./logic`.
//
// `export type { … }`, not `export { type … }`: the block form is erased whole
// by the bundler, so re-exporting these types leaves no runtime edge to
// `./logic`. The inline-`type` form inside a value-export block keeps the module
// dependency in place — the exact shape of the leak this file must not have, and
// what `client-seam.test.ts` guards.
export type { TriviaAdvance, TriviaEvent, TriviaPhase, TriviaStanding, TriviaState } from './types';
export type { TriviaQuestion } from './questions';
// Nothing else of `./questions` or `./settings` is exported: the schema reaches
// the hub as `triviaGameModule.settingsSchema` and the pack's categories reach
// the Host through the options on it, so a client that imported either by name
// would be a client that had learnt what game it is drawing.
export { triviaGameModule } from './trivia';
