import type { GameLifecycleRejection } from '@huddle/game-core';
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

// See schema.test.ts: pnpm's isolated node_modules layout defeats convex-test's
// default module lookup, so the function modules are handed over explicitly.
const modules = import.meta.glob(['./**/*.*s', '!./**/*.d.ts', '!./**/*.test.*']);

type Backend = ReturnType<typeof convexTest>;

/**
 * A room with a party in it, and what each phone is holding.
 *
 * The first to join is the Host — that is `joinRoom`'s rule, not this fixture's
 * — so `host` below is the phone that is allowed to start a game and `guest` is
 * every phone that is not.
 */
async function roomWithParty(t: Backend): Promise<{
  roomId: Id<'rooms'>;
  host: string;
  guest: string;
}> {
  const room = await t.mutation(api.rooms.createRoom, {});
  const host = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
  const guest = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });

  return { roomId: room.roomId, host: host.sessionToken, guest: guest.sessionToken };
}

/** The rejection a refused call carried, or a failure if it was not refused. */
async function rejectionFrom(call: Promise<unknown>): Promise<GameLifecycleRejection> {
  try {
    await call;
  } catch (error) {
    // A ConvexError is the only kind whose payload survives the wire — a plain
    // Error reaches the phone as "Server Error" with nothing to act on.
    expect(error).toBeInstanceOf(ConvexError);
    return (error as ConvexError<GameLifecycleRejection>).data;
  }

  throw new Error('the room allowed a call it should have refused');
}

describe('a room’s phase', () => {
  it('starts in the lobby', async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await roomWithParty(t);

    expect(await t.query(api.games.running, { roomId })).toBeNull();
  });

  it('goes lobby → in-game → lobby, and no further', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);

    await t.mutation(api.games.startGame, { sessionToken: host, gameId: 'trivia' });
    expect(await t.query(api.games.running, { roomId })).not.toBeNull();

    await t.mutation(api.games.endGame, { sessionToken: host });
    expect(await t.query(api.games.running, { roomId })).toBeNull();
  });
});

