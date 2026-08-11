import { TvBootScreen } from '../features/boot/native';
import { useRoomOpening } from '../platform/room-session/native';
import { TvSessionController } from './tv-session-controller';

/**
 * The TV route coordinator owns room opening, subscriptions, and surface selection.
 *
 * The real app owns the TV session and Convex subscriptions here instead of
 * accepting a demo view model: room, browse, setup, and runtime phases remain
 * display-only projections of the authoritative room state.
 */
export function TvScreen() {
  const { opening, reopen } = useRoomOpening();

  if (opening.kind !== 'open') {
    return <TvBootScreen phase={opening.kind} />;
  }

  return (
    <TvSessionController
      key={opening.room.roomId}
      room={opening.room}
      opening={opening}
      onExpired={reopen}
    />
  );
}

export default TvScreen;
