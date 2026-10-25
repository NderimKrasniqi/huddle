import {
  type CommandArgs,
  type CommandName,
  type CommandResult,
  decodeClientMessage,
  encodeMessage,
  type HostMessage,
  PHONE_VIEWS,
  PROTOCOL_VERSION,
  type RoomRejection,
  type ViewName,
  type ViewValue,
  ANONYMOUS_COMMANDS,
} from '@huddle/contracts/protocol';
import {
  AWAY_AFTER_MS,
  COUNTDOWN_MS,
  type GameEvent,
  type GameLogic,
  type GamePlayer,
  type GameSettings,
  type GameSetupMode,
  generateRoomCode,
  generateSessionToken,
  isAvatarId,
  isGuestId,
  NICKNAME_MAX_LENGTH,
  normalizeRoomCode,
  readiness,
  refusalToStart,
  ROOM_CODE_LENGTH,
  ROOM_EXPIRY_MS,
  ROOM_PLAYER_CAP,
  roomPhase,
  settingsFrom,
  settingsRefusal,
  settingsRefusalForMode,
} from '@huddle/domain';
import { browsingIndex, GAME_LOGIC_REGISTRY, gameLogicById } from '@huddle/game-registry/logic';

import {
  decodeStoredRuntime,
  type DecodedRuntime,
  projectRuntime,
  runtimeFailure,
  validatedDeadline,
} from './game-runtime';
import type { CancelTimer, HostPorts } from './ports';
import { RateLimiter } from './rate-limits';
import { Refusal } from './refusal';
import {
  type HostSnapshot,
  type RoomState,
  type Seat,
  type Setup,
  SNAPSHOT_VERSION,
  type StoredGame,
} from './state';

/** A seat preview nobody refreshes for this long is dropped. */
const SEAT_PREVIEW_TTL_MS = 20_000;
/** How often the host looks for silent phones, stale previews and expiry. */
const SWEEP_INTERVAL_MS = 1_000;
/** Ten seats, a few join forms and some headroom. */
export const CONNECTION_CAP = 32;

/** What the TV's own screens read, in-process. */
export type TvViews = {
  readonly roomId: string;
  readonly code: string;
  readonly roster: ViewValue<'roster'>;
  readonly setup: ViewValue<'setup'>;
  readonly browsing: ViewValue<'browsing'>;
  readonly running: ViewValue<'running'>;
  readonly connection: ViewValue<'connection'>;
  readonly arrivals: ViewValue<'arrivals'>;
};

/** One transport connection, as the transport drives it. */
export type HostConnection = {
  /** A text frame from the phone. */
  readonly receive: (frame: string) => void;
  /** The transport closed. The seat stays; silence will mark it away. */
  readonly disconnect: () => void;
};

type Viewer = { readonly kind: 'tv' } | { readonly kind: 'player'; readonly playerId: string };

type Connection = {
  readonly id: number;
  readonly send: (frame: string) => void;
  readonly close: () => void;
  greeted: boolean;
  playerId?: string;
  /** The last value sent per view, without its clock fields. */
  readonly sent: Map<ViewName, string>;
};

type StartArgs = {
  readonly gameId?: string;
  readonly settings?: Record<string, string>;
  readonly mode?: GameSetupMode;
};

/**
 * The room's authority, run by the TV (ADR-01).
 *
 * Every change goes through `change`, which recomputes the views, pushes the
 * ones that changed to each phone and to the TV's own screens, and saves a
 * snapshot. Rules refuse by throwing a `Refusal`; a refused command changes
 * nothing because every rule checks before it writes.
 */
export class RoomHost {
  private room: RoomState;
  private readonly tvInstanceId: string;
  private readonly limiter: RateLimiter;
  private readonly connections = new Map<number, Connection>();
  private readonly tvListeners = new Set<(views: TvViews) => void>();
  private nextConnectionId = 1;
  private countdownTimer: CancelTimer | undefined;
  private deadlineTimer: CancelTimer | undefined;
  private sweepTimer: CancelTimer | undefined;
  private disposed = false;
  /** True when this host was rebuilt from a snapshot rather than opened fresh. */
  readonly restored: boolean;

  constructor(
    private readonly ports: HostPorts,
    snapshot?: HostSnapshot,
  ) {
    this.limiter = new RateLimiter(ports.now);
    const usable =
      snapshot !== undefined &&
      snapshot.version === SNAPSHOT_VERSION &&
      ports.now() - snapshot.savedAt < ROOM_EXPIRY_MS;
    this.restored = usable;
    this.tvInstanceId = usable ? snapshot.tvInstanceId : this.newId('tv');
    this.room = usable ? this.restoreRoom(snapshot) : this.freshRoom();
    this.armSweep();
    this.flush();
  }

  // ------------------------------------------------------------ public API

  info(): { readonly roomId: string; readonly code: string; readonly tvInstanceId: string; readonly hasRunningGame: boolean } {
    return {
      roomId: this.room.roomId,
      code: this.room.code,
      tvInstanceId: this.tvInstanceId,
      hasRunningGame: this.room.game !== undefined,
    };
  }

  /** Accepts a transport connection, or closes it when the room is at capacity. */
  connect(send: (frame: string) => void, close: () => void): HostConnection {
    if (this.disposed || this.connections.size >= CONNECTION_CAP) {
      close();
      return { receive: () => {}, disconnect: () => {} };
    }
    const connection: Connection = { id: this.nextConnectionId++, send, close, greeted: false, sent: new Map() };
    this.connections.set(connection.id, connection);
    return {
      receive: (frame) => this.receive(connection, frame),
      disconnect: () => {
        this.connections.delete(connection.id);
      },
    };
  }

  /** The TV's screens subscribe here; the listener runs now and on every change. */
  subscribeTv(listener: (views: TvViews) => void): () => void {
    this.tvListeners.add(listener);
    listener(this.tvViews());
    return () => this.tvListeners.delete(listener);
  }

