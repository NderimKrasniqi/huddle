import type { GameDeadline, GameLogic, GamePlayerId, GameSettings } from '@huddle/game-core';
import { z } from 'zod';

import { votingMetadata } from './metadata';
import { CURATED_PROMPTS, type VotingPrompt } from './prompts';
import { votingSettings, VOTING_SETTINGS_SCHEMA } from './settings';
import { playersCounted, votesIn, REVEAL_SECONDS, VOTE_SECONDS } from './state';

/**
 * The Voting game's rules, with no screens attached.
 *
 * This is the half that runs inside a Convex mutation, which is why it is its
 * own package entry point (`@huddle/game-voting/logic`): the server seeds a
 * game's state and reduces its events and must not carry the React Native that
 * draws it. `./voting` is where the screens are put back on top for the two
 * clients. It is the same seam trivia draws (`@huddle/game-trivia/logic`).
 *
 * The whole reason this game exists is to prove the platform is genuinely
 * game-independent, so it shares nothing with trivia but the interface: no
 * scoring, no right answers, no Question Pack, a different player range, and a
 * loop the room's own clock drives from end to end.
 */

/** How long a prompt stays open for votes before the room stops waiting. */
/**
 * Where a game of Voting is: a prompt taking votes, its tally on screen, or
 * over.
 *
 * The three beats of the loop the TV draws — the prompt with its options, the
 * reveal with the counts, and the closing screen once the last prompt is done.
 */
export type VotingPhase = 'voting' | 'reveal' | 'finished';

/**
 * A game of Voting in progress.
 *
 * The privacy the game promises — "each participant's vote stays private until
 * reveal" — is a property of *what this state holds*, not only of what the
 * screens draw. The state never records who voted for what. It keeps two things
 * instead:
 *
 * - `voters`: the players who have voted the current prompt, so a second tap is
 *   refused and the "3/5 voted" numerator can be counted. It says *that* a
 *   player voted, never *what* they voted.
 * - `tally`: an anonymous running count per option. It says *how many* chose
 *   each option, never *who*.
 *
 * No arrangement of the two can name a voter's choice, so — unlike a map of
 * player to option — a vote's owner is not in the payload the hub ships to every
 * client. Voting still declares the required identity projection explicitly:
 * its implementation returns the state unchanged because there is no private
 * field to redact. That the *tally* is visible before the reveal
 * is the price of never storing attribution: a game cannot reveal a count it did
 * not keep, and keeping it anonymously is what lets the reveal show the room its
 * own opinion without ever exposing a person's. The screens hold the count back
 * until the reveal on top of that; the state is what makes the stronger promise.
 *
 * `prompts` is the whole game, dealt once at the start and carried here, so a
 * room is asked what it was dealt however the prompt list changes afterwards.
 * `players` is who is playing — fixed at the start like trivia's standings, so a
 * phone that joins mid-game is in the room but not in this list, and watches.
 */
export type VotingState = {
  readonly prompts: readonly VotingPrompt[];
  /** Which prompt is up; the last one once the game is finished. */
  readonly promptIndex: number;
  readonly phase: VotingPhase;
  /** Who has voted the current prompt — cleared when the room moves on. Never what they voted. */
  readonly voters: readonly GamePlayerId[];
  /** The current prompt's anonymous counts, one per option — cleared with `voters`. */
  readonly tally: readonly number[];
  /** Who is playing, fixed at the start. A later joiner is in the room but not here. */
  readonly players: readonly GamePlayerId[];
};

/**
 * What a player does in a game of Voting, and what moves the room on.
 *
 * `vote` names the prompt it was aimed at, because a phone's tap and the room's
 * beat race: a tap that leaves while prompt one is up must vote on prompt one or
 * nothing, never whatever is on screen when it lands. It carries no timing —
 * this game pays nothing for speed — and `awayPlayerIds` is the hub's, written
 * over whatever arrived, because presence is the room's and a phone writing
 * somebody out of a prompt is a claim (see `GameEvent`).
 *
 * `advance` is the room finishing a beat: a prompt the room stops waiting on, or
 * a reveal ending. Its `playerId` is optional because nobody sends it — both of
 * this game's beats end on the room's own clock (`voteTimer`, `revealTimer`), so
 * the field is always absent, which `GameEvent` says is the room itself.
 *
 * It names both the prompt it is ending and the beat of it, so an `advance` that
 * arrives a beat late lands on nothing: it is addressed to the beat it was armed
 * for, and the reducer returns the state untouched for any other.
 */
export type VotingEvent =
  | {
      readonly kind: 'vote';
      readonly playerId: GamePlayerId;
      readonly promptIndex: number;
      readonly optionIndex: number;
      /** Who the room had stopped hearing from — the hub's, like trivia's. Absent means nobody. */
      readonly awayPlayerIds?: readonly GamePlayerId[];
    }
  | {
      readonly kind: 'advance';
      /** Absent: the room's own clock raises both of this game's advances. */
      readonly playerId?: GamePlayerId;
      readonly promptIndex: number;
      /** The beat being ended: the prompt on screen, or its reveal. */
      readonly phase: VotingPhase;
      /** Hub-enriched clock/presence fields; ignored by the reducer. */
      readonly msRemaining?: number;
      readonly awayPlayerIds?: readonly GamePlayerId[];
    };

