import type { GamePlayerId } from '@huddle/game-core';

import type { VotingState } from './logic';

/**
 * The Vote Screen as data: what one phone is looking at, given the state the
 * whole room is looking at.
 *
 * A function of the room's state and nothing else — the phone remembers no tap
 * of its own. A tap goes to the reducer and comes back in the state as this
 * player's presence in `voters`, which is the same round trip trivia's answers
 * wait for. The screen's whole job is to offer exactly the taps the rules would
 * accept, so the refusals in `logic.ts` are a floor nobody stands on.
 *
 * Because the state never records *what* a player voted (see `VotingState`), a
 * phone cannot echo its own choice back — and does not try to. A cast ballot is
 * drawn as cast, not as "you picked this": the private thing is never on the
 * phone to leak, which is the whole point of holding it nowhere.
 *
 * `./controller-screen.tsx` is this drawn; the split is the repo's, which tests
 * logic and not renderers (docs/tech-stack.md).
 */

/** What one of the prompt's option buttons is doing. */
export type VoteOptionState =
  /** Pressable: this player has not voted yet. */
  | 'open'
  /** Not pressable: this player's ballot is already in. Which option they chose is not drawn, because it is not known here. */
  | 'closed';

/** One of the prompt's options, as a button. */
export type VoteOption = {
  /** Its place in the prompt — what a `vote` event names. */
  readonly optionIndex: number;
  readonly text: string;
  readonly state: VoteOptionState;
};

/** What the phone draws while a game of Voting runs. */
export type VoteScreen =
  /** A prompt is open and this player is in the game it is asking. */
  | {
      readonly kind: 'prompt';
      /**
       * The prompt these buttons vote on. Carried rather than assumed, because a
       * `vote` is addressed to the prompt the phone was reading and not to
       * whatever is up when the tap lands (see `VotingEvent`).
       */
      readonly promptIndex: number;
      readonly text: string;
      readonly options: readonly VoteOption[];
      /** Whether this player's ballot is in — the screen's "VOTE IN". */
      readonly voted: boolean;
    }
  /** Nothing to press: what the room is doing is happening on the television. */
  | { readonly kind: 'eyesUp'; readonly line: string };

/**
 * What a phone with nothing to press is told, which is always where to look.
 *
 * "Eyes up" is the platform's own principle (docs/CONTEXT.md): a phone out of
 * things to do says so and points at the television, rather than competing with
 * it for the room's attention.
 */
const EYES_UP = {
  reveal: 'Eyes up — the results are on the TV.',
  finished: 'That’s a wrap — thanks for voting.',
  /** A phone that joined after the game started: seated, but not playing. */
  watching: 'You’re in from the next game — eyes up on the TV.',
} as const;

/** What the phone holding `playerId` draws for the game as it stands. */
export function voteScreen(state: VotingState, playerId: GamePlayerId): VoteScreen {
  const prompt = state.prompts[state.promptIndex];

  if (state.phase === 'finished') {
    return { kind: 'eyesUp', line: EYES_UP.finished };
  }

  // The reveal, and — for the same reason `revealed` guards it — a prompt index
  // past the end, which is the type system's question and not the game's.
  if (state.phase === 'reveal' || prompt === undefined) {
    return { kind: 'eyesUp', line: EYES_UP.reveal };
  }

  if (!state.players.includes(playerId)) {
    return { kind: 'eyesUp', line: EYES_UP.watching };
  }

  const voted = state.voters.includes(playerId);

  return {
    kind: 'prompt',
    promptIndex: state.promptIndex,
    text: prompt.text,
    options: prompt.options.map((text, optionIndex) => ({
      optionIndex,
      text,
      // Every button closes together the moment the ballot is in: without a
      // record of the choice there is no one button to single out, and closing
      // them all is exactly the rule the reducer enforces — a second tap does
      // nothing.
      state: voted ? 'closed' : 'open',
    })),
    voted,
  };
}
