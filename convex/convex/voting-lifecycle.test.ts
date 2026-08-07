import { type GameSettings, type GameLifecycleRejection } from '@huddle/game-core';
import { gameLogicById } from '@huddle/game-registry/logic';
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

/**
 * The hub, run through the *second* game.
 *
 * `games.test.ts` proves the platform lifecycle — start, settings, events, the
 * room's clock, ending — and it proves it with trivia in every room. That is
 * the reference game, so trivia is the right thing to test the hub against; but
 * a hub tested against one game has only shown it runs *that* game, and the
 * whole reason Voting exists is to show the platform is game-independent
 * (project-scope.md: "prove that the platform is genuinely game-independent").
 *
 * So this file re-runs the game-touching platform workflows with `gameId:
 * 'voting'`: a differently-shaped module (one setting not three, a 2–10 range,
 * no scoring, both beats on the room's own clock). Nothing here re-tests the
 * parts of the hub that never see a game — host transfer, player removal, TV
 * recovery — those act on the room envelope and are proven once, game-agnostic,
 * in `players.test.ts`/`rooms.test.ts`. What is proven here is that the second
 * game reaches the same rules the first one did, and the hub adds nothing and
 * carries nothing across.
 *
 * This is task 5.4's automated backbone: the acceptance matrix's "second game
 * included" column for every workflow that runs a game through the hub.
 */

// See schema.test.ts: pnpm's isolated node_modules layout defeats convex-test's
// default module lookup, so the function modules are handed over explicitly.
const modules = import.meta.glob(['./**/*.*s', '!./**/*.d.ts', '!./**/*.test.*']);

type Backend = ReturnType<typeof convexTest>;

/** A room already playing Voting on its default settings, every phone's token by nickname. */
async function roomVoting(
  t: Backend,
  ...nicknames: readonly string[]
): Promise<{ roomId: Id<'rooms'>; tokens: Record<string, string> }> {
  return await roomVotingOn(t, undefined, ...nicknames);
}

/** A room playing Voting on the Host's chosen settings, every phone's token by nickname. */
async function roomVotingOn(
  t: Backend,
  settings: GameSettings | undefined,
  ...nicknames: readonly string[]
): Promise<{ roomId: Id<'rooms'>; tokens: Record<string, string> }> {
  const room = await t.mutation(api.rooms.createRoom, {});
  const tokens: Record<string, string> = {};

  for (const nickname of nicknames) {
    const seated = await t.mutation(api.players.joinRoom, { code: room.code, nickname });
    tokens[nickname] = seated.sessionToken;
  }

  // The first to join is the Host, and the Host is who starts a game.
  const host = tokens[nicknames[0] ?? ''];

  if (host === undefined) {
    throw new Error('a room with nobody in it has no game to play');
  }

  await t.mutation(api.games.startGame, { sessionToken: host, gameId: 'voting', settings });

  return { roomId: room.roomId, tokens };
}

/** The state of the game the room is playing, or a failure if it is playing none. */
async function stateOf(t: Backend, roomId: Id<'rooms'>) {
  const running = await t.query(api.games.running, { roomId });

  if (running === null) {
    throw new Error('this room is in its lobby, not in a game');
  }

  return running.state;
}

/**
 * How long Voting gives the room on the beat this state is on — asked of the
 * module, not written here, because the twenty and the six are Voting's numbers
 * (`VOTE_SECONDS`, `REVEAL_SECONDS`) and this only asserts the room waits as
 * long as the game it is running says.
 */
function voteClockOn(state: unknown): number {
  const afterMs = gameLogicById('voting')?.deadline?.(state)?.afterMs;

  if (afterMs === undefined) {
    throw new Error('this beat has no clock running on it');
  }

  return afterMs;
}

/** Lets `ms` of the party go by, and runs whatever the room had scheduled for it. */
async function elapse(t: Backend, ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await t.finishInProgressScheduledFunctions();
}

