import {
  type CommandArgs,
  type CommandName,
  type CommandResult,
  decodeCommandResult,
  decodeHostMessage,
  encodeMessage,
  type HostMessage,
  PROTOCOL_VERSION,
  type RoomRejection,
  type ViewName,
  type ViewValue,
} from '@huddle/contracts/protocol';
import { HEARTBEAT_INTERVAL_MS } from '@huddle/domain';

/** A command the host refused. */
export class BotRefusal extends Error {
  constructor(readonly rejection: RoomRejection) {
    super(`refused: ${rejection.kind}`);
  }
}

/**
 * A scripted phone: it speaks the Room Protocol over Node's built-in
 * WebSocket, keeps the views the host pushes, and beats like a phone in front
 * of its owner until told to go quiet.
 */
export class Bot {
  private readonly views = new Map<ViewName, unknown>();
  private readonly pending = new Map<number, { name: CommandName; resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private readonly watchers = new Set<() => void>();
  private nextRequest = 1;
  private beat: ReturnType<typeof setInterval> | undefined;
  closed: string | undefined;

  private constructor(
    readonly name: string,
    private readonly socket: WebSocket,
  ) {}

  static async connect(url: string, name: string): Promise<Bot> {
    const socket = new WebSocket(url);
    const bot = new Bot(name, socket);
    const welcomed = new Promise<void>((resolve, reject) => {
      socket.addEventListener('message', (event) => {
        const message = bot.onFrame(String(event.data));
        if (message?.type === 'welcome') resolve();
        if (message?.type === 'incompatible') reject(new Error(`${name}: host speaks protocol ${message.protocol}`));
      });
      socket.addEventListener('close', () => {
        bot.closed ??= 'transport';
        reject(new Error(`${name}: closed before welcome`));
        bot.stopBeating();
        for (const request of bot.pending.values()) request.reject(new Error(`${name}: connection closed`));
        bot.pending.clear();
        bot.notify();
      });
    });
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => resolve(), { once: true });
      socket.addEventListener('error', () => reject(new Error(`${name}: cannot reach ${url}`)), { once: true });
    });
    socket.send(encodeMessage({ type: 'hello', protocol: PROTOCOL_VERSION }));
    await welcomed;
    return bot;
  }

  private onFrame(frame: string): HostMessage | undefined {
    const decoded = decodeHostMessage(frame);
    if (!decoded.ok) {
      console.warn(`${this.name}: undecodable host frame`);
      return undefined;
    }
    const message = decoded.message;
    if (message.type === 'view') this.views.set(message.name, message.value);
    if (message.type === 'closed') this.closed = message.reason;
    if (message.type === 'result') {
      const request = this.pending.get(message.requestId);
      this.pending.delete(message.requestId);
      if (request !== undefined) {
        if (message.ok) request.resolve(decodeCommandResult(request.name, message.value));
        else request.reject(new BotRefusal(message.rejection));
      }
    }
    this.notify();
    return message;
  }

  private notify(): void {
    for (const watcher of this.watchers) watcher();
  }

  command<Name extends CommandName>(name: Name, args: CommandArgs<Name>): Promise<CommandResult<Name>> {
    const requestId = this.nextRequest++;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { name, resolve: resolve as (value: unknown) => void, reject });
      this.socket.send(encodeMessage({ type: 'command', requestId, name, args } as never));
    });
  }

  /** Like `command`, but a refusal resolves to `false` instead of throwing. */
  async attempt<Name extends CommandName>(name: Name, args: CommandArgs<Name>): Promise<boolean> {
    try {
      await this.command(name, args);
      return true;
    } catch (error) {
      if (error instanceof BotRefusal) return false;
      throw error;
    }
  }

  view<Name extends ViewName>(name: Name): ViewValue<Name> | undefined {
    return this.views.get(name) as ViewValue<Name> | undefined;
  }

  /** Resolves once `check` holds against the latest views, or rejects after `timeoutMs`. */
  waitFor(check: (bot: Bot) => boolean, timeoutMs = 120_000): Promise<void> {
    if (check(this)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.watchers.delete(watcher);
        reject(new Error(`${this.name}: timed out waiting`));
      }, timeoutMs);
      const watcher = () => {
        if (!check(this)) return;
        clearTimeout(timer);
        this.watchers.delete(watcher);
        resolve();
      };
      this.watchers.add(watcher);
    });
  }

  startBeating(): void {
    this.stopBeating();
    this.beat = setInterval(() => {
      if (this.socket.readyState === WebSocket.OPEN) this.socket.send(encodeMessage({ type: 'ping', sentAt: Date.now() }));
    }, HEARTBEAT_INTERVAL_MS);
  }

  /** The phone goes in a pocket: no more beats, so the room marks it away. */
  stopBeating(): void {
    if (this.beat !== undefined) clearInterval(this.beat);
    this.beat = undefined;
  }

  close(): void {
    this.stopBeating();
    this.socket.close();
  }
}
