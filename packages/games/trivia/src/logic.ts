import type { GameDeadline, GameLogic, GamePlayerId, GameSettings } from '@huddle/game-core';

import { questionsFor, type TriviaQuestion } from './questions';
import { triviaSettings, TRIVIA_SETTINGS_SCHEMA, type ScoringMode } from './settings';

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

/**
 * How long a question stays up before the room stops waiting for it — the
 * plan's pinned twenty seconds, counted down on the television.
 *
 * A rule of the game like `REVEAL_SECONDS`, and the same number twice over: the
 * room's clock runs on it (`questionTimer`) and the TV's countdown draws it, so
 * a countdown that reached zero while the question was still live would be two
 * numbers that had drifted rather than one rule.
 */
export const QUESTION_SECONDS = 20;

/**
 * How long the Reveal stays up before the room moves to the next question.
 *
 * A rule of the game rather than a fact about either screen, so it is here with
 * the rest of them: the phones count it down and the television draws for that
 * long, and the two cannot be counting different numbers.
 */
export const REVEAL_SECONDS = 5;

/**
 * Where a game of trivia is: a question on screen, its Reveal, or over.
 *
 * The three beats of the loop the TV draws (docs/implementation-plan.md, Phase
 * 3): the question with its four options, the reveal with the right answer and
 * the running scoreboard, and the final standings.
 */
export type TriviaPhase = 'question' | 'reveal' | 'finished';

/** One row of the scoreboard: a player and what they have scored so far. */
export type TriviaStanding = {
  readonly playerId: GamePlayerId;
  readonly score: number;
};

/**
 * A game of trivia in progress.
 *
 * The standings are the players: everyone the game was started with has a row
 * from the first question, so this list is both the scoreboard and the answer
 * to "who is playing". It is held in scoreboard order — highest first, ties in
 * the order they already had — so the running scoreboard, the Victory Screen
 * and the finished state are one ordering decided once here, rather than the
 * same sort written again on every screen that draws it.
 *
 * `answers` is the current question's only: it is cleared when the room moves
 * to the next one, and a player missing from it is a player who has not
 * answered — which scores exactly what a wrong answer scores.
 *
 * The last two fields are optional because a game already in progress when
 * speed scoring landed carries neither, and must finish unharmed: a room dealt
 * its question by an older deployment reads as flat with nothing timed, which
 * is exactly how that room was being scored when it started.
 */
export type TriviaState = {
  readonly questions: readonly TriviaQuestion[];
  /** Which question is up; the last one played once the game is finished. */
  readonly questionIndex: number;
  readonly phase: TriviaPhase;
  /** The current question's answers: player → the option they locked in. */
  readonly answers: Readonly<Record<GamePlayerId, number>>;
  /**
   * The current question's timings: player → the seconds the Question Timer
   * still had when their answer landed. Cleared with `answers`, which it is
   * keyed exactly like.
   *
   * Beside `answers` rather than inside it, because `answers` is the map three
   * screens read — the "3/5 answered" count, a phone's Locked In buttons, the
   * Reveal's Verdict — and not one of them has any business with the timing.
   * Only `revealed` reads this, and only to price a correct answer.
   */
  readonly answerSeconds?: Readonly<Record<GamePlayerId, number>>;
  readonly standings: readonly TriviaStanding[];
  /**
   * The Scoring Mode the Host chose, kept because the reveal is where it is
   * read and the reveal is handed nothing but the state.
   */
  readonly scoring?: ScoringMode;
};

/**
 * What a player does in a game of trivia, and what moves the room on.
 *
 * `answer` names the question it was aimed at, because a phone's tap and the
 * room's beat race: a tap that leaves while question one is up must answer
 * question one or nothing at all, never whatever is on screen when it lands.
 * Its `msRemaining` is what speed scoring is paid on, and it is the hub's
 * rather than the phone's for the same reason `playerId` is: a phone naming its
 * own speed is a claim, and the hub writes the field over whatever arrived.
 *
 * `advance` is the room finishing a beat — a reveal ending, or a question the
 * room stops waiting on. Its `playerId` is optional because both kinds of
 * sender exist: a phone's timer at the end of a reveal names the phone, and the
 * Question Timer names nobody, because the room's own clock running out is not
 * something anybody did.
 *
 * It is addressed the same way, and has to be: it is the room's only "move on"
 * signal and nothing owns it, so every source of it races every other — the
 * question's countdown, a Host skipping ahead, and a "next" on any of ten
 * phones. It names both the question it is ending and the beat of it, because
 * a bare "move on" arriving a beat late lands on the next question and reveals
 * it to a room that has not read it yet, losing a whole question and the scores
 * from it. Naming both makes the second of two thumbs a beat apart do nothing.
 */