  /** The TV app went to the background (true) or came back (false). */
  setTvAway(away: boolean): void {
    this.change(() => (away ? this.markTvAway() : this.restoreTv()));
  }

  /**
   * Swaps a room nobody has joined for a fresh one with a new code, for a
   * relay that has the old code taken. Returns false, changing nothing, once a
   * player holds a seat. The TV's screens see a new room id and reopen it.
   */
  replaceEmptyRoom(): boolean {
    if (this.disposed || this.room.seats.length > 0) return false;
    this.change(() => {
      for (const connection of this.connections.values()) connection.close();
      this.connections.clear();
      this.room = this.freshRoom();
    });
    return true;
  }

  snapshot(): HostSnapshot {
    return { version: SNAPSHOT_VERSION, tvInstanceId: this.tvInstanceId, savedAt: this.ports.now(), room: copy(this.room) };
  }

  dispose(): void {
    this.disposed = true;
    this.countdownTimer?.();
    this.deadlineTimer?.();
    this.sweepTimer?.();
    for (const connection of this.connections.values()) connection.close();
    this.connections.clear();
    this.tvListeners.clear();
  }

  // ------------------------------------------------------------ room lifecycle

  private freshRoom(): RoomState {
    return {
      roomId: this.newId('room'),
      code: generateRoomCode(this.ports.random),
      tvAway: false,
      seats: [],
      previews: [],
    };
  }

  /**
   * A restarted TV app picks its room back up. Time spent down does not count
   * against a running beat: its remainder at the moment of saving is kept and
   * re-armed now. A countdown in progress returns to the ready check.
   */
  private restoreRoom(snapshot: HostSnapshot): RoomState {
    const room = copy(snapshot.room);
    room.tvAway = false;
    room.tvAwaySince = undefined;
    if (room.setup !== undefined) room.setup = withoutCountdown(room.setup);
    const running = room.game;
    if (running !== undefined && running.deadlineAt !== undefined) {
      const { deadlineAt, deadlineBeat: _beat, deadlineEvent: _event, ...rest } = running;
      room.game = { ...rest, pausedRemainingMs: Math.max(0, deadlineAt - snapshot.savedAt) };
    }
    this.room = room;
    if (room.game !== undefined && room.game.playerPaused !== true && room.game.pausedRemainingMs !== undefined) {
      room.game = this.resumePausedGameClock(room.game);
    }
    return room;
  }

  /**
   * The room ends: every phone is told, and the TV shows a new room with a new
   * code. Reached when the TV has been away for the whole expiry window.
   */
  private closeRoom(): void {
    for (const connection of this.connections.values()) {
      if (connection.playerId !== undefined) this.sendTo(connection, { type: 'closed', reason: 'roomClosed' });
      connection.close();
    }
    this.connections.clear();
    this.countdownTimer?.();
    this.deadlineTimer?.();
    this.countdownTimer = undefined;
    this.deadlineTimer = undefined;
    this.room = this.freshRoom();
  }

  private markTvAway(): void {
    if (this.room.tvAway) return;
    this.room.game = this.pauseGameClock(this.room.game);
    this.room.tvAway = true;
    this.room.tvAwaySince = this.ports.now();
    // The countdown needs the TV to show it; it stops until the TV is back.
    this.reconcileCountdown();
  }

  /**
   * The TV is back. The game clock resumes from its remainder unless a player
   * disconnect still holds it, which waits for the Host or the last return.
   */
  private restoreTv(): void {
    if (!this.room.tvAway) return;
    this.room.tvAway = false;
    this.room.tvAwaySince = undefined;
    const running = this.room.game;
    if (running === undefined || running.playerPaused === true) return;
    this.room.game = this.resumePausedGameClock(running);
  }

  // ------------------------------------------------------------ presence

  private armSweep(): void {
    this.sweepTimer = this.ports.setTimer(SWEEP_INTERVAL_MS, () => {
      if (this.disposed) return;
      this.change(() => this.sweep());
      this.limiter.prune();
      this.armSweep();
    });
  }

  /**
   * The room noticing time pass: phones gone quiet become away, stale join
   * previews go, and a TV away for the whole window ends the room.
   */
  private sweep(): void {
    const now = this.ports.now();
    if (this.room.tvAway && this.room.tvAwaySince !== undefined && now - this.room.tvAwaySince >= ROOM_EXPIRY_MS) {
      this.closeRoom();
      return;
    }
    this.room.previews = this.room.previews.filter((preview) => now - preview.updatedAt < SEAT_PREVIEW_TTL_MS);
    for (const seat of this.room.seats) {
      if (!seat.away && now - seat.lastSeenAt >= AWAY_AFTER_MS) this.markAway(seat);
    }
  }

  private silenceOf(seat: Seat): number {
    return this.ports.now() - seat.lastSeenAt;
  }

  /** Whether the room is still hearing from this phone. */
  private beating(seat: Seat): boolean {
    return this.silenceOf(seat) < AWAY_AFTER_MS;
  }

  /** A frame from a seated phone is its beat. */
  private touch(seat: Seat): void {
    seat.lastSeenAt = this.ports.now();
    if (!seat.away) return;
    seat.away = false;
    // Coming back repairs a Host pointer that stayed on a silent seat, and can
    // release a game held for disconnected players.
    this.restoreConnectedHost();
    this.resumeWhenEveryoneReturns();
  }

  private markAway(seat: Seat): void {
    seat.away = true;
    this.reconcileCountdown();
    // A host who has gone quiet has left the party as far as the room can tell.
    this.handOverRoom(seat, false);
    this.pauseForDisconnectedPlayer();
  }

