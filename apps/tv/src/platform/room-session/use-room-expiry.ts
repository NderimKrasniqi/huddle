import { api } from '@huddle/convex';
import { useQuery } from 'convex/react';
import { useEffect } from 'react';

import type { OpenRoom } from './room-opening';

/** Notify the coordinator when Convex has deleted the displayed room. */
export function useRoomExpiry(room: OpenRoom, onExpired: (expired: OpenRoom) => void): void {
  const stillOpen = useQuery(api.rooms.stillOpen, { roomId: room.roomId });

  useEffect(() => {
    if (stillOpen === false) {
      onExpired(room);
    }
  }, [stillOpen, room, onExpired]);
}
