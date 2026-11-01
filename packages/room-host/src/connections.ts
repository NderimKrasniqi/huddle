import { encodeMessage, type HostMessage, type ViewName } from '@huddle/contracts/protocol';

export type Connection = {
  readonly id: number;
  readonly send: (frame: string) => void;
  readonly close: () => void;
  greeted: boolean;
  playerId?: string;
  lastFrameAt: number;
  watchingAvailability?: boolean;
  readonly sent: Map<ViewName, string>;
};

export class Connections {
  private readonly byId = new Map<number, Connection>();
  private nextId = 1;

  get size(): number {
    return this.byId.size;
  }

  values(): Connection[] {
    return [...this.byId.values()];
  }

  has(connection: Connection): boolean {
    return this.byId.has(connection.id);
  }

  open(send: (frame: string) => void, close: () => void, now: number): Connection {
    const connection: Connection = { id: this.nextId++, send, close, greeted: false, sent: new Map(), lastFrameAt: now };
    this.byId.set(connection.id, connection);
    return connection;
  }

  forget(connection: Connection): void {
    this.byId.delete(connection.id);
  }

  drop(connection: Connection, farewell?: HostMessage): void {
    if (farewell !== undefined) this.send(connection, farewell);
    connection.close();
    this.byId.delete(connection.id);
  }

  dropAll(farewellToSeated?: HostMessage): void {
    for (const connection of this.byId.values()) {
      if (farewellToSeated !== undefined && connection.playerId !== undefined) this.send(connection, farewellToSeated);
      connection.close();
    }
    this.byId.clear();
  }

  send(connection: Connection, message: HostMessage): void {
    connection.send(encodeMessage(message));
  }

  bind(connection: Connection, playerId: string): void {
    for (const other of this.of(playerId)) {
      if (other.id !== connection.id) this.drop(other, { type: 'closed', reason: 'replaced' });
    }
    connection.playerId = playerId;
    connection.sent.clear();
  }

  unseat(playerId: string, reason: 'removed' | undefined): void {
    for (const connection of this.of(playerId)) {
      connection.playerId = undefined;
      connection.sent.clear();
      this.send(connection, { type: 'view', name: 'session', value: null });
      if (reason !== undefined) this.drop(connection, { type: 'closed', reason });
    }
  }

  private of(playerId: string): Connection[] {
    return this.values().filter((connection) => connection.playerId === playerId);
  }
}
