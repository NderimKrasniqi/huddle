/** Versioned key: changing the credential format must not silently reuse it. */
export const TV_SESSION_TOKEN_KEY = 'huddle.tv-session-token.v1';

export type TvSessionStore = {
  readonly read: () => Promise<string | null>;
  readonly write: (token: string) => Promise<void>;
};

export type TvIdentityFailure = 'read' | 'write' | 'uuid';

/** A device identity failure that cannot be repaired by retrying the network. */
export class TvIdentityError extends Error {
  readonly kind = 'tv-identity';
  readonly failure: TvIdentityFailure;

  constructor(failure: TvIdentityFailure, message: string) {
    super(message);
    this.name = 'TvIdentityError';
    this.failure = failure;
  }
}

export function isTvIdentityError(error: unknown): error is TvIdentityError {
  return error instanceof TvIdentityError;
}

/** UUIDs are the only values accepted from the persisted TV keystore. */
export function isTvSessionToken(value: string | null): value is string {
  return value !== null &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Read or mint the TV identity. Persisting precedes the network mutation, so
 * a successful room open can always be recovered after a process kill.
 *
 * Both the keystore and the UUID source are parameters with no defaults, and
 * this module imports nothing native, on purpose. The native pair lives in
 * `tv-session-native.ts` and is supplied by `room.ts`. Two things forced the
 * split:
 *
 * - Defaulting them here to `expo-secure-store` and `expo-crypto` behind a
 *   dynamic `await import()` is what broke the television. A dynamic import
 *   compiles to a lazily loaded split bundle, and when one arrives Metro calls
 *   `HMRClient.registerBundle()`, which opens with `assertHMRClient()`. tvOS
 *   never sets the HMR client up, so that assert threw
 *   `Expected HMRClient.setup() call at startup.` out of the first thing
 *   `openRoom` awaited — so no room was ever opened, and the pairing screen
 *   blamed a backend that was healthy the whole time.
 * - Importing them *statically* from this file fixes the television and breaks
 *   the tests instead: `expo-crypto` pulls in `expo-modules-core`, which reads
 *   `__DEV__` at import time, and this module has a unit test that Node runs.
 *
 * Keeping this file free of native imports is the only arrangement that serves
 * both. Do not reintroduce a default here.
 */
export async function ensureTvSessionToken(
  store: TvSessionStore,
  uuid: () => string,
): Promise<string> {
  let stored: string | null;
  try {
    stored = await store.read();
  } catch {
    // Do not retain or expose a storage exception: a provider may include
    // implementation details or a credential in its message.
    throw new TvIdentityError('read', 'Huddle TV could not read its device identity');
  }

  if (isTvSessionToken(stored)) return stored;

  let token: string;
  try {
    token = uuid();
  } catch {
    throw new TvIdentityError('uuid', 'Huddle TV could not create a device identity');
  }

  if (!isTvSessionToken(token)) {
    throw new TvIdentityError('uuid', 'Huddle TV received an invalid device identity');
  }

  try {
    await store.write(token);
  } catch {
    throw new TvIdentityError('write', 'Huddle TV could not save its device identity');
  }

  return token;
}
