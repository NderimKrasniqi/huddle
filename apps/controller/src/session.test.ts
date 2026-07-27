import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  alsoInMemory,
  joinScreenState,
  type PlayerSession,
  rememberSession,
  resumeSession,
  type SessionTokenStore,
} from './session';

/** The seat the room hands back for a token it knows. */
const ADAS_SEAT: PlayerSession = {
  playerId: 'player_ada' as PlayerSession['playerId'],
  roomId: 'room_kwrd' as PlayerSession['roomId'],
  code: 'KWRD',
  nickname: 'Ada',
};

/**
 * How long these tests give the room to answer. Spelled out rather than
 * imported: how long a launch may look blank is a product decision, so a test
 * that follows the constant wherever it moves would stop testing anything.
 */
const PATIENCE = 4000;

/** A phone that remembers what it was told to, the way a working one does. */
function phoneRemembering(sessionToken: string | null): SessionTokenStore {
  let remembered = sessionToken;
  return {
    read: () => Promise.resolve(remembered),
    write: (token) => {
      remembered = token;
      return Promise.resolve();
    },
  };
}

/** A phone whose storage is broken — locked keychain, wiped device, anything. */
function brokenPhone(): SessionTokenStore {
  return {
    read: () => Promise.reject(new Error('keychain unavailable')),
    write: () => Promise.reject(new Error('keychain unavailable')),
  };
}

/** Everything `resumeSession` told the screen, in the order it said it. */
function reportsOf(): {
  readonly report: (session: PlayerSession | null) => void;
  readonly said: (PlayerSession | null)[];
} {
  const said: (PlayerSession | null)[] = [];
  return { report: (session) => said.push(session), said };
}

describe('resumeSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('puts the phone back in the seat its remembered token still holds', async () => {
    const { report, said } = reportsOf();
    const lookUp = vi.fn().mockResolvedValue(ADAS_SEAT);

    resumeSession(phoneRemembering('adastoken'), lookUp, report, PATIENCE);
    await vi.advanceTimersByTimeAsync(1);

    expect(said).toEqual([ADAS_SEAT]);
    expect(lookUp).toHaveBeenCalledWith('adastoken');

    // And the deadline it beat says nothing afterwards: a player seated at 1ms
    // must not be shown the join form when the patience would have run out.
    await vi.advanceTimersByTimeAsync(PATIENCE);
    expect(said).toEqual([ADAS_SEAT]);
  });

  it('goes quiet when the screen it was answering is gone', async () => {
    const { report, said } = reportsOf();
    const silence = vi.fn(() => new Promise<PlayerSession | null>(() => {}));

    const cancel = resumeSession(phoneRemembering('adastoken'), silence, report, PATIENCE);
    cancel();
    await vi.advanceTimersByTimeAsync(PATIENCE);

    expect(said).toEqual([]);
  });

  it('asks the room nothing when the phone has never joined', async () => {
    const { report, said } = reportsOf();
    const lookUp = vi.fn().mockResolvedValue(ADAS_SEAT);

    resumeSession(phoneRemembering(null), lookUp, report, PATIENCE);
    await vi.advanceTimersByTimeAsync(1);

    expect(said).toEqual([null]);
    // A phone with no token has no seat to claim, and asking about one would
    // be asking with somebody else's answer.
    expect(lookUp).not.toHaveBeenCalled();
  });

  it('has no session when the room does not know the token', async () => {
    const { report, said } = reportsOf();
    const lookUp = vi.fn().mockResolvedValue(null);

    resumeSession(phoneRemembering('staletoken'), lookUp, report, PATIENCE);
    await vi.advanceTimersByTimeAsync(1);

    expect(said).toEqual([null]);
  });

  it('offers the join form once the room has had its patience and said nothing', async () => {
    const { report, said } = reportsOf();
    // What an unreachable backend actually does: `ConvexReactClient.query`
    // waits for a websocket update and has no timeout of its own, so it
    // neither answers nor fails. A launch on dropped wifi sat here forever.
    const silence = vi.fn(() => new Promise<PlayerSession | null>(() => {}));

    resumeSession(phoneRemembering('adastoken'), silence, report, PATIENCE);

    await vi.advanceTimersByTimeAsync(PATIENCE - 1);
    expect(said).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(said).toEqual([null]);
  });

  it('still seats the player when the answer turns up after the patience is out', async () => {
    const { report, said } = reportsOf();
    let answer: (session: PlayerSession | null) => void = () => {};
    const slowRoom = vi.fn(
      () =>
        new Promise<PlayerSession | null>((resolve) => {
          answer = resolve;
        }),
    );

    resumeSession(phoneRemembering('adastoken'), slowRoom, report, PATIENCE);
    await vi.advanceTimersByTimeAsync(PATIENCE);
    expect(said).toEqual([null]);

    // A slow network does not cost anybody their seat: the room's answer wins
    // whenever it lands, which is what stops a reconnecting phone from being
    // offered a form it could take a second seat from.
    answer(ADAS_SEAT);
    await vi.advanceTimersByTimeAsync(1);

    expect(said).toEqual([null, ADAS_SEAT]);
  });

  it('has no session when the phone cannot read its own storage', async () => {
    const { report, said } = reportsOf();

    // The join screen is the one screen a player can act from, so every way of
    // not having a seat has to end there.
    resumeSession(brokenPhone(), vi.fn(), report, PATIENCE);
    await vi.advanceTimersByTimeAsync(1);

    expect(said).toEqual([null]);
  });

  it('has no session when the query itself fails', async () => {
    const { report, said } = reportsOf();
    // The one way the client does reject: the query function threw server-side.
    const lookUp = vi.fn().mockRejectedValue(new Error('server error'));

    resumeSession(phoneRemembering('adastoken'), lookUp, report, PATIENCE);
    await vi.advanceTimersByTimeAsync(1);

    expect(said).toEqual([null]);
  });
});

