import { PurposeScreen } from '@huddle/ui/native';
import {
  tvBootPresentation,
  type TvBootPhase,
} from './boot-state';
import { TvCreatingRoomScreen } from './tv-creating-room-screen';

/** The TV before it has a safe room code to show. */
export function TvBootScreen({ phase }: { readonly phase: TvBootPhase }) {
  if (phase === 'startup' || phase === 'opening' || phase === 'reconnecting') {
    return <TvCreatingRoomScreen phase={phase} />;
  }

  return <PurposeScreen platform="tv" purpose={tvBootPresentation(phase).purpose} />;
}