/** The room's own id for the player it knows by this nickname. */
async function playerIdOf(t: Backend, roomId: Id<'rooms'>, nickname: string): Promise<string> {
  const roster = await t.query(api.players.roster, { roomId });
  const seat = roster.find((player) => player.nickname === nickname);

  if (seat === undefined) {
    throw new Error(`no player called ${nickname} in this room`);
  }

  return seat.playerId;
}

/** The rejection a refused call carried, or a failure if it was not refused. */
async function rejectionFrom(call: Promise<unknown>): Promise<GameLifecycleRejection> {
  try {
    await call;
  } catch (error) {
    expect(error).toBeInstanceOf(ConvexError);
    return (error as ConvexError<GameLifecycleRejection>).data;
  }

  throw new Error('the room allowed a call it should have refused');
}

describe('the Host starting Voting', () => {
  it('seeds Voting’s opening state, with the room’s players in it', async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await roomVoting(t, 'Ada', 'Grace', 'Linus');
    const roster = await t.query(api.players.roster, { roomId });

    const running = await t.query(api.games.running, { roomId });

    expect(running?.gameId).toBe('voting');
    // Voting opens on its first prompt with an empty tally and the room's
    // players fixed into the game in roster order — the module's own factory
    // ran, and the hub invented nothing. A three-option prompt, so three zeros.
    expect(running?.state.phase).toBe('voting');
    expect(running?.state.promptIndex).toBe(0);
    expect(running?.state.voters).toEqual([]);
    expect(running?.state.tally).toEqual([0, 0, 0]);
    expect(running?.state.players).toEqual(roster.map((seat) => seat.playerId));
  });

  it('refuses a party below Voting’s declared minimum', async () => {
    const t = convexTest(schema, modules);
    const room = await t.mutation(api.rooms.createRoom, {});
    // One phone in the room, and the hub gates the start on the range Voting's
    // own metadata declares (2–10) — read from the module, not written in the
    // hub, which is the whole of the hub naming no game.
    const alone = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });

    expect(
      await rejectionFrom(
        t.mutation(api.games.startGame, { sessionToken: alone.sessionToken, gameId: 'voting' }),
      ),
    ).toEqual({ kind: 'notEnoughPlayers', need: 2, have: 1 });
    expect(await t.query(api.games.running, { roomId: room.roomId })).toBeNull();
  });

  it('refuses a phone that is not the Host', async () => {
    const t = convexTest(schema, modules);
    const room = await t.mutation(api.rooms.createRoom, {});
    await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
    const guest = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });

    expect(
      await rejectionFrom(
        t.mutation(api.games.startGame, { sessionToken: guest.sessionToken, gameId: 'voting' }),
      ),
    ).toEqual({ kind: 'notHost' });
    expect(await t.query(api.games.running, { roomId: room.roomId })).toBeNull();
  });

  it('starts on the rounds the Host chose, and defaults the ones they left', async () => {
    const t = convexTest(schema, modules);

    // Voting's one setting is differently shaped from trivia's three, which is
    // the point: the hub settles it against Voting's own schema without knowing
    // "rounds" is a prompt count. Five prompts asked for, five dealt.
    const chosen = await roomVotingOn(t, { rounds: '5' }, 'Ada', 'Grace');
    expect((await stateOf(t, chosen.roomId)).prompts).toHaveLength(5);

    // A Host who opened nothing still starts a game, and it is the game the
    // module's defaults describe — three prompts.
    const defaulted = await roomVoting(t, 'Ada', 'Grace');
    expect((await stateOf(t, defaulted.roomId)).prompts).toHaveLength(3);
  });

  it('refuses a value Voting’s schema does not offer', async () => {
    const t = convexTest(schema, modules);
    const room = await t.mutation(api.rooms.createRoom, {});
    const host = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
    await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });

    // Four is not one of the counts the prompt list can deal, so the schema
    // does not offer it and the hub refuses it — the same gate trivia's odd
    // question counts meet, on a game that declares an entirely different set.
    expect(
      await rejectionFrom(
        t.mutation(api.games.startGame, {
          sessionToken: host.sessionToken,
          gameId: 'voting',
          settings: { rounds: '4' },
        }),
      ),
    ).toEqual({ kind: 'settingRejected', key: 'rounds', value: '4' });
    expect(await t.query(api.games.running, { roomId: room.roomId })).toBeNull();
  });

  it('refuses a setting Voting does not declare', async () => {
    const t = convexTest(schema, modules);
    const room = await t.mutation(api.rooms.createRoom, {});
    const host = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
    await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });

    // Trivia's own "category" means nothing to Voting: a setting the game does
    // not declare is refused, so the two games' schemas cannot bleed together.
    expect(
      await rejectionFrom(
        t.mutation(api.games.startGame, {
          sessionToken: host.sessionToken,
          gameId: 'voting',
          settings: { category: 'Movies' },
        }),
      ),
    ).toEqual({ kind: 'settingRejected', key: 'category', value: 'Movies' });
  });

  it('refuses to start a second game over the one being played', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomVoting(t, 'Ada', 'Grace');
    const started = await t.query(api.games.running, { roomId });

    expect(
      await rejectionFrom(
        t.mutation(api.games.startGame, { sessionToken: tokens.Ada ?? '', gameId: 'voting' }),
      ),
    ).toEqual({ kind: 'alreadyInGame' });
    // A start that went through would have replaced a game in progress.
    expect(await t.query(api.games.running, { roomId })).toEqual(started);
  });
});

