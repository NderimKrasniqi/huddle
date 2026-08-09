import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ForegroundWatch, keepPresent } from './presence';
import type { SessionTokenStore } from '../session';

/**
 * How often these tests expect a beat. Spelled out rather than imported: how
 * often a phone says it is there is a product decision the scope's away rule is
 * measured against (`packages/game-core/src/presence.test.ts` holds it to that
 * rule), so a test that followed the constant wherever it moved would stop
 * testing anything.
 */
const BEAT = 3000;

/** A phone that remembers a token, the way one that has joined a room does. */
function phoneRemembering(sessionToken: string | null): SessionTokenStore {
  return {
    read: () => Promise.resolve(sessionToken),
    write: () => Promise.resolve(),
  };
}

/** A phone whose storage is broken — locked keychain, wiped device, anything. */
function brokenPhone(): SessionTokenStore {
  return {
    read: () => Promise.reject(new Error('keychain unavailable')),
    write: () => Promise.reject(new Error('keychain unavailable')),
  };
}

/**
 * An app that starts in the foreground and can be put away and picked up again,
 * shaped like the `AppState` subscription the Controller hands `keepPresent`.
 */
function appInForeground(): {
  readonly watch: ForegroundWatch;
  readonly background: () => void;
  readonly foreground: () => void;
  readonly watching: () => boolean;
} {
  let tell: ((inForeground: boolean) => void) | undefined;

  return {
    watch: (onChange) => {
      tell = onChange;
      onChange(true);
      return () => {
        tell = undefined;
      };
    },
    background: () => tell?.(false),
    foreground: () => tell?.(true),
    watching: () => tell !== undefined,
  };
}

describe('keepPresent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('tells the room this phone is there, and keeps telling it', async () => {
    const beat = vi.fn().mockResolvedValue(null);
    const app = appInForeground();

    keepPresent(phoneRemembering('adastoken'), beat, app.watch, BEAT);
    // The token comes out of the keystore before the first beat can carry it.
    await vi.advanceTimersByTimeAsync(1);

    expect(beat.mock.calls).toEqual([['adastoken']]);

    await vi.advanceTimersByTimeAsync(BEAT * 3);
    expect(beat).toHaveBeenCalledTimes(4);
  });

  it('goes quiet the moment the app does, which is what being away is', async () => {
    const beat = vi.fn().mockResolvedValue(null);
    const app = appInForeground();

    keepPresent(phoneRemembering('adastoken'), beat, app.watch, BEAT);
    await vi.advanceTimersByTimeAsync(1);
    app.background();

    // A minute in somebody's pocket, and the room hears nothing further than
    // the beat that landed before it went in there.
    await vi.advanceTimersByTimeAsync(BEAT * 20);
    expect(beat).toHaveBeenCalledTimes(1);
  });

  it('speaks up the instant the app comes back, rather than at the next beat', async () => {
    const beat = vi.fn().mockResolvedValue(null);
    const app = appInForeground();

    keepPresent(phoneRemembering('adastoken'), beat, app.watch, BEAT);
    await vi.advanceTimersByTimeAsync(1);
    app.background();
    await vi.advanceTimersByTimeAsync(BEAT * 20);

    app.foreground();

    // Clearing an away badge costs a round trip, not an interval: waiting for
    // the timer would spend seconds the scope has already budgeted elsewhere.
    expect(beat).toHaveBeenCalledTimes(2);

    // And the beat goes on from there, on the same interval as before.
    await vi.advanceTimersByTimeAsync(BEAT);
    expect(beat).toHaveBeenCalledTimes(3);
  });

  it('says nothing for a phone that holds no seat', async () => {
    const beat = vi.fn().mockResolvedValue(null);
    const app = appInForeground();

    keepPresent(phoneRemembering(null), beat, app.watch, BEAT);
    await vi.advanceTimersByTimeAsync(BEAT * 3);

    expect(beat).not.toHaveBeenCalled();
  });

  it('says nothing for a phone that cannot read its own token', async () => {
    const beat = vi.fn().mockResolvedValue(null);
    const app = appInForeground();

    keepPresent(brokenPhone(), beat, app.watch, BEAT);
    await vi.advanceTimersByTimeAsync(BEAT * 3);

    expect(beat).not.toHaveBeenCalled();
  });

  it('keeps beating after one fails to land', async () => {
    // Somebody's wifi, mid-party: a beat is lost and the room starts counting
    // silence. What must not happen is the phone giving up on saying it is here.
    const beat = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(null);
    const app = appInForeground();

    keepPresent(phoneRemembering('adastoken'), beat, app.watch, BEAT);
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(BEAT * 2);

    expect(beat).toHaveBeenCalledTimes(3);
  });

  it('stops when the screen that started it is gone', async () => {
    const beat = vi.fn().mockResolvedValue(null);
    const app = appInForeground();

    const stop = keepPresent(phoneRemembering('adastoken'), beat, app.watch, BEAT);
    await vi.advanceTimersByTimeAsync(1);
    stop();

    await vi.advanceTimersByTimeAsync(BEAT * 3);
    expect(beat).toHaveBeenCalledTimes(1);
    // The foreground subscription goes with it: an app left listening after its
    // screen has gone would beat again the next time it was picked up.
    expect(app.watching()).toBe(false);
  });

  it('never starts beating for a screen that went away before its token arrived', async () => {
    const beat = vi.fn().mockResolvedValue(null);
    const app = appInForeground();

    const stop = keepPresent(phoneRemembering('adastoken'), beat, app.watch, BEAT);
    stop();
    await vi.advanceTimersByTimeAsync(BEAT * 3);

    expect(beat).not.toHaveBeenCalled();
  });
});
