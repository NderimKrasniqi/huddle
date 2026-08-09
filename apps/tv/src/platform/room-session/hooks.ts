import { api } from '@huddle/convex';
import { useQuery } from 'convex/react';
import { useCallback, useEffect, useState } from 'react';

import { closeExpiredRoom, deployed, openRoom } from './room';
import {
  keepOpeningRoom,
  type OpenRoom,
  type RoomOpening,
  roomOpeningAtLaunch,
} from './room-opening';

export function useRoomOpening(): {
  readonly opening: RoomOpening;
  readonly reopen: (expired: OpenRoom) => void;
} {
  /** How many rooms this screen has watched end — the trigger, not a statistic. */
  const [roomsEnded, setRoomsEnded] = useState(0);
  const [opening, setOpening] = useState<RoomOpening>(() => roomOpeningAtLaunch(deployed));

  useEffect(
    () => (deployed ? keepOpeningRoom(openRoom, setOpening) : undefined),
    // `deployed` is fixed at bundle time, so the only thing that ever opens a
    // second room is the first one expiring.
    [roomsEnded],
  );

  const reopen = useCallback((expired: OpenRoom) => {
    closeExpiredRoom(expired);
    setOpening(roomOpeningAtLaunch(deployed));
    setRoomsEnded((ended) => ended + 1);
  }, []);

  return { opening, reopen };
}

/**
 * Watches the room this TV is showing for the end of it.
 *
 * A room whose party has gone is deleted ten minutes later, and nobody is going
 * to touch the television about it — so the news has to arrive as a push, which
 * is what this subscription is. Until it does, the screen is showing a Room Code
 * that belongs to no room: the worst thing a pairing screen can display, because
 * it fails silently in the hands of whoever types it.
 *
 * It cannot be read off the roster, which is the subscription this screen
 * already holds: an expired room and a room nobody has joined are the same empty
 * roster, and they want opposite treatment.
 */

export function useRoomExpiry(room: OpenRoom, onExpired: (expired: OpenRoom) => void): void {
  const stillOpen = useQuery(api.rooms.stillOpen, { roomId: room.roomId });

  useEffect(() => {
    // `undefined` is the moment before the first answer, which says nothing.
    if (stillOpen === false) {
      onExpired(room);
    }
  }, [stillOpen, room, onExpired]);
}
