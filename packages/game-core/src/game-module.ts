import type { ReactNode } from 'react';

import type { KeyArtColorName } from './key-art';
import type { AvatarId } from './avatar';

/**
 * The Game Module interface: everything the hub knows about a game, and the
 * only thing it knows.
 *
 * The hub — the TV app, the Controller, and the Convex mutations between them —
 * contains no game logic and no game names. It renders a Registry, holds a
 * state it cannot read, and hands events to a `reduce` it did not write. That
 * is what makes a second game an entry rather than a change
 * (docs/project-scope.md: "adding a hypothetical game #2 requires no hub
 * changes").
 *
 * Every part of the interface is here because the hub needs it from *outside*
 * the game: the metadata is what the carousel draws, the settings schema is
 * what the Host's settings screen draws, the initial-state factory is what a
 * starting room calls, `reduce` is what a mutation wraps, and the screens are
 * what the two clients mount once the game is running.
 */

/** A player, as the room identifies them (`players._id`). */
export type GamePlayerId = string;

/**
 * A player as a game sees them: the `roster` projection, minus `host`.
 *
 * A game is handed the same players the TV's seats draw, because it draws them
 * too — a scoreboard is nicknames and avatars. `host` is not among them
 * on purpose: the Host plays like everybody else, and a game
 * that could tell would eventually treat them differently. `away` *is*, because
 * a game must never wait for a phone that has gone quiet.
 */
export type GamePlayer = {
  readonly playerId: GamePlayerId;
  readonly nickname: string;
  readonly away: boolean;
  /**
   * The avatar they claimed on the join form. Not optional, unlike the colour
   * it replaced: a colour was claimed after joining, so a seat had to be
   * drawable without one, and an avatar is chosen before the seat exists.
   */
  readonly avatar: AvatarId;
};

/**
 * A seat as the room's roster states it — a `GamePlayer` with the one field a
 * game is not given.
 */
export type RosterSeatForGame = GamePlayer & { readonly host: boolean };

/**
 * The room's roster as a game receives it: the same seats, minus `host`.
 *
 * Both clients need this to mount a game's screens, so it is written once here
 * rather than twice. The server makes the same projection in `games.ts` and not
 * through this function, because it builds it from `players` rows, which carry
 * `_id` and no `host` at all — the field is the room's. What matters is the
 * shape they agree on: a game is never handed the Host, on either side.
 */
export function gamePlayersFrom(
  seats: readonly RosterSeatForGame[],
): readonly GamePlayer[] {
  return seats.map(({ playerId, nickname, away, avatar }) => ({
    playerId,
    nickname,
    away,
    avatar,
  }));
}

/**
 * The floor every game event stands on: which player it came from, if a player
 * came into it at all.
 *
 * The hub is what puts a game event into a room, and it can only do that
 * generically if every event answers the one question the hub is able to
 * settle — a Controller presents its Session Token, and the room turns that
 * into a player. So a phone never names itself and is never believed when it
 * does: the mutation that carries an event to `reduce` is what fills this in
 * from the token it was called with.
 *
 * Absent means the room itself. A `GameDeadline` running out is an event nobody
 * sent, and there is no phone behind the scheduled mutation that raises it —
 * naming a player there would be the room speaking in somebody's name. No
 * client can produce one, because the mutation that carries a phone's event
 * writes this field over whatever arrived, so an absent player is always the
 * room and never a claim.
 */
export type GameEvent = {
  readonly playerId?: GamePlayerId;
  /**
   * How long the room's clock still had when this event reached the rules — the
   * beat's `GameDeadline`, read at the moment the event landed.
   *
   * The hub's, and written the same way `playerId` is: over whatever arrived,
   * so a phone claiming to have been faster than it was is a claim the rules
   * never see. It is here rather than in any module's own event because it is
   * the hub that holds the clock — a reducer may not read one, and a game that
   * pays for speed has no other way to be told what a second was worth.
   *
   * Absent means the room could not say: a beat with no deadline running on it,
   * the scheduled deadline itself (which is the clock running *out*, so nothing
   * is left of it), or a room dealt its beat by a deployment older than the
   * field this is timed against. A game that reads it decides what nothing
   * means; trivia pays no bonus.
   */
  readonly msRemaining?: number;
  /**
   * Which of the room's players are Away, as the room reads it at the moment
   * this event lands.
   *
   * The hub's, and written over whatever arrived for the same reason `playerId`
   * is: a phone writing somebody out of a question is a claim, and the room is
   * the only thing that knows who it has stopped hearing from. It is here
   * rather than in any module's own event because presence is the *room's* —
   * it lives on the players, not in any game's state, and it changes while no
   * game event is being sent at all, so a game that must never wait for a quiet
   * phone (Away) has no other way to be told.
   *
   * Absent means the room could not say, which is a room dealt its beat by a
   * deployment older than this field. A game that reads it decides what nothing
   * means; trivia waits for everybody, exactly as it did before there was one.
   */
  readonly awayPlayerIds?: readonly GamePlayerId[];
};

