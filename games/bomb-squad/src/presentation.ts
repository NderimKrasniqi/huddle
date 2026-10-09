import { bomb } from './theme';
import { ACCUSE_SECONDS, BRIEF_SECONDS, CUT_SECONDS, HOW_TO_SECONDS, REVEAL_SECONDS } from './logic';
import type { BombState, Clue, Wire } from './types';

export const WIRE_COLOR: Readonly<Record<Wire, string>> = {
  red: bomb.wireRed,
  blue: bomb.wireBlue,
  yellow: bomb.wireYellow,
  green: bomb.wireGreen,
};

export function wireName(wire: Wire): string {
  return wire.charAt(0).toUpperCase() + wire.slice(1);
}

/** A clue in words, as the phone shows it and a player would say it aloud. */
export function clueText(clue: Clue): string {
  switch (clue.kind) {
    case 'not':
      return `It's not ${clue.wire}.`;
    case 'tone':
      return clue.tone === 'warm' ? "It's a warm colour (red or yellow)." : "It's a cool colour (blue or green).";
    case 'side':
      return clue.side === 'left' ? "It's on the left half." : "It's on the right half.";
    case 'nextTo':
      return `It's right next to ${clue.wire}.`;
  }
}

/** Fallback seconds for each beat, before the room's clock arrives. */
export function phaseSeconds(state: BombState): number {
  switch (state.phase) {
    case 'howTo':
      return HOW_TO_SECONDS;
    case 'brief':
      return BRIEF_SECONDS;
    case 'debate':
      return state.debateSeconds;
    case 'cut':
      return CUT_SECONDS;
    case 'accuse':
      return ACCUSE_SECONDS;
    default:
      return REVEAL_SECONDS;
  }
}
