import { useCallback, useState } from 'react';

import type { OpenRoom } from '../platform/room-session';
import {
  TvBootScreen,
  TvRestoringRoomScreen,
} from '../features/boot/native';
import { useRoomOpening } from '../platform/room-session/native';
import { TvSessionController } from './tv-session-controller';

export function shouldRestoreTvRoom(room: OpenRoom): boolean {
  return room.restored && !room.hasRunningGame;
}

/**
 * The TV route coordinator owns room opening, subscriptions, and surface selection.
 *
 * The real app owns the TV session and Convex subscriptions here instead of
 * accepting a demo view model: room, browse, setup, and runtime phases remain
 * display-only projections of the authoritative room state.
 */
export function TvScreen() {
  const { opening, reopen } = useRoomOpening();
  const [restoredRoomHandoff, setRestoredRoomHandoff] = useState<
    OpenRoom['roomId'] | undefined
  >(undefined);
  const openedRoomId = opening.kind === 'open' ? opening.room.roomId : undefined;
  const handleRestoreReady = useCallback(() => {
    if (openedRoomId !== undefined) setRestoredRoomHandoff(openedRoomId);
  }, [openedRoomId]);

  if (opening.kind !== 'open') {
    return <TvBootScreen phase={opening.kind} />;
  }

  if (
    shouldRestoreTvRoom(opening.room) &&
    restoredRoomHandoff !== opening.room.roomId
  ) {
    return (
      <TvRestoringRoomScreen
        roomCode={opening.room.code}
        onReadyAnimationComplete={handleRestoreReady}
      />
    );
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
