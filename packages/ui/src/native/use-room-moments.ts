import { useEffect, useState } from 'react';
import { advanceRoomMoments, INITIAL_ROOM_MOMENTS, type RoomMomentSnapshot } from './room-moments';

export function useRoomMoments(snapshot: Omit<RoomMomentSnapshot, 'now'>) {
  const [moments, setMoments] = useState(INITIAL_ROOM_MOMENTS);
  const { playerIds, runtime, lobbyResolved, browsing } = snapshot;
  useEffect(() => {
    // Each authoritative room change is an event the moments reducer must see
    // once, with the time it arrived; deriving during render would re-run it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoments((previous) => advanceRoomMoments(previous, { playerIds, runtime, lobbyResolved, browsing, now: Date.now() }));
  }, [playerIds, runtime, lobbyResolved, browsing]);
  useEffect(() => {
    if (moments.welcomeIds.length === 0) return;
    const timer = setTimeout(() => setMoments((previous) => ({ ...previous, welcomeIds: [] })), Math.max(0, moments.welcomeUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [moments.welcomeIds, moments.welcomeUntil]);
  // Hide stale presentation synchronously when authority changes surfaces.
  return { ...moments, returned: moments.returned && lobbyResolved && !browsing,
    welcomeIds: lobbyResolved && !browsing ? moments.welcomeIds : [] };
}
