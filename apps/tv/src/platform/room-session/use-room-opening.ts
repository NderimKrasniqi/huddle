import { useCallback, useEffect, useState } from 'react';

import type { OpenRoom } from '../room-client';
import { tvRoomClient } from '../room-client/native';

export type RoomOpening =
  | { readonly kind: 'opening' }
  | { readonly kind: 'reconnecting' }
  | { readonly kind: 'open'; readonly room: OpenRoom };

const RETRY_MS = 2_000;

export function useRoomOpening(): { readonly opening: RoomOpening; readonly reopen: () => void } {
  const [opening, setOpening] = useState<RoomOpening>({ kind: 'opening' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const open = (failures: number) => {
      tvRoomClient.openRoom().then(
        (room) => {
          if (!stopped) setOpening({ kind: 'open', room });
        },
        (error: unknown) => {
          if (stopped) return;
          if (failures === 0) console.warn('Huddle TV could not open its room; it keeps trying.', String(error));
          setOpening({ kind: 'reconnecting' });
          retry = setTimeout(() => open(failures + 1), RETRY_MS);
        },
      );
    };
    open(0);
    return () => {
      stopped = true;
      clearTimeout(retry);
    };
  }, [attempt]);

  const reopen = useCallback(() => {
    setOpening({ kind: 'opening' });
    setAttempt((count) => count + 1);
  }, []);

  return { opening, reopen };
}

export function useRoomExpiry(room: OpenRoom, onExpired: () => void): void {
  const stillOpen = tvRoomClient.useStillOpen(room.roomId);
  useEffect(() => {
    if (stillOpen === false) onExpired();
  }, [stillOpen, onExpired]);
}