  /**
   * Hands the room on if the departing seat holds it. The successor is the
   * seat heard from most recently. A room nobody is beating in keeps its Host
   * when that Host's seat survives (going quiet is not resigning); a leaver
   * hands on to the earliest seat left even if it is quiet, so the room is
   * never left pointing at a deleted seat.
   */
  private handOverRoom(departing: Seat, departingIsLeaving: boolean): void {
    if (this.room.hostPlayerId !== departing.playerId) return;
    const others = this.room.seats.filter((seat) => seat.playerId !== departing.playerId);
    const beating = others
      .filter((seat) => this.beating(seat))
      .reduce<Seat | undefined>((best, seat) => (best === undefined || seat.lastSeenAt > best.lastSeenAt ? seat : best), undefined);
    const successor = beating ?? (departingIsLeaving ? others[0] : undefined);
    if (successor !== undefined) this.room.hostPlayerId = successor.playerId;
  }

  /** Gives a room whose Host is silent to its earliest live seat. */
  private restoreConnectedHost(): void {
    const host = this.seatById(this.room.hostPlayerId);
    if (host !== undefined && this.beating(host)) return;
    const successor = this.room.seats.find((seat) => this.beating(seat));
    if (successor !== undefined) this.room.hostPlayerId = successor.playerId;
  }

  private needsHost(): boolean {
    return this.seatById(this.room.hostPlayerId) === undefined;
  }

  private pauseForDisconnectedPlayer(): void {
    const running = this.room.game;
    if (running === undefined || running.playerPaused === true) return;
    this.room.game = { ...this.pauseGameClock(running)!, playerPaused: true };
  }

  private resumeWhenEveryoneReturns(): void {
    const running = this.room.game;
    if (running?.playerPaused !== true) return;
    const seats = this.room.seats;
    if (seats.length === 0 || seats.some((seat) => !this.beating(seat))) return;
    const { playerPaused: _paused, ...recovered } = running;
    this.room.game = this.room.tvAway ? recovered : this.resumePausedGameClock(recovered);
  }

  // ------------------------------------------------------------ connections

  private receive(connection: Connection, frame: string): void {
    if (this.disposed || !this.connections.has(connection.id)) return;
    const decoded = decodeClientMessage(frame);
    if (!decoded.ok) {
      connection.close();
      this.connections.delete(connection.id);
      return;
    }
    const message = decoded.message;
    if (message.type === 'hello') {
      if (message.protocol !== PROTOCOL_VERSION) {
        this.sendTo(connection, { type: 'incompatible', protocol: PROTOCOL_VERSION });
        connection.close();
        this.connections.delete(connection.id);
        return;
      }
      connection.greeted = true;
      this.sendTo(connection, { type: 'welcome', protocol: PROTOCOL_VERSION, tvInstanceId: this.tvInstanceId, roomCode: this.room.code });
      return;
    }
    if (!connection.greeted) {
      connection.close();
      this.connections.delete(connection.id);
      return;
    }
    const seat = this.seatById(connection.playerId);
    if (message.type === 'ping') {
      if (seat !== undefined) this.change(() => this.touch(seat));
      this.sendTo(connection, { type: 'pong', sentAt: message.sentAt });
      return;
    }
    const { requestId, name, args } = message;
    try {
      let value: unknown = null;
      this.change(() => {
        if (seat !== undefined) this.touch(seat);
        value = this.run(connection, name, args as never);
      });
      this.sendTo(connection, { type: 'result', requestId, ok: true, value });
    } catch (error) {
      const rejection: RoomRejection = error instanceof Refusal ? error.rejection : { kind: 'hostError' };
      if (!(error instanceof Refusal)) this.ports.log?.('Huddle room host error', { command: name });
      this.sendTo(connection, { type: 'result', requestId, ok: false, rejection });
      // A refusal can follow writes that are still true (a beat), so views flush.
      this.flush();
    }
  }

  private sendTo(connection: Connection, message: HostMessage): void {
    connection.send(encodeMessage(message));
  }

  private connectionsOf(playerId: string): Connection[] {
    return [...this.connections.values()].filter((connection) => connection.playerId === playerId);
  }

  /** Unseat a phone's connections: it hears `session: null`, then `closed`. */
  private unseatConnections(playerId: string, reason: 'removed' | undefined): void {
    for (const connection of this.connectionsOf(playerId)) {
      connection.playerId = undefined;
      connection.sent.clear();
      this.sendTo(connection, { type: 'view', name: 'session', value: null });
      if (reason !== undefined) {
        this.sendTo(connection, { type: 'closed', reason });
        connection.close();
        this.connections.delete(connection.id);
      }
    }
  }

  private bind(connection: Connection, playerId: string): void {
    for (const other of this.connectionsOf(playerId)) {
      if (other.id === connection.id) continue;
      this.sendTo(other, { type: 'closed', reason: 'replaced' });
      other.close();
      this.connections.delete(other.id);
    }
    connection.playerId = playerId;
    connection.sent.clear();
  }

  // ------------------------------------------------------------ dispatch

  private run<Name extends CommandName>(connection: Connection, name: Name, args: CommandArgs<Name>): CommandResult<Name> {
    if (!ANONYMOUS_COMMANDS.has(name) && this.seatById(connection.playerId) === undefined) {
      throw new Refusal({ kind: 'notJoined' });
    }
    const handler = this.commands[name] as (connection: Connection, args: CommandArgs<Name>) => CommandResult<Name>;
    return handler(connection, args);
  }

