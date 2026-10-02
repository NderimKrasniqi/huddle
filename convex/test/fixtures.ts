import { gameLogicById } from '@huddle/game-registry/logic';
import type { TestConvexForDataModelAndIdentity } from 'convex-test';
import rateLimiterSchema from '../node_modules/@convex-dev/rate-limiter/dist/component/schema.js';

import { api } from '../convex/_generated/api';
import type { DataModel, Id } from '../convex/_generated/dataModel';

export type Backend = TestConvexForDataModelAndIdentity<DataModel>;

const rateLimiterModules = import.meta.glob(
  '../node_modules/@convex-dev/rate-limiter/dist/component/**/*.js',
);
const registeredBackends = new WeakSet<object>();

/** Register the production room opener's component on a convex-test backend. */
export function registerRateLimiter(t: Backend): void {
  if (registeredBackends.has(t)) return;
  t.registerComponent('rateLimiter', rateLimiterSchema, rateLimiterModules);
  registeredBackends.add(t);
}

const FIXTURE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
let nextFixtureCode = 0;

function fixtureCode(): string {
  let value = nextFixtureCode;
  nextFixtureCode += 1;

  return Array.from({ length: 4 }, () => {
    const letter = FIXTURE_ALPHABET[value % FIXTURE_ALPHABET.length]!;
    value = Math.floor(value / FIXTURE_ALPHABET.length);
    return letter;
  }).join('');
}

/** Insert a room row without exercising the production room-opening API. */
export async function roomFixture(
  t: Backend,
  code = fixtureCode(),
): Promise<{ roomId: Id<'rooms'>; code: string }> {
  registerRateLimiter(t);
  const roomId = await t.run(async (ctx) =>
    await ctx.db.insert('rooms', { code, tvAway: false }),
  );
  return { roomId, code };
}

/**
 * Look at a room as its own TV. A room opened through `openRoom` already has
 * the TV session this uses; a fixture room has none, so one is seated for the
 * single look and removed again, leaving rooms that model a TV-less legacy
 * room exactly as they were.
 */
async function asTv<T>(t: Backend, roomId: Id<'rooms'>, look: (tvSessionToken: string) => Promise<T>): Promise<T> {
  const { token, temporary } = await t.run(async (ctx) => {
    const tv = await ctx.db.query('tvSessions').filter((q) => q.eq(q.field('roomId'), roomId)).first();
    if (tv !== null) return { token: tv.sessionToken, temporary: undefined };
    const token = `tv-fixture-${roomId}`;
    const temporary = await ctx.db.insert('tvSessions', { roomId, sessionToken: token, lastSeenAt: Date.now(), away: false });
    return { token, temporary };
  });
  try {
    return await look(token);
  } finally {
    if (temporary !== undefined) await t.run(async (ctx) => await ctx.db.delete(temporary));
  }
}

/** The running game as the room's own TV is shown it. */
export async function tvRunning(t: Backend, roomId: Id<'rooms'>) {
  return await asTv(t, roomId, (tvSessionToken) => t.query(api.games.running, { roomId, tvSessionToken }));
}

/** The roster as the room's own TV is shown it. */
export async function tvRoster(t: Backend, roomId: Id<'rooms'>) {
  return await asTv(t, roomId, (tvSessionToken) => t.query(api.players.roster, { roomId, tvSessionToken }));
}

/** The Host's setup draft as the room's own TV is shown it. */
export async function tvSetup(t: Backend, roomId: Id<'rooms'>) {
  return await asTv(t, roomId, (tvSessionToken) => t.query(api.games.setup, { roomId, tvSessionToken }));
}

/** The browsed game card as the room's own TV is shown it. */
export async function tvBrowsing(t: Backend, roomId: Id<'rooms'>) {
  return await asTv(t, roomId, (tvSessionToken) => t.query(api.games.browsing, { roomId, tvSessionToken }));
}

/** The typed Trivia projection fields exercised at the backend boundary. */
export type TriviaTestState = {
  readonly phase: string;
  readonly questions: readonly { readonly text: string; readonly correctIndex: number }[];
  readonly answers: Readonly<Record<string, number>>;
  readonly standings: readonly { readonly playerId: string; readonly score: number }[];
};

/** The fields backend tests inspect across Voting and registry seam checks. */
export type TestRunningState = {
  readonly phase: string;
  readonly promptIndex: number;
  readonly voters: readonly string[];
  readonly tally: readonly number[];
  readonly players: readonly string[];
  readonly prompts?: readonly unknown[];
  readonly questions?: TriviaTestState['questions'];
  readonly answers?: TriviaTestState['answers'];
  readonly standings?: TriviaTestState['standings'];
};

/** Resolve and type-check a public `games.running` projection for a test. */
export function runningState<T>(response: unknown): T {
  if (
    typeof response !== 'object' ||
    response === null ||
    !('kind' in response) ||
    response.kind !== 'running' ||
    !('gameId' in response) ||
    typeof response.gameId !== 'string' ||
    !('state' in response)
  ) {
    throw new Error('expected a running game projection');
  }

  const game = gameLogicById(response.gameId);
  if (game === undefined) throw new Error(`game ${response.gameId} is not installed`);

  const state = game.decodeState(response.state);
  if (state === undefined) throw new Error(`game ${response.gameId} returned no decoded state`);
  return state as T;
}