/**
 * A game's own clock: what it does when nobody does anything, and how long the
 * room waits first.
 *
 * A reducer may not reach for a clock, so a game that has to end a beat by
 * itself — trivia's twenty-second question — cannot do it from inside `reduce`.
 * It declares the deadline instead and the hub schedules it, which is the whole
 * of how a countdown runs without the hub knowing what a question is.
 *
 * `event` is addressed to the beat it ends, exactly as a phone's event is: a
 * deadline can fire into a beat that has already been left (the room answered
 * early and moved on), and the module's own rules are what make that land as
 * nothing.
 *
 * `beat` names the beat being timed, and is the one thing about a deadline the
 * hub can read. Two deadlines with the same `beat` are the same deadline, so
 * the room arms it once when it enters that beat — a countdown re-armed on
 * every event would be a beat that never ended while anybody was still acting
 * on it.
 */
export type GameDeadline<Event extends GameEvent = GameEvent> = {
  readonly beat: string;
  /** How long from now, so nothing here reads a clock either. */
  readonly afterMs: number;
  readonly event: Event;
};

/** How many players a game is playable with. */
export type PlayerRange = {
  readonly min: number;
  readonly max: number;
};

/** A game's card face: a flat block of color with its Bungee title on it. */
export type GameKeyArt = {
  readonly color: KeyArtColorName;
};

/**
 * What the hub can say about a game without playing it — the whole of the
 * carousel card (docs/design/design-handoff.md §6: key art, title, and the
 * chips under it).
 */
export type GameMetadata = {
  /** Stable across builds: it is what a room stores when a game is picked. */
  readonly id: string;
  /** As the carousel sets it in Bungee. */
  readonly title: string;
  readonly keyArt: GameKeyArt;
  readonly playerRange: PlayerRange;
  /** How long a game of this runs, for the "~12 min" chip. */
  readonly estimatedMinutes: number;
  /**
   * The genre chip: what *kind* of game this is, for a room choosing between
   * several. Nothing to do with a Question Pack's categories, which are
   * trivia's own business.
   */
  readonly category: string;
};

/** One value a Host can choose for a setting. */
export type GameSettingOption = {
  readonly value: string;
  readonly label: string;
};

/**
 * One host-tunable option, as the hub renders it.
 *
 * A closed list of labelled values rather than a free field, because that is
 * what every setting Huddle has scoped actually is (scoring mode, question
 * count, category filter) and because it is what a generic screen can draw
 * without a game telling it how. `defaultValue` is one of `options`, so a room
 * that has been asked nothing still has settings.
 */
export type GameSetting = {
  readonly key: string;
  readonly label: string;
  readonly options: readonly GameSettingOption[];
  readonly defaultValue: string;
};

/** A game module's declaration of its host-tunable options. */
export type GameSettingsSchema = readonly GameSetting[];

/** What a game is started with: who is playing, and what the Host chose. */
export type GameSetup<Settings> = {
  readonly players: readonly GamePlayer[];
  readonly settings: Settings;
};

/**
 * What the TV screen of a running game is given.
 *
 * The state and the roster, and nothing else — the TV app holds no player
 * record of its own and is a pure renderer of what the room says.
 */
export type TvGameScreenProps<State> = {
  readonly state: State;
  readonly players: readonly GamePlayer[];
};

/**
 * What the Controller screen of a running game is given: the same state the TV
 * is drawing, the player holding this phone, and the way back to the room.
 *
 * `sendEvent` takes the game's own event, `playerId` included, because a screen
 * that has `player` can fill it in and a screen is easier to read for it. It is
 * a claim, not an identification: see `GameEvent`.
 */
export type ControllerGameScreenProps<State, Event extends GameEvent> = {
  readonly state: State;
  readonly player: GamePlayer;
  readonly sendEvent: (event: Event) => void;
};

/**
 * A self-contained game behind the hub's one interface.
 *
 * The type parameters default to the widest thing each can be, which is how the
 * hub holds a game it cannot name (`GameRegistry` below): a state it treats as
 * opaque, an event it knows only names a player, and settings it passes back
 * exactly as the Host chose them. Every member that takes the game's own state
 * is declared as a method so that assignment stays bivariant — the deliberate
 * hole that lets a `GameModule<TriviaState, …>` sit in a list of
 * `GameModule<unknown, …>`. The hub is the only code that looks through that
 * hole, and what it is doing there is storing and reloading a game's state
 * without reading it.
 */