  private readonly commands: {
    readonly [Name in CommandName]: (connection: Connection, args: CommandArgs<Name>) => CommandResult<Name>;
  } = {
    joinAvailability: (_connection, { code }) => {
      const normalized = normalizeRoomCode(code);
      if (normalized.length !== ROOM_CODE_LENGTH || normalized !== this.room.code) return null;
      return {
        full: this.room.seats.length >= ROOM_PLAYER_CAP,
        takenAvatarIds: this.room.seats.map((seat) => seat.avatar),
      };
    },

    previewSeat: (_connection, args) => {
      const code = normalizeRoomCode(args.code);
      if (code !== this.room.code || !isGuestId(args.previewKey) || !isAvatarId(args.avatar)) return null;
      this.limiter.consume('seatPreviewRoom', this.room.roomId);
      this.limiter.consume('seatPreviewKey', args.previewKey);
      const nickname = Array.from(args.nickname.trim()).slice(0, NICKNAME_MAX_LENGTH).join('');
      const now = this.ports.now();
      const existing = this.room.previews.find((preview) => preview.previewKey === args.previewKey);
      if (existing === undefined) {
        const held = new Set(this.room.seats.map((seat) => seat.avatar));
        const shown = this.room.previews.filter((preview) => !held.has(preview.avatar)).length;
        // Never more arriving seats than the room has free ones.
        if (this.room.seats.length + shown >= ROOM_PLAYER_CAP) return null;
        this.room.previews.push({ previewId: this.newId('preview'), previewKey: args.previewKey, nickname, avatar: args.avatar, updatedAt: now });
        return null;
      }
      existing.nickname = nickname;
      existing.avatar = args.avatar;
      existing.updatedAt = now;
      return null;
    },

    clearSeatPreview: (_connection, { previewKey }) => {
      this.room.previews = this.room.previews.filter((preview) => preview.previewKey !== previewKey);
      return null;
    },

    joinRoom: (connection, args) => {
      const code = normalizeRoomCode(args.code);
      const nickname = args.nickname.trim();
      if (nickname === '' || [...nickname].length > NICKNAME_MAX_LENGTH) {
        throw new Refusal({ kind: 'nameUnusable', maxLength: NICKNAME_MAX_LENGTH });
      }
      if (!isAvatarId(args.avatar)) throw new Refusal({ kind: 'avatarUnknown', avatar: args.avatar });
      if (args.guestId !== undefined && !isGuestId(args.guestId)) throw new Refusal({ kind: 'guestIdInvalid' });
      if (code !== this.room.code) throw new Refusal({ kind: 'roomNotFound', code });
      this.limiter.consume('joinGlobal', 'global');
      this.limiter.consume('joinRoom', this.room.roomId);
      this.limiter.consume('joinGuest', args.guestId ?? 'legacy-clients');
      const seats = this.room.seats;
      // The cap first: "name taken" would send someone to think of another name
      // for a room with no seat left for any name.
      if (seats.length >= ROOM_PLAYER_CAP) throw new Refusal({ kind: 'roomFull', cap: ROOM_PLAYER_CAP });
      if (seats.some((seat) => seat.nickname.trim().toLowerCase() === nickname.toLowerCase())) {
        throw new Refusal({ kind: 'nameTaken', nickname });
      }
      if (seats.some((seat) => seat.avatar === args.avatar)) throw new Refusal({ kind: 'avatarTaken', avatar: args.avatar });

      const seat: Seat = {
        playerId: this.newId('player'),
        nickname,
        sessionToken: generateSessionToken(this.ports.random),
        lastSeenAt: this.ports.now(),
        away: false,
        avatar: args.avatar,
        ...(args.guestId === undefined ? {} : { guestId: args.guestId }),
      };
      seats.push(seat);
      if (this.needsHost()) this.room.hostPlayerId = seat.playerId;
      // A new seat is not Ready, so a running countdown stops.
      this.reconcileCountdown();
      this.bind(connection, seat.playerId);
      return {
        playerId: seat.playerId,
        roomId: this.room.roomId,
        code: this.room.code,
        nickname,
        avatar: seat.avatar,
        sessionToken: seat.sessionToken,
      };
    },

    resumeSession: (connection, { sessionToken }) => {
      const seat = this.room.seats.find((candidate) => candidate.sessionToken === sessionToken);
      if (seat === undefined) return null;
      this.bind(connection, seat.playerId);
      this.touch(seat);
      return this.sessionOf(seat);
    },

    leaveRoom: (connection) => {
      const seat = this.requireSeat(connection);
      this.limiter.consume('memberCommand', seat.playerId);
      // Before the seat goes, so the successor is chosen from a roster it is on.
      this.handOverRoom(seat, true);
      this.room.seats = this.room.seats.filter((candidate) => candidate.playerId !== seat.playerId);
      this.unseatConnections(seat.playerId, undefined);
      if (this.room.seats.length > 0) {
        this.dropReady(seat.playerId);
        this.reconcileCountdown();
        this.resumeWhenEveryoneReturns();
        return null;
      }
      // The TV owns the room: the last leaver leaves an empty lobby behind.
      this.deadlineTimer?.();
      this.deadlineTimer = undefined;
      this.countdownTimer?.();
      this.countdownTimer = undefined;
      this.room.hostPlayerId = undefined;
      this.room.game = undefined;
      this.room.setup = undefined;
      this.room.browsingGameIndex = undefined;
      return null;
    },

    transferHost: (connection, { playerId }) => {
      const actor = this.requireHost(connection, 'hostCommand');
      const target = this.targetSeat(actor, playerId);
      if (!this.beating(target)) throw new Refusal({ kind: 'targetAway' });
      this.room.hostPlayerId = target.playerId;
      return null;
    },

    removePlayer: (connection, { playerId }) => {
      const actor = this.requireHost(connection, 'hostCommand');
      const target = this.targetSeat(actor, playerId);
      this.room.seats = this.room.seats.filter((seat) => seat.playerId !== target.playerId);
      this.unseatConnections(target.playerId, 'removed');
      this.dropReady(target.playerId);
      this.reconcileCountdown();
      this.resumeWhenEveryoneReturns();
      return null;
    },

    browseGame: (connection, { index }) => {
      this.requireHost(connection, 'hostCommand');
      // A TV in the background keeps the last committed card.
      if (this.room.tvAway) return null;
      this.room.browsingGameIndex = browsingIndex(index);
      return null;
    },

    selectGame: (connection, args) => {
      this.requireHost(connection, 'hostCommand');
      if (this.room.game !== undefined) throw new Refusal({ kind: 'setupAlreadyRunning' });
      const selected = setupForGame(args.gameId, args.mode, undefined);
      const index = GAME_LOGIC_REGISTRY.findIndex((entry) => entry.metadata.id === args.gameId);
      this.cancelCountdownTimer();
      this.room.setup = { gameId: args.gameId, settings: selected.settings, mode: selected.mode, stage: 'configuring', readyPlayerIds: [] };
      if (index >= 0) this.room.browsingGameIndex = browsingIndex(index);
      return null;
    },

    configureGame: (connection, args) => {
      this.requireHost(connection, 'hostCommand');
      if (this.room.game !== undefined) throw new Refusal({ kind: 'setupAlreadyRunning' });
      const setup = this.room.setup;
      const gameId = args.gameId ?? setup?.gameId;
      if (gameId === undefined) throw new Refusal({ kind: 'setupNotFound' });
      if (setup?.stage === 'ready' || setup?.stage === 'countdown') throw new Refusal({ kind: 'setupLocked' });
      const game = gameLogicById(gameId);
      if (game === undefined) throw new Refusal({ kind: 'gameNotInstalled', gameId });
      const merged = { ...setup?.settings, ...args.settings };
      const mode = args.mode ?? setup?.mode ?? 'custom';
      const refusal = settingsRefusalForMode(game.settingsSchema, game.settingsPresentation, merged, mode);
      if (refusal !== null) throw new Refusal(refusal);
      this.room.setup = { gameId, settings: settingsFrom(game.settingsSchema, merged), mode, stage: 'configuring', readyPlayerIds: [] };
      return null;
    },

    finalizeGameSetup: (connection) => {
      const host = this.requireHost(connection, 'hostCommand');
      const setup = this.room.setup;
      if (setup === undefined) throw new Refusal({ kind: 'setupNotFound' });
      setupForGame(setup.gameId, setup.mode, setup.settings);
      this.cancelCountdownTimer();
      // Locking setup is the Host saying they are ready.
      this.room.setup = { ...withoutCountdown(setup), stage: 'ready', readyPlayerIds: [host.playerId] };
      return null;
    },

    setGameReady: (connection, { ready }) => {
      const seat = this.requireSeat(connection);
      this.limiter.consume('memberCommand', seat.playerId);
      const setup = this.room.setup;
      if (setup === undefined) throw new Refusal({ kind: 'setupNotFound' });
      if (setup.stage !== 'ready' && setup.stage !== 'countdown') throw new Refusal({ kind: 'setupNotReady' });
      const current = setup.readyPlayerIds;
      const readyPlayerIds = ready
        ? current.includes(seat.playerId) ? current : [...current, seat.playerId]
        : current.filter((playerId) => playerId !== seat.playerId);
      this.room.setup = { ...setup, readyPlayerIds };
      // An un-Ready during the countdown stops it.
      this.reconcileCountdown();
      return null;
    },

    reopenGameSetup: (connection) => {
      this.requireHost(connection, 'hostCommand');
      const setup = this.room.setup;
      if (setup === undefined) throw new Refusal({ kind: 'setupNotFound' });
      this.cancelCountdownTimer();
      this.room.setup = { ...withoutCountdown(setup), stage: 'configuring', readyPlayerIds: [] };
      return null;
    },

    cancelGameSetup: (connection) => {
      this.requireHost(connection, 'hostCommand');
      if (this.room.game === undefined) {
        this.cancelCountdownTimer();
        this.room.setup = undefined;
        this.room.browsingGameIndex = undefined;
      }
      return null;
    },

    startGame: (connection, args) => {
      this.requireHost(connection, 'hostCommand');
      this.startFromSetup(args);
      return null;
    },

    startCountdown: (connection) => {
      this.requireHost(connection, 'hostCommand');
      const setup = this.room.setup;
      // A second tap during the countdown asks for what is already happening.
      if (setup?.stage === 'countdown') return null;
      this.validatedStart({});
      const endsAt = this.ports.now() + COUNTDOWN_MS;
      this.room.setup = { ...setup!, stage: 'countdown', countdownEndsAt: endsAt };
      this.armCountdown(endsAt, COUNTDOWN_MS);
      return null;
    },

    stopCountdown: (connection) => {
      this.requireHost(connection, 'hostCommand');
      const setup = this.room.setup;
      if (setup?.stage !== 'countdown') return null;
      this.cancelCountdownTimer();
      this.room.setup = withoutCountdown(setup);
      return null;
    },

    endGame: (connection) => {
      this.requireHost(connection, 'hostCommand');
      this.deadlineTimer?.();
      this.deadlineTimer = undefined;
      this.cancelCountdownTimer();
      // The next lobby starts at the first card, not the game that just ended.
      this.room.game = undefined;
      this.room.setup = undefined;
      this.room.browsingGameIndex = undefined;
      return null;
    },

    continueAfterDisconnect: (connection) => {
      this.requireHost(connection, 'hostCommand');
      const running = this.room.game;
      // Idempotent for a duplicate tap or a choice that arrived after everyone came back.
      if (running?.playerPaused !== true) return null;
      const { playerPaused: _paused, ...continuing } = running;
      // A TV pause has display precedence: remember the choice, re-arm on TV return.
      this.room.game = this.room.tvAway ? continuing : this.resumePausedGameClock(continuing);
      return null;
    },

    sendEvent: (connection, { event }) => {
      const seat = this.requireSeat(connection);
      this.limiter.consume('gameEvent', seat.playerId);
      if (this.room.tvAway || this.room.game?.playerPaused === true) return null;
      if (typeof event !== 'object' || event === null || Array.isArray(event)) return null;
      // The seat the connection holds names the player; whatever the phone
      // wrote there is a claim the host does not read.
      this.playGameEvent({ ...(event as object), playerId: seat.playerId });
      return null;
    },
  };

