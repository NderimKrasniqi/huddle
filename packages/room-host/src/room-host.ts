import {
  ANONYMOUS_COMMANDS,
  type CommandArgs,
  type CommandName,
  type CommandResult,
  decodeClientMessage,
  type HostMessage,
  PHONE_VIEWS,
  PROTOCOL_VERSION,
  type RoomRejection,
  type ViewName,
} from '@huddle/contracts/protocol';

import { gameCommands } from './commands/game';
import { gameSetupCommands } from './commands/game-setup';
import { hostingCommands } from './commands/hosting';
import { joiningCommands } from './commands/joining';
import { type Connection, Connections } from './connections';
import { type CommandTable, RoomCore } from './core';
import type { CancelTimer, HostPorts } from './ports';
import { Refusal } from './refusal';
import type { HostSnapshot } from './state';
import { type TvViews, tvViewsOf, type Viewer, viewOf, withoutClock } from './views';

export type { TvViews };

const SWEEP_INTERVAL_MS = 1_000;
export const CONNECTION_CAP = 32;

export type HostConnection = {
  readonly receive: (frame: string) => void;
  readonly disconnect: () => void;
};

export class RoomHost {
  private readonly core: RoomCore;
  private readonly commands: CommandTable;
  private readonly connections = new Connections();
  private readonly tvListeners = new Set<(views: TvViews) => void>();
  private sweepTimer: CancelTimer | undefined;
  private disposed = false;
  private depth = 0;
  private lastSaved: string | undefined;

  constructor(
    private readonly ports: HostPorts,
    snapshot?: HostSnapshot,
  ) {
    this.core = new RoomCore(ports, this.connections, (run) => this.change(run), snapshot);
    this.commands = {
      ...joiningCommands(this.core),
      ...hostingCommands(this.core),
      ...gameSetupCommands(this.core),
      ...gameCommands(this.core),
    };
    this.armSweep();
    this.flush();
  }

  get restored(): boolean {
    return this.core.restored;
  }

  info(): { readonly roomId: string; readonly code: string; readonly tvInstanceId: string; readonly hasRunningGame: boolean } {
    const room = this.core.room;
    return { roomId: room.roomId, code: room.code, tvInstanceId: this.core.tvInstanceId, hasRunningGame: room.game !== undefined };
  }

  connect(send: (frame: string) => void, close: () => void): HostConnection {
    if (this.disposed || this.connections.size >= CONNECTION_CAP) {
      close();
      return { receive: () => {}, disconnect: () => {} };
    }
    const connection = this.connections.open(send, close, this.ports.now());
    return {
      receive: (frame) => this.receive(connection, frame),
      disconnect: () => this.connections.forget(connection),
    };
  }

  subscribeTv(listener: (views: TvViews) => void): () => void {
    this.tvListeners.add(listener);
    listener(tvViewsOf(this.core.room, this.ports.now(), this.ports.log));
    return () => this.tvListeners.delete(listener);
  }

  setTvAway(away: boolean): void {
    this.change(() => (away ? this.core.markTvAway() : this.core.restoreTv()));
  }

  replaceEmptyRoom(): boolean {
    if (this.disposed || this.core.room.seats.length > 0) return false;
    this.change(() => {
      this.connections.dropAll();
      this.core.room = this.core.freshRoom();
    });
    return true;
  }

  snapshot(): HostSnapshot {
    return this.core.snapshot();
  }

  dispose(): void {
    this.disposed = true;
    this.core.stopTimers();
    this.sweepTimer?.();
    this.connections.dropAll();
    this.tvListeners.clear();
  }

  private armSweep(): void {
    this.sweepTimer = this.ports.setTimer(SWEEP_INTERVAL_MS, () => {
      if (this.disposed) return;
      // Most seconds change nothing; only then are views rebuilt and sent.
      this.depth += 1;
      let changed = false;
      try {
        changed = this.core.sweep();
      } finally {
        this.depth -= 1;
      }
      if (changed && this.depth === 0) this.flush();
      this.core.limiter.prune();
      this.armSweep();
    });
  }

