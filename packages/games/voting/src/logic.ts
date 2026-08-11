import type { GameDeadline, GameLogic, GamePlayerId, GameSettings } from '@huddle/game-core';

import { votingMetadata } from './metadata';
import { CURATED_PROMPTS } from './prompts';
import { votingSettings, VOTING_SETTINGS_PRESENTATION, VOTING_SETTINGS_SCHEMA } from './settings';
import { playersCounted, votesIn, REVEAL_SECONDS, VOTE_SECONDS } from './state';
import { votingEventSchema, votingStateSchema } from './schemas';
import type { VotingAdvance, VotingEvent, VotingState } from './types';

export { votingEventSchema, votingStateSchema } from './schemas';
export type { VotingAdvance, VotingEvent, VotingPhase, VotingState } from './types';

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
  // The hub names every event sent by a phone. Only its internal deadline omits
  // that identity, so a player cannot impersonate the clock and skip a beat.
  if (event.playerId !== undefined) {
    return state;
  }

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
  settingsPresentation: VOTING_SETTINGS_PRESENTATION,
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
  isFinished: (state) => state.phase === 'finished',
  finishedSummary: () => ({ title: 'Hot Takes complete' }),
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