  // ------------------------------------------------------------ authorization

  private requireSeat(connection: Connection): Seat {
    const seat = this.seatById(connection.playerId);
    if (seat === undefined) throw new Refusal({ kind: 'notInRoom' });
    return seat;
  }

  private requireHost(connection: Connection, limit: 'hostCommand'): Seat {
    const seat = this.requireSeat(connection);
    this.limiter.consume(limit, seat.playerId);
    if (this.room.hostPlayerId !== seat.playerId) throw new Refusal({ kind: 'notHost' });
    return seat;
  }

  /** The seat a host control names: in this room, and not the Host's own. */
  private targetSeat(actor: Seat, playerId: string): Seat {
    const target = this.seatById(playerId);
    if (target === undefined) throw new Refusal({ kind: 'targetNotInRoom' });
    if (target.playerId === actor.playerId) throw new Refusal({ kind: 'targetIsSelf' });
    return target;
  }

  private seatById(playerId: string | undefined): Seat | undefined {
    return playerId === undefined ? undefined : this.room.seats.find((seat) => seat.playerId === playerId);
  }

  private dropReady(playerId: string): void {
    const setup = this.room.setup;
    if (setup !== undefined) this.room.setup = { ...setup, readyPlayerIds: setup.readyPlayerIds.filter((id) => id !== playerId) };
  }

