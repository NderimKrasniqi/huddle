import type { RunningGameScreen } from '@huddle/game-registry';

import type { SeatedSurface } from '../features/room';

export type PhonePurpose =
  | 'Starting Huddle'
  | 'Restoring your room'
  | 'Join a room'
  | 'Scan a room code'
  | 'Room lobby'
  | 'Waiting for the Host'
  | 'Choose a game'
  | 'Game setup'
  | 'Game paused'
  | 'Game unavailable'
  | 'Game finished'
  | 'Trivia game'
  | 'Voting game';

export function phoneGamePurpose(gameId: string): PhonePurpose {
  switch (gameId) {
    case 'trivia':
      return 'Trivia game';
    case 'voting':
      return 'Voting game';
    default:
      return 'Game unavailable';
  }
}

export function phonePurposeForSurface(
  surface: SeatedSurface,
  runtime: RunningGameScreen,
  hasSetup: boolean,
): PhonePurpose {
  if (runtime.kind === 'finished') return 'Game finished';
  if (runtime.kind === 'paused') return 'Game paused';
  if (runtime.kind === 'unavailable') return 'Game unavailable';
  if (runtime.kind === 'game') return phoneGamePurpose(runtime.module.metadata.id);

  switch (surface) {
    case 'waiting':
      return 'Waiting for the Host';
    case 'picker':
      return hasSetup ? 'Game setup' : 'Choose a game';
    case 'room':
      return 'Room lobby';
    case 'game':
      return 'Game unavailable';
    case 'finished':
      return 'Game finished';
    case 'runtime-status':
      return 'Game unavailable';
  }
}
