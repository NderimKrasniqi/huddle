/** TASK-02 spike: the LAN server seam, free of native imports. */
export const LAN_SPIKE_PORT = 7777;

export type LanServerEvents = {
  onOpen(event: { readonly id: number; readonly remote?: string }): void;
  onMessage(event: { readonly id: number; readonly data: string }): void;
  onClose(event: { readonly id: number; readonly code: number; readonly reason: string }): void;
  onError(event: { readonly id?: number; readonly message: string }): void;
};
