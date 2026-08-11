import {
  AVATAR_IDS,
  AWAY_AFTER_MS,
  HEARTBEAT_INTERVAL_MS,
  type GameSettings,
  settingsFrom,
  type GameLifecycleRejection,
} from '@huddle/game-core';
import { GAME_REGISTRY } from '@huddle/game-registry';
import { gameLogicById } from '@huddle/game-registry/logic';
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import {
  roomFixture,
  runningState as typedRunningState,
  type TriviaTestState,
} from '../test/fixtures';

// See schema.test.ts: pnpm's isolated node_modules layout defeats convex-test's
// default module lookup, so the function modules are handed over explicitly.
const modules = import.meta.glob(['./**/*.*s', '!./**/*.d.ts', '!./**/*.test.*']);

function runningState(response: unknown): TriviaTestState {
  return typedRunningState<TriviaTestState>(response);
}

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
  const room = await roomFixture(t);
  const host = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada', avatar: 'fox' });
  const guest = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace', avatar: 'green-alien' });

  return { roomId: room.roomId, host: host.sessionToken, guest: guest.sessionToken };
}

/**
 * A room in a game with every setting left at its default — sent as an empty
 * set of choices, which is a Host who opened the settings screen and changed
 * nothing. (A Host who never opened it sends none at all: that is `startGame`
 * with the argument omitted, tested where the lifecycle is.)
 */
async function roomPlaying(
  t: Backend,
  ...nicknames: readonly string[]
): Promise<{ roomId: Id<'rooms'>; tokens: Record<string, string> }> {
  return await roomPlayingOn(t, {}, ...nicknames);
}

/** A room in a game the Host chose settings for, every phone's token by nickname. */
async function roomPlayingOn(
  t: Backend,
  settings: GameSettings,
  ...nicknames: readonly string[]
): Promise<{ roomId: Id<'rooms'>; tokens: Record<string, string> }> {
  const room = await roomFixture(t);
  const tokens: Record<string, string> = {};

  for (const [at, nickname] of nicknames.entries()) {
    const seated = await t.mutation(api.players.joinRoom, {
      code: room.code,
      nickname,
      avatar: AVATAR_IDS[at % AVATAR_IDS.length]!,
    });
    tokens[nickname] = seated.sessionToken;
  }

  // The first to join is the Host, and the Host is who starts a game.
  const host = tokens[nicknames[0] ?? ''];

  if (host === undefined) {
    throw new Error('a room with nobody in it has no game to play');
  }

  await t.mutation(api.games.startGame, { sessionToken: host, gameId: 'trivia', settings });

  return { roomId: room.roomId, tokens };
}

/**
 * The room plays its game out: every question answered and every reveal ended,
 * so the room arrives at the beat its Victory Screen is on.
 *
 * The beats are read back one at a time, the way the phones read them, rather
 * than driven off the module's question list — so this plays whatever the room
 * was dealt, however many questions that turns out to be.
 */
async function playToTheFinalScores(
  t: Backend,
  roomId: Id<'rooms'>,
  tokens: Record<string, string>,
): Promise<void> {
  const phones = Object.values(tokens);
  if (phones.length === 0) {
    throw new Error('a room with nobody in it has no game to play');
  }

  // A bound rather than a limit: three inline questions are six beats, and a
  // game that never finishes should fail this test instead of hanging it.
  for (let beat = 0; beat < 100; beat += 1) {
    // The room's own state: this fixture plays a game *correctly* on purpose, so
    // it needs the answers, which is exactly what no client is given while a
    // question is up (`redactStateFor`).
    const state = await t.run(async (ctx) => (await ctx.db.get(roomId))?.game?.state);

    if (state === undefined || state.phase === 'finished') {
      return;
    }

    if (state.phase === 'question') {
      // The first phone answers correctly and the rest do not, so the scoreboard
      // the Host leaves behind is one somebody actually won.
      const correct = state.questions[state.questionIndex].correctIndex;

      for (const [index, sessionToken] of phones.entries()) {
        await t.mutation(api.games.sendEvent, {
          sessionToken,
          event: {
            kind: 'answer',
            questionIndex: state.questionIndex,
            optionIndex: index === 0 ? correct : (correct + 1) % 4,
          },
        });
      }
    } else {
      // Fire the room's own deadline directly. Other clock behavior is tested
      // against the scheduler below; this helper only needs to play each beat.
      const deadline = gameLogicById('trivia')?.deadline?.(state);
      if (deadline === undefined) throw new Error('the reveal has no room clock');
      await t.mutation(internal.games.reachDeadline, {
        roomId,
        gameId: 'trivia',
        event: deadline.event,
      });
    }
  }

  throw new Error('the game never reached its final scores');
}

/** The state of the game the room is playing, or a failure if it is playing none. */
/**
 * The game state the room actually stored — read from the row, not through
 * `running`.
 *
 * `running` is a *client's* view and hands back the module's projection of it
 * (`redactStateFor`), which is a question about what a phone may see rather than
 * about what the room decided. Every rule below is about the latter, so this
 * reads the row the way the reducer wrote it. What a client sees is asserted on
 * its own, through `running`, where the redaction is the subject.
 */
async function stateOf(t: Backend, roomId: Id<'rooms'>) {
  const stored = await t.run(async (ctx) => (await ctx.db.get(roomId))?.game);

  if (stored === undefined) {
    throw new Error('this room is in its lobby, not in a game');
  }

  return stored.state;
}

/**
 * How long the module gives the room on the beat this state is on.
 *
 * Asked of the module rather than written down here, because that is what the
 * hub does: the twenty seconds are trivia's number and are pinned in trivia's
 * own tests (`QUESTION_SECONDS`). What these tests are about is that the room
 * waits exactly as long as the game it is running says, and not a beat less.
 */
function clockOn(state: unknown): number {
  const afterMs = gameLogicById('trivia')?.deadline?.(state)?.afterMs;

  if (afterMs === undefined) {
    throw new Error('this beat has no clock running on it');
  }

  return afterMs;
}

/**
 * Lets `ms` of the party go by, and runs whatever the room had scheduled for it.
 *
 * Only meaningful under fake timers — the suite below installs them, because
 * what it is about is twenty-second countdowns and a suite that waited for them
 * would take minutes to say so.
 */
async function elapse(t: Backend, ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await t.finishInProgressScheduledFunctions();
}