/**
 * The `advance` a clock sends. Both of the game's produce exactly this — a
 * `GameDeadline<VotingEvent>` would let a clock start returning a vote, which is
 * not a thing a clock can send.
 */
type VotingAdvance = Extract<VotingEvent, { kind: 'advance' }>;

const playerIdSchema = z.string().min(1);
const votingPromptSchema = z.strictObject({
  text: z.string(),
  options: z.array(z.string()).min(2).max(4),
});

/** Strict server-side decoder for persisted Voting state. */
export const votingStateSchema = z.strictObject({
  prompts: z.array(votingPromptSchema).min(1),
  promptIndex: z.number().int().nonnegative(),
  phase: z.enum(['voting', 'reveal', 'finished']),
  voters: z.array(playerIdSchema),
  tally: z.array(z.number().int().nonnegative()),
  players: z.array(playerIdSchema),
});

const votingVoteEventSchema = z.strictObject({
  kind: z.literal('vote'),
  playerId: playerIdSchema,
  promptIndex: z.number().int().nonnegative(),
  optionIndex: z.number().int().min(0).max(3),
  msRemaining: z.number().finite().nonnegative().optional(),
  awayPlayerIds: z.array(playerIdSchema).optional(),
});

const votingAdvanceEventSchema = z.strictObject({
  kind: z.literal('advance'),
  playerId: playerIdSchema.optional(),
  promptIndex: z.number().int().nonnegative(),
  phase: z.enum(['voting', 'reveal', 'finished']),
  msRemaining: z.number().finite().nonnegative().optional(),
  awayPlayerIds: z.array(playerIdSchema).optional(),
});

/** Strict server-side decoder for untrusted Voting events. */
export const votingEventSchema = z.union([votingVoteEventSchema, votingAdvanceEventSchema]);

/**
 * The beat a state is on, named: which prompt, and which half of it.
 *
 * What a clock is set for. Both of the game's clocks key off this one function,
 * so "the same beat" means one thing however it is being timed, and the hub can
 * tell whether a state it just wrote started a new one (`GameDeadline`).
 */
function beatOf(state: VotingState): string {
  return `${state.promptIndex}:${state.phase}`;
}

/** A fresh, all-zero tally for a prompt with this many options. */
function emptyTally(optionCount: number): number[] {
  return Array.from({ length: optionCount }, () => 0);
}

/** Whether this player is in the game, rather than merely in the room. */
function isPlaying(state: VotingState, playerId: GamePlayerId): boolean {
  return state.players.includes(playerId);
}

/**
 * How many players the current prompt is counted against — the "3/5 voted"
 * denominator: everyone the room is still hearing from, plus anyone already in.
 *
 * Away is subtracted because a room cannot wait for a phone it has stopped
 * hearing from (a game never waits for an away player), and a
 * vote already cast is added back because it is already cast: a count that
 * dropped a player the moment their phone went quiet would be the television
 * losing a vote the room has. The exact rule trivia counts its answers by.
 *
 * Who is Away is the room's and arrives with the event (`VotingEvent`), so a
 * room that said nothing is a room with nobody away.
 */
export { playersCounted, votesIn, REVEAL_SECONDS, VOTE_SECONDS } from './state';

/** The prompt ends: the tally is what it is, and the room moves to showing it. */
function revealed(state: VotingState): VotingState {
  // Nothing to compute — the tally was kept as the votes came in, precisely so
  // that no map of who-voted-what had to be kept to produce it here.
  return { ...state, phase: 'reveal' };
}

/** A player casts a vote: their first one, on the prompt they were shown. */
function voteTaken(
  state: VotingState,
  event: Extract<VotingEvent, { kind: 'vote' }>,
): VotingState {
  const prompt = state.prompts[state.promptIndex];

  if (
    // Nothing to vote on: the tally is up, or the game is over.
    state.phase !== 'voting' ||
    prompt === undefined ||
    // A stale tap, aimed at a prompt the room has moved on from.
    event.promptIndex !== state.promptIndex ||
    !isPlaying(state, event.playerId) ||
    // Voted already: a second tap changes nothing, which is the rule the phone's
    // vote screen draws as a cast ballot rather than open buttons.
    state.voters.includes(event.playerId) ||
    !Number.isInteger(event.optionIndex) ||
    event.optionIndex < 0 ||
    event.optionIndex >= prompt.options.length
  ) {
    return state;
  }

  const voters = [...state.voters, event.playerId];
  // The one write that records the vote, and it records it anonymously: the
  // count at the chosen option goes up, and nothing anywhere says whose it was.
  const tally = state.tally.map((count, optionIndex) =>
    optionIndex === event.optionIndex ? count + 1 : count,
  );
  const voted = { ...state, voters, tally };
  const counted = playersCounted(voted, event.awayPlayerIds);

  // The last player the room is still hearing from ends the prompt: there is
  // nobody left to wait for. A room where nobody is counted — everyone away with
  // nothing cast — is left to its Vote Timer, the one clock nobody has to be
  // awake for, exactly as trivia leaves such a room to its Question Timer.
  return counted > 0 && votesIn(voted) === counted ? revealed(voted) : voted;
}

