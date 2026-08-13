import { api } from '@huddle/convex';
import { useMutation } from 'convex/react';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { phoneSessionTokenStore } from '../session/native';
import { type ForegroundWatch, keepPresent } from './presence';

const watchAppForeground: ForegroundWatch = (onChange) => {
  onChange(AppState.currentState === 'active');
  const watching = AppState.addEventListener('change', (state) => onChange(state === 'active'));
  return () => watching.remove();
};

/** Keeps the current seat present while the phone is foregrounded. */
export function useHeartbeat(): void {
  const heartbeat = useMutation(api.players.heartbeat);
  useEffect(
    () =>
      keepPresent(
        phoneSessionTokenStore,
        (sessionToken) => heartbeat({ sessionToken }),
        watchAppForeground,
      ),
    [heartbeat],
  );
}
