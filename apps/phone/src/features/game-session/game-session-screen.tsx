import type { GameModule } from '@huddle/domain';
import { HuddleText, ScreenShell, StatusSurface } from '@huddle/ui/native';
import { View } from 'react-native';

export function InGameScreen({ module }: { readonly module: GameModule }) {
  return (
    <ScreenShell testID="phone-game-runtime">
      <View accessible accessibilityRole="header">
        <HuddleText variant="caption" align="center">NOW PLAYING</HuddleText>
        <HuddleText variant="display" align="center">{module.metadata.title}</HuddleText>
        <HuddleText variant="bodyLarge" align="center">Your game is ready on this phone.</HuddleText>
      </View>
    </ScreenShell>
  );
}

export function FinishedScreen() {
  return (
    <StatusSurface
      variant="finished"
      title="Game finished"
      message="Nice work, everyone. Choose what to do next."
      testID="phone-game-finished"
    />
  );
}

export function GameRuntimeStatusScreen({
  status,
}: {
  readonly status: 'paused' | 'unavailable';
}) {
  return (
    <StatusSurface
      variant={status}
      title={status === 'paused' ? 'Game paused' : 'Game unavailable'}
      message={status === 'paused' ? 'The room will continue when the phones and TV are ready.' : 'The Host can return the room to the lobby.'}
      testID={`phone-game-${status}`}
    />
  );
}
