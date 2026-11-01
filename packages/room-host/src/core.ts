import type { CommandArgs, CommandName, CommandResult } from '@huddle/contracts/protocol';
import {
  AWAY_AFTER_MS,
  type GameEvent,
  type GameLogic,
  type GamePlayer,
  type GameSettings,
  type GameSetupMode,
  generateRoomCode,
  generateSessionToken,
  readiness,
  refusalToStart,
  ROOM_EXPIRY_MS,
  roomPhase,
  settingsFrom,
  settingsRefusal,
  settingsRefusalForMode,
} from '@huddle/domain';
import { gameLogicById } from '@huddle/game-registry/logic';

import type { Connection, Connections } from './connections';
import { advanceGame, decodeStoredRuntime, validatedDeadline } from './game-runtime';
import type { CancelTimer, HostPorts } from './ports';
import { RateLimiter } from './rate-limits';
import { Refusal } from './refusal';
import { withoutCountdown } from './setup';
import { type HostSnapshot, type RoomState, type Seat, SNAPSHOT_VERSION, type StoredGame } from './state';

export type { Connection };

type StartArgs = {
  readonly gameId?: string;
  readonly settings?: Record<string, string>;
  readonly mode?: GameSetupMode;
};

export type CommandTable = {
  readonly [Name in CommandName]: (connection: Connection, args: CommandArgs<Name>) => CommandResult<Name>;
};

const SEAT_PREVIEW_TTL_MS = 20_000;
// Abandoned join forms must not fill the cap; an open form asks every three seconds.
const UNSEATED_IDLE_MS = 30_000;

type Deadline = { readonly beat: string; readonly afterMs: number; readonly event: unknown };

export class RoomCore {
  room: RoomState;
  readonly tvInstanceId: string;
  readonly restored: boolean;
  readonly limiter: RateLimiter;
  private countdownTimer: CancelTimer | undefined;
  private deadlineTimer: CancelTimer | undefined;

  constructor(
    readonly ports: HostPorts,
    readonly connections: Connections,
    private readonly change: (run: () => void) => void,
    snapshot?: HostSnapshot,
  ) {
    this.limiter = new RateLimiter(ports.now);
    const usable = snapshot !== undefined && snapshot.version === SNAPSHOT_VERSION && ports.now() - snapshot.savedAt < ROOM_EXPIRY_MS;
    this.restored = usable;
    this.tvInstanceId = usable ? snapshot.tvInstanceId : this.newId('tv');
    this.room = usable ? this.restoreRoom(snapshot) : this.freshRoom();
  }

  snapshot(): HostSnapshot {
    return { version: SNAPSHOT_VERSION, tvInstanceId: this.tvInstanceId, savedAt: this.ports.now(), room: copy(this.room) };
  }

  newId(prefix: string): string {
    return `${prefix}_${generateSessionToken(this.ports.random).slice(0, 16)}`;
  }

  freshRoom(): RoomState {
    return { roomId: this.newId('room'), code: generateRoomCode(this.ports.random), tvAway: false, seats: [], previews: [] };
  }

