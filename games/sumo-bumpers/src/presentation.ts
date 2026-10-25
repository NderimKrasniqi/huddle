import type { GamePlayer } from '@huddle/domain';

import { HOW_TO_SECONDS, MATCH_OVER_SECONDS, REPLAY_SECONDS } from './logic';
import type { Knockout, SumoState } from './types';

export function phaseSeconds(state: SumoState): number {
  switch (state.phase) {
    case 'howTo':
      return HOW_TO_SECONDS;
    case 'aim':
      return state.aimSeconds;
    case 'replay':
      return REPLAY_SECONDS;
    case 'matchOver':
      return MATCH_OVER_SECONDS;
    default:
      return 0;
  }
}

export function beatKey(state: SumoState): string {
  return `${state.match}:${state.round}:${state.phase}`;
}

export function knockoutLine(knockout: Knockout, players: readonly GamePlayer[]): string {
  const name = (id: string | undefined) => players.find((player) => player.playerId === id)?.nickname ?? 'Someone';
  if (knockout.by === undefined || knockout.by === knockout.out) return `${name(knockout.out)} slid into the sea!`;
  if (knockout.byGhost) return `Ghost ${name(knockout.by)} sank ${name(knockout.out)}!`;
  return `${name(knockout.by)} bumped ${name(knockout.out)} into the sea!`;
}

export const HOW_TO_STEPS = [
  { title: 'Aim', line: 'Pull back on your phone. The dotted line shows where you stop.' },
  { title: 'Launch', line: 'Everyone flies at once. Bump others off the ice.' },
  { title: 'Survive', line: 'The ice shrinks every round. Last one standing wins.' },
  { title: 'Haunt', line: 'Knocked out? Fire ghost pucks from the edge.' },
] as const;
