import { describe, expect, it } from 'vitest';

import {
  type IdentityStore,
  parseIdentity,
  loadGuestProfile,
  recallIdentity,
  rememberAvatar,
  rememberName,
} from './identity';

const GUEST_ID = '123e4567-e89b-42d3-a456-426614174000';

/** A phone that remembers the last string it was told, the way a working one does. */
function phoneRemembering(raw: string | null = null): IdentityStore {
  let remembered = raw;
  return {
    read: () => Promise.resolve(remembered),
    write: (next) => {
      remembered = next;
      return Promise.resolve();
    },
  };
}

/** A phone whose storage is broken — no reads, no writes. */
function brokenPhone(): IdentityStore {
  return {
    read: () => Promise.reject(new Error('storage unavailable')),
    write: () => Promise.reject(new Error('storage unavailable')),
  };
}

/** A phone that can be read but not written to. */
function readOnlyPhone(raw: string | null): IdentityStore {
  return {
    read: () => Promise.resolve(raw),
    write: () => Promise.reject(new Error('read-only')),
  };
}

describe('parseIdentity', () => {
  it('reads back a record this app wrote', () => {
    const raw = JSON.stringify({ nickname: 'Ada', avatar: 'fox' });
    expect(parseIdentity(raw)).toEqual({ nickname: 'Ada', avatar: 'fox' });
  });

  it('remembers nothing when nothing was stored', () => {
    expect(parseIdentity(null)).toEqual({ nickname: null, avatar: null });
  });

  it('remembers nothing from malformed JSON', () => {
    expect(parseIdentity('{not json')).toEqual({ nickname: null, avatar: null });
  });

  it('remembers nothing from JSON that is not a record', () => {
    expect(parseIdentity('"Ada"')).toEqual({ nickname: null, avatar: null });
    expect(parseIdentity('null')).toEqual({ nickname: null, avatar: null });
    expect(parseIdentity('42')).toEqual({ nickname: null, avatar: null });
  });

  it('drops an avatar this build no longer offers', () => {
    const raw = JSON.stringify({ nickname: 'Ada', avatar: 'chartreuse' });
    expect(parseIdentity(raw)).toEqual({ nickname: 'Ada', avatar: null });
  });

  it('drops a non-string name or avatar', () => {
    const raw = JSON.stringify({ nickname: 7, avatar: ['fox'] });
    expect(parseIdentity(raw)).toEqual({ nickname: null, avatar: null });
  });

  it('caps a stored name to the length the field allows', () => {
    const long = 'x'.repeat(50);
    const raw = JSON.stringify({ nickname: long, avatar: 'teal-bear' });
    // NICKNAME_MAX_LENGTH is 20 (see @huddle/domain); the cap is the field's,
    // not a number spelled out here, so this follows it wherever it moves.
    expect(parseIdentity(raw).nickname).toHaveLength(20);
  });

  it('treats a blank name as no name', () => {
    const raw = JSON.stringify({ nickname: '   ', avatar: 'teal-bear' });
    expect(parseIdentity(raw)).toEqual({ nickname: null, avatar: 'teal-bear' });
  });

  it('keeps one field when only the other is remembered', () => {
    expect(parseIdentity(JSON.stringify({ avatar: 'red-robot' }))).toEqual({
      nickname: null,
      avatar: 'red-robot',
    });
    expect(parseIdentity(JSON.stringify({ nickname: 'Ada' }))).toEqual({
      nickname: 'Ada',
      avatar: null,
    });
  });
});

describe('recallIdentity', () => {
  it('reads the identity back through the store', async () => {
    const store = phoneRemembering(JSON.stringify({ nickname: 'Ada', avatar: 'fox' }));
    await expect(recallIdentity(store)).resolves.toEqual({ nickname: 'Ada', avatar: 'fox' });
  });

  it('remembers nothing when the store cannot be read', async () => {
    await expect(recallIdentity(brokenPhone())).resolves.toEqual({ nickname: null, avatar: null });
  });
});

describe('rememberName / rememberAvatar', () => {
  it('remembers a name', async () => {
    const store = phoneRemembering();
    await rememberName(store, 'Ada');
    await expect(recallIdentity(store)).resolves.toEqual({ nickname: 'Ada', avatar: null });
  });

  it('remembers a avatar', async () => {
    const store = phoneRemembering();
    await rememberAvatar(store, 'teal-bear');
    await expect(recallIdentity(store)).resolves.toEqual({ nickname: null, avatar: 'teal-bear' });
  });

  it('changing one field leaves the other standing', async () => {
    const store = phoneRemembering();
    await rememberName(store, 'Ada');
    await rememberAvatar(store, 'fox');
    await expect(recallIdentity(store)).resolves.toEqual({ nickname: 'Ada', avatar: 'fox' });

    await rememberName(store, 'Grace');
    await expect(recallIdentity(store)).resolves.toEqual({ nickname: 'Grace', avatar: 'fox' });
  });

  it('trims a name to what the field would hold', async () => {
    const store = phoneRemembering();
    await rememberName(store, `${'y'.repeat(30)}`);
    const { nickname } = await recallIdentity(store);
    expect(nickname).toHaveLength(20);
  });

  it('a write that fails is swallowed, not thrown', async () => {
    await expect(rememberName(readOnlyPhone(null), 'Ada')).resolves.toBeUndefined();
    await expect(rememberAvatar(brokenPhone(), 'teal-bear')).resolves.toBeUndefined();
  });
});

describe('GuestProfileV1', () => {
  it('migrates the remembered identity and persists one UUID', async () => {
    const store = phoneRemembering(JSON.stringify({ nickname: 'Ada', avatar: 'fox' }));
    await expect(loadGuestProfile(store, () => GUEST_ID)).resolves.toEqual({
      version: 1,
      guestId: GUEST_ID,
      displayName: 'Ada',
      avatarId: 'fox',
    });
    await expect(loadGuestProfile(store, () => { throw new Error('must not mint twice'); })).resolves.toMatchObject({ guestId: GUEST_ID });
  });

  it('rejects a non-UUID factory result', async () => {
    await expect(loadGuestProfile(phoneRemembering(), () => 'guest-1')).rejects.toThrow('non-UUID');
  });

  it('preserves a blank-name v1 profile and its guest ID across reloads', async () => {
    const store = phoneRemembering(JSON.stringify({
      version: 1,
      guestId: GUEST_ID,
      displayName: '',
      avatarId: 'fox',
    }));

    await expect(loadGuestProfile(store, () => { throw new Error('must not mint'); })).resolves.toEqual({
      version: 1,
      guestId: GUEST_ID,
      displayName: '',
      avatarId: 'fox',
    });
    await expect(loadGuestProfile(store, () => { throw new Error('must not mint on reload'); })).resolves.toMatchObject({
      guestId: GUEST_ID,
      avatarId: 'fox',
    });
  });

  it('normalizes a v1 name while preserving its guest ID and avatar', async () => {
    const store = phoneRemembering(JSON.stringify({
      version: 1,
      guestId: GUEST_ID,
      displayName: `  ${'x'.repeat(25)}  `,
      avatarId: 'teal-bear',
    }));

    await expect(loadGuestProfile(store, () => { throw new Error('must not mint'); })).resolves.toEqual({
      version: 1,
      guestId: GUEST_ID,
      displayName: 'x'.repeat(20),
      avatarId: 'teal-bear',
    });
    await expect(loadGuestProfile(store, () => { throw new Error('must not mint on reload'); })).resolves.toEqual({
      version: 1,
      guestId: GUEST_ID,
      displayName: 'x'.repeat(20),
      avatarId: 'teal-bear',
    });
  });
});
