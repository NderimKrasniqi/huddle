export type PhoneLoadingPhase = 'startup' | 'restoring';

export type PhoneLoadingPresentation = {
  readonly purpose: 'Starting Huddle' | 'Restoring your room';
};

export function phoneLoadingPresentation(phase: PhoneLoadingPhase): PhoneLoadingPresentation {
  return { purpose: phase === 'startup' ? 'Starting Huddle' : 'Restoring your room' };
}
