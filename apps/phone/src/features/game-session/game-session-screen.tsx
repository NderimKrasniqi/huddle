import type { GameModule } from '@huddle/domain';
import { PurposeScreen } from '@huddle/ui/native';

export function InGameScreen({ module }: { readonly module: GameModule }) {
  const purpose = module.metadata.id === 'trivia' ? 'Trivia game' : 'Voting game';
  return <PurposeScreen platform="phone" purpose={purpose} />;
}

export function FinishedScreen() {
  return <PurposeScreen platform="phone" purpose="Game finished" />;
}

export function GameRuntimeStatusScreen({
  status,
}: {
  readonly status: 'paused' | 'unavailable';
}) {
  return (
    <PurposeScreen
      platform="phone"
      purpose={status === 'paused' ? 'Game paused' : 'Game unavailable'}
    />
  );
}
