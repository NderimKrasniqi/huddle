import * as SecureStore from 'expo-secure-store';

import { alsoInMemory, type SessionTokenStore } from './session';

const SESSION_TOKEN_KEY = 'huddle.sessionToken';

export const phoneSessionTokenStore: SessionTokenStore = alsoInMemory({
  read: () => SecureStore.getItemAsync(SESSION_TOKEN_KEY),
  write: (sessionToken) => SecureStore.setItemAsync(SESSION_TOKEN_KEY, sessionToken),
  clear: () => SecureStore.deleteItemAsync(SESSION_TOKEN_KEY),
});
