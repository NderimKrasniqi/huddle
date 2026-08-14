import type { TvGameScreenProps } from '@huddle/domain';
import { PurposeScreen } from '@huddle/ui/native';

import type { VotingState } from './types';

export function VotingTvScreen(_props: TvGameScreenProps<VotingState>) {
  return <PurposeScreen platform="tv" purpose="Voting game" />;
}
