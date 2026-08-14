import type { GameModule } from '@huddle/domain';
import { PurposeScreen } from '@huddle/ui/native';

export function GameStage({ module }: { readonly module: GameModule }) {
  const purpose = module.metadata.id === 'trivia' ? 'Trivia game' : 'Voting game';
  return <PurposeScreen platform="tv" purpose={purpose} />;
}

export function TvRuntimeStatus({
  kind,
}: {
  readonly kind: 'paused' | 'unavailable';
}) {
  return <PurposeScreen platform="tv" purpose={kind === 'paused' ? 'Game paused' : 'Game unavailable'} />;
}
