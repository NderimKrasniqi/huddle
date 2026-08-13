import type { GameDeadline, GameLogic, GamePlayerId, GameSettings } from '@huddle/domain';

import { triviaMetadata } from './metadata';
import { questionsFor, type TriviaQuestion } from './questions';
import {
  triviaSettings,
  TRIVIA_SETTINGS_PRESENTATION,
  TRIVIA_SETTINGS_SCHEMA,
} from './settings';
// The pure reads over the state live in `./state`, so the screens can import
// them without pulling this file — and the Question Pack `./questions` deals
// from — into the client bundle (docs/implementation-plan.md 5.9). They are
// imported here for the rules' own use and re-exported, so the server and the
// tests go on reading them off the module they always have.
import { answersIn, beatOf, playersCounted, QUESTION_SECONDS, REVEAL_SECONDS } from './state';
import { triviaEventSchema, triviaStateSchema } from './schemas';
import type { TriviaAdvance, TriviaEvent, TriviaStanding, TriviaState } from './types';

export { answersIn, playersCounted, QUESTION_SECONDS, REVEAL_SECONDS } from './state';
export { triviaEventSchema, triviaStateSchema } from './schemas';
export type { TriviaAdvance, TriviaEvent, TriviaPhase, TriviaStanding, TriviaState } from './types';

/**
 * Trivia's rules, with no screens attached.
 *
 * This is the half that runs inside a Convex mutation, which is why it is its
 * own module and its own package entry point (`@huddle/game-trivia/logic`): the
 * server seeds a game's state and reduces its events, and must not carry the
 * React Native that draws it. `./trivia` is where the screens are put back on
 * top for the two clients.
 */

/**
 * What a correct answer is worth, before the Host's Scoring Mode adds anything
 * to it: the whole of a flat game's score, and the floor of a speed one's.
 *
 * One number rather than two identical ones, because it is one rule: a right
 * answer is worth a hundred, and speed is a bonus paid on top of that for the
 * seconds the question did not need. A wrong answer and an answer that never
 * came are worth nothing in either mode, which is what keeps the Verdict on the
 * television honest — a mark that says wrong can never sit beside points. It
 * keeps the name of the mode it is the whole of.
 */
export const FLAT_SCORE_PER_CORRECT_ANSWER = 100;

/**
 * What speed pays on top, for a correct answer with the whole question still
 * left on the clock — falling to nothing as the last second goes.
 *
 * The plan's formula in full: `100 + round(100 × secondsRemaining / 20)`, so
 * the fastest possible answer is worth twice a flat one and the slowest exactly
 * as much. Rounded rather than truncated, so half a point goes up and the room
 * is never told 174 for an answer the rules priced at 175.
 */
export const SPEED_BONUS_PER_CORRECT_ANSWER = 100;


/** The scoreboard order: highest first, ties left in the order they had. */
function inScoreOrder(standings: readonly TriviaStanding[]): readonly TriviaStanding[] {
  // `Array#sort` is stable, so players on equal scores keep their places
  // instead of trading them every time somebody else scores.
  return [...standings].sort((first, second) => second.score - first.score);
}

function isPlaying(state: TriviaState, playerId: GamePlayerId): boolean {
  return state.standings.some((standing) => standing.playerId === playerId);
}

/**
 * The seconds a question still had when an answer landed, as the rules will pay
 * for them.
 *
 * The rules have no clock of their own, so this is whatever the hub timed the
 * event with (`GameEvent`) — held to the question's own twenty seconds at both
 * ends, since a clock that reads longer than the beat, or one already overdue,
 * is a room's bookkeeping and not a score anybody earned.
 *
 * Absent is nothing, which is flat. Two things reach it: a beat with no clock
 * running on it, and a room dealt its question by a deployment older than the
 * field the hub times against. Paying no bonus is the safe direction of the two
 * — the alternative is paying a full one for an answer that may have taken the
 * whole question.
 */