/** Let time pass while only the named phones keep telling the room they are present. */
async function elapseBeating(
  t: Backend,
  sessionTokens: readonly string[],
  ms: number,
): Promise<void> {
  let elapsed = 0;

  while (elapsed < ms) {
    const step = Math.min(HEARTBEAT_INTERVAL_MS, ms - elapsed);
    await vi.advanceTimersByTimeAsync(step);

    for (const sessionToken of sessionTokens) {
      await t.mutation(api.players.heartbeat, { sessionToken });
    }

    await t.finishInProgressScheduledFunctions();
    elapsed += step;
  }
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

describe('a running game when a player disconnects', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pauses when an ordinary player stops heartbeating', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');

    await elapseBeating(t, [tokens.Ada ?? ''], AWAY_AFTER_MS + 1);

    expect(await t.query(api.games.running, { roomId })).toEqual({
      kind: 'paused',
      gameId: 'trivia',
      reason: 'playerDisconnected',
    });
  });

  it('transfers Host before pausing when the disconnected player was Host', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');

    await elapseBeating(t, [tokens.Grace ?? ''], AWAY_AFTER_MS + 1);

    expect(await t.query(api.players.roster, { roomId })).toContainEqual(
      expect.objectContaining({ nickname: 'Grace', host: true, away: false }),
    );
    expect(await t.query(api.games.running, { roomId })).toMatchObject({
      kind: 'paused',
      reason: 'playerDisconnected',
    });

    await t.mutation(api.games.continueAfterDisconnect, {
      sessionToken: tokens.Grace ?? '',
    });
    expect(await t.query(api.games.running, { roomId })).toMatchObject({ kind: 'running' });
  });

  it('makes the first returning player Host when the whole party disconnected', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');

    await elapse(t, AWAY_AFTER_MS + 1);
    await t.mutation(api.players.heartbeat, { sessionToken: tokens.Grace ?? '' });

    expect(await t.query(api.players.roster, { roomId })).toContainEqual(
      expect.objectContaining({ nickname: 'Grace', host: true, away: false }),
    );
    expect(await t.query(api.games.running, { roomId })).toMatchObject({
      kind: 'paused',
      reason: 'playerDisconnected',
    });
  });

  it('ignores game input until the Host makes a recovery choice', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
    const before = await stateOf(t, roomId);

    await elapseBeating(t, [tokens.Ada ?? ''], AWAY_AFTER_MS + 1);
    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Ada ?? '',
      event: { kind: 'answer', questionIndex: 0, optionIndex: 0 },
    });

    expect(await stateOf(t, roomId)).toEqual(before);
    expect(await t.query(api.games.running, { roomId })).toMatchObject({
      kind: 'paused',
      reason: 'playerDisconnected',
    });
  });

  it('resumes the exact remainder when the Host continues below the starting minimum', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');

    await elapseBeating(t, Object.values(tokens), 1_000);
    await elapseBeating(t, [tokens.Ada ?? ''], AWAY_AFTER_MS + 1);
    const paused = await t.run(async (ctx) => (await ctx.db.get(roomId))?.game);
    const remainder = paused?.pausedRemainingMs;
    expect(remainder).toBeGreaterThan(0);

    await t.mutation(api.games.continueAfterDisconnect, {
      sessionToken: tokens.Ada ?? '',
    });

    const continued = await t.run(async (ctx) => (await ctx.db.get(roomId))?.game);
    expect(continued?.playerPaused).toBeUndefined();
    expect((continued?.deadlineAt ?? 0) - Date.now()).toBe(remainder);
    expect(await t.query(api.games.running, { roomId })).toMatchObject({ kind: 'running' });

    await elapseBeating(t, [tokens.Ada ?? ''], Math.max(0, (remainder ?? 0) - 1));
    expect((await stateOf(t, roomId)).phase).toBe('question');
    await elapseBeating(t, [tokens.Ada ?? ''], 1);
    expect((await stateOf(t, roomId)).phase).toBe('reveal');
  });

  it('resumes the exact remainder automatically when everyone returns', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');

    await elapseBeating(t, [tokens.Ada ?? ''], AWAY_AFTER_MS + 1);
    const remainder = await t.run(
      async (ctx) => (await ctx.db.get(roomId))?.game?.pausedRemainingMs,
    );

    await t.mutation(api.players.heartbeat, { sessionToken: tokens.Grace ?? '' });

    const recovered = await t.run(async (ctx) => (await ctx.db.get(roomId))?.game);
    expect(recovered?.playerPaused).toBeUndefined();
    expect(recovered?.pausedRemainingMs).toBeUndefined();
    expect((recovered?.deadlineAt ?? 0) - Date.now()).toBe(remainder);
    expect(await t.query(api.games.running, { roomId })).toMatchObject({ kind: 'running' });
  });

  it('refuses Continue from a player who is not the Host', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace', 'Linus');

    await elapseBeating(
      t,
      [tokens.Ada ?? '', tokens.Grace ?? ''],
      AWAY_AFTER_MS + 1,
    );

    expect(
      await rejectionFrom(
        t.mutation(api.games.continueAfterDisconnect, {
          sessionToken: tokens.Grace ?? '',
        }),
      ),
    ).toEqual({ kind: 'notHost' });
    expect(await t.query(api.games.running, { roomId })).toMatchObject({
      kind: 'paused',
      reason: 'playerDisconnected',
    });
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
    // Trivia opens on its first question with the room's players on the
    // scoreboard in roster order — which is what says the module's own factory
    // ran, and that the hub did not invent a state of its own. The rest of that
    // state is trivia's business and is tested where its rules are.
    expect(runningState(running).phase).toBe('question');
    expect(runningState(running).standings).toEqual(
      roster.map((seat) => ({ playerId: seat.playerId, score: 0 })),
    );
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
    expect(await t.query(api.games.running, { roomId })).toMatchObject({
      kind: 'running',
      gameId: started?.gameId,
      state: runningState(started),
    });
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
    const room = await roomFixture(t);
    // One phone in the room, and trivia declares itself 2–10.
    const alone = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada', avatar: 'fox' });

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
    const room = await roomFixture(t);
    const alone = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada', avatar: 'fox' });
    await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace', avatar: 'green-alien' });

    // The refusal has a remedy, and this is it. The symmetric too-large gate
    // is covered in game-core because every installed game currently shares
    // the room's maximum of ten seats.
    await t.mutation(api.games.startGame, { sessionToken: alone.sessionToken, gameId: 'trivia' });

    expect(await t.query(api.games.running, { roomId: room.roomId })).not.toBeNull();
  });

  /**
   * The questions the installed module deals for these settings, asked of the
   * module itself.
   *
   * The hub cannot check that a room was dealt "five Movies questions" — it
   * cannot read a game's state, and nothing here knows what a question is. What
   * it can check is that the room holds exactly what the module makes of the
   * settings the Host sent, which is the whole of "started from them".
   */
  function questionsDealtFor(chosen: GameSettings | undefined): readonly string[] {
    const game = gameLogicById('trivia');

    if (game === undefined) {
      throw new Error('this build installs no trivia');
    }

    const state = game.createInitialState({
      players: [],
      settings: settingsFrom(game.settingsSchema, chosen),
    }) as { readonly questions: readonly { readonly text: string }[] };

    return state.questions.map((question) => question.text);
  }

  /**
   * The questions the room is actually holding, by the same measure — read from
   * the row, since what a client is shown mid-question is deliberately not the
   * deal (`redactStateFor` withholds the questions the room has not reached).
   */
  async function questionsInPlay(t: Backend, roomId: Id<'rooms'>): Promise<readonly string[]> {
    const stored = await t.run(async (ctx) => (await ctx.db.get(roomId))?.game);
    const questions = stored?.state.questions as readonly { readonly text: string }[] | undefined;

    if (questions === undefined) {
      throw new Error('this room is not playing anything');
    }

    return questions.map((question) => question.text);
  }

  it('starts on the schema’s defaults when the Host chose nothing', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);

    await t.mutation(api.games.startGame, { sessionToken: host, gameId: 'trivia' });

    // A Host who never opened the settings screen still starts a game, and it
    // is the game the module's own defaults describe.
    expect(await questionsInPlay(t, roomId)).toEqual(questionsDealtFor(undefined));
  });

  it('starts on exactly the settings the Host chose', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);
    const chosen = { category: 'Movies', questionCount: '5' };

    await t.mutation(api.games.startGame, {
      sessionToken: host,
      gameId: 'trivia',
      settings: chosen,
    });

    const inPlay = await questionsInPlay(t, roomId);

    expect(inPlay).toHaveLength(5);
    expect(inPlay).toEqual(questionsDealtFor(chosen));
    // And not the game the defaults would have dealt, or the assertion above
    // would pass on a hub that ignored the Host entirely.
    expect(inPlay).not.toEqual(questionsDealtFor(undefined));
  });

  it('takes settings from nobody but the Host', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host, guest } = await roomWithParty(t);

    // The settings screen is the Host's, and this is what makes that true
    // rather than drawn: a phone with no room control can send a schema's own
    // values and still change nothing about the room it is in.
    expect(
      await rejectionFrom(
        t.mutation(api.games.startGame, {
          sessionToken: guest,
          gameId: 'trivia',
          settings: { category: 'Movies', questionCount: '5' },
        }),
      ),
    ).toEqual({ kind: 'notHost' });
    expect(await t.query(api.games.running, { roomId })).toBeNull();

    await t.mutation(api.games.startGame, { sessionToken: host, gameId: 'trivia' });

    // And when the room does start, it starts on the Host's settings — the
    // defaults here — with no trace of what the other phone asked for.
    expect(await questionsInPlay(t, roomId)).toEqual(questionsDealtFor(undefined));
  });

  it('defaults every setting the Host left alone', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);

    await t.mutation(api.games.startGame, {
      sessionToken: host,
      gameId: 'trivia',
      settings: { category: 'Movies' },
    });

    // The count was never sent, so the room is dealt the schema's own.
    expect(await questionsInPlay(t, roomId)).toEqual(questionsDealtFor({ category: 'Movies' }));
    expect(await questionsInPlay(t, roomId)).toHaveLength(10);
  });

  it('refuses a value the game’s schema does not offer', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);

    expect(
      await rejectionFrom(
        t.mutation(api.games.startGame, {
          sessionToken: host,
          gameId: 'trivia',
          settings: { questionCount: '7' },
        }),
      ),
    ).toEqual({ kind: 'settingRejected', key: 'questionCount', value: '7' });

    // Refused means nothing happened: the room did not start on a default it
    // was never asked for.
    expect(await t.query(api.games.running, { roomId })).toBeNull();
  });

  it('refuses settings that the selected custom mode does not expose', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);

    await t.mutation(api.games.selectGame, { sessionToken: host, gameId: 'trivia', mode: 'standard' });

    expect(
      await rejectionFrom(
        t.mutation(api.games.configureGame, {
          sessionToken: host,
          mode: 'custom',
          settings: { scoring: 'speed' },
        }),
      ),
    ).toEqual({ kind: 'settingRejected', key: 'scoring', value: 'speed' });

    expect(await t.query(api.games.setup, { roomId })).toMatchObject({ mode: 'standard' });

    expect(
      await rejectionFrom(
        t.mutation(api.games.configureGame, {
          sessionToken: host,
          mode: 'custom',
          settings: { scoring: 'flat', questionSeconds: '15' },
        }),
      ),
    ).toEqual({ kind: 'settingRejected', key: 'questionSeconds', value: '15' });
  });

  it('accepts the newly declared difficulty setting', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);

    await t.mutation(api.games.startGame, {
      sessionToken: host,
      gameId: 'trivia',
      settings: { difficulty: 'hard' },
    });
    expect(await t.query(api.games.running, { roomId })).not.toBeNull();
  });

  it('tells a party too small that, before it tells them about a setting', async () => {
    const t = convexTest(schema, modules);
    const room = await roomFixture(t);
    const alone = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada', avatar: 'fox' });

    expect(
      await rejectionFrom(
        t.mutation(api.games.startGame, {
          sessionToken: alone.sessionToken,
          gameId: 'trivia',
          settings: { questionCount: '7' },
        }),
      ),
    ).toEqual({ kind: 'notEnoughPlayers', need: 2, have: 1 });
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

  it('brings a played-out game back to the same roster, and leaves its scores behind', async () => {
    const t = convexTest(schema, modules);
    const room = await roomFixture(t);
    const tokens: Record<string, string> = {};

    for (const [nickname, avatar] of [
      ['Ada', 'fox'],
      ['Grace', 'green-alien'],
      ['Linus', 'pink-bunny'],
    ] as const) {
      const seated = await t.mutation(api.players.joinRoom, {
        code: room.code,
        nickname,
        avatar,
      });
      tokens[nickname] = seated.sessionToken;
    }

    const host = tokens.Ada ?? '';
    const lobby = await t.query(api.players.roster, { roomId: room.roomId });

    await t.mutation(api.games.startGame, { sessionToken: host, gameId: 'trivia' });
    await playToTheFinalScores(t, room.roomId, tokens);

    // The game really was played: somebody is ahead on the scoreboard the Host
    // is about to leave, which is what makes the assertions below mean anything.
    const played = await t.query(api.games.running, { roomId: room.roomId });
    expect(runningState(played).phase).toBe('finished');
    expect(runningState(played).standings[0]!.score).toBeGreaterThan(0);

    await t.mutation(api.games.endGame, { sessionToken: host });

    expect(await t.query(api.games.running, { roomId: room.roomId })).toBeNull();
    // "The same roster" is the AC's own words, and this is the whole of what one
    // holds: the same seats in the same order, with the nicknames and the
    // avatars they had in the lobby, and the same Host among them.
    expect(await t.query(api.players.roster, { roomId: room.roomId })).toEqual(lobby);
    // The scores do not follow anybody back. They were only ever in
    // `game.state`, which is the field ending clears — so the next game starts
    // from the module's factory and not from what the last one left. Read as a
    // boolean because `t.run` hands an absent field back as `null`.
    const stillHoldsAGame = await t.run(async (ctx) => {
      const row = await ctx.db.get(room.roomId);

      return row !== null && row.game !== undefined;
    });

    expect(stillHoldsAGame).toBe(false);
  });

  it('ends a beat the room has no other way out of', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');

    for (const sessionToken of Object.values(tokens)) {
      await t.mutation(api.games.sendEvent, {
        sessionToken,
        event: { kind: 'answer', questionIndex: 0, optionIndex: 0 },
      });
    }

    // The room is on a Reveal. Ending the game here proves the Host control is
    // available throughout play, not only from the final standings.
    expect(runningState(await t.query(api.games.running, { roomId })).phase).toBe('reveal');

    await t.mutation(api.games.endGame, { sessionToken: tokens.Ada ?? '' });

    expect(await t.query(api.games.running, { roomId })).toBeNull();
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

/**
 * The one mutation a running game's events travel on.
 *
 * It is the hub's whole part in playing a game: it says which player an event
 * came from and stores whatever the module's rules make of it. Every rule the
 * events below meet is trivia's, tested where trivia's rules are — what is
 * tested here is that the hub carries them faithfully and adds nothing.
 */
describe('a player’s event in the running game', () => {
  it('reaches the module’s rules, and the room keeps what they decide', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
    const grace = await playerIdOf(t, roomId, 'Grace');

    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Grace ?? '',
      event: { kind: 'answer', questionIndex: 0, optionIndex: 2 },
    });

    // Read as Grace: an answer is that player's own until the Reveal, so hers is
    // the view her option index survives in (see the redaction tests below).
    const running = await t.query(api.games.running, {
      roomId,
      sessionToken: tokens.Grace ?? '',
    });
    expect(runningState(running).answers).toEqual({ [grace]: 2 });
  });

  it('names the player from the Session Token, never from the phone', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
    const ada = await playerIdOf(t, roomId, 'Ada');
    const grace = await playerIdOf(t, roomId, 'Grace');

    // A phone naming somebody else is a claim, and the hub does not believe
    // it: the answer is recorded against the seat the token holds.
    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Grace ?? '',
      event: { kind: 'answer', playerId: ada, questionIndex: 0, optionIndex: 1 },
    });

    const running = await t.query(api.games.running, {
      roomId,
      sessionToken: tokens.Grace ?? '',
    });
    expect(runningState(running).answers).toEqual({ [grace]: 1 });
  });

  it('cannot forge the room clock to skip a beat', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
    const before = await t.run(async (ctx) => (await ctx.db.get(roomId))?.game);

    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Ada ?? '',
      event: { kind: 'advance', questionIndex: 0, phase: 'question' },
    });

    const after = await t.run(async (ctx) => (await ctx.db.get(roomId))?.game);
    expect(after).toEqual(before);
  });

  it('lets a second tap change nothing', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
    const grace = await playerIdOf(t, roomId, 'Grace');

    for (const optionIndex of [2, 0]) {
      await t.mutation(api.games.sendEvent, {
        sessionToken: tokens.Grace ?? '',
        event: { kind: 'answer', questionIndex: 0, optionIndex },
      });
    }

    // The rule is the reducer's; what this says is that the hub does not
    // overwrite an answer on its way past.
    const running = await t.query(api.games.running, {
      roomId,
      sessionToken: tokens.Grace ?? '',
    });
    expect(runningState(running).answers).toEqual({ [grace]: 2 });
  });

  it('does not restart a missing clock for an event the rules refuse', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');

    // Model a valid game written before its scheduler fields landed. A stale
    // event is a reducer no-op and must not turn into the write that repairs the
    // clock: only a state transition may arm the next beat.
    await t.run(async (ctx) => {
      const room = await ctx.db.get(roomId);
      if (room?.game === undefined) throw new Error('expected a running game');
      if (room.game.deadline !== undefined) await ctx.scheduler.cancel(room.game.deadline);
      await ctx.db.patch(roomId, {
        game: { ...room.game, deadline: undefined, deadlineAt: undefined },
      });
    });

    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Grace ?? '',
      event: { kind: 'answer', questionIndex: 99, optionIndex: 0 },
    });

    const stored = await t.run(async (ctx) => (await ctx.db.get(roomId))?.game);
    expect(stored?.deadline).toBeUndefined();
    expect(stored?.deadlineAt).toBeUndefined();
  });

  /**
   * What the room broadcasts of a game in flight, and to whom.
   *
   * The scope's "private player state stays private while shared state appears
   * on the TV" (docs/project-scope.md), at the one place it is decided: the room
   * stores a game's state whole and `running` hands each client only what the
   * module says that client may see. Trivia's secret is a live answer, so these
   * are about the wire and not about any screen — no screen ever drew another
   * player's choice, and the payload it was drawn from carried it anyway.
   */
  describe('a game in flight is broadcast redacted', () => {
    // Trivia's stand-in for a hidden answer, written out rather than imported:
    // the hub does not depend on any game module, and a test of the hub that
    // imported one would be the only thing in `convex/` that names a game.
    const HIDDEN_ANSWER = -1;

    it('keeps one player’s answer off every other phone, and off the TV', async () => {
      const t = convexTest(schema, modules);
      const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
      const grace = await playerIdOf(t, roomId, 'Grace');

      await t.mutation(api.games.sendEvent, {
        sessionToken: tokens.Grace ?? '',
        event: { kind: 'answer', questionIndex: 0, optionIndex: 2 },
      });

      // The television presents no token: it is nobody, and is owed nobody's
      // private state.
      const onTv = await t.query(api.games.running, { roomId });
      // Ada is in the room and still answering. She learns that Grace is in —
      // the "1/2 answered" count is those keys — and not what she chose.
      const onAdasPhone = await t.query(api.games.running, {
        roomId,
        sessionToken: tokens.Ada ?? '',
      });

      expect(runningState(onTv).answers).toEqual({ [grace]: HIDDEN_ANSWER });
      expect(runningState(onAdasPhone).answers).toEqual({ [grace]: HIDDEN_ANSWER });
      // The count the TV draws is unmoved by the hiding: it is the keys.
      expect(Object.keys(runningState(onTv).answers ?? {})).toEqual([grace]);
    });

    it('shows a player their own answer', async () => {
      const t = convexTest(schema, modules);
      const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
      const grace = await playerIdOf(t, roomId, 'Grace');

      await t.mutation(api.games.sendEvent, {
        sessionToken: tokens.Grace ?? '',
        event: { kind: 'answer', questionIndex: 0, optionIndex: 2 },
      });

      // Her phone draws its Locked In button off this, so it is the one copy the
      // option survives in.
      const onHerPhone = await t.query(api.games.running, {
        roomId,
        sessionToken: tokens.Grace ?? '',
      });

      expect(runningState(onHerPhone).answers).toEqual({ [grace]: 2 });
    });

    it('gives a token from another room the television’s view', async () => {
      const t = convexTest(schema, modules);
      const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
      const grace = await playerIdOf(t, roomId, 'Grace');
      // A phone seated in a different party, presenting a token that is real and
      // is nobody here.
      const elsewhere = await roomPlaying(t, 'Linus', 'Ken');

      await t.mutation(api.games.sendEvent, {
        sessionToken: tokens.Grace ?? '',
        event: { kind: 'answer', questionIndex: 0, optionIndex: 2 },
      });

      const seen = await t.query(api.games.running, {
        roomId,
        sessionToken: elsewhere.tokens.Linus ?? '',
      });

      expect(runningState(seen).answers).toEqual({ [grace]: HIDDEN_ANSWER });
    });

    it('keeps the answers to the questions off every client', async () => {
      const t = convexTest(schema, modules);
      const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');

      // Read as a seated player, which is the most any client is entitled to.
      const seen = await t.query(api.games.running, {
        roomId,
        sessionToken: tokens.Ada ?? '',
      });

      // The whole game is dealt at `startGame`, so without this the first
      // payload of the first question carries every answer to every question —
      // a client that reads its own socket wins the game.
      const correctIndexes = runningState(seen).questions.map(
        (question: { correctIndex: number }) => question.correctIndex,
      );

      expect(correctIndexes).not.toHaveLength(0);
      expect(correctIndexes.every((index: number) => index < 0)).toBe(true);
      // And the questions the room has not reached carry no text to read ahead.
      expect(runningState(seen).questions[1]!.text).toBe('');
    });

    it('keeps the rest of the game off the wire at the reveal too', async () => {
      const t = convexTest(schema, modules);
      const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');

      // Both answer, which ends the question and puts the room on its reveal —
      // the beat a client would otherwise only have to wait five seconds for.
      for (const nickname of ['Ada', 'Grace']) {
        await t.mutation(api.games.sendEvent, {
          sessionToken: tokens[nickname] ?? '',
          event: { kind: 'answer', questionIndex: 0, optionIndex: 0 },
        });
      }

      const seen = await t.query(api.games.running, {
        roomId,
        sessionToken: tokens.Grace ?? '',
      });

      expect(runningState(seen).phase).toBe('reveal');
      // The question just revealed gives up its answer, because that is what a
      // reveal is; the ones the room has not reached give up nothing.
      expect(runningState(seen).questions[0]!.correctIndex).toBeGreaterThanOrEqual(0);
      expect(runningState(seen).questions[1]!.text).toBe('');
      expect(runningState(seen).questions[1]!.correctIndex).toBeLessThan(0);
    });

    it('reveals every answer once the question is over', async () => {
      const t = convexTest(schema, modules);
      const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
      const ada = await playerIdOf(t, roomId, 'Ada');
      const grace = await playerIdOf(t, roomId, 'Grace');

      // Both phones answer, which is what ends the question: the reveal is the
      // beat these options stop being private on.
      for (const [nickname, optionIndex] of [
        ['Ada', 1],
        ['Grace', 2],
      ] as const) {
        await t.mutation(api.games.sendEvent, {
          sessionToken: tokens[nickname] ?? '',
          event: { kind: 'answer', questionIndex: 0, optionIndex },
        });
      }

      // Read as the television, which is owed the least of any client.
      const onTv = await t.query(api.games.running, { roomId });

      expect(runningState(onTv).phase).toBe('reveal');
      expect(runningState(onTv).answers).toEqual({ [ada]: 1, [grace]: 2 });
    });

    it('scores a hidden answer in full', async () => {
      const t = convexTest(schema, modules);
      const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
      const grace = await playerIdOf(t, roomId, 'Grace');
      // The right answer to the question the room was actually dealt.
      const { questions } = await stateOf(t, roomId);
      const correctIndex = questions[0].correctIndex;

      await t.mutation(api.games.sendEvent, {
        sessionToken: tokens.Grace ?? '',
        event: { kind: 'answer', questionIndex: 0, optionIndex: correctIndex },
      });
      // Ada answers too, which is what ends the question — the last answer in
      // reveals it, so this needs no clock.
      await t.mutation(api.games.sendEvent, {
        sessionToken: tokens.Ada ?? '',
        event: { kind: 'answer', questionIndex: 0, optionIndex: correctIndex === 0 ? 1 : 0 },
      });

      // Redaction is a projection for reading and never reaches the rules: the
      // reveal runs on the state the room stored, so an answer hidden from the
      // room still scores.
      const onTv = await t.query(api.games.running, { roomId });
      const scored = runningState(onTv).standings.find(
        (standing: { playerId: string }) => standing.playerId === grace,
      );

      expect(scored?.score).toBeGreaterThan(0);
    });
  });

  it('takes a whole party answering at once', async () => {
    const t = convexTest(schema, modules);
    const party = ['Ada', 'Grace', 'Linus', 'Ken', 'Barbara'];
    const { roomId, tokens } = await roomPlaying(t, ...party);

    // Every answer is in flight before any of them commits — the scope's
    // "simultaneous answers without races", against the transaction that is
    // supposed to make it true.
    await Promise.all(
      party.map((nickname, optionIndex) =>
        t.mutation(api.games.sendEvent, {
          sessionToken: tokens[nickname] ?? '',
          event: { kind: 'answer', questionIndex: 0, optionIndex: optionIndex % 4 },
        }),
      ),
    );

    const running = await t.query(api.games.running, { roomId });
    expect(Object.keys(runningState(running).answers ?? {})).toHaveLength(party.length);
    // The last answer ends the question, which is only reached if none of the
    // five was lost on the way in.
    expect(runningState(running).phase).toBe('reveal');
  });

  it('does nothing at all in a room that is between games', async () => {
    const t = convexTest(schema, modules);
    const { roomId, guest } = await roomWithParty(t);

    // A thumb that landed just after the Host ended the game. There is nothing
    // to tell the person holding the phone — the screen they are on has
    // already gone — so this is silence rather than a refusal.
    await t.mutation(api.games.sendEvent, {
      sessionToken: guest,
      event: { kind: 'answer', questionIndex: 0, optionIndex: 0 },
    });

    expect(await t.query(api.games.running, { roomId })).toBeNull();
  });

  it('stores nothing when the module makes nothing of the event', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
    const started = await t.query(api.games.running, { roomId });

    // A phone that is behind — or one that is lying. A module that does not
    // recognise an event returns no state at all, and storing that would let
    // one such event erase the game the room is playing.
    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Grace ?? '',
      event: { kind: 'not-an-event-trivia-knows' },
    });

    expect(await t.query(api.games.running, { roomId })).toMatchObject({
      kind: 'running',
      gameId: started?.gameId,
      state: runningState(started),
    });
  });

  it('refuses a phone whose seat is gone', async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await roomPlaying(t, 'Ada', 'Grace');

    expect(
      await rejectionFrom(
        t.mutation(api.games.sendEvent, {
          sessionToken: 'a-token-no-seat-holds',
          event: { kind: 'answer', questionIndex: 0, optionIndex: 0 },
        }),
      ),
    ).toEqual({ kind: 'notInRoom' });
    expect(runningState(await t.query(api.games.running, { roomId })).answers).toEqual({});
  });

  it('is open to every player, not only the Host', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');

    // The lifecycle is Host-only; playing the game is not. A game that only
    // the Host could act in would not be a party game.
    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Ada ?? '',
      event: { kind: 'answer', questionIndex: 0, optionIndex: 0 },
    });
    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Grace ?? '',
      event: { kind: 'answer', questionIndex: 0, optionIndex: 0 },
    });

    expect(Object.keys(runningState(await t.query(api.games.running, { roomId })).answers ?? {}))
      .toHaveLength(2);
  });
});

