import type { TvSurface } from './tv-surface';

export type TvPurpose =
  | 'Starting Huddle'
  | 'Creating a room'
  | 'Reconnecting to room'
  | 'TV setup required'
  | 'TV unavailable'
  | 'Room invitation'
  | 'Choose a game'
  | 'Game setup'
  | 'Game paused'
  | 'Game unavailable'
  | 'Game finished'
  | 'Trivia game'
  | 'Voting game';

export function tvGamePurpose(gameId: string): TvPurpose {
  switch (gameId) {
    case 'trivia':
      return 'Trivia game';
    case 'voting':
      return 'Voting game';
    default:
      return 'Game unavailable';
  }
}

export function tvPurposeForSurface(
  surface: TvSurface,
  runtime: 'game' | 'finished' | 'paused' | 'unavailable' | 'lobby',
  gameId?: string,
): TvPurpose {
  if (runtime === 'finished') return 'Game finished';
  if (runtime === 'paused') return 'Game paused';
  if (runtime === 'unavailable') return 'Game unavailable';
  if (runtime === 'game') return tvGamePurpose(gameId ?? '');

  switch (surface) {
    case 'setup':
      return 'Game setup';
    case 'carousel':
      return 'Choose a game';
    case 'room':
      return 'Room invitation';
    case 'game':
      return 'Game finished';
    case 'runtime-status':
      return 'Game unavailable';
  }
}
