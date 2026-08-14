import type { TvGameScreenProps } from '@huddle/domain';
import { PurposeScreen } from '@huddle/ui/native';

import type { TriviaState } from './types';

export function TriviaTvScreen(_props: TvGameScreenProps<TriviaState>) {
  return <PurposeScreen platform="tv" purpose="Trivia game" />;
}
