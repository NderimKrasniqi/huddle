import type { TvGameScreenProps } from '@huddle/domain';
import type { ComponentType } from 'react';
import { Text, View, type TextProps, type ViewProps } from 'react-native';
import type { VotingState } from './types';

const NativeView = View as ComponentType<ViewProps & { readonly className?: string }>;
const NativeText = Text as ComponentType<TextProps & { readonly className?: string }>;

export function VotingTvScreen({ state }: TvGameScreenProps<VotingState>) {
  return (
    <NativeView className="flex-1 items-center justify-center gap-8 bg-screen">
      <NativeText className="font-bold text-tv-display text-ink">Voting started</NativeText>
      <NativeText className="font-regular text-tv-body text-muted">
        Rounds: {state.resolvedSettings.rounds}
      </NativeText>
      <NativeText className="font-semibold text-tv-heading text-accent">
        Everyone made it in.
      </NativeText>
    </NativeView>
  );
}
