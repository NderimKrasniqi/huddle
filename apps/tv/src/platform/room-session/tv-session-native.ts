import { randomUUID } from 'expo-crypto';
import { getItemAsync, setItemAsync } from 'expo-secure-store';

import { TV_SESSION_TOKEN_KEY, type TvSessionStore } from './tv-session';

/**
 * The native half of the TV's durable identity: the Keychain-backed store and
 * the UUID source that `ensureTvSessionToken` is handed.
 *
 * These imports are static and must stay static — a dynamic `await import()`
 * becomes a split bundle whose arrival calls `HMRClient.registerBundle()`, and
 * that assert throws on tvOS. `tv-session.ts` carries the full account.
 *
 * They live in their own file rather than beside the logic they serve because
 * `expo-crypto` reaches `expo-modules-core`, which reads `__DEV__` while being
 * imported. Nothing under test may import this module; `tv-session.ts` holds
 * everything worth a unit test and imports nothing native.
 */
export const secureTvSessionStore: TvSessionStore = {
  read: () => getItemAsync(TV_SESSION_TOKEN_KEY),
  write: async (token) => {
    await setItemAsync(TV_SESSION_TOKEN_KEY, token);
  },
};

/** The platform's v4 UUID source, shaped for `ensureTvSessionToken`. */
export const nativeTvSessionUuid = (): string => randomUUID();