  // ------------------------------------------------------------ setup and countdown

  private readyCheckComplete(): boolean {
    const setup = this.room.setup;
    if (setup === undefined || this.room.game !== undefined || this.room.tvAway) return false;
    return readiness({
      stage: setup.stage,
      seats: this.room.seats.map((seat) => ({ playerId: seat.playerId, away: seat.away })),
      readyPlayerIds: setup.readyPlayerIds,
      playerRange: gameLogicById(setup.gameId)?.metadata.playerRange,
    }).complete;
  }

  /**
   * Stops the countdown when the ready check no longer holds. Called after
   * every change that can break it; it never starts one.
   */
  private reconcileCountdown(): void {
    const setup = this.room.setup;
    if (setup?.stage !== 'countdown' || this.readyCheckComplete()) return;
    this.cancelCountdownTimer();
    this.room.setup = withoutCountdown(setup);
  }

  private armCountdown(endsAt: number, afterMs: number): void {
    this.cancelCountdownTimer();
    this.countdownTimer = this.ports.setTimer(afterMs, () => {
      this.countdownTimer = undefined;
      this.change(() => this.launchCountdown(endsAt));
    });
  }

  private cancelCountdownTimer(): void {
    this.countdownTimer?.();
    this.countdownTimer = undefined;
  }

  /** The countdown ran out: start the game if the ready check still holds. */
  private launchCountdown(endsAt: number): void {
    const setup = this.room.setup;
    if (setup?.stage !== 'countdown' || setup.countdownEndsAt !== endsAt) return;
    if (!this.readyCheckComplete()) {
      this.room.setup = withoutCountdown(setup);
      return;
    }
    try {
      this.startFromSetup({});
    } catch (error) {
      if (!(error instanceof Refusal)) throw error;
      this.room.setup = withoutCountdown(setup);
    }
  }

  /**
   * Every refusal a start can meet, in the order the room hears them, or the
   * game, seats and settings it would use. The Host's Start and the start
   * itself share it, so a countdown only begins on a room that could start.
   */
  private validatedStart(args: StartArgs): { game: GameLogic; players: GamePlayer[]; requestedSettings: GameSettings | undefined } {
    const setup = this.room.setup;
    if (this.room.tvAway) throw new Refusal({ kind: 'tvUnavailable' });
    const gameId = args.gameId ?? setup?.gameId;
    if (gameId === undefined) throw new Refusal({ kind: 'setupNotFound' });
    const game = gameLogicById(gameId);
    if (game === undefined) throw new Refusal({ kind: 'gameNotInstalled', gameId });
    const players = this.gamePlayers();
    if (setup?.stage !== 'ready' && setup?.stage !== 'countdown') throw new Refusal({ kind: 'setupNotReady' });
    const away = players.filter((player) => player.away).map((player) => player.playerId);
    if (away.length > 0) throw new Refusal({ kind: 'playersAway', playerIds: away });
    const ready = new Set(setup.readyPlayerIds);
    const unready = players.filter((player) => !ready.has(player.playerId)).map((player) => player.playerId);
    if (unready.length > 0) throw new Refusal({ kind: 'playersNotReady', playerIds: unready });
    const requestedSettings = { ...setup.settings, ...args.settings };
    const mode = args.mode ?? setup.mode;
    const refusal =
      refusalToStart(roomPhase(this.room.game, setup), players.length, game.metadata.playerRange) ??
      (mode !== undefined
        ? settingsRefusalForMode(game.settingsSchema, game.settingsPresentation, requestedSettings, mode)
        : settingsRefusal(game.settingsSchema, requestedSettings));
    if (refusal !== null) throw new Refusal(refusal);
    return { game, players, requestedSettings };
  }

  private startFromSetup(args: StartArgs): void {
    const { game, players, requestedSettings } = this.validatedStart(args);
    const settings = settingsFrom(game.settingsSchema, requestedSettings);
    let state: unknown;
    try {
      state = game.decodeState(
        game.createInitialState({ players, settings, seed: Math.floor(this.ports.random() * 2 ** 31) }),
      );
      if (state === undefined) throw new Error('initial state decoder returned undefined');
    } catch {
      throw new Refusal({ kind: 'gameUnavailable', gameId: game.metadata.id });
    }
    const running: StoredGame = {
      gameId: game.metadata.id,
      stateVersion: game.stateVersion,
      state,
      settings,
      mode: args.mode ?? this.room.setup?.mode ?? 'standard',
    };
    const deadline = validatedDeadline(this.ports.log, this.room.roomId, running, game, state);
    if (!deadline.ok) throw new Refusal({ kind: 'gameUnavailable', gameId: game.metadata.id });
    this.cancelCountdownTimer();
    this.room.game = this.windGameClock(running, deadline.deadline);
    this.room.setup = undefined;
  }