function secondsLeftOn(msRemaining: number | undefined): number {
  if (msRemaining === undefined || !Number.isFinite(msRemaining)) {
    return 0;
  }

  return Math.min(Math.max(msRemaining / 1000, 0), QUESTION_SECONDS);
}

/**
 * What a correct answer is worth in this game: a hundred, and in a speed game
 * the bonus the seconds it left on the clock buy.
 *
 * The Host's whole Scoring Mode is this one line. A mode the state does not
 * carry is flat, which is both the schema's default and what a game dealt
 * before speed scoring existed was being scored.
 */
function scoreForCorrectAnswer(state: TriviaState, secondsRemaining: number): number {
  if (state.scoring !== 'speed') {
    return FLAT_SCORE_PER_CORRECT_ANSWER;
  }

  return (
    FLAT_SCORE_PER_CORRECT_ANSWER +
    Math.round((SPEED_BONUS_PER_CORRECT_ANSWER * secondsRemaining) / QUESTION_SECONDS)
  );
}

/**
 * The question ends: the right answer goes up on the TV and the scores catch
 * up with it.
 *
 * Scoring happens here rather than when an answer is taken, because a score
 * that moved the moment a phone was tapped would tell the room what the right
 * answer was before the reveal did.
 */
function revealed(state: TriviaState): TriviaState {
  const question = state.questions[state.questionIndex];

  // A game only runs out of questions by finishing, so this is the type
  // system's question and not the game's.
  if (question === undefined) {
    return state;
  }

  const scored = state.standings.map((standing) => ({
    playerId: standing.playerId,
    score:
      standing.score +
      (state.answers[standing.playerId] === question.correctIndex
        ? // A player who never answered is in neither map, so they are never
          // here: no answer scores what a wrong one scores, in both modes.
          scoreForCorrectAnswer(state, state.answerSeconds?.[standing.playerId] ?? 0)
        : 0),
  }));

  return { ...state, phase: 'reveal', standings: inScoreOrder(scored) };
}

/** A player locks in an option: their first one, on the question they were shown. */
function answerTaken(
  state: TriviaState,
  event: Extract<TriviaEvent, { kind: 'answer' }>,
): TriviaState {
  const question = state.questions[state.questionIndex];

  if (
    // Nothing to answer: the reveal is up, or the game is over.
    state.phase !== 'question' ||
    question === undefined ||
    // A stale tap, aimed at a question the room has moved on from.
    event.questionIndex !== state.questionIndex ||
    !isPlaying(state, event.playerId) ||
    // Locked in already: a second tap changes nothing, which is the rule the
    // phone's answer screen draws as disabled buttons.
    Object.hasOwn(state.answers, event.playerId) ||
    !Number.isInteger(event.optionIndex) ||
    event.optionIndex < 0 ||
    event.optionIndex >= question.options.length
  ) {
    return state;
  }

  const answers = { ...state.answers, [event.playerId]: event.optionIndex };
  // Timed now and priced at the reveal, because a score that moved the moment a
  // phone was tapped would tell the room what the right answer was.
  const answerSeconds = {
    ...state.answerSeconds,
    [event.playerId]: secondsLeftOn(event.msRemaining),
  };
  const answered = { ...state, answers, answerSeconds };
  // The chip's own two numbers, read off the state this answer just made: the
  // question ends the moment they are equal, which is what makes "the reveal
  // happens when the television reads n/n" one rule rather than two.
  const counted = playersCounted(answered, event.awayPlayerIds);

  // The last player the room is still hearing from ends the question: there is
  // nobody left to wait for, so the room is not made to sit through a countdown
  // it is done with. A phone that comes back is not shut out — answering is
  // judged above, where being away is never asked about — and it counts itself
  // back in by answering, since an answer already given is always counted.
  //
  // A room where nobody is counted is the exception, and it is what the zero
  // guards: everybody away with nothing answered makes "every counted player
  // has answered" true of nobody, and a question would reveal itself the
  // instant it went up. That room is left to its Question Timer, which is the
  // one clock nobody has to be awake for.
  return counted > 0 && answersIn(answered) === counted ? revealed(answered) : answered;
}