describe('fail-closed runtime boundaries', () => {
  it('returns unavailable and never raw state for an unknown game', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
    const raw = { secret: 'must-not-cross-the-wire' };

    await t.run(async (ctx) => {
      const room = await ctx.db.get(roomId);
      if (room?.game === undefined) throw new Error('expected a running game');
      await ctx.db.patch(roomId, {
        game: { ...room.game, gameId: 'removed-game', stateVersion: 1, state: raw },
      });
    });

    const response = await t.query(api.games.running, { roomId });
    expect(response).toEqual({ kind: 'unavailable', gameId: 'removed-game' });
    expect(JSON.stringify(response)).not.toContain('must-not-cross-the-wire');

    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Ada ?? '',
      event: { kind: 'anything' },
    });
    expect(await t.run(async (ctx) => (await ctx.db.get(roomId))?.game?.state)).toEqual(raw);
  });

  it('treats a wrong decoder version as unavailable without advancing it', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');

    await t.run(async (ctx) => {
      const room = await ctx.db.get(roomId);
      if (room?.game === undefined) throw new Error('expected a running game');
      await ctx.db.patch(roomId, { game: { ...room.game, stateVersion: 99 } });
    });

    expect(await t.query(api.games.running, { roomId })).toEqual({
      kind: 'unavailable',
      gameId: 'trivia',
    });
    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Grace ?? '',
      event: { kind: 'answer', questionIndex: 0, optionIndex: 0 },
    });
    expect(await t.run(async (ctx) => (await ctx.db.get(roomId))?.game?.stateVersion)).toBe(99);
  });
});

