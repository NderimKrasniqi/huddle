import type { PhoneGameScreenProps } from '@huddle/domain';
import { PurposeScreen } from '@huddle/ui/native';

import type { TriviaEvent, TriviaState } from './types';

export function TriviaPhoneScreen(_props: PhoneGameScreenProps<TriviaState, TriviaEvent>) {
  return <PurposeScreen platform="phone" purpose="Trivia game" />;
}
