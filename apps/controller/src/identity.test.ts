import { describe, expect, it } from 'vitest';

import {
  type IdentityStore,
  parseIdentity,
  recallIdentity,
  rememberColor,
  rememberName,
} from './identity';

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
    const raw = JSON.stringify({ nickname: 'Ada', color: 'cobalt' });
    expect(parseIdentity(raw)).toEqual({ nickname: 'Ada', color: 'cobalt' });
  });

  it('remembers nothing when nothing was stored', () => {
    expect(parseIdentity(null)).toEqual({ nickname: null, color: null });
  });

  it('remembers nothing from malformed JSON', () => {
    expect(parseIdentity('{not json')).toEqual({ nickname: null, color: null });
  });

  it('remembers nothing from JSON that is not a record', () => {
    expect(parseIdentity('"Ada"')).toEqual({ nickname: null, color: null });
    expect(parseIdentity('null')).toEqual({ nickname: null, color: null });
    expect(parseIdentity('42')).toEqual({ nickname: null, color: null });
  });

  it('drops a color that no longer names a swatch', () => {
    const raw = JSON.stringify({ nickname: 'Ada', color: 'chartreuse' });
    expect(parseIdentity(raw)).toEqual({ nickname: 'Ada', color: null });
  });

  it('drops a non-string name or color', () => {
    const raw = JSON.stringify({ nickname: 7, color: ['cobalt'] });
    expect(parseIdentity(raw)).toEqual({ nickname: null, color: null });
  });

  it('caps a stored name to the length the field allows', () => {
    const long = 'x'.repeat(50);
    const raw = JSON.stringify({ nickname: long, color: 'lagoon' });
    // NICKNAME_MAX_LENGTH is 20 (see @huddle/game-core); the cap is the field's,
    // not a number spelled out here, so this follows it wherever it moves.
    expect(parseIdentity(raw).nickname).toHaveLength(20);
  });

  it('treats a blank name as no name', () => {
    const raw = JSON.stringify({ nickname: '   ', color: 'lagoon' });
    expect(parseIdentity(raw)).toEqual({ nickname: null, color: 'lagoon' });
  });

  it('keeps one field when only the other is remembered', () => {
    expect(parseIdentity(JSON.stringify({ color: 'tangerine' }))).toEqual({
      nickname: null,
      color: 'tangerine',
    });
    expect(parseIdentity(JSON.stringify({ nickname: 'Ada' }))).toEqual({
      nickname: 'Ada',
      color: null,
    });
  });
});

describe('recallIdentity', () => {
  it('reads the identity back through the store', async () => {
    const store = phoneRemembering(JSON.stringify({ nickname: 'Ada', color: 'cobalt' }));
    await expect(recallIdentity(store)).resolves.toEqual({ nickname: 'Ada', color: 'cobalt' });
  });

  it('remembers nothing when the store cannot be read', async () => {
    await expect(recallIdentity(brokenPhone())).resolves.toEqual({ nickname: null, color: null });
  });
});

describe('rememberName / rememberColor', () => {
  it('remembers a name', async () => {
    const store = phoneRemembering();
    await rememberName(store, 'Ada');
    await expect(recallIdentity(store)).resolves.toEqual({ nickname: 'Ada', color: null });
  });

  it('remembers a color', async () => {
    const store = phoneRemembering();
    await rememberColor(store, 'lagoon');
    await expect(recallIdentity(store)).resolves.toEqual({ nickname: null, color: 'lagoon' });
  });

  it('changing one field leaves the other standing', async () => {
    const store = phoneRemembering();
    await rememberName(store, 'Ada');
    await rememberColor(store, 'cobalt');
    await expect(recallIdentity(store)).resolves.toEqual({ nickname: 'Ada', color: 'cobalt' });

    await rememberName(store, 'Grace');
    await expect(recallIdentity(store)).resolves.toEqual({ nickname: 'Grace', color: 'cobalt' });
  });

  it('trims a name to what the field would hold', async () => {
    const store = phoneRemembering();
    await rememberName(store, `${'y'.repeat(30)}`);
    const { nickname } = await recallIdentity(store);
    expect(nickname).toHaveLength(20);
  });

  it('a write that fails is swallowed, not thrown', async () => {
    await expect(rememberName(readOnlyPhone(null), 'Ada')).resolves.toBeUndefined();
    await expect(rememberColor(brokenPhone(), 'lagoon')).resolves.toBeUndefined();
  });
});
