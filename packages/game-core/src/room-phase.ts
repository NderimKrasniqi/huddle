import type { GameSettingsSchema } from './game-module';

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

/** The phase of a room holding `game` — the lobby if it holds none. */
export function roomPhase(game: RunningGame | undefined | null): RoomPhase {
  return game === undefined || game === null ? 'lobby' : 'in-game';
}

/**
 * Why the room refused to start or end a game.
 *
 * A `ConvexError` payload, like the join and color rejections before it: Convex
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
  | { readonly kind: 'alreadyInGame' };

/** What the Host asked the room to do. */
export type GameLifecycleIntent = 'start' | 'end';

/**
 * The phase a room reaches when the Host starts or ends a game, or the refusal
 * that leaves it where it is.
 *
 * Only starting can be refused on phase. Ending a game the room is not playing
 * is a no-op rather than a rejection: "End game" is a button a thumb can hit
 * twice, and the second tap asks for the lobby the room is already in — there is
 * nothing to tell the person holding the phone, and the screen they want is the
 * screen they have. Starting is refused instead, because a second start would
 * throw away the state of the game in progress.
 */
export function phaseAfter(
  phase: RoomPhase,
  intent: GameLifecycleIntent,
): { readonly next: RoomPhase } | { readonly refused: GameLifecycleRejection } {
  if (intent === 'end') {
    return { next: 'lobby' };
  }

  return phase === 'in-game' ? { refused: { kind: 'alreadyInGame' } } : { next: 'in-game' };
}

/**
 * The settings a game starts with when nobody has chosen any.
 *
 * Every setting declares a default among its options (`GameSetting`), so a
 * schema always answers this — which is what lets a Host start a game without
 * opening the settings screen at all. The Host's own choices replace this
 * wholesale in Phase 4; until then it is what every game is started with.
 */
export function defaultSettings(schema: GameSettingsSchema): Record<string, string> {
  return Object.fromEntries(schema.map((setting) => [setting.key, setting.defaultValue]));
}
