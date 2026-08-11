export type PhoneLoadingPhase = 'startup' | 'restoring';

export type PhoneLoadingPresentation = {
  readonly title: string;
  readonly message: string;
};

/** Copy for the phone states that exist before an actionable screen is safe. */
export function phoneLoadingPresentation(phase: PhoneLoadingPhase): PhoneLoadingPresentation {
  switch (phase) {
    case 'startup':
      return {
        title: 'Starting Huddle',
        message: 'Getting your controller ready.',
      };
    case 'restoring':
      return {
        title: 'Finding your room',
        message: 'Restoring your seat and reconnecting to the party.',
      };
  }
}
