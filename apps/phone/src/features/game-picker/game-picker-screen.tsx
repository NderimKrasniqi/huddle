import { HuddleText, ScreenShell, StatusSurface } from '@huddle/ui/native';
import { View } from 'react-native';

export type PickAGameScreenProps = {
  readonly setupDraft: { readonly stage: 'configuring' | 'ready' } | null | undefined;
};

/**
 * Compatibility entry point for callers that still render the picker feature
 * directly. The seated-room coordinator owns the live carousel now; this
 * fallback keeps the old seam branded without reintroducing a generic purpose
 * screen.
 */
export function PickAGameScreen({ setupDraft }: PickAGameScreenProps) {
  if (setupDraft !== null && setupDraft !== undefined) {
    return (
      <StatusSurface
        variant="info"
        title="Game setup"
        message="The room is preparing the next game."
        testID="phone-picker-setup-status"
      />
    );
  }

  return (
    <ScreenShell testID="phone-picker-status">
      <View accessible accessibilityRole="header">
        <HuddleText variant="display" align="center">What shall we play?</HuddleText>
        <HuddleText variant="bodyLarge" align="center">The Host is choosing from the Heartbeat carousel.</HuddleText>
      </View>
    </ScreenShell>
  );
}
