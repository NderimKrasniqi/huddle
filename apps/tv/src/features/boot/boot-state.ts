export type TvBootPhase = 'startup' | 'opening' | 'reconnecting' | 'misconfigured' | 'deviceFailure';

export type TvAnimatedBootPhase = Extract<
  TvBootPhase,
  'startup' | 'opening' | 'reconnecting'
>;

export type TvBootAnimationCopy = {
  readonly title: string;
  readonly subtitle: string;
};

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

/** Copy used by the app-owned animated renderer while a room is unresolved. */
export function tvBootAnimationCopy(
  phase: TvAnimatedBootPhase,
): TvBootAnimationCopy {
  switch (phase) {
    case 'startup':
      return {
        title: 'Starting Huddle…',
        subtitle: 'Getting things ready',
      };
    case 'opening':
      return {
        title: 'Creating your room…',
        subtitle: 'Setting things up',
      };
    case 'reconnecting':
      return {
        title: 'Reconnecting to room…',
        subtitle: 'Getting everyone back',
      };
  }
}