/** The room moves on from the beat this event named. */
function advanced(
  state: VotingState,
  event: Extract<VotingEvent, { kind: 'advance' }>,
): VotingState {
  // Already moved on: this is a second advance for a beat the room has left, and
  // acting on it would end the beat that replaced it.
  if (event.promptIndex !== state.promptIndex || event.phase !== state.phase) {
    return state;
  }

  switch (state.phase) {
    // Done waiting: whoever has not voted simply is not counted in the tally.
    case 'voting':
      return revealed(state);

    case 'reveal': {
      const nextIndex = state.promptIndex + 1;
      const nextPrompt = state.prompts[nextIndex];

      // The last reveal ends the game. Otherwise the next prompt opens with a
      // fresh, empty tally and nobody yet counted against it.
      return nextPrompt === undefined
        ? { ...state, phase: 'finished' }
        : {
            ...state,
            phase: 'voting',
            promptIndex: nextIndex,
            voters: [],
            tally: emptyTally(nextPrompt.options.length),
          };
    }

    // A finished game has no next beat. The room leaves it through the Host's
    // "Back to lobby", which is the hub's `endGame` and not this game's business.
    case 'finished':
      return state;
  }
}

/**
 * The Voting game's rules.
 *
 * Its metadata is declared in `./metadata` (the shared object the client module
 * points at too) and its settings in `./settings`; what is left here is the
 * game. `Settings` is `GameSettings` — the hub's strings — rather than the
 * game's own, because that is what the hub hands a module: it settles the Host's
 * choices against this schema and passes the result back untouched, and
 * `votingSettings` is where they stop being strings.
 */
export const votingGameLogic: GameLogic<VotingState, VotingEvent, GameSettings> = {
  stateVersion: 1,
  decodeState: (value) => votingStateSchema.parse(value) as VotingState,
  decodeEvent: (value) => votingEventSchema.parse(value) as VotingEvent,
  metadata: votingMetadata,
  settingsSchema: VOTING_SETTINGS_SCHEMA,
  createInitialState: ({ players, settings }) => {
    const chosen = votingSettings(settings);
    // The whole game is dealt here and never again: the prompts ride in the
    // state, so a room is asked what it was dealt whatever the prompt list does
    // afterwards. Capped by the schema, so the slice always fills.
    const prompts = CURATED_PROMPTS.slice(0, chosen.rounds);

    return {
      prompts,
      promptIndex: 0,
      phase: 'voting',
      voters: [],
      // A prompt always exists — `rounds` is at least three — so this reads a
      // real option count and never an empty deal.
      tally: emptyTally(prompts[0]?.options.length ?? 0),
      players: players.map((player) => player.playerId),
    };
  },
  reduce: (state, event) => {
    switch (event.kind) {
      case 'vote':
        return voteTaken(state, event);

      case 'advance':
        return advanced(state, event);
    }
  },
  // The room's own clock drives both beats — this game needs no phone to be
  // awake to move on. `voteTimer` and `revealTimer` are where each is decided.
  deadline: (state) => voteTimer(state) ?? revealTimer(state),
  // Voting stores no player-to-option attribution, so every viewer receives
  // the same state. The required projection seam still makes that guarantee
  // explicit to the runtime.
  redactStateFor: (state) => state,
};

/**
 * The Vote Timer: the seconds a prompt takes votes, and the `advance` that ends
 * it when they are up.
 *
 * The room's clock, scheduled server-side (`convex/convex/games.ts`), which is
 * what makes it the beat that ends for a room whose every phone is face-down on
 * a table. Whoever has not voted when it fires simply is not in the tally.
 *
 * No player is named: nobody sent it, and an absent `playerId` is how
 * `GameEvent` says the room raised it.
 */
export function voteTimer(state: VotingState): GameDeadline<VotingAdvance> | undefined {
  if (state.phase !== 'voting') {
    return undefined;
  }

  return {
    beat: beatOf(state),
    afterMs: VOTE_SECONDS * 1000,
    event: { kind: 'advance', promptIndex: state.promptIndex, phase: 'voting' },
  };
}

/**
 * The Reveal Timer: the seconds the tally stays up, and the `advance` that moves
 * the room to the next prompt.
 *
 * Also the room's clock rather than the phones' — unlike trivia, whose reveal
 * the Controllers time. This game is deliberately simpler: both of its beats end
 * on the server, so a room progresses through a whole game of it with no phone
 * doing anything but voting. The last reveal's advance lands on the finished
 * state and stops, since `advanced` gives a finished game no next beat.
 */
export function revealTimer(state: VotingState): GameDeadline<VotingAdvance> | undefined {
  if (state.phase !== 'reveal') {
    return undefined;
  }

  return {
    beat: beatOf(state),
    afterMs: REVEAL_SECONDS * 1000,
    event: { kind: 'advance', promptIndex: state.promptIndex, phase: 'reveal' },
  };
}
