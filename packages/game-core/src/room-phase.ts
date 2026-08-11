import type { PlayerRange } from './game-module';

/**
 * Where a room stands between parties and games.
 *
 * Two phases and one transition each way (docs/implementation-plan.md: `lobby →
 * in-game → lobby`). A room in the lobby is the roster and the Host's picker; a
 * room in a game is the module's two screens on the television and every phone.
 *
 * The phase is *read* off the room rather than stored beside the game, because
 * the two would be one fact written twice: a room holding a running game is in
 * a game, and a room holding none is in its lobby. Written that way there is no
 * such row as an in-game room with nothing running, and no repair to write for
 * a start that half-succeeded.
 */
export const ROOM_PHASES = ['lobby', 'in-game'] as const;

export type RoomPhase = (typeof ROOM_PHASES)[number];

/** The running game a room holds: which module, and the state it is at. */
export type RunningGame<State = unknown> = {
  readonly gameId: string;
  readonly state: State;
};

/**
 * The sanitized running-game projection returned to clients.
 *
 * Paused and unavailable responses intentionally carry no state. A client can
 * still identify the game (and offer the Host a way back to the lobby) without
 * ever rendering stale or undecodable data.
 */
export type RunningGameResponse =
  | null
  | {
      readonly kind: 'running';
      readonly gameId: string;
      readonly state: unknown;
      readonly clockRemainingMs?: number;
    }
  | {
      readonly kind: 'paused';
      readonly gameId: string;
      readonly reason: 'tvDisconnected' | 'playerDisconnected';
    }
  | {
      readonly kind: 'unavailable';
      readonly gameId: string;
    };

/** The phase of a room holding `game` — the lobby if it holds none. */
export function roomPhase(game: RunningGame | undefined | null): RoomPhase {
  return game === undefined || game === null ? 'lobby' : 'in-game';
}

/**
 * Why the room refused to start or end a game.
 *
 * A `ConvexError` payload, like the join and host-control rejections beside it: Convex
 * redacts the message of anything that is not one, so the phone would otherwise
 * be told "Server Error" and have nothing to say to the person holding it.
 */
export type GameLifecycleRejection =
  /** The phone is not in a room: its seat expired, or its token is stale. */
  | { readonly kind: 'notInRoom' }
  /** A phone that is not the Host tried to run the room. */
  | { readonly kind: 'notHost' }
  /** No installed module answers to this id — see the Registry. */
  | { readonly kind: 'gameNotInstalled'; readonly gameId: string }
  /** Starting a game in a room that is already playing one. */
  | { readonly kind: 'alreadyInGame' }
  /**
   * Fewer players in the room than the game declares it needs. Carries both
   * numbers, because the only useful thing to say to the Host is how many more
   * people have to join.
   */
  | { readonly kind: 'notEnoughPlayers'; readonly need: number; readonly have: number }
  /**
   * More players in the room than the game declares it supports. Carries both
   * numbers so the Host can remove the exact number of seats needed to start.
   */
  | { readonly kind: 'tooManyPlayers'; readonly max: number; readonly have: number }
  /**
   * Starting a game on settings its Settings Schema does not offer — a key the
   * game never declared, or a value the setting does not list. Carries both, so
   * the refusal names what was actually sent rather than only that something
   * was. See `settingsRefusal`, which is where it is decided.
   */
  | { readonly kind: 'settingRejected'; readonly key: string; readonly value: string }
  /** The shared TV is away, so starting a game would advance unseen state. */
  | { readonly kind: 'tvUnavailable' };

/** What the Host asked the room to do. */
export type GameLifecycleIntent = 'start' | 'end';

/**
 * The phase a room is in once the Host has started or ended a game.
 *
 * Total, and deliberately so: neither transition can fail *as a transition*.
 * What can fail is being allowed to start at all, and that is
 * `refusalToStart` — kept apart so this stays the `lobby → in-game → lobby`
 * machine the plan names and nothing else.
 */
export function phaseAfter(intent: GameLifecycleIntent): RoomPhase {
  return intent === 'start' ? 'in-game' : 'lobby';
}

/**
 * Why the room may not start this game right now, or `null` if it may.
 *
 * These rules are here rather than at the mutation because they are the game's
 * own business and neither needs a database: a room already playing must not
 * have that game replaced by a second start, and a game declares the party it
 * is playable by (`PlayerRange`).
 *
 * There is no matching rule for *ending*. A second tap on "Back to lobby" asks
 * for the lobby the room is already in — there is nothing to tell the person
 * holding the phone, and the screen they want is the screen they have — so
 * ending is unconditional and has no refusal to check.
 *
 * The Host's picker previews the same range, but this shared gate remains
 * authoritative if a stale client, a race, or a future smaller-capacity game
 * reaches the mutation. Since `removePlayer`, the rejection has a direct
 * remedy rather than stranding the room.
 */
export function refusalToStart(
  phase: RoomPhase,
  seatedPlayers: number,
  playerRange: PlayerRange,
): GameLifecycleRejection | null {
  // Asked first: it is a fact about the room, where the count is a fact about
  // the party, and a room mid-game should hear the same refusal whoever is in
  // it.
  if (phase === 'in-game') {
    return { kind: 'alreadyInGame' };
  }

  if (seatedPlayers < playerRange.min) {
    return { kind: 'notEnoughPlayers', need: playerRange.min, have: seatedPlayers };
  }

  if (seatedPlayers > playerRange.max) {
    return { kind: 'tooManyPlayers', max: playerRange.max, have: seatedPlayers };
  }

  return null;
}

// The settings a start is allowed on live in `./game-settings`, beside the
// schema they are settled against: this file is the room's phases, and the two
// only meet at `startGame`.
