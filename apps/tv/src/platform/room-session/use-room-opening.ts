import { useCallback, useEffect, useState } from 'react';

import {
  closeExpiredRoom,
  deployed,
  openRoom,
} from './room-client';
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
  const [roomsEnded, setRoomsEnded] = useState(0);
  const [opening, setOpening] = useState<RoomOpening>(() => roomOpeningAtLaunch(deployed));

  useEffect(
    () => (deployed ? keepOpeningRoom(openRoom, setOpening) : undefined),
    [roomsEnded],
  );

  const reopen = useCallback((expired: OpenRoom) => {
    closeExpiredRoom(expired);
    setOpening(roomOpeningAtLaunch(deployed));
    setRoomsEnded((ended) => ended + 1);
  }, []);

  return { opening, reopen };
}
