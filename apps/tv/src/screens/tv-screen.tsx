import { useCallback, useState } from 'react';

import type { OpenRoom } from '../platform/room-session';
import {
  TvBootScreen,
  TvRestoringRoomScreen,
} from '../features/boot/native';
import { useRoomOpening } from '../platform/room-session/native';
import { TvSessionController } from './tv-session-controller';

function shouldRestoreTvRoom(room: OpenRoom): boolean {
  return room.restored && !room.hasRunningGame;
}

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
      onExpired={reopen}
    />
  );
}

export default TvScreen;
