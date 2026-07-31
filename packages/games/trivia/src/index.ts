// Trivia: the first Game Module behind game-core's interface. The Registry
// (`@huddle/game-registry`) is what installs it in the hub.
//
// The rules are also reachable on their own at `@huddle/game-trivia/logic`,
// which is the entry point the Convex server uses — see `./logic`.
export {
  triviaGameLogic,
  FLAT_SCORE_PER_CORRECT_ANSWER,
  type TriviaEvent,
  type TriviaPhase,
  type TriviaStanding,
  type TriviaState,
} from './logic';
export { type TriviaQuestion } from './questions';
// Nothing else of `./questions` or `./settings` is exported: the schema reaches
// the hub as `triviaGameModule.settingsSchema` and the pack's categories reach
// the Host through the options on it, so a client that imported either by name
// would be a client that had learnt what game it is drawing.
export { triviaGameModule } from './trivia';
