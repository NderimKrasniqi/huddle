export type TvBootPhase = 'startup' | 'opening' | 'reconnecting' | 'misconfigured' | 'deviceFailure';

export type TvBootPresentation = {
  readonly purpose:
    | 'Starting Huddle'
    | 'Creating a room'
    | 'Reconnecting to room'
    | 'TV setup required'
    | 'TV unavailable';
};

export function tvBootPresentation(phase: TvBootPhase): TvBootPresentation {
  switch (phase) {
    case 'startup':
      return { purpose: 'Starting Huddle' };
    case 'opening':
      return { purpose: 'Creating a room' };
    case 'reconnecting':
      return { purpose: 'Reconnecting to room' };
    case 'misconfigured':
      return { purpose: 'TV setup required' };
    case 'deviceFailure':
      return { purpose: 'TV unavailable' };
  }
}
