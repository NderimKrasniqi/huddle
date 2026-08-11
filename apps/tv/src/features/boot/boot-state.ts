export type TvBootPhase = 'startup' | 'opening' | 'reconnecting' | 'misconfigured';

export type TvBootPresentation = {
  readonly title: string;
  readonly message: string;
  readonly active: boolean;
};

/** Copy and activity semantics for every pre-room TV state. */
export function tvBootPresentation(phase: TvBootPhase): TvBootPresentation {
  switch (phase) {
    case 'startup':
      return {
        title: 'Starting Huddle',
        message: 'Getting the TV ready for your group.',
        active: true,
      };
    case 'opening':
      return {
        title: 'Creating your room',
        message: 'Setting up a room code and connection.',
        active: true,
      };
    case 'reconnecting':
      return {
        title: 'Reconnecting to Huddle',
        message: 'We can’t reach the room service yet. Huddle will keep trying automatically.',
        active: true,
      };
    case 'misconfigured':
      return {
        title: 'Huddle needs setup',
        message: 'Set EXPO_PUBLIC_CONVEX_URL and rebuild this TV app.',
        active: false,
      };
  }
}