/**
 * The room's own clock — the half of a Question Timer that the module cannot
 * carry, since a reducer has no clock and a television cannot speak.
 *
 * Every test here runs against the real scheduler convex-test emulates, with
 * time faked: a countdown suite that waited twenty real seconds a test would
 * cost more than the thing it protects. What is being asserted is that the room
 * moves on *by itself* — no phone sends anything below except an answer — which
 * is the whole point of moving this beat off the phones.
 */
describe('the clock a question runs on', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** The option that scores, for the question the room is on. */
  function correctAnswerTo(state: { questions: { correctIndex: number }[]; questionIndex: number }) {
    return state.questions[state.questionIndex]?.correctIndex ?? 0;
  }

  it('reveals the question when its time runs out, scoring nothing for whoever did not answer', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
    const ada = await playerIdOf(t, roomId, 'Ada');
    const grace = await playerIdOf(t, roomId, 'Grace');
    const asked = await stateOf(t, roomId);

    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Ada ?? '',
      event: { kind: 'answer', questionIndex: 0, optionIndex: correctAnswerTo(asked) },
    });

    // A second short of the deadline: the room is still waiting on connected
    // but idle Grace.
    await elapseBeating(t, Object.values(tokens), clockOn(asked) - 1000);
    expect((await stateOf(t, roomId)).phase).toBe('question');

    await elapseBeating(t, Object.values(tokens), 1000);

    const revealed = await stateOf(t, roomId);

    expect(revealed.phase).toBe('reveal');
    // Grace scores what a wrong answer scores. Nothing on any phone sent this
    // — the room ended the question on its own.
    expect(revealed.standings).toEqual([
      { playerId: ada, score: 100 },
      { playerId: grace, score: 0 },
    ]);
  });

  it('reveals as soon as everybody has answered and advances without a phone timer', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
    const asked = await stateOf(t, roomId);

    for (const sessionToken of [tokens.Ada ?? '', tokens.Grace ?? '']) {
      await t.mutation(api.games.sendEvent, {
        sessionToken,
        event: { kind: 'answer', questionIndex: 0, optionIndex: correctAnswerTo(asked) },
      });
    }

    expect((await stateOf(t, roomId)).phase).toBe('reveal');

    // The question clock that was armed at start was cancelled when the final
    // answer moved the room into reveal. The server owns the reveal clock too:
    // no phone timer/event is needed to advance the room.
    const revealed = await stateOf(t, roomId);
    expect(revealed.phase).toBe('reveal');
    expect(revealed.questionIndex).toBe(0);

    await elapseBeating(t, Object.values(tokens), clockOn(revealed));

    const next = await stateOf(t, roomId);
    expect(next.phase).toBe('question');
    expect(next.questionIndex).toBe(1);
  });

  it('does not give a question more time because somebody answered it', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
    const asked = await stateOf(t, roomId);

    // A thumb landing with a second to spare. The countdown belongs to the
    // question, not to the last thing that happened during it — a clock re-armed
    // on every answer would be a question a party could keep alive forever.
    await elapseBeating(t, Object.values(tokens), clockOn(asked) - 1000);
    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Ada ?? '',
      event: { kind: 'answer', questionIndex: 0, optionIndex: correctAnswerTo(asked) },
    });
    await elapseBeating(t, Object.values(tokens), 1000);

    expect((await stateOf(t, roomId)).phase).toBe('reveal');
  });

  it('starts a fresh clock on the question after the reveal', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');

    await elapseBeating(t, Object.values(tokens), clockOn(await stateOf(t, roomId)));
    await elapseBeating(t, Object.values(tokens), clockOn(await stateOf(t, roomId)));

    const second = await stateOf(t, roomId);

    expect(second.questionIndex).toBe(1);
    expect(second.phase).toBe('question');

    await elapseBeating(t, Object.values(tokens), clockOn(second) - 1000);
    expect((await stateOf(t, roomId)).phase).toBe('question');

    await elapseBeating(t, Object.values(tokens), 1000);

    const revealed = await stateOf(t, roomId);

    expect(revealed.phase).toBe('reveal');
    expect(revealed.questionIndex).toBe(1);
  });

  it('winds a clock for a beat that is running without one', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
    const asked = await stateOf(t, roomId);

    // A question on screen with nothing pending on it. Trivia cannot reach this
    // by itself — its deadline always leaves the beat — but the hub is generic
    // and two things do: a module whose deadline ticks without moving the beat,
    // and a room dealt its question by a deployment older than the field this
    // clock is stored in. Both would stop counting in silence.
    await t.run(async (ctx) => {
      const room = await ctx.db.get(roomId);

      if (room?.game?.deadline === undefined) {
        throw new Error('a question on screen should have a clock pending on it');
      }

      await ctx.scheduler.cancel(room.game.deadline);
      await ctx.db.patch(roomId, {
        game: { ...room.game, deadline: undefined, deadlineAt: undefined },
      });
    });

    await t.mutation(api.games.sendEvent, {
      sessionToken: tokens.Ada ?? '',
      event: { kind: 'answer', questionIndex: 0, optionIndex: correctAnswerTo(asked) },
    });
    await elapseBeating(t, Object.values(tokens), clockOn(asked));

    expect((await stateOf(t, roomId)).phase).toBe('reveal');
  });

  /**
   * The room timing an event against its own clock, which is the half of speed
   * scoring the module cannot carry: a reducer may not read a clock, so what a
   * second was worth has to arrive with the event (`GameEvent.msRemaining`).
   *
   * What the points mean is trivia's and is tested where trivia's rules are.
   * What is asserted here is that the room times an answer by the clock it is
   * actually running, and by nothing a phone says about itself.
   */
  describe('and the answers it times', () => {
    it('hands the rules what the room’s clock had left', async () => {
      const t = convexTest(schema, modules);
      const { roomId, tokens } = await roomPlayingOn(t, { scoring: 'speed' }, 'Ada', 'Grace');
      const ada = await playerIdOf(t, roomId, 'Ada');
      const asked = await stateOf(t, roomId);

      // Five seconds of thinking, so fifteen of the twenty are left: trivia
      // prices that at 100 + 75, and it can only know it from the hub.
      await elapseBeating(t, Object.values(tokens), 5_000);
      await t.mutation(api.games.sendEvent, {
        sessionToken: tokens.Ada ?? '',
        event: { kind: 'answer', questionIndex: 0, optionIndex: correctAnswerTo(asked) },
      });
      // Grace remains connected but sends no answer; the room ends the question itself.
      await elapseBeating(t, Object.values(tokens), clockOn(asked) - 5_000);

      const revealed = await stateOf(t, roomId);

      expect(revealed.phase).toBe('reveal');
      expect(revealed.standings).toContainEqual({ playerId: ada, score: 175 });
    });

    it('never believes a phone about how fast it was', async () => {
      const t = convexTest(schema, modules);
      const { roomId, tokens } = await roomPlayingOn(t, { scoring: 'speed' }, 'Ada', 'Grace');
      const ada = await playerIdOf(t, roomId, 'Ada');
      const asked = await stateOf(t, roomId);

      await elapseBeating(t, Object.values(tokens), 15_000);
      // A phone claiming the whole question was still on the clock. The hub
      // writes this field over whatever arrived, exactly as it does the player,
      // so the answer is scored on the five seconds that were really left.
      await t.mutation(api.games.sendEvent, {
        sessionToken: tokens.Ada ?? '',
        event: {
          kind: 'answer',
          questionIndex: 0,
          optionIndex: correctAnswerTo(asked),
          msRemaining: clockOn(asked),
        },
      });
      await elapseBeating(t, Object.values(tokens), clockOn(asked) - 15_000);

      expect((await stateOf(t, roomId)).standings).toContainEqual({ playerId: ada, score: 125 });
    });
  });

  /**
   * The room telling the rules who it has stopped hearing from, which is the
   * half of "games never wait for an away player" a module cannot carry:
   * presence is on the room's players and changes without any game event, so
   * who is Away has to arrive with the event (`GameEvent.awayPlayerIds`).
   *
   * What a game makes of it is that game's business and is tested where its
   * rules are. What is asserted here is that the room reads the away flags it
   * keeps, and reads nothing a phone says about anybody's presence.
   */
  describe('and the away players it names', () => {
    it('hands the rules the seats the room has stopped hearing from', async () => {
      const t = convexTest(schema, modules);
      const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
      const grace = await playerIdOf(t, roomId, 'Grace');
      const asked = await stateOf(t, roomId);

      // Grace's phone is face-down on the table, so the room has marked her
      // away — exactly what `markAway` writes when a Heartbeat stops.
      await t.run(async (ctx) => {
        await ctx.db.patch(grace as Id<'players'>, { away: true });
      });
      await t.mutation(api.games.sendEvent, {
        sessionToken: tokens.Ada ?? '',
        event: { kind: 'answer', questionIndex: 0, optionIndex: correctAnswerTo(asked) },
      });

      // Revealed on Ada's answer alone, with the whole question still on the
      // clock: a room with one quiet phone does not sit out every countdown.
      expect((await stateOf(t, roomId)).phase).toBe('reveal');
    });

    it('never believes a phone about who is away', async () => {
      const t = convexTest(schema, modules);
      const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
      const grace = await playerIdOf(t, roomId, 'Grace');
      const asked = await stateOf(t, roomId);

      // A phone writing Grace out of the question it is answering. The hub
      // writes this field over whatever arrived, as it does the player and the
      // clock, so the room goes on waiting for the phone it is hearing from.
      await t.mutation(api.games.sendEvent, {
        sessionToken: tokens.Ada ?? '',
        event: {
          kind: 'answer',
          questionIndex: 0,
          optionIndex: correctAnswerTo(asked),
          awayPlayerIds: [grace],
        },
      });

      expect((await stateOf(t, roomId)).phase).toBe('question');
    });
  });

  it('stops with the game, so a room that starts another gets its full time', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlaying(t, 'Ada', 'Grace');
    const clock = clockOn(await stateOf(t, roomId));

    await elapse(t, clock - 1000);
    await t.mutation(api.games.endGame, { sessionToken: tokens.Ada ?? '' });
    await t.mutation(api.games.startGame, { sessionToken: tokens.Ada ?? '', gameId: 'trivia' });

    // The first game's clock comes due a second from now, addressed to question
    // one of a game that is over — and the new game is on question one too, so
    // the address alone cannot save it. Ending a game has to stop its clock, or
    // a Host who restarts one watches its first question reveal itself early.
    await elapse(t, clock - 1000);
    expect((await stateOf(t, roomId)).phase).toBe('question');

    await elapse(t, 1000);
    expect((await stateOf(t, roomId)).phase).toBe('reveal');
  });
});

