import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useRoomClient } from '../room-client/native';
import { usePhoneSession } from '../session';
import { type ForegroundWatch, keepPresent } from './presence';

const watchAppForeground: ForegroundWatch = (onChange) => {
  onChange(AppState.currentState === 'active');
  const watching = AppState.addEventListener('change', (state) => onChange(state === 'active'));
  return () => watching.remove();
};

export function useHeartbeat(): void {
  const { heartbeat } = useRoomClient();
  const { sessionToken } = usePhoneSession();
  useEffect(
    () =>
      keepPresent(
        { read: async () => sessionToken ?? null },
        (token) => heartbeat(token),
        watchAppForeground,
      ),
    [heartbeat, sessionToken],
  );
}