  // ------------------------------------------------------------ game clock

  /** Stops the prior beat's timer and arms `deadline`, if any, for the next. */
  private windGameClock(running: StoredGame, deadline: { beat: string; afterMs: number; event: unknown } | undefined, afterMs?: number): StoredGame {
    this.deadlineTimer?.();
    this.deadlineTimer = undefined;
    const { deadlineAt: _at, deadlineBeat: _beat, deadlineEvent: _event, pausedRemainingMs: _paused, ...rest } = running;
    if (deadline === undefined) return rest;
    const wait = afterMs ?? deadline.afterMs;
    const gameId = running.gameId;
    this.deadlineTimer = this.ports.setTimer(wait, () => {
      this.deadlineTimer = undefined;
      this.change(() => this.reachDeadline(gameId, deadline.event));
    });
    return { ...rest, deadlineAt: this.ports.now() + wait, deadlineBeat: deadline.beat, deadlineEvent: deadline.event };
  }

  /** Stops the clock once and keeps the exact remainder for recovery. */
  private pauseGameClock(running: StoredGame | undefined): StoredGame | undefined {
    if (running === undefined || running.deadlineAt === undefined) return running;
    this.deadlineTimer?.();
    this.deadlineTimer = undefined;
    const { deadlineAt, deadlineBeat: _beat, deadlineEvent: _event, ...rest } = running;
    return { ...rest, pausedRemainingMs: Math.max(0, deadlineAt - this.ports.now()) };
  }

  /** Re-arms a paused game from its remainder, re-reading the beat's deadline. */
  private resumePausedGameClock(running: StoredGame): StoredGame {
    const remaining = running.pausedRemainingMs;
    const { pausedRemainingMs: _paused, ...rest } = running;
    if (remaining === undefined) return rest;
    const runtime = decodeStoredRuntime(this.ports.log, this.room.roomId, rest);
    if (runtime === undefined) return rest;
    const checked = validatedDeadline(this.ports.log, this.room.roomId, rest, runtime.game, runtime.state);
    if (!checked.ok || checked.deadline === undefined) return rest;
    return this.windGameClock(rest, checked.deadline, Math.max(0, remaining));
  }

  private reachDeadline(gameId: string, event: unknown): void {
    const running = this.room.game;
    if (running === undefined || running.gameId !== gameId) return;
    const { deadlineAt: _at, deadlineBeat: _beat, deadlineEvent: _event, ...expired } = running;
    this.room.game = expired;
    this.playGameEvent(event as GameEvent);
  }

  /**
   * Puts an event to the running game's rules and winds the clock to the beat
   * that leaves it on. A phone's tap and the room's own deadline both come
   * through here, judged by the same reducer.
   */
  private playGameEvent(event: GameEvent): void {
    const running = this.room.game;
    if (this.room.tvAway || running === undefined || running.playerPaused === true) return;
    const runtime = decodeStoredRuntime(this.ports.log, this.room.roomId, running);
    if (runtime === undefined) return;
    const { game, state } = runtime;
    const now = this.ports.now();

    let decodedEvent: GameEvent;
    try {
      decodedEvent = game.decodeEvent({
        ...event,
        ...(running.deadlineAt === undefined ? {} : { msRemaining: running.deadlineAt - now }),
        awayPlayerIds: this.room.seats.filter((seat) => seat.away).map((seat) => seat.playerId),
        fromHost: event.playerId !== undefined && event.playerId === this.room.hostPlayerId,
      });
      if (decodedEvent === undefined) throw new Error('event decoder returned undefined');
    } catch {
      runtimeFailure(this.ports.log, this.room.roomId, running, 'eventDecode');
      return;
    }

    let next: unknown;
    try {
      next = game.reduce(state, decodedEvent);
    } catch {
      runtimeFailure(this.ports.log, this.room.roomId, running, 'reducer');
      return;
    }
    if (next === undefined || next === state) return;
    try {
      next = game.decodeState(next);
      if (next === undefined) throw new Error('reducer decoder returned undefined');
    } catch {
      runtimeFailure(this.ports.log, this.room.roomId, running, 'reducerOutput');
      return;
    }

    const nextDeadline = validatedDeadline(this.ports.log, this.room.roomId, running, game, next);
    if (!nextDeadline.ok) return;
    const updated: StoredGame = { ...running, stateVersion: game.stateVersion, state: next };
    const sameBeat =
      running.deadlineAt !== undefined &&
      this.deadlineTimer !== undefined &&
      running.deadlineBeat === nextDeadline.deadline?.beat;
    this.room.game = sameBeat ? updated : this.windGameClock(updated, nextDeadline.deadline);
  }

  // ------------------------------------------------------------ views

  private gamePlayers(): GamePlayer[] {
    return this.room.seats.map((seat) => ({ playerId: seat.playerId, nickname: seat.nickname, away: seat.away, avatar: seat.avatar }));
  }

  private sessionOf(seat: Seat): NonNullable<ViewValue<'session'>> {
    return { playerId: seat.playerId, roomId: this.room.roomId, code: this.room.code, nickname: seat.nickname, avatar: seat.avatar };
  }