  private receive(connection: Connection, frame: string): void {
    if (this.disposed || !this.connections.has(connection)) return;
    connection.lastFrameAt = this.ports.now();
    const decoded = decodeClientMessage(frame);
    if (!decoded.ok && decoded.requestId !== undefined && connection.greeted) {
      this.connections.send(connection, { type: 'result', requestId: decoded.requestId, ok: false, rejection: decoded.rejection });
      return;
    }
    if (!decoded.ok) {
      this.connections.drop(connection);
      return;
    }
    const message = decoded.message;
    if (message.type === 'hello') {
      if (message.protocol !== PROTOCOL_VERSION) {
        this.connections.drop(connection, { type: 'incompatible', protocol: PROTOCOL_VERSION });
        return;
      }
      connection.greeted = true;
      this.connections.send(connection, { type: 'welcome', protocol: PROTOCOL_VERSION, tvInstanceId: this.core.tvInstanceId, roomCode: this.core.room.code });
      return;
    }
    if (!connection.greeted) {
      this.connections.drop(connection);
      return;
    }
    const seat = this.core.seatById(connection.playerId);
    if (message.type === 'ping') {
      if (seat !== undefined && !seat.away) seat.lastSeenAt = this.ports.now();
      else if (seat !== undefined) this.change(() => this.core.touch(seat));
      this.connections.send(connection, { type: 'pong', sentAt: message.sentAt });
      return;
    }
    const { requestId, name, args } = message;
    const limiter = this.core.limiter;
    limiter.begin();
    try {
      let value: unknown = null;
      this.change(() => {
        if (seat !== undefined) this.core.touch(seat);
        value = this.run(connection, name, args as never);
      });
      limiter.commit();
      this.connections.send(connection, { type: 'result', requestId, ok: true, value });
    } catch (error) {
      limiter.rollback();
      const rejection: RoomRejection = error instanceof Refusal ? error.rejection : { kind: 'hostError' };
      if (!(error instanceof Refusal)) this.ports.log?.('Huddle room host error', { command: name });
      this.connections.send(connection, { type: 'result', requestId, ok: false, rejection });
      this.flush();
    }
  }

  private run<Name extends CommandName>(connection: Connection, name: Name, args: CommandArgs<Name>): CommandResult<Name> {
    const seated = this.core.seatById(connection.playerId) !== undefined;
    if (!ANONYMOUS_COMMANDS.has(name) && !seated) throw new Refusal({ kind: 'notJoined' });
    // A second join would rebind the connection and orphan its first seat.
    if (name === 'joinRoom' && seated) throw new Refusal({ kind: 'badMessage' });
    const handler = this.commands[name] as (connection: Connection, args: CommandArgs<Name>) => CommandResult<Name>;
    return handler(connection, args);
  }

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
    const room = this.core.room;
    const now = this.ports.now();
    for (const connection of this.connections.values()) {
      if (connection.playerId === undefined) {
        if (connection.watchingAvailability === true) this.pushView(connection, 'availability', { kind: 'tv' }, now);
        continue;
      }
      const viewer: Viewer = { kind: 'player', playerId: connection.playerId };
      for (const name of PHONE_VIEWS) this.pushView(connection, name, viewer, now);
    }
    if (this.tvListeners.size > 0) {
      const views = tvViewsOf(room, now, this.ports.log);
      for (const listener of this.tvListeners) listener(views);
    }
    const save = this.ports.save;
    if (save === undefined) return;
    // Beats alone are not worth a write; a restore gives every seat a fresh one.
    const saved = JSON.stringify(room, (key, value: unknown) => (key === 'lastSeenAt' ? undefined : value));
    if (saved === this.lastSaved) return;
    this.lastSaved = saved;
    save(this.core.snapshot());
  }

  private pushView(connection: Connection, name: ViewName, viewer: Viewer, now: number): void {
    const value = viewOf(this.core.room, name, viewer, now, this.ports.log);
    const key = JSON.stringify(withoutClock(value));
    if (connection.sent.get(name) === key) return;
    connection.sent.set(name, key);
    this.connections.send(connection, { type: 'view', name, value } as HostMessage);
  }
}