export type TriviaEvent =
  | {
      readonly kind: 'answer';
      readonly playerId: GamePlayerId;
      readonly questionIndex: number;
      readonly optionIndex: number;
      /**
       * How long the Question Timer had left when this reached the rules.
       * Absent where the room could not say — see `secondsLeftOn`.
       */
      readonly msRemaining?: number;
      /**
       * Who the room had stopped hearing from when this reached the rules — the
       * hub's, like `msRemaining`, and for the same reason: presence is the
       * room's and a reducer holds only the game.
       *
       * It is on the answer alone because ending a question early is the only
       * rule in trivia that waits for anybody. Absent means the room could not
       * say, and trivia then waits for the whole scoreboard.
       */
      readonly awayPlayerIds?: readonly GamePlayerId[];
    }
  | {
      readonly kind: 'advance';
      /** Absent when the room's own clock raised it: see `questionTimer`. */
      readonly playerId?: GamePlayerId;
      readonly questionIndex: number;
      /** The beat being ended: the question on screen, or its reveal. */
      readonly phase: TriviaPhase;
    };

/**
 * The `advance` a clock sends. Both of trivia's produce exactly this — a
 * `GameDeadline<TriviaEvent>` would let either of them start returning an
 * answer, which is not a thing a clock can send.
 */
type TriviaAdvance = Extract<TriviaEvent, { kind: 'advance' }>;

/**
 * The beat a state is on, named: which question, and which half of it.
 *
 * What a clock is set for. Both of trivia's — the room's Question Timer and the
 * phones' Reveal Beat — key off this one function, so "the same beat" means one
 * thing however it is being timed, and the hub can tell whether a state it has
 * just written started a new one (`GameDeadline`).
 */
function beatOf(state: TriviaState): string {
  return `${state.questionIndex}:${state.phase}`;
}

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
 * How many players the current question is counted against — the "3/5 answered"
 * denominator: everyone the room is still hearing from, plus anyone already in.
 *
 * Away is subtracted because a room cannot be waiting for a phone it has
 * stopped hearing from (a game never waits for an away
 * player), and an answer already given is added back because it is already
 * given: a count that dropped a player the moment their phone went quiet would
 * be the television losing an answer the room has.
 *
 * Who is Away is the room's and arrives with the event (`TriviaEvent`), so a
 * room that said nothing is a room with nobody away — the whole scoreboard, and
 * what trivia waited for before it was ever told.
 *
 * It lives with the rules rather than on the screen because it *is* the rule
 * the reveal turns on: the question ends when this many answers are in
 * (`answersIn`), so the chip reading `n/n` and the reveal happening are one
 * fact and not two that agree. The television reads it off the roster it is
 * handed (`TvGameScreenProps`) and the reducer off the away list it is handed,
 * and neither can arrive at a different number from the same room.
 */
export function playersCounted(
  state: TriviaState,
  awayPlayerIds: readonly GamePlayerId[] | undefined,
): number {
  const away = new Set(awayPlayerIds);

  return state.standings.filter(
    (standing) =>
      !away.has(standing.playerId) || Object.hasOwn(state.answers, standing.playerId),
  ).length;
}

