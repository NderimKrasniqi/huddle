// Hot Takes: the deliberately simple second Game Module behind game-core's
// interface, and the proof the platform is genuinely game-independent. The
// Registry (`@huddle/game-registry`) is what installs it in the hub.
//
// The rules are also reachable on their own at `@huddle/game-voting/logic`,
// which is the entry point the Convex server uses — see `./logic`.
export type { VotingEvent, VotingPhase, VotingState } from './logic';
// Timing constants are pure client display facts and live in the client-safe
// state seam; the rules object itself remains behind `./logic`.
export { REVEAL_SECONDS, VOTE_SECONDS } from './state';
export type { VotingPrompt } from './prompts';
// Nothing of `./settings` is exported by name: the schema reaches the hub as
// `votingGameModule.settingsSchema`, so a client importing it by name would be
// a client that had learnt what game it is drawing.
export { votingGameModule } from './voting';
