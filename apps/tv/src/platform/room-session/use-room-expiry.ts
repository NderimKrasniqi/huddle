import { useEffect } from 'react';

import { tvRoomClient } from '../room-client/native';

import type { OpenRoom } from './room-opening';

/** Notify the coordinator when the displayed room has ended. */
export function useRoomExpiry(room: OpenRoom, onExpired: (expired: OpenRoom) => void): void {
  const stillOpen = tvRoomClient.useStillOpen(room.roomId);

  useEffect(() => {
    if (stillOpen === false) {
      onExpired(room);
    }
  }, [stillOpen, room, onExpired]);
}
