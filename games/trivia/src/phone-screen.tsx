import type { PhoneGameScreenProps } from '@huddle/domain';
import type { ComponentType } from 'react';
import { Text, View, type TextProps, type ViewProps } from 'react-native';
import type { TriviaEvent, TriviaState } from './types';

const NativeView = View as ComponentType<ViewProps & { readonly className?: string }>;
const NativeText = Text as ComponentType<TextProps & { readonly className?: string }>;

export function TriviaPhoneScreen({ state }: PhoneGameScreenProps<TriviaState, TriviaEvent>) {
  return (
    <NativeView className="flex-1 items-center justify-center gap-4 bg-canvas px-6">
      <NativeText className="font-bold text-phone-title text-ink">Trivia started</NativeText>
      <NativeText className="font-regular text-phone-body text-muted">
        Questions: {state.resolvedSettings.questions}
      </NativeText>
      <NativeText className="font-semibold text-phone-body text-accent">
        You’re in the game.
      </NativeText>
    </NativeView>
  );
}