describe('the carousel the Host browses', () => {
  it('reports no card at all in a room nobody has browsed in', async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await roomWithParty(t);

    // Not card zero. The television's Room screen — code, QR and roster
    // together — stands until the Host takes over the carousel, so "nobody has
    // browsed yet" has to survive the trip to a client rather than being
    // flattened into the first card here.
    expect(await t.query(api.games.browsing, { roomId })).toBeNull();
  });

  it('remembers where the Host browsed to, first card included', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);

    await t.mutation(api.games.browseGame, { sessionToken: host, index: 0 });

    // Zero rather than null: the Host browsing *to* the first card is a
    // different fact from nobody having browsed, and it is the one that moves
    // the television off its Room screen.
    expect(await t.query(api.games.browsing, { roomId })).toBe(0);
  });

  it('clamps an index this build does not install', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);

    // A phone browsing past what this deployment has installed gets the nearest
    // card, not an error on a television.
    await t.mutation(api.games.browseGame, { sessionToken: host, index: 99 });

    expect(await t.query(api.games.browsing, { roomId })).toBe(GAME_REGISTRY.length - 1);
  });

  it('refuses a phone that is not the Host', async () => {
    const t = convexTest(schema, modules);
    const { roomId, guest } = await roomWithParty(t);

    // One shared surface: a room where anybody could move it is a room where
    // nobody could read it.
    expect(
      await rejectionFrom(t.mutation(api.games.browseGame, { sessionToken: guest, index: 0 })),
    ).toEqual({ kind: 'notHost' });
    expect(await t.query(api.games.browsing, { roomId })).toBeNull();
  });

  it('leaves a running game alone', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);

    await t.mutation(api.games.startGame, { sessionToken: host, gameId: 'trivia' });
    const running = await t.query(api.games.running, { roomId });

    // Browsing mid-game is harmless lobby furniture, not a refusal for a Host
    // whose thumb was still on the arrows as the game started.
    await t.mutation(api.games.browseGame, { sessionToken: host, index: 0 });

    expect(await t.query(api.games.running, { roomId })).toMatchObject({
      kind: 'running',
      gameId: running?.gameId,
      state: runningState(running),
    });
  });
});

