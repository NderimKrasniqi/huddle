import type { GamePlayerId } from '@huddle/domain';

import type { PlayableTriviaState, TriviaState } from './types';
import { playableState } from './state';

/**
 * The Answer Screen as data: what one phone is looking at, given the state the
 * whole room is looking at.
 *
 * It is a function of the room's state and nothing else — the phone remembers
 * no tap of its own. A tap goes to the reducer and comes back as an answer in
 * the state: one truth about who answered what, drawn wherever it is needed. The screen's
 * whole job is to offer exactly the taps the rules would accept, so that the
 * refusals in `logic.ts` are a floor nobody is standing on.
 *
 * `./phone-screen.tsx` is this drawn; the split is the repo's, which tests
 * logic and not renderers (docs/tech-stack.md).
 */

/** What one of the four buttons is doing. */
export type AnswerOptionState =
  /** Pressable: this player has not answered yet. */
  | 'open'
  /** The option this player locked in. */
  | 'lockedIn'
  /** Not their answer, and no longer pressable. */
  | 'closed';

/** One of the question's four options, as a button. */
export type AnswerOption = {
  /** Its place in the question — what an `answer` event names. */
  readonly optionIndex: number;
  readonly text: string;
  readonly state: AnswerOptionState;
};

/** What the phone draws while a game of trivia runs. */
export type AnswerScreen =
  /** A question is up and this player is in the game that is asking it. */
  | {
      readonly kind: 'question';
      /**
       * The question these buttons answer. Carried rather than assumed,
       * because an `answer` is addressed to the question the phone was reading
       * and not to whatever is up when the tap lands (see `TriviaEvent`).
       */
      readonly questionIndex: number;
      readonly text: string;
      readonly options: readonly AnswerOption[];
      /** Whether this player's answer is in — the screen's "LOCKED IN". */
      readonly lockedIn: boolean;
    }
  /** Nothing to press: what the room is doing is happening on the television. */
  | { readonly kind: 'eyesUp'; readonly line: string };

/**
 * What a phone with nothing to press is told, which is always where to look.
 *
 * "Eyes up" is the platform's own principle: a phone that has
 * run out of things to do says so and points at the television, rather than
 * competing with it for the room's attention.
 */
const EYES_UP = {
  reveal: 'Eyes up — the answer’s on the TV.',
  finished: 'That’s the last question — final scores on the TV.',
  /** A phone that joined after the game started: seated, but not playing. */
  watching: 'You’re in from the next game — eyes up on the TV.',
} as const;

/** Whether this player is in the game, rather than merely in the room. */
function isPlaying(state: PlayableTriviaState, playerId: GamePlayerId): boolean {
  return state.standings.some((standing) => standing.playerId === playerId);
}

function optionState(chosen: number | undefined, optionIndex: number): AnswerOptionState {
  if (chosen === undefined) {
    return 'open';
  }

  return chosen === optionIndex ? 'lockedIn' : 'closed';
}

/** What the phone holding `playerId` draws for the game as it stands. */
export function answerScreen(state: TriviaState, playerId: GamePlayerId): AnswerScreen {
  const current = playableState(state);

  // Legacy launch-proof rooms remain readable, but have no playable question
  // to expose. Keep them on a safe branded eyes-up surface.
  if (current === undefined) {
    return { kind: 'eyesUp', line: 'This Trivia room needs an updated game.' };
  }

  if (current.phase === 'intro') {
    return { kind: 'eyesUp', line: 'Get ready — eyes up on the TV.' };
  }

  const question = current.questions[current.questionIndex];

  if (current.phase === 'finished') {
    return { kind: 'eyesUp', line: EYES_UP.finished };
  }

  // The reveal, and — for the same reason `revealed` guards it — a question
  // index past the end of the questions, which is the type system's question
  // and not the game's.
  if (current.phase === 'reveal' || question === undefined) {
    return { kind: 'eyesUp', line: EYES_UP.reveal };
  }

  if (!isPlaying(current, playerId)) {
    return { kind: 'eyesUp', line: EYES_UP.watching };
  }

  // `Object.hasOwn` rather than a lookup against `undefined`, as in the
  // reducer: a player id is a key of the room's making, and every object
  // answers to `toString`.
  const answered = Object.hasOwn(current.answers, playerId) ? current.answers[playerId] : undefined;
  // A Phone projection contains at most this viewer's own answer. Anything
  // absent is still open; other players' ids never cross this seam.
  const chosen = answered !== undefined && answered >= 0 ? answered : undefined;

  return {
    kind: 'question',
    questionIndex: current.questionIndex,
    text: question.text,
    options: question.options.map((text, optionIndex) => ({
      optionIndex,
      text,
      state: optionState(chosen, optionIndex),
    })),
    lockedIn: chosen !== undefined,
  };
}
