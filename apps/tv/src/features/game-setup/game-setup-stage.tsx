import { StatusSurface } from '@huddle/ui/native';

export function GameSetupStage(_props: Record<string, unknown>) {
  return (
    <StatusSurface
      platform="tv"
      variant="info"
      title="Game setup"
      message="The Host is choosing settings on the phone."
      testID="tv-game-setup-status"
    />
  );
}