/** How many of the current question's answers are in: the chip's numerator. */
export function answersIn(state: TriviaState): number {
  return state.standings.filter((standing) => Object.hasOwn(state.answers, standing.playerId))
    .length;
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
 * It closes the wire and not the build: `@huddle/packs` ships in the Controller
 * bundle and `questionsFor` is deterministic, so a *modified* client can still
 * work out the deal locally. What this stops is the passive read — the socket,
 * a proxy, an honest client showing more than it should. Keeping the pack out of
 * the client entirely is a larger change than a projection.
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
 * Trivia's metadata, settings schema and rules.
 *
 * Its settings are declared in `./settings` and its questions drawn from the
 * Curated Pack in `./questions`, so what is left here is the game: what a
 * question is worth, when a question ends, and what a reveal does to the
 * scoreboard.
 *
 * `Settings` is `GameSettings` — the hub's strings — rather than trivia's own
 * three, because that is what the hub actually hands a module: it settles the
 * Host's choices against this schema and passes the result back untouched, and
 * `triviaSettings` is where they stop being strings.
 */
export const triviaGameLogic: GameLogic<TriviaState, TriviaEvent, GameSettings> = {
  metadata: {
    id: 'trivia',
    title: 'Trivia',
    /**
     * Punch, because the accents are spoken for elsewhere and this one is
     * spoken for least: cobalt is the focused card's own offset shadow
     * (docs/design/design-handoff.md §6) and a block would sit on top of it,
     * tangerine is the brand's, green is presence, yellow is the chip printed
     * on the card itself. Its Bungee title sets in ink.
     */
    keyArt: { color: 'ink' },
    /** The scope's "2–10 players", the second of which is a full room. */
    playerRange: { min: 2, max: 10 },
    /**
     * Ten questions — Phase 4's default count — at a 20-second countdown and a
     * five-second reveal apiece, plus the victory screen: about five minutes.
     * The handoff's "~12 min" chip is mock filler; the chip draws whatever the
     * module declares, and this is the number the scoped settings produce.
     */
    estimatedMinutes: 5,
    /** The genre chip. Not one of a Question Pack's categories. */
    category: 'Knowledge',
  },
  settingsSchema: TRIVIA_SETTINGS_SCHEMA,
  createInitialState: ({ players, settings }) => {
    const chosen = triviaSettings(settings);

    return {
      // The whole game is dealt here and never again: the questions ride in the
      // state, so a room is asked what it was dealt at the moment it started,
      // whatever the pack does afterwards.
      questions: questionsFor(chosen.category, chosen.questionCount),
      questionIndex: 0,
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
  deadline: questionTimer,
  // A live answer is its player's until the Reveal: the hub broadcasts the state
  // each client is entitled to, and this is trivia's projection of it.
  redactStateFor: redactTriviaStateFor,
};

/**
 * The beat that ends a Reveal, addressed and timed — or nothing, on a beat that
 * ends by itself.
 *
 * This is the room's clock, and it is here rather than in the screen that runs
 * it for one reason: it is the only thing in trivia that moves the room from
 * one question to the next, and a mistake in it does not fail loudly. An
 * `advance` addressed to the wrong beat is *inert by design* — the reducer
 * returns the state untouched and the hub skips the write — so getting this
 * wrong does not throw, does not log, and does not fail a renderer test. It
 * hangs the reveal forever. Deciding it here is what lets it be asserted.
 *
 * Who sends it is the screen's business (`./controller-screen`), and the answer
 * is "every playing phone": the event is addressed to the beat it ends, so the
 * first to arrive moves the room and the rest do nothing at all.
 */
export function revealBeat(
  state: TriviaState,
  playerId: GamePlayerId,
): GameDeadline<TriviaAdvance> | undefined {
  if (state.phase !== 'reveal') {
    return undefined;
  }

  return {
    beat: beatOf(state),
    afterMs: REVEAL_SECONDS * 1000,
    event: {
      kind: 'advance',
      playerId,
      // The beat on screen now — not the one that will be up when the timer
      // fires, which is exactly what makes a late send harmless.
      questionIndex: state.questionIndex,
      phase: 'reveal',
    },
  };
}

/**
 * The Question Timer: the twenty seconds a question runs, and the `advance`
 * that ends it when they are up.
 *
 * This is trivia's Game Deadline, so unlike the Reveal Beat above it is the
 * *room's* clock and not the phones'. The hub schedules it server-side, which
 * is what makes it the one beat in trivia that ends for a room whose every
 * phone is face-down on a table. Whoever has not answered when it fires scores
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
    afterMs: QUESTION_SECONDS * 1000,
    event: {
      kind: 'advance',
      questionIndex: state.questionIndex,
      phase: 'question',
    },
  };
}