/** The room moves on from the beat this event named. */
function advanced(
  state: TriviaState,
  event: Extract<TriviaEvent, { kind: 'advance' }>,
): TriviaState {
  // The hub names every event sent by a phone. An advance with that identity is
  // therefore not the internal deadline event and cannot move the room's beat.
  if (event.playerId !== undefined) {
    return state;
  }

  // Already moved on: this is a second "next" for a beat the room has left, and
  // acting on it would end the beat that replaced it — revealing a question
  // nobody has been given the chance to answer.
  if (event.questionIndex !== state.questionIndex || event.phase !== state.phase) {
    return state;
  }

  switch (state.phase) {
    // Done waiting: whoever has not answered scores what a wrong answer
    // scores, which is nothing.
    case 'question':
      return revealed(state);

    case 'reveal': {
      const nextIndex = state.questionIndex + 1;

      // The last reveal ends the game, and the standings are already in the
      // order the Victory Screen reads them in.
      return nextIndex < state.questions.length
        ? { ...state, phase: 'question', questionIndex: nextIndex, answers: {}, answerSeconds: {} }
        : { ...state, phase: 'finished' };
    }

    // A finished game has no next beat. The room leaves it through the Host's
    // "Back to lobby", which is the hub's `endGame` and not trivia's business.
    case 'finished':
      return state;
  }
}

/**
 * The option index that stands in for a hidden answer in the broadcast state.
 *
 * While a question is up, an answerer's *key* stays in `answers` so the room's
 * "n answered" count holds (`answersIn` counts keys), but the option they picked
 * is theirs until the Reveal. Outside the real `0..options.length` range, and
 * read by nothing — a phone draws only its own answer, and the reveal scores off
 * the stored, unredacted state — so it is shown to no one.
 */
export const HIDDEN_ANSWER = -1;

/**
 * The `correctIndex` that stands in for a question's answer while it is still
 * being asked.
 *
 * Outside the real `0..options.length` range like `HIDDEN_ANSWER`, and for the
 * same reason: nothing can mark an option correct by matching it, so the failure
 * direction is "no option is right" rather than "the wrong one is".
 *
 * A *different* number from `HIDDEN_ANSWER`, which costs nothing and closes one
 * whole class of mistake. A verdict is `answers[playerId] === correctIndex`
 * (`verdictsOf`), and today that is only ever reached at the reveal, where both
 * sides are real. Were the two sentinels equal, a screen that ever computed a
 * verdict on question-phase state would find every hidden answer matching every
 * hidden answer key and draw the whole room as correct — the exact direction the
 * paragraph above says this chose against.
 */
export const HIDDEN_CORRECT_INDEX = -2;

/**
 * A question the room has not been asked yet, as the broadcast carries it.
 *
 * The whole game is dealt into the state at `startGame` (`questionsFor`), so
 * every question's text and options are sitting in the room's row from the first
 * beat. Kept in the list rather than dropped so the count the television draws —
 * "Question 3 of 10" — is still the game's own length, and so every index still
 * means what it meant.
 */
const WITHHELD_QUESTION: TriviaQuestion = {
  text: '',
  options: ['', '', '', ''],
  correctIndex: HIDDEN_CORRECT_INDEX,
};

/**
 * The dealt questions as the room may see them: the one being asked, the ones
 * already played, and nothing at all of the ones still to come.
 *
 * The rule is the same on every beat, which is the point. A game is dealt whole
 * at `startGame`, so "what has this room been asked so far" is the only honest
 * thing to send it — and the beat that made that obvious was the reveal. Five
 * seconds of it stand between every pair of questions, so a projection that
 * relaxed there would hand the rest of the game to anybody willing to wait for
 * question one to end, which is everybody.
 *
 * What the beat *does* decide is the answer to the question on screen: hidden
 * while it is being asked, and its own once the room has been shown it. Past
 * questions keep theirs for the same reason — the room has seen them, and a list
 * where only some entries carry an answer is a list that says which one is live.
 */