describe('rememberSession', () => {
  it('keeps the token for the next launch', async () => {
    const phone = phoneRemembering(null);

    await rememberSession(phone, 'adastoken');

    expect(await phone.read()).toBe('adastoken');
  });

  it('does not fail a join it cannot record', async () => {
    // The seat is real whether or not the phone manages to write the token
    // down: a storage failure costs this player their rejoin, and must not cost
    // them the join they just made.
    await expect(rememberSession(brokenPhone(), 'adastoken')).resolves.toBeUndefined();
  });
});

describe('alsoInMemory', () => {
  it('reads back a token the store refused to write', async () => {
    const phone = alsoInMemory(brokenPhone());

    await rememberSession(phone, 'adastoken');

    // The player is seated and the keychain is not co-operating. What they must
    // not lose on top of their rejoin is their heartbeat, which reads this back
    // every few seconds for as long as they are in the room.
    expect(await phone.read()).toBe('adastoken');
  });

  it('prefers the token it was just given to the one the store holds', async () => {
    // A store that takes a write and goes on answering with what it had: the
    // shape of a keystore whose write quietly failed. Ada walked to another TV,
    // and only one of these two tokens is the room she is standing in.
    const phone = alsoInMemory({
      read: () => Promise.resolve('oldroomtoken'),
      write: () => Promise.resolve(),
    });

    await phone.write('newroomtoken');

    expect(await phone.read()).toBe('newroomtoken');
  });

  it('falls through to the store when nothing has been written this launch', async () => {
    // The force-quit case, which memory cannot help with and the keystore can.
    expect(await alsoInMemory(phoneRemembering('adastoken')).read()).toBe('adastoken');
    expect(await alsoInMemory(phoneRemembering(null)).read()).toBeNull();
  });

  it('still fails a write the store failed', async () => {
    // `rememberSession` is the one that decides a failed write is survivable,
    // and it can only decide that if it hears about it.
    await expect(alsoInMemory(brokenPhone()).write('adastoken')).rejects.toThrow();
  });
});

describe('joinScreenState', () => {
  it('holds the screen back while the seat is still being worked out', () => {
    expect(joinScreenState(undefined, '')).toEqual({ kind: 'restoring' });
  });

  it('is the join form for a phone holding no seat', () => {
    expect(joinScreenState(null, '')).toEqual({ kind: 'joining' });
    expect(joinScreenState(null, 'ABCD')).toEqual({ kind: 'joining' });
  });

  it('is the seat for a phone that already holds one', () => {
    expect(joinScreenState(ADAS_SEAT, '')).toEqual({ kind: 'seated', session: ADAS_SEAT });
  });

  it('ignores a Join Link for the room the phone is already in', () => {
    // Scanning the TV they are already playing on asks for nothing, whatever
    // case the link was written in.
    expect(joinScreenState(ADAS_SEAT, 'KWRD')).toEqual({ kind: 'seated', session: ADAS_SEAT });
    expect(joinScreenState(ADAS_SEAT, 'kwrd')).toEqual({ kind: 'seated', session: ADAS_SEAT });
  });

  it('lets a Join Link for another room through to the form', () => {
    // The party moved to a second TV. A seat in the room they walked out of is
    // no reason to refuse the room they are standing in — and with no leave
    // control on the seated screen, refusing it would be permanent.
    expect(joinScreenState(ADAS_SEAT, 'ABCD')).toEqual({ kind: 'joining' });
  });
});
