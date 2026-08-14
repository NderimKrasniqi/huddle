import { PurposeScreen } from '@huddle/ui/native';
import { tvBootPresentation, type TvBootPhase } from './boot-state';

/** The TV before it has a safe room code to show. */
export function TvBootScreen({ phase }: { readonly phase: TvBootPhase }) {
  return <PurposeScreen platform="tv" purpose={tvBootPresentation(phase).purpose} />;
}