function questionsAsAsked(state: TriviaState): readonly TriviaQuestion[] {
  const answersAreOut = state.phase !== 'question';

  return state.questions.map((question, index) => {
    if (index > state.questionIndex) {
      return WITHHELD_QUESTION;
    }

    return answersAreOut ? question : { ...question, correctIndex: HIDDEN_CORRECT_INDEX };
  });
}

/**
 * Trivia's state as one viewer is entitled to see it, for the broadcast the hub
 * sends the room (`GameLogic.redactStateFor`).
 *
 * A question being asked has two things in it nobody may read yet, and they are
 * different in kind. One is *private to a player*: which option each phone
 * locked in. The other is simply *not yet earned*: which option is right, and
 * what the rest of the game is going to ask. Both sit in the same row, because
 * the state a room stores is the game whole and the rules need all of it.
 *
 * The two are held back on different beats, and that difference is the whole of
 * what this function decides:
 *
 * - **The rest of the game is withheld always** (`questionsAsAsked`). Questions
 *   the room has not reached carry only their place, on every beat, because the
 *   beat a client would wait for is the reveal — five seconds of it between
 *   every pair of questions — and a projection that relaxed there would hand
 *   over the remaining answers to anybody willing to sit through question one.
 *   The answer to the question on screen is hidden while it is being asked and
 *   its own once the room has been shown it.
 * - **A live answer is withheld only while it is live.** Every answerer's key is
 *   kept — the "n answered" count is those keys and must not move — but the
 *   option reads `HIDDEN_ANSWER` for everyone except the viewer, whose own
 *   choice their phone still draws. At the reveal the options are the whole of
 *   what the screen shows, so nothing is held back. `answerSeconds` goes with
 *   them: only the reveal prices it, off the stored state.
 *
 * The first is not player-privacy but game integrity, and `questions.ts` states
 * the rule it follows: a field the rules never read is a field with no business
 * travelling. No screen reads an unplayed question at all — both clients read
 * `questions[questionIndex]` and the list's length, and nothing else.
 *
 * This closes the wire; 5.9 closed the build. The projection is what stops a
 * passive read — the socket, a proxy, an honest client showing more than it
 * should — by keeping unplayed questions off the broadcast. Keeping the pack out
 * of the client bundle entirely, so a *modified* client cannot hold the
 * deterministic deal and work it out locally, is 5.9's doing (the client-safe
 * `GameModule`, `./state`, and `./content/categories`). The two are
 * complementary: even with the pack gone from the client, this projection is
 * still the only thing between one player's in-flight answer and the rest of the
 * room.
 *
 * Because this copy is never reduced, everything hidden here is still scored in
 * full when the reveal runs on the state the room actually stored (see
 * `games.running`).
 */
export function redactTriviaStateFor(
  state: TriviaState,
  viewer: GamePlayerId | undefined,
): TriviaState {
  const questions = questionsAsAsked(state);

  // The answers are the room's to show the moment the question is over, so this
  // half is the one beat that does relax.
  if (state.phase !== 'question') {
    return { ...state, questions };
  }

  // `?? {}` because this runs on the read path now: a state without the field —
  // a room dealt by a deployment older than it, or a shape nothing has written
  // yet — would otherwise throw here and take `running` down for every client in
  // the room, the television included.
  const answers = Object.fromEntries(
    Object.entries(state.answers ?? {}).map(([playerId, optionIndex]) => [
      playerId,
      playerId === viewer ? optionIndex : HIDDEN_ANSWER,
    ]),
  );

  return { ...state, questions, answers, answerSeconds: undefined };
}

