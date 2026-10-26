export const TV_SESSION_TOKEN_KEY = 'huddle.tv-session-token.v1';

export type TvSessionStore = {
  readonly read: () => Promise<string | null>;
  readonly write: (token: string) => Promise<void>;
};

export type TvIdentityFailure = 'read' | 'write' | 'uuid';

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

export function isTvSessionToken(value: string | null): value is string {
  return value !== null &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function ensureTvSessionToken(
  store: TvSessionStore,
  uuid: () => string,
): Promise<string> {
  let stored: string | null;
  try {
    stored = await store.read();
  } catch {
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