describe('the Host starting a game', () => {
  it('seeds the state from the module, with the room’s players in it', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);

    await t.mutation(api.games.startGame, { sessionToken: host, gameId: 'trivia' });

    const running = await t.query(api.games.running, { roomId });
    const roster = await t.query(api.players.roster, { roomId });

    expect(running?.gameId).toBe('trivia');
    // Trivia's opening state is the players it was started with, in roster
    // order — which is what says the module's own factory ran, and that the hub
    // did not invent a state of its own.
    expect(running?.state).toEqual({ playerIds: roster.map((seat) => seat.playerId) });
  });

  it('refuses a game the Registry does not install', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);

    expect(
      await rejectionFrom(
        t.mutation(api.games.startGame, { sessionToken: host, gameId: 'charades' }),
      ),
    ).toEqual({ kind: 'gameNotInstalled', gameId: 'charades' });

    // Refused means nothing happened: the room is still in its lobby.
    expect(await t.query(api.games.running, { roomId })).toBeNull();
  });

  it('refuses to start a second game over the one being played', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);

    await t.mutation(api.games.startGame, { sessionToken: host, gameId: 'trivia' });
    const started = await t.query(api.games.running, { roomId });

    expect(
      await rejectionFrom(
        t.mutation(api.games.startGame, { sessionToken: host, gameId: 'trivia' }),
      ),
    ).toEqual({ kind: 'alreadyInGame' });

    // The refusal earns its keep here: a start that went through would have
    // replaced the state of a game in progress.
    expect(await t.query(api.games.running, { roomId })).toEqual(started);
  });

  it('refuses a phone that is not the Host', async () => {
    const t = convexTest(schema, modules);
    const { roomId, guest } = await roomWithParty(t);

    expect(
      await rejectionFrom(
        t.mutation(api.games.startGame, { sessionToken: guest, gameId: 'trivia' }),
      ),
    ).toEqual({ kind: 'notHost' });
    expect(await t.query(api.games.running, { roomId })).toBeNull();
  });

  it('tells a non-Host nothing about the game it named', async () => {
    const t = convexTest(schema, modules);
    const { guest } = await roomWithParty(t);

    // A phone with no room control learns only that, never whether the game it
    // asked for exists.
    expect(
      await rejectionFrom(
        t.mutation(api.games.startGame, { sessionToken: guest, gameId: 'charades' }),
      ),
    ).toEqual({ kind: 'notHost' });
  });

  it('refuses a party smaller than the game is playable by', async () => {
    const t = convexTest(schema, modules);
    const room = await t.mutation(api.rooms.createRoom, {});
    // One phone in the room, and trivia declares itself 2–10.
    const alone = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });

    expect(
      await rejectionFrom(
        t.mutation(api.games.startGame, {
          sessionToken: alone.sessionToken,
          gameId: 'trivia',
        }),
      ),
    ).toEqual({ kind: 'notEnoughPlayers', need: 2, have: 1 });
    expect(await t.query(api.games.running, { roomId: room.roomId })).toBeNull();
  });

  it('lets the same room start once somebody else joins', async () => {
    const t = convexTest(schema, modules);
    const room = await t.mutation(api.rooms.createRoom, {});
    const alone = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
    await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });

    // The refusal has a remedy, and this is it — which is why it is a refusal
    // and being too *large* for a game is not.
    await t.mutation(api.games.startGame, { sessionToken: alone.sessionToken, gameId: 'trivia' });

    expect(await t.query(api.games.running, { roomId: room.roomId })).not.toBeNull();
  });

  it('refuses a phone whose seat is gone', async () => {
    const t = convexTest(schema, modules);
    await roomWithParty(t);

    expect(
      await rejectionFrom(
        t.mutation(api.games.startGame, { sessionToken: 'a-token-no-seat-holds', gameId: 'trivia' }),
      ),
    ).toEqual({ kind: 'notInRoom' });
  });
});

describe('the Host ending the game', () => {
  it('returns the room to the lobby with its roster, host and code intact', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);
    const before = await t.query(api.players.roster, { roomId });
    const code = await t.run(async (ctx) => (await ctx.db.get(roomId))?.code);

    await t.mutation(api.games.startGame, { sessionToken: host, gameId: 'trivia' });
    await t.mutation(api.games.endGame, { sessionToken: host });

    expect(await t.query(api.games.running, { roomId })).toBeNull();
    // "Room intact" is the whole point of ending a game rather than a party:
    // the same seats, the same host, the same code on the television.
    expect(await t.query(api.players.roster, { roomId })).toEqual(before);
    expect(await t.run(async (ctx) => (await ctx.db.get(roomId))?.code)).toBe(code);
    expect(await t.query(api.rooms.stillOpen, { roomId })).toBe(true);
  });

  it('refuses a phone that is not the Host', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host, guest } = await roomWithParty(t);

    await t.mutation(api.games.startGame, { sessionToken: host, gameId: 'trivia' });

    expect(await rejectionFrom(t.mutation(api.games.endGame, { sessionToken: guest }))).toEqual({
      kind: 'notHost',
    });
    // The game a guest tried to end is still running.
    expect(await t.query(api.games.running, { roomId })).not.toBeNull();
  });

  it('lets a second tap ask for the lobby the room is already in', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);

    await t.mutation(api.games.startGame, { sessionToken: host, gameId: 'trivia' });
    await t.mutation(api.games.endGame, { sessionToken: host });
    // The thumb that hit the button twice wants the screen the room is on.
    await t.mutation(api.games.endGame, { sessionToken: host });

    expect(await t.query(api.games.running, { roomId })).toBeNull();
    expect(await t.query(api.rooms.stillOpen, { roomId })).toBe(true);
  });
});
