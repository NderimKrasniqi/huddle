import type { RoomRejection } from '@huddle/contracts/protocol';

export class Refusal {
  constructor(readonly rejection: RoomRejection) {}
}
