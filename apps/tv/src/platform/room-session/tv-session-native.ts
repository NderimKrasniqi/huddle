// Keep these imports static: a dynamic import becomes a split bundle whose HMR registration asserts on tvOS.
import { randomUUID } from 'expo-crypto';
import { getItemAsync, setItemAsync } from 'expo-secure-store';

import { TV_SESSION_TOKEN_KEY, type TvSessionStore } from './tv-session';

export const secureTvSessionStore: TvSessionStore = {
  read: () => getItemAsync(TV_SESSION_TOKEN_KEY),
  write: async (token) => {
    await setItemAsync(TV_SESSION_TOKEN_KEY, token);
  },
};

export const nativeTvSessionUuid = (): string => randomUUID();
