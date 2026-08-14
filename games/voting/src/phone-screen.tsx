import type { PhoneGameScreenProps } from '@huddle/domain';
import { PurposeScreen } from '@huddle/ui/native';

import type { VotingEvent, VotingState } from './types';

export function VotingPhoneScreen(_props: PhoneGameScreenProps<VotingState, VotingEvent>) {
  return <PurposeScreen platform="phone" purpose="Voting game" />;
}
