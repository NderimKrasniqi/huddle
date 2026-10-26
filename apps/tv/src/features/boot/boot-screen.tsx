import type { TvBootPhase } from './boot-state';
import { TvCreatingRoomScreen } from './tv-creating-room-screen';

export function TvBootScreen({ phase }: { readonly phase: TvBootPhase }) {
  return <TvCreatingRoomScreen phase={phase} />;
}