describe('a vote in the running game', () => {
  it('carries the vote to the module and keeps the tally anonymous', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomVoting(t, 'Ada', 'Grace', 'Linus');

    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Grace ?? '',
      event: { kind: 'vote', promptIndex: 0, optionIndex: 1 },
    });

    const running = await t.query(api.games.running, { roomId });
    const grace = await playerIdOf(t, roomId, 'Grace');

    // The count went up at the chosen option and nowhere names whose it was.
    expect(running?.state.tally).toEqual([0, 1, 0]);
    // `voters` says *that* Grace voted — a second tap is refused and the "1/3"
    // numerator is counted from it — never *what* she voted.
    expect(running?.state.voters).toEqual([grace]);
    // The privacy the game promises is structural: the payload the hub ships to
    // every phone and the TV alike holds no map of voter → choice, so no client
    // can name a vote's owner however it reads the state. This asserts the shape
    // at the hub boundary, which is where the security review's claim has to
    // hold — the reveal shows the room its own opinion, never a person's.
    expect(Object.keys(running?.state ?? {}).sort()).toEqual(
      ['phase', 'players', 'promptIndex', 'prompts', 'tally', 'voters'].sort(),
    );
  });

  it('names the voter from the Session Token, never from the phone', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomVoting(t, 'Ada', 'Grace');
    const ada = await playerIdOf(t, roomId, 'Ada');
    const grace = await playerIdOf(t, roomId, 'Grace');

    // Grace's phone naming Ada is a claim the hub does not read: the vote is
    // recorded against the seat the token holds.
    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Grace ?? '',
      event: { kind: 'vote', playerId: ada, promptIndex: 0, optionIndex: 2 },
    });

    expect((await stateOf(t, roomId)).voters).toEqual([grace]);
  });

  it('reveals as soon as everyone present has voted, without waiting for the clock', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomVoting(t, 'Ada', 'Grace');

    for (const sessionToken of [tokens.Ada ?? '', tokens.Grace ?? '']) {
      await t.mutation(api.games.sendEvent, {
        sessionToken,
        event: { kind: 'vote', promptIndex: 0, optionIndex: 0 },
      });
    }

    // The last vote the room was waiting on ends the prompt — the hub fed the
    // module the real roster and the real away-set (nobody), so `playersCounted`
    // saw two of two in and closed the prompt with no clock touched.
    expect((await stateOf(t, roomId)).phase).toBe('reveal');
  });

  it('reveals past an away player, on the votes it is still hearing', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomVoting(t, 'Ada', 'Grace', 'Linus');
    const linus = await playerIdOf(t, roomId, 'Linus');

    // Linus's phone is face-down on the table, so the room has marked him away —
    // exactly what `markAway` writes when a Heartbeat stops. A room never waits
    // for a phone it has stopped hearing from, and the hub reads that presence
    // fresh at each event rather than believing the phone that sent it.
    await t.run(async (ctx) => {
      await ctx.db.patch(linus as Id<'players'>, { away: true });
    });

    for (const sessionToken of [tokens.Ada ?? '', tokens.Grace ?? '']) {
      await t.mutation(api.games.sendEvent, {
        sessionToken,
        event: { kind: 'vote', promptIndex: 0, optionIndex: 0 },
      });
    }

    // Two present phones, both in, and the prompt closes: the room did not sit
    // out its clock waiting for the third.
    expect((await stateOf(t, roomId)).phase).toBe('reveal');
  });

  it('stores nothing when the module makes nothing of the event', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomVoting(t, 'Ada', 'Grace');
    const started = await t.query(api.games.running, { roomId });

    // An event Voting does not recognise returns no state, and storing that
    // would let one such event erase the game the room is playing.
    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Grace ?? '',
      event: { kind: 'not-an-event-voting-knows' },
    });

    expect(await t.query(api.games.running, { roomId })).toEqual(started);
  });

  it('leaves a mid-game joiner in the room but out of the game', async () => {
    const t = convexTest(schema, modules);
    const room = await t.mutation(api.rooms.createRoom, {});
    const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
    await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });
    await t.mutation(api.games.startGame, { sessionToken: ada.sessionToken, gameId: 'voting' });

    // Voting does not seat late joiners (its `players` are fixed at the start),
    // so a phone that joins now is in the room and watching, not in the game.
    const linus = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace II' });
    const roster = await t.query(api.players.roster, { roomId: room.roomId });
    const before = await t.query(api.games.running, { roomId: room.roomId });

    expect(roster).toHaveLength(3);
    expect(before?.state.players).toHaveLength(2);

    // A vote from someone the game is not playing lands on nothing.
    await t.mutation(api.games.sendEvent, {
      sessionToken: linus.sessionToken,
      event: { kind: 'vote', promptIndex: 0, optionIndex: 0 },
    });

    expect(await t.query(api.games.running, { roomId: room.roomId })).toEqual(before);
  });
});

