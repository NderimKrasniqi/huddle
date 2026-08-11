import { describe, expect, it, vi } from 'vitest';

import {
  ensureTvSessionToken,
  isTvIdentityError,
  isTvSessionToken,
  TvIdentityError,
  type TvSessionStore,
} from './tv-session';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

function store(initial: string | null): TvSessionStore & { value: string | null } {
  const state = { value: initial };
  return {
    get value() {
      return state.value;
    },
    set value(value: string | null) {
      state.value = value;
    },
    read: async () => state.value,
    write: async (value) => {
      state.value = value;
    },
  };
}

describe('durable TV identity', () => {
  it('keeps a valid stored UUID', async () => {
    const persisted = store(UUID);
    await expect(ensureTvSessionToken(persisted, vi.fn())).resolves.toBe(UUID);
  });

  it('replaces an invalid value before returning it', async () => {
    const persisted = store('legacy-token');
    await expect(ensureTvSessionToken(persisted, () => UUID)).resolves.toBe(UUID);
    expect(persisted.value).toBe(UUID);
  });

  it('does not open with an in-memory fallback when storage fails', async () => {
    const persisted: TvSessionStore = {
      read: async () => {
        throw new Error('keystore unavailable');
      },
      write: async () => undefined,
    };
    await expect(ensureTvSessionToken(persisted, () => UUID)).rejects.toMatchObject({
      name: 'TvIdentityError',
      failure: 'read',
    });
  });

  it('wraps UUID and write failures without exposing provider errors', async () => {
    await expect(ensureTvSessionToken(store(null), () => 'not-a-uuid')).rejects.toBeInstanceOf(
      TvIdentityError,
    );

    const persisted: TvSessionStore = {
      read: async () => null,
      write: async () => {
        throw new Error('provider detail should not escape');
      },
    };
    const error = await ensureTvSessionToken(persisted, () => UUID).catch((failure: unknown) => failure);

    expect(isTvIdentityError(error)).toBe(true);
    expect(error).toMatchObject({ failure: 'write' });
    expect((error as Error).message).not.toContain('provider detail');
  });

  it('only accepts v4 UUID credentials', () => {
    expect(isTvSessionToken(UUID)).toBe(true);
    expect(isTvSessionToken('')).toBe(false);
    expect(isTvSessionToken('550e8400-e29b-11d4-a716-446655440000')).toBe(false);
  });
});