describe('the shared game setup draft', () => {
  it('selects a preset, mirrors configuration, and starts atomically', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host } = await roomWithParty(t);

    await t.mutation(api.games.selectGame, { sessionToken: host, gameId: 'trivia', mode: 'quick' });
    expect(await t.query(api.games.setup, { roomId })).toMatchObject({
      gameId: 'trivia',
      mode: 'quick',
      settings: { questionCount: '5', difficulty: 'mixed', questionSeconds: '15' },
    });

    await t.mutation(api.games.configureGame, {
      sessionToken: host,
      settings: { questionCount: '15', difficulty: 'hard', questionSeconds: '30', category: 'Movies' },
      mode: 'custom',
    });
    expect(await t.query(api.games.setup, { roomId })).toMatchObject({
      mode: 'custom',
      settings: { questionCount: '15', difficulty: 'hard', questionSeconds: '30', category: 'Movies' },
    });

    await t.mutation(api.games.startGame, { sessionToken: host });
    expect(await t.query(api.games.setup, { roomId })).toBeNull();
    expect(await t.query(api.games.running, { roomId })).toMatchObject({
      kind: 'running',
      gameId: 'trivia',
      settings: { questionCount: '15', difficulty: 'hard', questionSeconds: '30', category: 'Movies' },
      mode: 'custom',
    });
  });

  it('is Host-only and can be cancelled while the TV is away', async () => {
    const t = convexTest(schema, modules);
    const { roomId, host, guest } = await roomWithParty(t);

    expect(
      await rejectionFrom(t.mutation(api.games.selectGame, { sessionToken: guest, gameId: 'trivia' })),
    ).toEqual({ kind: 'notHost' });

    await t.mutation(api.games.selectGame, { sessionToken: host, gameId: 'trivia' });
    await t.mutation(api.games.cancelGameSetup, { sessionToken: host });
    expect(await t.query(api.games.setup, { roomId })).toBeNull();
  });

  it('replays only a finished run with fresh state and locked settings', async () => {
    const t = convexTest(schema, modules);
    const { roomId, tokens } = await roomPlayingOn(
      t,
      { questionCount: '5', difficulty: 'hard', questionSeconds: '30' },
      'Ada',
      'Grace',
    );
    await playToTheFinalScores(t, roomId, tokens);
    const before = await t.query(api.games.running, { roomId });
    expect((before as unknown as { state: { phase: string } }).state.phase).toBe('finished');

    await t.mutation(api.games.replayGame, { sessionToken: tokens.Ada ?? '' });
    const after = await t.query(api.games.running, { roomId });
    expect(after).toMatchObject({
      kind: 'running',
      mode: 'standard',
      settings: { questionCount: '5', difficulty: 'hard', questionSeconds: '30' },
    });
    expect((after as unknown as { state: { phase: string; questionIndex: number; standings: readonly { score: number }[] } }).state).toMatchObject({
      phase: 'question',
      questionIndex: 0,
      standings: [{ score: 0 }, { score: 0 }],
    });
  });
});