describe('the room’s own clock, driving both of Voting’s beats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('closes a prompt when its vote timer runs out', async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await roomVoting(t, 'Ada', 'Grace');
    const asked = await stateOf(t, roomId);

    // Nobody votes — every phone is face-down. A second short of the deadline
    // the prompt is still open; on it, the room closes the prompt itself.
    await elapse(t, voteClockOn(asked) - 1000);
    expect((await stateOf(t, roomId)).phase).toBe('voting');

    await elapse(t, 1000);
    expect((await stateOf(t, roomId)).phase).toBe('reveal');
  });

  it('moves to the next prompt when the reveal timer runs out, untouched by any phone', async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await roomVoting(t, 'Ada', 'Grace');

    // Onto the reveal on the vote timer, then off it on the reveal timer — both
    // the room's own. This is where Voting departs from trivia, whose reveal the
    // Controllers time: a room can play a whole prompt of Voting with no phone
    // doing anything at all.
    await elapse(t, voteClockOn(await stateOf(t, roomId)));
    expect((await stateOf(t, roomId)).phase).toBe('reveal');

    await elapse(t, voteClockOn(await stateOf(t, roomId)));

    const next = await stateOf(t, roomId);
    expect(next.phase).toBe('voting');
    expect(next.promptIndex).toBe(1);
    // A fresh prompt: an empty tally and nobody yet counted against it.
    expect(next.voters).toEqual([]);
  });

  it('plays a whole game to finished on its own clock, with no phone awake', async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await roomVoting(t, 'Ada', 'Grace');

    // The default three prompts, driven only by letting each beat's clock run
    // out. A bound rather than a limit: three prompts is six beats, and a game
    // that never finishes should fail this test rather than hang it.
    for (let beat = 0; beat < 100; beat += 1) {
      const state = await stateOf(t, roomId);

      if (state.phase === 'finished') {
        break;
      }

      await elapse(t, voteClockOn(state));
    }

    const ended = await stateOf(t, roomId);
    expect(ended.phase).toBe('finished');
    // Finished on the last of the three it was dealt.
    expect(ended.promptIndex).toBe(2);
  });
});

