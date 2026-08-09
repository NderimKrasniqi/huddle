/** Versioned key: changing the credential format must not silently reuse it. */
export const TV_SESSION_TOKEN_KEY = 'huddle.tv-session-token.v1';

export type TvSessionStore = {
  readonly read: () => Promise<string | null>;
  readonly write: (token: string) => Promise<void>;
};

export const secureTvSessionStore: TvSessionStore = {
  read: async () => (await import('expo-secure-store')).getItemAsync(TV_SESSION_TOKEN_KEY),
  write: async (token) => {
    await (await import('expo-secure-store')).setItemAsync(TV_SESSION_TOKEN_KEY, token);
  },
};

/** UUIDs are the only values accepted from the persisted TV keystore. */
export function isTvSessionToken(value: string | null): value is string {
  return value !== null &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Read or mint the TV identity. Persisting precedes the network mutation, so
 * a successful room open can always be recovered after a process kill.
 */
export async function ensureTvSessionToken(
  store: TvSessionStore = secureTvSessionStore,
  uuid?: () => string,
): Promise<string> {
  const stored = await store.read();
  if (isTvSessionToken(stored)) return stored;
  const token = uuid === undefined ? (await import('expo-crypto')).randomUUID() : uuid();
  if (!isTvSessionToken(token)) throw new Error('Crypto.randomUUID returned an invalid token');
  await store.write(token);
  return token;
}