/**
 * Trivia's rules: what a question is worth, when a question ends, and what a
 * reveal does to the scoreboard.
 *
 * Its metadata is declared in `./metadata`, its settings in `./settings`, and
 * its questions drawn from the Curated Pack in `./questions` — the last of which
 * is why this half is the server's alone (`@huddle/game-trivia/logic`): the pack
 * carries every answer, and `createInitialState` deals from it. The metadata is
 * the shared object the client module points at too, so the card and the game
 * name one thing.
 *
 * `Settings` is `GameSettings` — the hub's strings — rather than trivia's own
 * three, because that is what the hub actually hands a module: it settles the
 * Host's choices against this schema and passes the result back untouched, and
 * `triviaSettings` is where they stop being strings.
 */
export const triviaGameLogic: GameLogic<TriviaState, TriviaEvent, GameSettings> = {
  stateVersion: 1,
  decodeState: (value) => triviaStateSchema.parse(value) as TriviaState,
  decodeEvent: (value) => triviaEventSchema.parse(value) as TriviaEvent,
  metadata: triviaMetadata,
  settingsSchema: TRIVIA_SETTINGS_SCHEMA,
  settingsPresentation: TRIVIA_SETTINGS_PRESENTATION,
  createInitialState: ({ players, settings }) => {
    const chosen = triviaSettings(settings);

    return {
      // The whole game is dealt here and never again: the questions ride in the
      // state, so a room is asked what it was dealt at the moment it started,
      // whatever the pack does afterwards.
      questions: questionsFor(chosen.category, chosen.questionCount, chosen.difficulty ?? 'mixed'),
      questionIndex: 0,
      questionSeconds: chosen.questionSeconds ?? 20,
      phase: 'question',
      answers: {},
      answerSeconds: {},
      // Roster order, since nobody has scored yet and the sort is stable.
      standings: players.map((player) => ({ playerId: player.playerId, score: 0 })),
      // The one setting the rules carry: the reveal is where it is read, and
      // the reveal is handed nothing but the state.
      scoring: chosen.scoring,
    };
  },
  reduce: (state, event) => {
    switch (event.kind) {
      case 'answer':
        return answerTaken(state, event);

      case 'advance':
        return advanced(state, event);
    }
  },
  // The room's own clock, which the hub schedules and no phone has to be awake
  // for. `questionTimer` is where what it does is decided and tested.
  deadline: (state) => questionTimer(state) ?? revealTimer(state),
  // A live answer is its player's until the Reveal: the hub broadcasts the state
  // each client is entitled to, and this is trivia's projection of it.
  redactStateFor: redactTriviaStateFor,
  isFinished: (state) => state.phase === 'finished',
};

/**
 * The Question Timer: the twenty seconds a question runs, and the `advance`
 * that ends it when they are up.
 *
 * This is trivia's Game Deadline: the hub schedules it server-side, just like
 * the Reveal Timer. Whoever has not answered when it fires scores
 * what a wrong answer scores, which is nothing — `revealed` does not ask how a
 * question ended, only what was answered before it did.
 *
 * The two ways a question can end therefore race, which is what the room wants
 * of them: the last player answering reveals it early, and this fires
 * afterwards onto a beat that no longer matches and does nothing. Nobody has to
 * cancel anything for that to hold — the address is what makes it safe, as it
 * is for every other `advance`.
 *
 * No player is named. Nobody sent it, and an absent `playerId` is exactly how
 * `GameEvent` says so.
 */
export function questionTimer(state: TriviaState): GameDeadline<TriviaAdvance> | undefined {
  if (state.phase !== 'question') {
    return undefined;
  }

  return {
    beat: beatOf(state),
    afterMs: (state.questionSeconds ?? QUESTION_SECONDS) * 1000,
    event: {
      kind: 'advance',
      questionIndex: state.questionIndex,
      phase: 'question',
    },
  };
}

/** The server-owned clock that ends a reveal and opens the next question. */
export function revealTimer(state: TriviaState): GameDeadline<TriviaAdvance> | undefined {
  if (state.phase !== 'reveal') {
    return undefined;
  }

  return {
    beat: beatOf(state),
    afterMs: REVEAL_SECONDS * 1000,
    event: {
      kind: 'advance',
      questionIndex: state.questionIndex,
      phase: 'reveal',
    },
  };
}