describe('the Host ending Voting, and playing something else', () => {
  it('returns the room to its lobby with roster, host and code intact', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomVoting(t, 'Ada', 'Grace');
    const before = await t.query(api.players.roster, { roomId });
    const code = await t.run(async (ctx) => (await ctx.db.get(roomId))?.code);

    await t.mutation(api.games.endGame, { sessionToken: tokens.Ada ?? '' });

    expect(await t.query(api.games.running, { roomId })).toBeNull();
    // Ending a game is the party deciding to play something else, not the party
    // ending: the same seats, the same host, the same code on the television.
    expect(await t.query(api.players.roster, { roomId })).toEqual(before);
    expect(await t.run(async (ctx) => (await ctx.db.get(roomId))?.code)).toBe(code);
    expect(await t.query(api.rooms.stillOpen, { roomId })).toBe(true);
  });

  it('switches between the two games, carrying nothing across', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomVoting(t, 'Ada', 'Grace');
    const host = tokens.Ada ?? '';

    // A vote cast, so the game the room is about to leave holds real state.
    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Grace ?? '',
      event: { kind: 'vote', promptIndex: 0, optionIndex: 0 },
    });
    await t.mutation(api.games.endGame, { sessionToken: host });

    // Voting → Trivia: the room is dealt trivia's own opening state, with no
    // trace of the poll it just left. The scores start from trivia's factory,
    // and none of Voting's fields ride along.
    await t.mutation(api.games.startGame, { sessionToken: host, gameId: 'trivia' });
    const trivia = await t.query(api.games.running, { roomId });
    expect(trivia?.gameId).toBe('trivia');
    expect(trivia?.state.phase).toBe('question');
    expect(trivia?.state.tally).toBeUndefined();
    expect(trivia?.state.prompts).toBeUndefined();

    await t.mutation(api.games.endGame, { sessionToken: host });

    // Trivia → Voting: and back the other way, a clean Voting seed with none of
    // trivia's questions or standings on it. Switching games leaves nothing of
    // the last one behind, in either direction.
    await t.mutation(api.games.startGame, { sessionToken: host, gameId: 'voting' });
    const voting = await t.query(api.games.running, { roomId });
    expect(voting?.gameId).toBe('voting');
    expect(voting?.state.phase).toBe('voting');
    expect(voting?.state.promptIndex).toBe(0);
    expect(voting?.state.questions).toBeUndefined();
    expect(voting?.state.standings).toBeUndefined();
  });

  it('replays Voting from a clean state after a game is played out', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomVoting(t, 'Ada', 'Grace');
    const host = tokens.Ada ?? '';

    // Get the room off its first prompt so a stale replay would be visible.
    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Grace ?? '',
      event: { kind: 'vote', promptIndex: 0, optionIndex: 2 },
    });

    await t.mutation(api.games.endGame, { sessionToken: host });
    await t.mutation(api.games.startGame, { sessionToken: host, gameId: 'voting' });

    const replayed = await stateOf(t, roomId);
    // The replay is a fresh game from the module's factory, not the one the room
    // just left: first prompt, empty tally, nobody counted.
    expect(replayed.promptIndex).toBe(0);
    expect(replayed.voters).toEqual([]);
    expect(replayed.tally).toEqual([0, 0, 0]);
  });
});
