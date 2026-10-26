export const LAN_PORT = 7777;

export type LanServerEvents = {
  onOpen(event: { readonly id: number; readonly remote?: string }): void;
  onMessage(event: { readonly id: number; readonly data: string }): void;
  onClose(event: { readonly id: number; readonly code: number; readonly reason: string }): void;
  onError(event: { readonly id?: number; readonly message: string }): void;
};

export type LanServer = {
  start(port: number): Promise<number>;
  send(id: number, data: string): void;
  close(id: number): void;
  stop(): Promise<void>;
  addresses(): string[];
  advertise(code: string, port: number): Promise<string>;
  stopAdvertising(): void;
};