  stopTimers(): void {
    this.cancelCountdownTimer();
    this.stopGameClock();
  }

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
    this.forgiveTvOutage();
    if (room.game !== undefined && room.game.playerPaused !== true && room.game.pausedRemainingMs !== undefined) {
      room.game = this.resumePausedGameClock(room.game);
    }
    return room;
  }

  private closeRoom(): void {
    this.connections.dropAll({ type: 'closed', reason: 'roomClosed' });
    this.stopTimers();
    this.room = this.freshRoom();
  }

  markTvAway(): void {
    // No phone can reach an away TV, so nobody is marked away meanwhile.
    if (this.room.tvAway) return;
    this.room.game = this.pauseGameClock(this.room.game);
    this.room.tvAway = true;
    this.room.tvAwaySince = this.ports.now();
    this.reconcileCountdown();
  }

  restoreTv(): void {
    if (!this.room.tvAway) return;
    this.room.tvAway = false;
    this.room.tvAwaySince = undefined;
    this.forgiveTvOutage();
    const running = this.room.game;
    if (running === undefined || running.playerPaused === true) return;
    this.room.game = this.resumePausedGameClock(running);
  }

  // Phones cannot reach a TV that is down or backgrounded, so that silence is not theirs.
  private forgiveTvOutage(): void {
    const now = this.ports.now();
    for (const seat of this.room.seats) if (!seat.away) seat.lastSeenAt = now;
  }

  sweep(): boolean {
    const now = this.ports.now();
    if (this.room.tvAway && this.room.tvAwaySince !== undefined && now - this.room.tvAwaySince >= ROOM_EXPIRY_MS) {
      this.closeRoom();
      return true;
    }
    const previews = this.room.previews.length;
    this.room.previews = this.room.previews.filter((preview) => now - preview.updatedAt < SEAT_PREVIEW_TTL_MS);
    let changed = this.room.previews.length !== previews;
    for (const connection of this.connections.values()) {
      if (this.seatById(connection.playerId) === undefined && now - connection.lastFrameAt >= UNSEATED_IDLE_MS) this.connections.drop(connection);
    }
    if (this.room.tvAway) return changed;
    for (const seat of this.room.seats) {
      if (!seat.away && now - seat.lastSeenAt >= AWAY_AFTER_MS) {
        this.markAway(seat);
        changed = true;
      }
    }
    return changed;
  }

  seatById(playerId: string | undefined): Seat | undefined {
    return playerId === undefined ? undefined : this.room.seats.find((seat) => seat.playerId === playerId);
  }

  beating(seat: Seat): boolean {
    return this.ports.now() - seat.lastSeenAt < AWAY_AFTER_MS;
  }

  touch(seat: Seat): void {
    seat.lastSeenAt = this.ports.now();
    if (!seat.away) return;
    seat.away = false;
    this.restoreConnectedHost();
    this.resumeWhenEveryoneReturns();
  }

  private markAway(seat: Seat): void {
    seat.away = true;
    this.reconcileCountdown();
    this.handOverRoom(seat, false);
    this.pauseForDisconnectedPlayer();
  }

  // A quiet Host keeps the room when nobody else is beating either; going quiet is not resigning.
  handOverRoom(departing: Seat, departingIsLeaving: boolean): void {
    if (this.room.hostPlayerId !== departing.playerId) return;
    const others = this.room.seats.filter((seat) => seat.playerId !== departing.playerId);
    const beating = others
      .filter((seat) => this.beating(seat))
      .reduce<Seat | undefined>((best, seat) => (best === undefined || seat.lastSeenAt > best.lastSeenAt ? seat : best), undefined);
    const successor = beating ?? (departingIsLeaving ? others[0] : undefined);
    if (successor !== undefined) this.room.hostPlayerId = successor.playerId;
  }

  private restoreConnectedHost(): void {
    const host = this.seatById(this.room.hostPlayerId);
    if (host !== undefined && this.beating(host)) return;
    const successor = this.room.seats.find((seat) => this.beating(seat));
    if (successor !== undefined) this.room.hostPlayerId = successor.playerId;
  }

  needsHost(): boolean {
    return this.seatById(this.room.hostPlayerId) === undefined;
  }

  private pauseForDisconnectedPlayer(): void {
    const running = this.room.game;
    if (running === undefined || running.playerPaused === true) return;
    this.room.game = { ...this.pauseGameClock(running)!, playerPaused: true };
  }

  resumeWhenEveryoneReturns(): void {
    const running = this.room.game;
    if (running?.playerPaused !== true) return;
    const seats = this.room.seats;
    if (seats.length === 0 || seats.some((seat) => !this.beating(seat))) return;
    const { playerPaused: _paused, ...recovered } = running;
    this.room.game = this.room.tvAway ? recovered : this.resumePausedGameClock(recovered);
  }

  bind(connection: Connection, playerId: string): void {
    this.connections.bind(connection, playerId);
  }

  unseatConnections(playerId: string, reason: 'removed' | undefined): void {
    this.connections.unseat(playerId, reason);
  }

  requireSeat(connection: Connection): Seat {
    const seat = this.seatById(connection.playerId);
    if (seat === undefined) throw new Refusal({ kind: 'notInRoom' });
    return seat;
  }

  requireHost(connection: Connection, limit: 'hostCommand'): Seat {
    const seat = this.requireSeat(connection);
    this.limiter.consume(limit, seat.playerId);
    if (this.room.hostPlayerId !== seat.playerId) throw new Refusal({ kind: 'notHost' });
    return seat;
  }

  targetSeat(actor: Seat, playerId: string): Seat {
    const target = this.seatById(playerId);
    if (target === undefined) throw new Refusal({ kind: 'targetNotInRoom' });
    if (target.playerId === actor.playerId) throw new Refusal({ kind: 'targetIsSelf' });
    return target;
  }

  dropReady(playerId: string): void {
    const setup = this.room.setup;
    if (setup !== undefined) this.room.setup = { ...setup, readyPlayerIds: setup.readyPlayerIds.filter((id) => id !== playerId) };
  }

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

  reconcileCountdown(): void {
    const setup = this.room.setup;
    if (setup?.stage !== 'countdown' || this.readyCheckComplete()) return;
    this.cancelCountdownTimer();
    this.room.setup = withoutCountdown(setup);
  }

  armCountdown(endsAt: number, afterMs: number): void {
    this.cancelCountdownTimer();
    this.countdownTimer = this.ports.setTimer(afterMs, () => {
      this.countdownTimer = undefined;
      this.change(() => this.launchCountdown(endsAt));
    });
  }

  cancelCountdownTimer(): void {
    this.countdownTimer?.();
    this.countdownTimer = undefined;
  }

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

  validatedStart(args: StartArgs): { game: GameLogic; players: GamePlayer[]; requestedSettings: GameSettings | undefined } {
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

  startFromSetup(args: StartArgs): void {
    const { game, players, requestedSettings } = this.validatedStart(args);
    const settings = settingsFrom(game.settingsSchema, requestedSettings);
    let state: unknown;
    try {
      state = game.decodeState(game.createInitialState({ players, settings, seed: Math.floor(this.ports.random() * 2 ** 31) }));
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

  stopGameClock(): void {
    this.deadlineTimer?.();
    this.deadlineTimer = undefined;
  }

  private windGameClock(running: StoredGame, deadline: Deadline | undefined, afterMs?: number): StoredGame {
    this.stopGameClock();
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

  private pauseGameClock(running: StoredGame | undefined): StoredGame | undefined {
    if (running === undefined || running.deadlineAt === undefined) return running;
    this.stopGameClock();
    const { deadlineAt, deadlineBeat: _beat, deadlineEvent: _event, ...rest } = running;
    return { ...rest, pausedRemainingMs: Math.max(0, deadlineAt - this.ports.now()) };
  }

  resumePausedGameClock(running: StoredGame): StoredGame {
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

  playGameEvent(event: GameEvent): void {
    const running = this.room.game;
    if (this.room.tvAway || running === undefined || running.playerPaused === true) return;
    const step = advanceGame(this.ports.log, this.room.roomId, running, {
      ...event,
      // Always the host's value, so a phone cannot send its own.
      msRemaining: running.deadlineAt === undefined ? undefined : running.deadlineAt - this.ports.now(),
      awayPlayerIds: this.room.seats.filter((seat) => seat.away).map((seat) => seat.playerId),
      fromHost: event.playerId !== undefined && event.playerId === this.room.hostPlayerId,
    });
    if (step === undefined) return;
    const updated: StoredGame = { ...running, stateVersion: step.game.stateVersion, state: step.state };
    const sameBeat = running.deadlineAt !== undefined && this.deadlineTimer !== undefined && running.deadlineBeat === step.deadline?.beat;
    this.room.game = sameBeat ? updated : this.windGameClock(updated, step.deadline);
  }

  private gamePlayers(): GamePlayer[] {
    return this.room.seats.map((seat) => ({ playerId: seat.playerId, nickname: seat.nickname, away: seat.away, avatar: seat.avatar }));
  }
}

// Hermes has no structuredClone.
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