export interface GameLogic<
  State = unknown,
  Event extends GameEvent = GameEvent,
  Settings = unknown,
> {
  readonly metadata: GameMetadata;
  readonly settingsSchema: GameSettingsSchema;
  /** The state a game begins in, given its players and the Host's settings. */
  createInitialState(setup: GameSetup<Settings>): State;
  /**
   * The rules, as a pure function. It runs server-side inside a Convex
   * mutation, so it may not reach for a clock, a random number or a network:
   * everything it needs arrives in `state` and `event`.
   */
  reduce(state: State, event: Event): State;
  /**
   * The clock this game wants running on the beat `state` is on, if it wants
   * one. Optional: a game where nothing expires declares none, and a room
   * playing it moves only when somebody moves it.
   *
   * Pure, like `reduce`, and asked in the same mutation that wrote the state —
   * so it answers in milliseconds from now rather than at a timestamp, and no
   * part of a game module ever reads the time.
   */
  deadline?(state: State): GameDeadline<Event> | undefined;
  /**
   * The state as one viewer is entitled to see it, for the broadcast the hub
   * sends every client. Optional: a game whose whole state is shared declares
   * none and the hub sends its state to everyone unchanged.
   *
   * `viewer` is the player this copy is for, or `undefined` for the television —
   * and for any phone whose seat is not in this room — which is entitled to no
   * player's private state. This is where a game keeps one player's in-flight
   * choices off the wire to the rest of the room: the room stores the state
   * whole and the hub hands each client only what `redactStateFor` returns (see
   * `games.running`).
   *
   * Pure, and a projection *for reading only*: the redacted copy is never fed
   * back to `reduce`, which always runs on the unredacted state the room stored.
   * So hiding a field here can never change what the rules decide — it only
   * changes what a client is told (see trivia's pre-reveal answers). The hub
   * cannot do this itself: only the module knows which of its own fields are one
   * player's and which are the room's.
   */
  redactStateFor?(state: State, viewer: GamePlayerId | undefined): State;
}

/**
 * What a client holds of a game: how the hub draws it, and the two screens it
 * mounts once it is running. Deliberately *not* the rules.
 *
 * `GameModule` does not extend `GameLogic`. A client renders a game — the
 * carousel card from `metadata`, the Host's options from `settingsSchema`, the
 * `screens` once it starts — but it never runs one: `createInitialState` and
 * `reduce` execute inside Convex mutations, and the state a screen draws arrives
 * from the room. Leaving the rules off this type is not tidiness, it is the seam
 * that keeps a game's *content* server-side. Trivia's `createInitialState` deals
 * from the Question Pack, so a module that carried it would carry the pack —
 * every question and its answer — into the phone bundle, where a modified client
 * could reproduce the deterministic deal and know each answer before the TV
 * asked (docs/implementation-plan.md 5.9). The server imports a Registry of
 * `GameLogic` (the rules, and the pack with them); the clients import this.
 * `@huddle/game-registry` ships the two lists through separate entry points, and
 * `registry.test.ts` holds them to one order and one shared `metadata`.
 *
 * Screens are React Native and could not sit on the server type anyway — a
 * module's screens are properties of it, and properties do not tree-shake, so a
 * server importing them would bundle the user interface of every installed game.
 */
export interface GameModule<State = unknown, Event extends GameEvent = GameEvent> {
  readonly metadata: GameMetadata;
  readonly settingsSchema: GameSettingsSchema;
  /**
   * The two faces of a running game. Both are React components — plain
   * functions of their props — so the hub mounts them without knowing what
   * they draw.
   */
  readonly screens: {
    tv(props: TvGameScreenProps<State>): ReactNode;
    controller(props: ControllerGameScreenProps<State, Event>): ReactNode;
  };
}

/**
 * The installed games, in the order the hub offers them.
 *
 * Ordered because the carousel browses it by index (the room's
 * `browsingGameIndex`), so "the third card" has to mean the same thing on the
 * TV and on the Host's phone.
 */
export type GameRegistry = readonly GameModule[];

/**
 * The same installed games as the server holds them: rules only, no screens.
 *
 * Ordered identically to `GameRegistry` — they are two views of one list, and
 * `@huddle/game-registry` is where that is held true.
 */
export type GameLogicRegistry = readonly GameLogic[];
