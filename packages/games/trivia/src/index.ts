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
export { INLINE_QUESTIONS, type TriviaQuestion } from './questions';
export { triviaGameModule } from './trivia';
