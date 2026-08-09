import AsyncStorage from '@react-native-async-storage/async-storage';

import type { IdentityStore } from '../../features/join';

/**
 * Where this phone keeps the last-used name and avatar: `AsyncStorage`, the
 * device's plain key/value store — deliberately *not* the keystore the Session
 * Token lives in (`session-store.ts`).
 *
 * The token is a credential — it is the only thing between a phone and somebody's
 * seat — so it earns the Keychain/Keystore. A nickname in a living room and one
 * of ten swatches are not: they are conveniences a returning player would type
 * again in seconds, and nothing about them is worth the encrypted store. Keeping
 * them out of it is also the point — the keystore holds the one thing that
 * matters, and nothing else rides along to dilute that.
 *
 * One key, holding the JSON record `identity.ts` reads and writes. It is
 * overwritten in place: a phone remembers its most recent name and avatar, not a
 * history of them.
 */
const IDENTITY_KEY = 'huddle.identity';

export const phoneIdentityStore: IdentityStore = {
  read: () => AsyncStorage.getItem(IDENTITY_KEY),
  write: (raw) => AsyncStorage.setItem(IDENTITY_KEY, raw),
};
