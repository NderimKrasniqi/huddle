import type { PhoneGameScreenProps } from '@huddle/domain';
import type { ComponentType } from 'react';
import { Text, View, type TextProps, type ViewProps } from 'react-native';
import type { VotingEvent, VotingState } from './types';

const NativeView = View as ComponentType<ViewProps & { readonly className?: string }>;
const NativeText = Text as ComponentType<TextProps & { readonly className?: string }>;

export function VotingPhoneScreen({ state }: PhoneGameScreenProps<VotingState, VotingEvent>) {
  return (
    <NativeView className="flex-1 items-center justify-center gap-4 bg-canvas px-6">
      <NativeText className="font-bold text-phone-title text-ink">Voting started</NativeText>
      <NativeText className="font-regular text-phone-body text-muted">
        Rounds: {state.resolvedSettings.rounds}
      </NativeText>
      <NativeText className="font-semibold text-phone-body text-accent">
        You’re in the game.
      </NativeText>
    </NativeView>
  );
}
