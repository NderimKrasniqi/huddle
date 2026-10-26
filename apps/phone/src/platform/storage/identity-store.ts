import AsyncStorage from '@react-native-async-storage/async-storage';

import type { IdentityStore } from '../../models';

const IDENTITY_KEY = 'huddle.identity';

export const phoneIdentityStore: IdentityStore = {
  read: () => AsyncStorage.getItem(IDENTITY_KEY),
  write: (raw) => AsyncStorage.setItem(IDENTITY_KEY, raw),
};
