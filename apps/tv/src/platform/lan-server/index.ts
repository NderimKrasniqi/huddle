/**
 * The TV's LAN WebSocket server seam (ADR-02), free of native imports. The
 * room host's transport (TASK-12) drives it; phones connect to it over Wi-Fi.
 */

/** The port a TV asks for first; `start` falls back to any free port. */
export const LAN_PORT = 7777;

export type LanServerEvents = {
  onOpen(event: { readonly id: number; readonly remote?: string }): void;
  onMessage(event: { readonly id: number; readonly data: string }): void;
  onClose(event: { readonly id: number; readonly code: number; readonly reason: string }): void;
  onError(event: { readonly id?: number; readonly message: string }): void;
};

export type LanServer = {
  /** Listens on `port`, or any free port when it is taken; resolves the port in use. */
  start(port: number): Promise<number>;
  /** Sends one text frame to a connection; a closed connection drops it. */
  send(id: number, data: string): void;
  close(id: number): void;
  stop(): Promise<void>;
  /** IPv4 addresses, home-network ranges first. */
  addresses(): string[];
  /** Announces `Huddle-<code>` as `_huddle._tcp`, with code, port and hosts in TXT. */
  advertise(code: string, port: number): Promise<string>;
  stopAdvertising(): void;
};
