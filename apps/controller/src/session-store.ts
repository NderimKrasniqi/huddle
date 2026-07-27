import * as SecureStore from 'expo-secure-store';

import type { SessionTokenStore } from './session';

/**
 * Where this phone keeps its Session Token: the device keystore, via
 * `expo-secure-store` (iOS Keychain, Android Keystore-encrypted preferences).
 *
 * The token has to outlive the process — a force-quit is the case it exists for
 * — so it cannot live in memory, and the keystore is the store Expo ships for a
 * value that is a credential. It is a small one: it names a nickname in a
 * living room, and Huddle holds nothing else about anybody (docs/project-scope.md).
 * But it is the only thing standing between a phone and somebody's seat, and
 * the alternative stores would leave it in plain text on the filesystem for the
 * same effort.
 *
 * One key, overwritten on every join: a phone is in one room at a time, and the
 * token of a room it has left is of no use to anyone.
 */
const SESSION_TOKEN_KEY = 'huddle.sessionToken';

export const phoneSessionTokenStore: SessionTokenStore = {
  read: () => SecureStore.getItemAsync(SESSION_TOKEN_KEY),
  write: (sessionToken) => SecureStore.setItemAsync(SESSION_TOKEN_KEY, sessionToken),
};
