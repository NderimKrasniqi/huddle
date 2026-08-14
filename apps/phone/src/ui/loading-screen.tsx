import { PurposeScreen } from '@huddle/ui/native';

import { phoneLoadingPresentation, type PhoneLoadingPhase } from './loading-state';

/** Branded startup/session-restoring screen for the phone app. */
export function PhoneLoadingScreen({ phase }: { readonly phase: PhoneLoadingPhase }) {
  return <PurposeScreen platform="phone" purpose={phoneLoadingPresentation(phase).purpose} />;
}