  private view<Name extends ViewName>(name: Name, viewer: Viewer): ViewValue<Name> {
    const room = this.room;
    const now = this.ports.now();
    switch (name) {
      case 'session': {
        const seat = viewer.kind === 'player' ? this.seatById(viewer.playerId) : undefined;
        return (seat === undefined ? null : this.sessionOf(seat)) as ViewValue<Name>;
      }
      case 'roster':
        return room.seats.map((seat) => ({
          playerId: seat.playerId,
          nickname: seat.nickname,
          away: seat.away,
          host: seat.playerId === room.hostPlayerId,
          avatar: seat.avatar,
        })) as ViewValue<Name>;
      case 'setup': {
        const setup = room.setup;
        if (setup === undefined) return null as ViewValue<Name>;
        return {
          gameId: setup.gameId,
          settings: setup.settings,
          mode: setup.mode,
          stage: setup.stage,
          readyPlayerIds: [...setup.readyPlayerIds],
          ...(setup.stage === 'countdown' && setup.countdownEndsAt !== undefined
            ? { countdownRemainingMs: Math.max(0, setup.countdownEndsAt - now) }
            : {}),
        } as ViewValue<Name>;
      }
      case 'browsing':
        return (room.browsingGameIndex === undefined ? null : browsingIndex(room.browsingGameIndex)) as ViewValue<Name>;
      case 'running':
        return this.runningView(viewer, now) as ViewValue<Name>;
      case 'connection':
        return { away: room.tvAway } as ViewValue<Name>;
      case 'arrivals': {
        if (viewer.kind !== 'tv') return [] as ViewValue<Name>;
        const held = new Set(room.seats.map((seat) => seat.avatar));
        return room.previews
          .filter((preview) => !held.has(preview.avatar))
          .map((preview) => ({ previewId: preview.previewId, nickname: preview.nickname, avatar: preview.avatar })) as ViewValue<Name>;
      }
      default:
        return null as ViewValue<Name>;
    }
  }

  private runningView(viewer: Viewer, now: number): ViewValue<'running'> {
    const running = this.room.game;
    if (running === undefined) return null;
    const runtime: DecodedRuntime | undefined = decodeStoredRuntime(this.ports.log, this.room.roomId, running);
    if (runtime === undefined) return { kind: 'unavailable', gameId: running.gameId };
    if (this.room.tvAway) return { kind: 'paused', gameId: running.gameId, reason: 'tvDisconnected' };
    if (running.playerPaused === true) return { kind: 'paused', gameId: running.gameId, reason: 'playerDisconnected' };
    const state = projectRuntime(runtime, viewer.kind === 'tv' ? undefined : viewer.playerId);
    if (state === undefined) {
      runtimeFailure(this.ports.log, this.room.roomId, running, 'projection');
      return { kind: 'unavailable', gameId: running.gameId };
    }
    return {
      kind: 'running',
      gameId: running.gameId,
      state,
      ...(running.settings === undefined ? {} : { settings: running.settings }),
      ...(running.mode === undefined ? {} : { mode: running.mode }),
      ...(running.deadlineAt === undefined ? {} : { clockRemainingMs: Math.max(0, running.deadlineAt - now) }),
    };
  }

  private tvViews(): TvViews {
    const tv: Viewer = { kind: 'tv' };
    return {
      roomId: this.room.roomId,
      code: this.room.code,
      roster: this.view('roster', tv),
      setup: this.view('setup', tv),
      browsing: this.view('browsing', tv),
      running: this.view('running', tv),
      connection: this.view('connection', tv),
      arrivals: this.view('arrivals', tv),
    };
  }

  /** Runs a change, then pushes what changed and saves. Nested calls flush once. */
  private depth = 0;
  private change(run: () => void): void {
    this.depth += 1;
    try {
      run();
    } finally {
      this.depth -= 1;
    }
    if (this.depth === 0) this.flush();
  }

  private flush(): void {
    if (this.disposed) return;
    for (const connection of this.connections.values()) {
      if (connection.playerId === undefined) continue;
      const viewer: Viewer = { kind: 'player', playerId: connection.playerId };
      for (const name of PHONE_VIEWS) {
        const value = this.view(name, viewer);
        const key = JSON.stringify(withoutClock(value));
        if (connection.sent.get(name) === key) continue;
        connection.sent.set(name, key);
        this.sendTo(connection, { type: 'view', name, value } as HostMessage);
      }
    }
    if (this.tvListeners.size > 0) {
      const views = this.tvViews();
      for (const listener of this.tvListeners) listener(views);
    }
    const save = this.ports.save;
    if (save === undefined) return;
    const saved = JSON.stringify(this.room);
    if (saved === this.lastSaved) return;
    this.lastSaved = saved;
    save(this.snapshot());
  }

  private lastSaved: string | undefined;

  private newId(prefix: string): string {
    return `${prefix}_${generateSessionToken(this.ports.random).slice(0, 16)}`;
  }
}

/** The setup with no countdown on it; the stage and the deadline go together. */
function withoutCountdown(setup: Setup): Setup {
  const { countdownEndsAt: _endsAt, ...rest } = setup;
  return { ...rest, stage: setup.stage === 'countdown' ? 'ready' : setup.stage };
}

/** A game's settings for a mode, or the refusal that says why not. */
function setupForGame(gameId: string, mode: GameSetupMode | undefined, chosen: GameSettings | undefined) {
  const game = gameLogicById(gameId);
  if (game === undefined) throw new Refusal({ kind: 'gameNotInstalled', gameId });
  const resolvedMode = mode ?? 'standard';
  const preset =
    resolvedMode === 'custom'
      ? undefined
      : game.settingsPresentation?.presets?.find((candidate) => candidate.mode === resolvedMode)?.settings;
  const settings = chosen ?? preset ?? settingsFrom(game.settingsSchema, undefined);
  const refusal = settingsRefusalForMode(game.settingsSchema, game.settingsPresentation, settings, resolvedMode);
  if (refusal !== null) throw new Refusal(refusal);
  return { game, settings, mode: resolvedMode };
}

/** A deep copy of JSON-safe room state. Hermes has no `structuredClone`. */
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** A view without the remainders that change every millisecond, for diffing. */
function withoutClock(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const { clockRemainingMs: _clock, countdownRemainingMs: _countdown, ...rest } = value as Record<string, unknown>;
  return rest;
}
