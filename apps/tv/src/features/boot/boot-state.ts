export type TvBootPhase = 'startup' | 'opening' | 'reconnecting';

export type TvAnimatedBootPhase = TvBootPhase;

export type TvBootAnimationCopy = {
  readonly title: string;
  readonly subtitle: string;
};

export type TvBootPresentation = {
  readonly purpose:
    | 'Starting Huddle'
    | 'Creating a room'
    | 'Reconnecting to room';
};

export function tvBootPresentation(phase: TvBootPhase): TvBootPresentation {
  switch (phase) {
    case 'startup':
      return { purpose: 'Starting Huddle' };
    case 'opening':
      return { purpose: 'Creating a room' };
    case 'reconnecting':
      return { purpose: 'Reconnecting to room' };
  }
}

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
