import type { TvGameScreenProps } from '@huddle/domain';
import { StyleSheet } from 'react-native';

import { answerLetter, cosmic } from './cosmic';
import type { TriviaState } from './types';
import type { WatchedOption } from './watching';

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;
export const SAFE_X = 96;
export const SAFE_Y = 54;

export type Players = TvGameScreenProps<TriviaState>['players'];

export const panel = {
  backgroundColor: cosmic.cream,
  borderRadius: 56,
} as const;

export function optionAccessibilityLabel(option: WatchedOption, revealed: boolean): string {
  return `${answerLetter(option.optionIndex)}: ${option.text}${revealed && option.correct === true ? ', correct answer' : ''}`;
}

export const stageStyles = StyleSheet.create({
  topLabel: { position: 'absolute', top: SAFE_Y + 18, left: 500, right: 500 },
  clockRow: { flexDirection: 'row', alignItems: 'baseline' },
  revealMascot: { position: 'absolute', right: 24, bottom: 8 },
  answerText: { flex: 1 },
});
